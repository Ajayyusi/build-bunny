-- World story: the opening cutscene, the friend the child meets, and the
-- Power earned at the finale (docs/build-bunny/STORY.md). Nullable so worlds
-- authored before the story shipped keep importing.
ALTER TABLE "World" ADD COLUMN "story" JSONB;
ALTER TABLE "World" ADD COLUMN "character" JSONB;
ALTER TABLE "World" ADD COLUMN "power" JSONB;
