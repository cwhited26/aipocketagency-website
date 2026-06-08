-- 030_chat_tool_call_card.sql — add the 'tool_call' inline-card kind (PA v5 connector bridge).
--
-- The chat-send route now runs a tool-use loop: when the agent fires a Connection (read inline,
-- write staged to the Approval Inbox) it appends an inline_card of kind 'tool_call' so the
-- tool-call activity renders in the home stream. This widens the card_kind CHECK to admit it.
--
-- Additive + non-destructive: the inline column CHECK (auto-named pa_chat_messages_card_kind_check
-- in migration 018) is dropped and re-added as a named constraint with the superset value list.
-- No data is touched; every previously-valid card_kind stays valid.

ALTER TABLE pa_chat_messages
  DROP CONSTRAINT IF EXISTS pa_chat_messages_card_kind_check;

ALTER TABLE pa_chat_messages
  ADD CONSTRAINT pa_chat_messages_card_kind_check
  CHECK (card_kind IS NULL OR card_kind IN (
    'memory_write', 'persona_invoke', 'doc_preview', 'voice_memo',
    'screenshot', 'sub_agent_activity', 'action_approval',
    'persona_response', 'tool_call'
  ));
