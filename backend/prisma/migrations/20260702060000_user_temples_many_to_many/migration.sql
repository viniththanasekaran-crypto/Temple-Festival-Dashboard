-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_templeId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "templeId";

-- CreateTable
CREATE TABLE "_TempleToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TempleToUser_AB_unique" ON "_TempleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_TempleToUser_B_index" ON "_TempleToUser"("B");

-- AddForeignKey
ALTER TABLE "_TempleToUser" ADD CONSTRAINT "_TempleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Temple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TempleToUser" ADD CONSTRAINT "_TempleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
