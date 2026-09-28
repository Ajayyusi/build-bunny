-- "Say it your way" (phrase ids only) and a teacher's "heard it explained
-- aloud" tick: the handoff's own-words explanation and teacher evidence.
CREATE TABLE "ExplanationSentence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "parts" TEXT[],
    "soundParts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExplanationSentence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExplanationSentence_studentUserId_levelId_key" ON "ExplanationSentence"("studentUserId", "levelId");
CREATE INDEX "ExplanationSentence_schoolId_levelId_idx" ON "ExplanationSentence"("schoolId", "levelId");
ALTER TABLE "ExplanationSentence" ADD CONSTRAINT "ExplanationSentence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplanationSentence" ADD CONSTRAINT "ExplanationSentence_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExplanationSentence" ADD CONSTRAINT "ExplanationSentence_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConceptObservation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "observedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConceptObservation_studentUserId_concept_key" ON "ConceptObservation"("studentUserId", "concept");
CREATE INDEX "ConceptObservation_schoolId_idx" ON "ConceptObservation"("schoolId");
ALTER TABLE "ConceptObservation" ADD CONSTRAINT "ConceptObservation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptObservation" ADD CONSTRAINT "ConceptObservation_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
