-- The weekly family email (brief §6): one address per child, added by a
-- teacher, used only after the family confirms it from that inbox.
-- CreateTable
CREATE TABLE "FamilyEmail" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviteSentAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),

    CONSTRAINT "FamilyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyEmail_studentUserId_key" ON "FamilyEmail"("studentUserId");

-- CreateIndex
CREATE INDEX "FamilyEmail_schoolId_idx" ON "FamilyEmail"("schoolId");

-- AddForeignKey
ALTER TABLE "FamilyEmail" ADD CONSTRAINT "FamilyEmail_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEmail" ADD CONSTRAINT "FamilyEmail_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEmail" ADD CONSTRAINT "FamilyEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

