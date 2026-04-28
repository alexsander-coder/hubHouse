-- CreateEnum
CREATE TYPE "public"."DocumentCategory" AS ENUM ('IDENTIDADE', 'SAUDE', 'ESCOLA', 'FINANCEIRO', 'IMOVEL', 'OUTROS');

-- CreateTable
CREATE TABLE "public"."Document" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerMemberId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "public"."DocumentCategory" NOT NULL,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_householdId_idx" ON "public"."Document"("householdId");

-- CreateIndex
CREATE INDEX "Document_ownerMemberId_idx" ON "public"."Document"("ownerMemberId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "public"."Document"("category");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "public"."Document"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "public"."HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
