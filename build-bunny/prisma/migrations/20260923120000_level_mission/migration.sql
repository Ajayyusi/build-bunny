-- Child-facing mission line, separate from the teacher-facing learning
-- objective. Nullable: existing levels fall back to their objective.
ALTER TABLE "Level" ADD COLUMN "mission" JSONB;
