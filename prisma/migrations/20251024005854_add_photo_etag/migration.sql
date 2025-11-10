-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('pending', 'processed', 'error');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "etag" TEXT,
ADD COLUMN     "status" "PhotoStatus" NOT NULL DEFAULT 'pending';
