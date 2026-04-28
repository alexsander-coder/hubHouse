-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storagePath" TEXT;
