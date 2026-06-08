import { permanentRedirect } from "next/navigation";

// The Inbox became Mission Control (PA-MC-1). This route is kept only as a permanent (308)
// redirect so existing links, bookmarks, and the connector approval-email deep links don't break.
export default function InboxRedirectPage() {
  permanentRedirect("/app/mission-control");
}
