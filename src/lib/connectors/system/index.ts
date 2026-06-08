// lib/connectors/system — internal PA system-mail connector (connector.email.system_send).
// Re-exports the action + the three concrete triggers so call sites import from one place.

export {
  systemSend,
  SYSTEM_EMAIL_CONNECTOR,
  SYSTEM_SEND_ACTION,
  type SystemSendInput,
  type SystemSendResult,
} from "./actions/send";

export {
  notifyDailyBriefReady,
  notifyApprovalNeeded,
  notifyConnectionReauthNeeded,
  type NotifyResult,
} from "./notifications";
