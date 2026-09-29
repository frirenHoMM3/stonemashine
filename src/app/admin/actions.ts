"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkCredentials, endSession, hashPassword, requireAdmin, startSession } from "@/lib/auth";
import { hit, reset } from "@/lib/rate-limit";
import { deleteImage } from "@/lib/uploads";
import { slugify } from "@/lib/slug";
import { CONDITIONS } from "@/lib/format";
import { SETTING_KEYS, type SettingKey } from "@/lib/settings";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/* ———————————— Вход / выход ———————————— */

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get("username") ?? "").trim().slice(0, 64);
  const password = String(fd.get("password") ?? "").slice(0, 256);
  const ip = await clientIp();

  const byIp = hit(`login:ip:${ip}`, 8, 15 * 60_000);
  const byUser = hit(`login:user:${username.toLowerCase()}`, 12, 15 * 60_000);
  if (!byIp.ok || !byUser.ok) {
    const min = Math.ceil(Math.max(byIp.retryAfter, byUser.retryAfter) / 60);
    return { error: `Слишком много попыток. Повторите через ${min} мин.` };
  }
  if (!username || !password) return { error: "Введите логин и пароль" };

  const user = await checkCredentials(username, password);
  if (!user) return { error: "Неверный логин или пароль" };

  reset(`login:ip:${ip}`);
  reset(`login:user:${username.toLowerCase()}`);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user.id, user.sessionEpoch);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const repeat = String(fd.get("repeat") ?? "");

  if (!(await checkCredentials(admin.username, current))) return { error: "Текущий пароль неверный" };
  if (next.length < 10) return { error: "Новый пароль — минимум 10 символов" };
  if (next !== repeat) return { error: "Пароли не совпадают" };

  // Повышаем epoch — все остальные сессии (другие браузеры) сразу вылетают
  const user = await db.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(next), sessionEpoch: { increment: 1 } },
  });
  await startSession(user.id, user.sessionEpoch);
  return { ok: "Пароль изменён. Остальные сессии завершены." };
}

export async function logoutEverywhere() {
  const admin = await requireAdmin();
  await db.adminUser.update({ where: { id: admin.id }, data: { sessionEpoch: { increment: 1 } } });
  await endSession();
  redirect("/admin/login");
}

/* ———————————— Товары ———————————— */

const optStr = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null);
const optInt = (min: number, max: number) =>
  z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/\s/g, ""));
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `Целое число ${min}–${max}` });
      return z.NEVER;
    }
    return n;
  });

const ImageSchema = z.object({
  file: z.string().regex(/^[a-z0-9]+$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const SpecSchema = z.object({ k: z.string().trim().max(80), v: z.string().trim().max(300) });

const ProductSchema = z.object({
  title: z.string().trim().min(3, "Минимум 3 символа").max(160),
  slug: z.string().trim().max(90),
  avitoUrl: z
    .string()
    .trim()
    .url("Нужна полная ссылка")
    .refine((u) => /^https:\/\/([a-z0-9-]+\.)*avito\.ru\//i.test(u), "Ссылка должна вести на avito.ru"),
  sku: optStr(80),
  oem: optStr(120),
  brand: optStr(80),
  carMake: optStr(60),
  carModel: optStr(80),
  yearFrom: optInt(1950, 2100),
  yearTo: optInt(1950, 2100),
  price: optInt(0, 100_000_000),
  oldPrice: optInt(0, 100_000_000),
  condition: z.enum(CONDITIONS as [string, ...string[]]),
  categoryId: optStr(40),
  description: optStr(10_000),
  inStock: z.boolean(),
  featured: z.boolean(),
  published: z.boolean(),
  images: z.array(ImageSchema).max(30, "Не больше 30 фото"),
  specs: z.array(SpecSchema).max(60),
});

function parseJson(v: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(v ?? "[]"));
  } catch {
    return [];
  }
}

async function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "tovar";
  for (let i = 0; i < 50; i++) {
    const candidate = i ? `${root}-${i + 1}` : root;
    const hit = await db.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit || hit.id === exceptId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveProduct(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = ProductSchema.safeParse({
    title: fd.get("title") ?? "",
    slug: fd.get("slug") ?? "",
    avitoUrl: fd.get("avitoUrl") ?? "",
    sku: fd.get("sku") ?? "",
    oem: fd.get("oem") ?? "",
    brand: fd.get("brand") ?? "",
    carMake: fd.get("carMake") ?? "",
    carModel: fd.get("carModel") ?? "",
    yearFrom: fd.get("yearFrom") ?? "",
    yearTo: fd.get("yearTo") ?? "",
    price: fd.get("price") ?? "",
    oldPrice: fd.get("oldPrice") ?? "",
    condition: fd.get("condition") ?? "USED",
    categoryId: fd.get("categoryId") ?? "",
    description: fd.get("description") ?? "",
    inStock: fd.get("inStock") === "on",
    featured: fd.get("featured") === "on",
    published: fd.get("published") === "on",
    images: parseJson(fd.get("images")),
    specs: parseJson(fd.get("specs")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    return { error: "Проверьте поля формы", fieldErrors };
  }

  const { images, specs, slug: rawSlug, ...data } = parsed.data;
  if (data.yearFrom && data.yearTo && data.yearFrom > data.yearTo) {
    return { error: "Проверьте поля формы", fieldErrors: { yearTo: "«По» меньше, чем «с»" } };
  }
  if (data.categoryId && !(await db.category.findUnique({ where: { id: data.categoryId } }))) {
    data.categoryId = null;
  }

  const slug = await uniqueSlug(rawSlug || data.title, id ?? undefined);
  const cleanSpecs = specs.filter((s) => s.k && s.v);
  const imageRows = images.map((img, i) => ({ ...img, sortOrder: i }));

  let removedFiles: string[] = [];
  try {
    if (id) {
      const old = await db.productImage.findMany({ where: { productId: id }, select: { file: true } });
      const keep = new Set(images.map((i) => i.file));
      removedFiles = old.map((o) => o.file).filter((f) => !keep.has(f));

      await db.$transaction([
        db.product.update({
          where: { id },
          data: { ...data, condition: data.condition as never, slug, specs: cleanSpecs },
        }),
        db.productImage.deleteMany({ where: { productId: id } }),
        db.productImage.createMany({ data: imageRows.map((r) => ({ ...r, productId: id })) }),
      ]);
    } else {
      await db.product.create({
        data: {
          ...data,
          condition: data.condition as never,
          slug,
          specs: cleanSpecs,
          images: { create: imageRows },
        },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Товар не найден — возможно, его уже удалили" };
    }
    throw e;
  }

  await Promise.all(removedFiles.map(deleteImage));
  revalidatePath("/", "layout");
  redirect(`/admin?saved=${encodeURIComponent(data.title)}`);
}

export async function deleteProduct(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const images = await db.productImage.findMany({ where: { productId: id }, select: { file: true } });
  await db.product.delete({ where: { id } }).catch(() => {});
  await Promise.all(images.map((i) => deleteImage(i.file)));
  revalidatePath("/", "layout");
}

export async function toggleProductFlag(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const flag = String(fd.get("flag"));
  if (!["published", "inStock", "featured"].includes(flag)) return;
  const p = await db.product.findUnique({ where: { id }, select: { published: true, inStock: true, featured: true } });
  if (!p) return;
  const key = flag as keyof typeof p;
  await db.product.update({ where: { id }, data: { [key]: !p[key] } });
  revalidatePath("/", "layout");
}

export async function duplicateProduct(fd: FormData) {
  await requireAdmin();
  const src = await db.product.findUnique({ where: { id: String(fd.get("id")) } });
  if (!src) return;
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, views: _v, specs, ...rest } = src;
  // Фото не копируем: файлы общие, удаление одного товара снесло бы их у второго
  const copy = await db.product.create({
    data: {
      ...rest,
      specs: specs ?? [],
      title: `${src.title} (копия)`,
      slug: await uniqueSlug(`${src.title}-kopiya`),
      published: false,
    },
  });
  redirect(`/admin/products/${copy.id}`);
}

/* ———————————— Категории ———————————— */

export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(fd.get("id") ?? "") || null;
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const sortOrder = Number(fd.get("sortOrder") ?? 0) || 0;
  if (name.length < 2) return { error: "Название — минимум 2 символа" };

  let slug = slugify(String(fd.get("slug") ?? "") || name) || "cat";
  const clash = await db.category.findUnique({ where: { slug } });
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  if (id) await db.category.update({ where: { id }, data: { name, slug, sortOrder } });
  else await db.category.create({ data: { name, slug, sortOrder } });
  revalidatePath("/", "layout");
  return { ok: id ? "Сохранено" : `Категория «${name}» добавлена` };
}

export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  await db.category.delete({ where: { id: String(fd.get("id")) } }).catch(() => {});
  revalidatePath("/", "layout");
}

/* ———————————— Настройки ———————————— */

const URL_KEYS: SettingKey[] = ["avitoProfile"];

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const fieldErrors: Record<string, string> = {};
  const values: [SettingKey, string][] = [];

  for (const key of Object.keys(SETTING_KEYS) as SettingKey[]) {
    let v = String(fd.get(key) ?? "").trim().slice(0, key === "about" ? 4000 : 300);
    if (key === "telegram") v = v.replace(/^@|^https?:\/\/t\.me\//, "");
    if (key === "whatsapp") v = v.replace(/\D/g, "");
    if (key === "shopName" && !v) fieldErrors[key] = "Не может быть пустым";
    if (v && URL_KEYS.includes(key) && !/^https:\/\//.test(v)) fieldErrors[key] = "Нужна ссылка, начинающаяся с https://";
    if (key === "telegram" && v && !/^[A-Za-z0-9_]{4,32}$/.test(v)) fieldErrors[key] = "Только username, например stonemachine_parts";
    values.push([key, v]);
  }
  if (Object.keys(fieldErrors).length) return { error: "Проверьте поля", fieldErrors };

  await db.$transaction(
    values.map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
  revalidatePath("/", "layout");
  return { ok: "Настройки сохранены" };
}
