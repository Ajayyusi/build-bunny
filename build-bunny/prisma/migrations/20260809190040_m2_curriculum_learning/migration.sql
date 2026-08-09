-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('BLOCK_CODING', 'CODE_PREDICTION', 'DEBUGGING', 'SEQUENCING', 'QUIZ', 'PATTERN_RECOGNITION', 'AI_CLASSIFICATION', 'REAL_ML', 'AI_ETHICS', 'CREATIVE_PROJECT', 'AI_SIM', 'CONCEPT_CARDS');

-- CreateEnum
CREATE TYPE "LearningTrack" AS ENUM ('PROGRAMMING', 'AI_CONCEPTS', 'MACHINE_LEARNING');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "programId" TEXT;

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "gradeMin" INTEGER NOT NULL,
    "gradeMax" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramWorld" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgramWorld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "tagline" JSONB,
    "theme" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "horizon" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "order" INTEGER NOT NULL,
    "unlockRule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "track" "LearningTrack" NOT NULL DEFAULT 'PROGRAMMING',
    "title" JSONB NOT NULL,
    "story" JSONB,
    "objective" JSONB,
    "instructions" JSONB,
    "explanation" JSONB,
    "teacherNotes" JSONB,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "recommendedGradeMin" INTEGER,
    "recommendedGradeMax" INTEGER,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
    "xpReward" INTEGER,
    "maxStars" INTEGER NOT NULL DEFAULT 3,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB NOT NULL,
    "hints" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersionId" TEXT,
    "arComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelVersion" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "LevelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelPrerequisite" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "requiresLevelId" TEXT NOT NULL,

    CONSTRAINT "LevelPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolProgram" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProgress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'UNLOCKED',
    "stars" INTEGER NOT NULL DEFAULT 0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "unlockSource" TEXT NOT NULL DEFAULT 'ORDER',
    "draftWorkspace" JSONB,
    "draftSavedAt" TIMESTAMP(3),
    "firstCompletedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "completedVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWorld_programId_worldId_key" ON "ProgramWorld"("programId", "worldId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWorld_programId_order_key" ON "ProgramWorld"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "World_slug_key" ON "World"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_worldId_slug_key" ON "Module"("worldId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_worldId_order_key" ON "Module"("worldId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Level_publishedVersionId_key" ON "Level"("publishedVersionId");

-- CreateIndex
CREATE INDEX "Level_status_idx" ON "Level"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Level_moduleId_slug_key" ON "Level"("moduleId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Level_moduleId_order_key" ON "Level"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LevelVersion_levelId_version_key" ON "LevelVersion"("levelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LevelPrerequisite_levelId_requiresLevelId_key" ON "LevelPrerequisite"("levelId", "requiresLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolProgram_schoolId_programId_key" ON "SchoolProgram"("schoolId", "programId");

-- CreateIndex
CREATE INDEX "StudentProgress_schoolId_levelId_idx" ON "StudentProgress"("schoolId", "levelId");

-- CreateIndex
CREATE INDEX "StudentProgress_studentUserId_status_idx" ON "StudentProgress"("studentUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgress_studentUserId_levelId_key" ON "StudentProgress"("studentUserId", "levelId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWorld" ADD CONSTRAINT "ProgramWorld_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWorld" ADD CONSTRAINT "ProgramWorld_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelVersion" ADD CONSTRAINT "LevelVersion_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelPrerequisite" ADD CONSTRAINT "LevelPrerequisite_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelPrerequisite" ADD CONSTRAINT "LevelPrerequisite_requiresLevelId_fkey" FOREIGN KEY ("requiresLevelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProgram" ADD CONSTRAINT "SchoolProgram_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProgram" ADD CONSTRAINT "SchoolProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
