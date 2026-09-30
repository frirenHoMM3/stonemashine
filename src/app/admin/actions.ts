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
import { pingIndexNow } from "@/lib/indexnow";

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
// Число пишут как угодно: «12 500», «12500 ₽», «12.500», «12 500,50 руб» — понимаем всё
function looseNumber(raw: string) {
  const v = raw.replace(/[\s\u00a0'’]/g, "").replace(/(₽|руб\.?|р\.?|rub|г\.?|год[а-я]*)$/i, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) return Number(v.replace(/[.,]/g, ""));
  if (/^\d+([.,]\d+)?$/.test(v)) return Math.round(Number(v.replace(",", ".")));
  return NaN;
}
const optInt = (min: number, max: number, hint: string) =>
  z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = looseNumber(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: hint });
      return z.NEVER;
    }
    return n;
  });

const ImageSchema = z.object({
  file: z.string().regex(/^[a-z0-9]+$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const SpecSchema = z.object({ k: z.string().trim().max(200), v: z.string().trim().max(2000) });
const SectionSchema = z.object({ t: z.string().trim().max(200), b: z.string().trim().max(20_000) });

const ProductSchema = z.object({
  title: z.string().trim().min(1, "Нужно название").max(300),
  slug: z.string().trim().max(120),
  // Любая ссылка — Авито, Дром, свой мессенджер. Только http(s): javascript: и прочее не пускаем
  avitoUrl: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v && !/^https?:\/\//i.test(v) && /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : v))
    .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Ссылка должна начинаться с http:// или https://")
    .transform((v) => v || null),
  sku: optStr(200),
  oem: optStr(500),
  brand: optStr(200),
  carMake: optStr(100),
  carModel: optStr(200),
  yearFrom: optInt(1900, 2100, "Год: 1900–2100"),
  yearTo: optInt(1900, 2100, "Год: 1900–2100"),
  price: optInt(0, 1_000_000_000, "Только число. Пояснение — в поле «к цене»"),
  oldPrice: optInt(0, 1_000_000_000, "Только число"),
  priceNote: optStr(120),
  condition: z.enum(CONDITIONS as [string, ...string[]]),
  conditionNote: optStr(120),
  categoryId: optStr(40),
  categoryNew: z.string().trim().max(60),
  description: optStr(50_000),
  inStock: z.boolean(),
  featured: z.boolean(),
  published: z.boolean(),
  images: z.array(ImageSchema).max(60, "Не больше 60 фото"),
  specs: z.array(SpecSchema).max(200),
  sections: z.array(SectionSchema).max(30),
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

async function uniqueCategorySlug(name: string) {
  const root = slugify(name) || "cat";
  for (let i = 0; i < 50; i++) {
    const candidate = i ? `${root}-${i + 1}` : root;
    if (!(await db.category.findUnique({ where: { slug: candidate } }))) return candidate;
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
    priceNote: fd.get("priceNote") ?? "",
    condition: fd.get("condition") ?? "USED",
    conditionNote: fd.get("conditionNote") ?? "",
    categoryId: fd.get("categoryId") ?? "",
    categoryNew: fd.get("categoryNew") ?? "",
    description: fd.get("description") ?? "",
    inStock: fd.get("inStock") === "on",
    featured: fd.get("featured") === "on",
    published: fd.get("published") === "on",
    images: parseJson(fd.get("images")),
    specs: parseJson(fd.get("specs")),
    sections: parseJson(fd.get("sections")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    return { error: "Проверьте поля формы", fieldErrors };
  }

  const { images, specs, sections, categoryNew, slug: rawSlug, ...data } = parsed.data;
  // Годы перепутали местами — просто меняем, а не ругаемся
  if (data.yearFrom && data.yearTo && data.yearFrom > data.yearTo) {
    [data.yearFrom, data.yearTo] = [data.yearTo, data.yearFrom];
  }
  // Новая категория прямо из карточки: находим по имени или создаём
  if (categoryNew) {
    const existing = await db.category.findFirst({ where: { name: { equals: categoryNew, mode: "insensitive" } } });
    const cat = existing ?? (await db.category.create({
      data: { name: categoryNew, slug: await uniqueCategorySlug(categoryNew) },
    }));
    data.categoryId = cat.id;
  } else if (data.categoryId && !(await db.category.findUnique({ where: { id: data.categoryId } }))) {
    data.categoryId = null;
  }

  const slug = await uniqueSlug(rawSlug || data.title, id ?? undefined);
  const cleanSpecs = specs.filter((s) => s.k || s.v);
  const cleanSections = sections.filter((x) => x.t || x.b);
  const imageRows = images.map((img, i) => ({ ...img, sortOrder: i }));

  let removedFiles: string[] = [];
  const oldSlug = id ? (await db.product.findUnique({ where: { id }, select: { slug: true } }))?.slug : null;
  try {
    if (id) {
      const old = await db.productImage.findMany({ where: { productId: id }, select: { file: true } });
      const keep = new Set(images.map((i) => i.file));
      removedFiles = old.map((o) => o.file).filter((f) => !keep.has(f));

      await db.$transaction([
        db.product.update({
          where: { id },
          data: { ...data, condition: data.condition as never, slug, specs: cleanSpecs, sections: cleanSections },
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
          sections: cleanSections,
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
  pingIndexNow([`/catalog/${slug}`, ...(oldSlug && oldSlug !== slug ? [`/catalog/${oldSlug}`] : []), "/catalog"]);
  const saved = encodeURIComponent(data.title);
  redirect(fd.get("next") === "new" ? `/admin/products/new?saved=${saved}` : `/admin/products?saved=${saved}`);
}

// «Удалить» кладёт в корзину: товар пропадает с сайта, но 30 дней его можно вернуть
export async function deleteProduct(fd: FormData) {
  await requireAdmin();
  await trash([String(fd.get("id"))]);
}

export async function restoreProduct(fd: FormData) {
  await requireAdmin();
  await db.product.updateMany({ where: { id: String(fd.get("id")) }, data: { deletedAt: null } });
  revalidatePath("/", "layout");
}

export async function purgeProduct(fd: FormData) {
  await requireAdmin();
  await purge([String(fd.get("id"))]);
}

async function trash(ids: string[]) {
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: { slug: true, published: true } });
  await db.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), published: false } });
  revalidatePath("/", "layout");
  pingIndexNow(rows.filter((r) => r.published).map((r) => `/catalog/${r.slug}`));
}

async function purge(ids: string[]) {
  const images = await db.productImage.findMany({ where: { productId: { in: ids } }, select: { file: true } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(images.map((i) => deleteImage(i.file)));
  revalidatePath("/", "layout");
}

export async function purgeExpiredTrash() {
  const old = await db.product.findMany({
    where: { deletedAt: { lt: new Date(Date.now() - 30 * 24 * 3600_000) } },
    select: { id: true },
  });
  if (old.length) await purge(old.map((o) => o.id));
}

const BULK = ["publish", "hide", "stock", "nostock", "trash", "restore", "purge", "category"] as const;

export async function bulkProducts(fd: FormData): Promise<void> {
  await requireAdmin();
  const action = String(fd.get("action")) as (typeof BULK)[number];
  let ids: string[] = [];
  try {
    ids = z.array(z.string().max(40)).max(500).parse(JSON.parse(String(fd.get("ids") ?? "[]")));
  } catch {
    return;
  }
  if (!ids.length || !BULK.includes(action)) return;

  const where = { id: { in: ids } };
  switch (action) {
    case "publish": await db.product.updateMany({ where: { ...where, deletedAt: null }, data: { published: true } }); break;
    case "hide": await db.product.updateMany({ where, data: { published: false } }); break;
    case "stock": await db.product.updateMany({ where, data: { inStock: true } }); break;
    case "nostock": await db.product.updateMany({ where, data: { inStock: false } }); break;
    case "trash": return trash(ids);
    case "restore": await db.product.updateMany({ where, data: { deletedAt: null } }); break;
    case "purge": return purge(ids);
    case "category": {
      const categoryId = String(fd.get("categoryId") ?? "") || null;
      if (categoryId && !(await db.category.findUnique({ where: { id: categoryId } }))) return;
      await db.product.updateMany({ where, data: { categoryId } });
      break;
    }
  }
  revalidatePath("/", "layout");
  if (action === "publish" || action === "hide" || action === "stock" || action === "nostock") {
    const rows = await db.product.findMany({ where, select: { slug: true } });
    pingIndexNow(rows.map((r) => `/catalog/${r.slug}`));
  }
}

export async function toggleProductFlag(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const flag = String(fd.get("flag"));
  if (!["published", "inStock", "featured"].includes(flag)) return;
  const p = await db.product.findUnique({ where: { id }, select: { published: true, inStock: true, featured: true } });
  if (!p) return;
  const key = flag as keyof typeof p;
  const updated = await db.product.update({ where: { id }, data: { [key]: !p[key] }, select: { slug: true } });
  revalidatePath("/", "layout");
  if (key !== "featured") pingIndexNow([`/catalog/${updated.slug}`]);
}

export async function duplicateProduct(fd: FormData) {
  await requireAdmin();
  const src = await db.product.findUnique({ where: { id: String(fd.get("id")) } });
  if (!src) return;
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, views: _v, specs, sections, ...rest } = src;
  // Фото не копируем: файлы общие, удаление одного товара снесло бы их у второго
  const copy = await db.product.create({
    data: {
      ...rest,
      specs: specs ?? [],
      sections: sections ?? [],
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
  if (!name) return { error: "Введите название" };

  const clash = await db.category.findFirst({ where: { name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
  if (clash) return { error: `Категория «${clash.name}» уже есть` };

  if (id) {
    // Адрес категории при переименовании не меняем — иначе сломаются ссылки из поисковиков
    await db.category.update({ where: { id }, data: { name } });
  } else {
    const last = await db.category.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.category.create({ data: { name, slug: await uniqueCategorySlug(name), sortOrder: (last?.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/", "layout");
  return { ok: id ? "Сохранено" : `«${name}» добавлена` };
}

export async function moveCategory(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const dir = Number(fd.get("dir")) < 0 ? -1 : 1;
  const all = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((c, k) => db.category.update({ where: { id: c.id }, data: { sortOrder: k } })));
  revalidatePath("/", "layout");
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
    if (key === "whatsapp" || key === "metrikaId") v = v.replace(/\D/g, "");
    // Вебмастер выдаёт готовый <meta ... content="КОД">: принимаем и тег целиком, и сам код
    if (key === "yandexVerification" || key === "googleVerification") {
      v = /content=["']([^"']+)["']/.exec(v)?.[1] ?? v;
      if (v && !/^[\w-]{6,100}$/.test(v)) fieldErrors[key] = "Вставьте код или meta-тег целиком";
    }
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
