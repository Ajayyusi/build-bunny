-- CreateEnum
CREATE TYPE "AttemptVerdict" AS ENUM ('PASS', 'PARTIAL', 'FAIL', 'ERROR');

-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('NORMAL', 'PREVIEW');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "weekStructure" JSONB;

-- CreateTable
CREATE TABLE "ActivityAttempt" (
    "id" TEXT NOT NULL,
    "attemptRunId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "levelVersion" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "kind" "AttemptKind" NOT NULL DEFAULT 'NORMAL',
    "workspaceJson" JSONB NOT NULL,
    "generatedCode" TEXT NOT NULL,
    "resultSummary" JSONB NOT NULL,
    "verdict" "AttemptVerdict" NOT NULL,
    "starsEarned" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "blockCount" INTEGER,
    "hintTierUsed" INTEGER NOT NULL DEFAULT 0,
    "clientVerdict" TEXT,
    "gradeMismatch" BOOLEAN NOT NULL DEFAULT false,
    "viaImpersonation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HintUsage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDailyActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudentDailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAttempt_attemptRunId_key" ON "ActivityAttempt"("attemptRunId");

-- CreateIndex
CREATE INDEX "ActivityAttempt_studentUserId_levelId_createdAt_idx" ON "ActivityAttempt"("studentUserId", "levelId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityAttempt_schoolId_createdAt_idx" ON "ActivityAttempt"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityAttempt_levelId_verdict_idx" ON "ActivityAttempt"("levelId", "verdict");

-- CreateIndex
CREATE INDEX "XpEvent_schoolId_createdAt_idx" ON "XpEvent"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpEvent_studentUserId_levelId_source_key" ON "XpEvent"("studentUserId", "levelId", "source");

-- CreateIndex
CREATE INDEX "HintUsage_schoolId_levelId_idx" ON "HintUsage"("schoolId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "HintUsage_studentUserId_levelId_tier_key" ON "HintUsage"("studentUserId", "levelId", "tier");

-- CreateIndex
CREATE INDEX "StudentDailyActivity_schoolId_date_idx" ON "StudentDailyActivity"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDailyActivity_studentUserId_date_key" ON "StudentDailyActivity"("studentUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE INDEX "StudentAchievement_schoolId_earnedAt_idx" ON "StudentAchievement"("schoolId", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentUserId_achievementId_key" ON "StudentAchievement"("studentUserId", "achievementId");

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintUsage" ADD CONSTRAINT "HintUsage_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDailyActivity" ADD CONSTRAINT "StudentDailyActivity_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
