-- 034_vision_ocr.sql — image upload + Claude vision OCR for the Ask box (Agent chat).
--
-- Two additive, non-destructive changes:
--
-- 1. pa_vision_log — one row per OCR attempt against an uploaded image/PDF, success OR failure.
--    It's the structured log: a failed extraction still writes a row (ok=false + error) instead of
--    a silent catch, and the token/cost columns let us see what vision is costing per owner.
--
-- 2. pocket_agent_messages.metadata — a nullable jsonb the chat message rows use to carry an
--    inline upload card ({ kind:'upload_result', caption, files:[...] }). The agent still reads the
--    OCR text from the message's `content`; metadata only drives the rich render in the Ask box.
--    Existing rows keep metadata = NULL and render exactly as before.

CREATE TABLE IF NOT EXISTS pa_vision_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid,
  file_url          text,
  prompt_tokens     int,
  completion_tokens int,
  cost_usd          numeric(10, 4),
  -- ok=false rows are the structured error log (graceful OCR failure); error holds the reason.
  ok                boolean NOT NULL DEFAULT true,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_vision_log_user_id_idx ON pa_vision_log (user_id, created_at DESC);

ALTER TABLE pocket_agent_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;
