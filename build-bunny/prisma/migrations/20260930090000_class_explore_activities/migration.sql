-- Activity launch control: a teacher's Explore AI settings per class.
CREATE TABLE "ClassExploreActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "launchedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassExploreActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassExploreActivity_classId_slug_key" ON "ClassExploreActivity"("classId", "slug");
CREATE INDEX "ClassExploreActivity_schoolId_classId_idx" ON "ClassExploreActivity"("schoolId", "classId");

ALTER TABLE "ClassExploreActivity" ADD CONSTRAINT "ClassExploreActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassExploreActivity" ADD CONSTRAINT "ClassExploreActivity_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
