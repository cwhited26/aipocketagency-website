import { permanentRedirect } from "next/navigation";

// Capture routing moved into the unified Captures Dashboard settings when the Capture Inbox App was
// retired. This route stays only as a permanent redirect (308 — Next's permanent-redirect status) so
// existing links and bookmarks land on the relocated section; the hash scrolls to it in-page.
export default function CaptureRoutingRedirectPage() {
  permanentRedirect("/app/captures/settings#routing-rules");
}
