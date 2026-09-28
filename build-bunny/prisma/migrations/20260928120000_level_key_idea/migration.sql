-- One-sentence "big idea" shown first on a level's result (the handoff's
-- "one short explanation"); the long explanation stays behind "Tell me more".
ALTER TABLE "Level" ADD COLUMN "keyIdea" JSONB;
