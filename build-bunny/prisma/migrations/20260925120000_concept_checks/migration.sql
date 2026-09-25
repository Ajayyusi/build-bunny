-- The one-tap "explain it" check after an Explore AI activity: three fixed
-- choices, never free text. First answer kept as the teacher's evidence.
-- CreateTable
CREATE TABLE "ConceptCheck" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "firstChoice" TEXT NOT NULL,
    "firstCorrect" BOOLEAN NOT NULL,
    "correctAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptCheck_schoolId_levelId_idx" ON "ConceptCheck"("schoolId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptCheck_studentUserId_levelId_key" ON "ConceptCheck"("studentUserId", "levelId");

-- AddForeignKey
ALTER TABLE "ConceptCheck" ADD CONSTRAINT "ConceptCheck_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptCheck" ADD CONSTRAINT "ConceptCheck_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptCheck" ADD CONSTRAINT "ConceptCheck_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

