-- AlterTable
ALTER TABLE "Temple" ADD COLUMN     "about" TEXT,
ADD COLUMN     "contacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "phone3" TEXT;
