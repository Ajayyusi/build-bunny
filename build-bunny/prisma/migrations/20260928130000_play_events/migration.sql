-- Analytics for start, test and retry (the handoff's P0 analytics):
-- a start on every session of a level, in-level AI tests (including ones
-- that happen in the browser) and retries.
ALTER TYPE "LearningEventType" ADD VALUE 'LEVEL_SESSION_STARTED';
ALTER TYPE "LearningEventType" ADD VALUE 'AI_TEST';
ALTER TYPE "LearningEventType" ADD VALUE 'AI_RETRY';
