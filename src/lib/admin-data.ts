import "server-only";
import { db } from "./db";

export async function productFormLookups() {
  const [categories, makes, models] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.product.findMany({ where: { carMake: { not: null } }, distinct: ["carMake"], select: { carMake: true }, orderBy: { carMake: "asc" } }),
    db.product.findMany({ where: { carModel: { not: null } }, distinct: ["carModel"], select: { carModel: true }, orderBy: { carModel: "asc" } }),
  ]);
  return {
    categories,
    makes: makes.map((m) => m.carMake!),
    models: models.map((m) => m.carModel!),
  };
}
