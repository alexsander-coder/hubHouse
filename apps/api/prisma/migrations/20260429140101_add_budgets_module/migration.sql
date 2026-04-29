-- CreateEnum
CREATE TYPE "public"."BudgetCategory" AS ENUM ('AGUA', 'LUZ', 'INTERNET', 'CONDOMINIO', 'ALUGUEL', 'GAS', 'SUPERMERCADO', 'OUTROS');

-- CreateTable
CREATE TABLE "public"."BudgetEntry" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "category" "public"."BudgetCategory" NOT NULL,
    "competenceMonth" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetEntry_householdId_competenceMonth_idx" ON "public"."BudgetEntry"("householdId", "competenceMonth");

-- CreateIndex
CREATE INDEX "BudgetEntry_category_idx" ON "public"."BudgetEntry"("category");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEntry_householdId_category_competenceMonth_key" ON "public"."BudgetEntry"("householdId", "category", "competenceMonth");

-- AddForeignKey
ALTER TABLE "public"."BudgetEntry" ADD CONSTRAINT "BudgetEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BudgetEntry" ADD CONSTRAINT "BudgetEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
