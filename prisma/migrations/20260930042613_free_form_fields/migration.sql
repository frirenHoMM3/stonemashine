-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "conditionNote" TEXT,
ADD COLUMN     "priceNote" TEXT,
ADD COLUMN     "sections" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "avitoUrl" DROP NOT NULL;
