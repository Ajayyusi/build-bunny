-- Grade modes for the AI activities (handoff P1): a child's mode follows
-- their grade unless a teacher or the child chose one. Null = follow grade.
CREATE TYPE "AiMode" AS ENUM ('YOUNGER', 'OLDER');
ALTER TABLE "StudentProfile" ADD COLUMN "aiMode" "AiMode";
