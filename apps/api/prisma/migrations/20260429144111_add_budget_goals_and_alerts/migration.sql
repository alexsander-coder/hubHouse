-- CreateTable
CREATE TABLE "public"."BudgetGoal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "category" "public"."BudgetCategory" NOT NULL,
    "competenceMonth" TIMESTAMP(3) NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetGoal_householdId_competenceMonth_idx" ON "public"."BudgetGoal"("householdId", "competenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetGoal_householdId_category_competenceMonth_key" ON "public"."BudgetGoal"("householdId", "category", "competenceMonth");

-- AddForeignKey
ALTER TABLE "public"."BudgetGoal" ADD CONSTRAINT "BudgetGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BudgetGoal" ADD CONSTRAINT "BudgetGoal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
