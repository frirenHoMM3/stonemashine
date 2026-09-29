// Демо-данные для локальной разработки: npm run db:seed
// На проде не запускается. Картинки генерируются заглушками.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const DIR = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");

async function fakeImage(label: string, hue: number) {
  await mkdir(DIR, { recursive: true });
  const file = `${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},8%,22%)"/><stop offset="1" stop-color="hsl(${hue},6%,9%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="800" cy="600" r="330" fill="none" stroke="hsl(${hue},4%,38%)" stroke-width="60"/>
    <circle cx="800" cy="600" r="120" fill="hsl(${hue},4%,30%)"/>
    <text x="60" y="1140" font-family="monospace" font-size="54" fill="#d8231c">${label}</text></svg>`;
  for (const [size, w] of [["lg", 1600], ["sm", 640]] as const) {
    const buf = await sharp(Buffer.from(svg)).resize(w).webp({ quality: 80 }).toBuffer();
    await writeFile(path.join(DIR, `${file}-${size}.webp`), buf);
  }
  return { file, width: 1600, height: 1200 };
}

async function main() {
  if ((await db.product.count()) > 0) return console.log("Товары уже есть — сид пропущен");

  const cats = await Promise.all(
    ["Двигатель", "Подвеска", "Кузов", "Оптика", "Трансмиссия", "Электрика"].map((name, i) =>
      db.category.create({ data: { name, slug: ["dvigatel", "podveska", "kuzov", "optika", "transmissiya", "elektrika"][i], sortOrder: i } }),
    ),
  );
  const rows = [
    ["Двигатель 2AR-FE 2.5 в сборе", 0, "Toyota", "Camry XV50", 2011, 2017, 185000, "CONTRACT", "19000-36380"],
    ["Стойка амортизатора передняя левая", 1, "BMW", "5 F10", 2010, 2016, 14500, "USED", "31316796309"],
    ["Капот алюминиевый", 2, "Audi", "A6 C7", 2011, 2018, 32000, "USED", "4G0823029"],
    ["Фара передняя правая LED Matrix", 3, "Mercedes-Benz", "E W213", 2016, 2020, 89000, "USED", "A2139069906"],
    ["АКПП 8HP50 xDrive", 4, "BMW", "X5 G05", 2018, 2023, 240000, "CONTRACT", "24008497880"],
    ["Генератор 150A", 5, "Volkswagen", "Tiguan II", 2016, 2022, 16900, "REFURBISHED", "04E903023K"],
    ["Рычаг передний нижний", 1, "Toyota", "RAV4 XA50", 2019, 2024, 7800, "NEW", "48068-42080"],
    ["Турбина 1.4 TSI", 0, "Skoda", "Octavia A7", 2013, 2019, 38500, "REFURBISHED", "04E145721B"],
  ] as const;

  for (const [i, [title, c, make, model, y1, y2, price, cond, oem]] of rows.entries()) {
    const imgs = [await fakeImage(oem, i * 40), await fakeImage(`${oem} / 2`, i * 40 + 20)];
    await db.product.create({
      data: {
        title, slug: `demo-${i + 1}`, carMake: make, carModel: model, yearFrom: y1, yearTo: y2,
        price, oldPrice: i % 3 === 0 ? Math.round(price * 1.15) : null, condition: cond, oem, sku: `SM-${1000 + i}`,
        avitoUrl: "https://www.avito.ru/", categoryId: cats[c].id, featured: i < 2, inStock: i !== 5,
        description: "Снято с автомобиля с небольшим пробегом.\nВизуально без повреждений, все крепления целые.\nПеред отправкой — проверка и фото по запросу.",
        specs: [{ k: "Пробег", v: "64 000 км" }, { k: "Сторона установки", v: "Левая" }, { k: "Гарантия", v: "14 дней на установку" }],
        images: { create: imgs.map((im, k) => ({ ...im, sortOrder: k })) },
      },
    });
  }
  console.log("✔ Демо-данные созданы");
}

main().finally(() => db.$disconnect());
