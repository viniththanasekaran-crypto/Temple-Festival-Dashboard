-- AlterTable
ALTER TABLE "FestivalAgenda" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "_TempleToUser" ADD CONSTRAINT "_TempleToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_TempleToUser_AB_unique";
