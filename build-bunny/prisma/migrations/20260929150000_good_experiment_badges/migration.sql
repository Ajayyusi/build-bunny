-- "Good experiment" badges (handoff: reward testing and reasoning, not
-- speed). Achievements are data; the seed doesn't run in production, so
-- they are added here. Idempotent: an existing slug is left alone.
INSERT INTO "Achievement" ("id", "slug", "name", "description", "icon", "criteria", "order") VALUES
  ('ach_curious_tester', 'curious-tester', '{"en":"Curious Tester","ar":"مختبِر فضولي"}'::jsonb, '{"en":"Test your AI 10 times: show its guesses, check a picture, give it the computer''s turn.","ar":"اختبر ذكاءك الاصطناعي 10 مرات: أظهر تخميناته، أو تحقّق من صورة، أو أعطِ الحاسوب دوره."}'::jsonb, '🔬', '{"type":"AI_TESTS","count":10}'::jsonb, 13),
  ('ach_try_check_try_again', 'try-check-try-again', '{"en":"Try, Check, Try Again","ar":"جرّب، تحقّق، جرّب من جديد"}'::jsonb, '{"en":"Finish an AI activity after a check that didn''t work — then do it twice more.","ar":"أنهِ نشاط ذكاء اصطناعي بعد تحقّق لم ينجح — ثم افعلها مرتين أخريين."}'::jsonb, '🔁', '{"type":"AI_COMEBACK","count":3}'::jsonb, 14),
  ('ach_honest_not_sure', 'honest-not-sure', '{"en":"Honest “Not Sure”","ar":"«لست متأكدًا» بصدق"}'::jsonb, '{"en":"Say “not enough evidence yet” or “can''t tell” when that''s the careful answer.","ar":"قل «لا يوجد دليل كافٍ بعد» أو «لا أستطيع أن أعرف» عندما تكون هذه هي الإجابة الحذرة."}'::jsonb, '🤔', '{"type":"SAID_NOT_SURE"}'::jsonb, 15)
ON CONFLICT ("slug") DO NOTHING;
