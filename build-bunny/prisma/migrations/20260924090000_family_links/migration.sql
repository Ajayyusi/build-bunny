-- Read-only family view (brief §6): teacher-shared private links, no parent
-- accounts. Only the token's SHA-256 hash is stored.
CREATE TABLE "FamilyLink" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyLink_tokenHash_key" ON "FamilyLink"("tokenHash");
CREATE INDEX "FamilyLink_schoolId_studentUserId_idx" ON "FamilyLink"("schoolId", "studentUserId");

ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
