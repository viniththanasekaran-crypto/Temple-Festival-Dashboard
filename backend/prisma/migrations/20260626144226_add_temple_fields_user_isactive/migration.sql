-- AlterTable
ALTER TABLE "Temple" ADD COLUMN     "deity" TEXT,
ADD COLUMN     "village" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;
