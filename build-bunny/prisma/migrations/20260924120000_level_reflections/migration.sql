-- How a level felt to the child (brief §6): one tap, no free text.
CREATE TYPE "ReflectionFeeling" AS ENUM ('EASY', 'JUST_RIGHT', 'TRICKY');

CREATE TABLE "LevelReflection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "feeling" "ReflectionFeeling" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelReflection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LevelReflection_studentUserId_levelId_key" ON "LevelReflection"("studentUserId", "levelId");
CREATE INDEX "LevelReflection_schoolId_levelId_idx" ON "LevelReflection"("schoolId", "levelId");

ALTER TABLE "LevelReflection" ADD CONSTRAINT "LevelReflection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LevelReflection" ADD CONSTRAINT "LevelReflection_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LevelReflection" ADD CONSTRAINT "LevelReflection_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
