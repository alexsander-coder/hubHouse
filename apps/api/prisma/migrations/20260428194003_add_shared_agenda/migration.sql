-- CreateEnum
CREATE TYPE "public"."EventCategory" AS ENUM ('CASA', 'SAUDE', 'ESCOLA', 'FINANCEIRO', 'PESSOAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "public"."EventRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerMemberId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."EventCategory" NOT NULL,
    "recurrence" "public"."EventRecurrence" NOT NULL DEFAULT 'NONE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_householdId_idx" ON "public"."Event"("householdId");

-- CreateIndex
CREATE INDEX "Event_ownerMemberId_idx" ON "public"."Event"("ownerMemberId");

-- CreateIndex
CREATE INDEX "Event_category_idx" ON "public"."Event"("category");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "public"."Event"("startsAt");

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "public"."HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
