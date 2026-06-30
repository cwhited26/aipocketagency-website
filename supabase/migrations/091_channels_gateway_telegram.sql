-- 091_channels_gateway_telegram.sql — Channels Gateway Phase 2 (Telegram) (PA-CHAN-1).
--
-- Phase 2 adds the Telegram adapter on top of the Phase 1 (Slack) gateway. It reuses the existing
-- two tables verbatim — pa_channel_connections + pa_channel_messages (migration 074) — and adds NO new
-- tables and NO new columns:
--
--   • A Telegram connection is one pa_channel_connections row with channel_slug = 'telegram',
--     external_id = 'tg:<botId>' (the BotFather bot id), auth_token_encrypted = the bot token, and
--     config carrying { botId, botUsername, webhookSecretEncrypted }. The per-connection webhook
--     secret rides ENCRYPTED inside config (lib/crypto/encrypt) — no schema change needed for it.
--
-- channel_slug is unconstrained `text` (074 deliberately ships no CHECK / enum — PA-CHAN spec §10),
-- so 'telegram' is already a legal value: there is literally no enum to widen. This migration is the
-- additive enablement record for Phase 2 — it refreshes the column comments so the schema documents
-- Telegram as a live channel rather than a "Phase 2+" reservation. It is idempotent and safe to
-- re-run.

COMMENT ON COLUMN pa_channel_connections.channel_slug IS
  'Channels Gateway channel: ''slack'' (Phase 1) | ''telegram'' (Phase 2, live) | (queued) ''sms'' | ''imessage'' | ''whatsapp'' | ''web_widget''. Unconstrained text by design (PA-CHAN spec §10); app-level validation is isChannelSlug() in lib/channels/types.ts.';

COMMENT ON COLUMN pa_channel_connections.external_id IS
  'The paired external identity. Slack: "<team_id>:<user_id>". Telegram: "tg:<botId>" (the BotFather bot id). Phone channels: the E.164 number. UNIQUE with channel_slug — the inbound webhook''s owner-resolve key.';

COMMENT ON COLUMN pa_channel_connections.auth_token_encrypted IS
  'AES-256-GCM envelope (lib/crypto/encrypt.ts). Slack: the bot token. Telegram: the BotFather bot token. The Telegram per-connection webhook secret is stored separately, also encrypted, inside config.webhookSecretEncrypted.';
