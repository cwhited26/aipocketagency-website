import { permanentRedirect } from "next/navigation";

// The Capture Inbox App was retired — its captures now live in the unified Captures Dashboard and its
// routing rules moved into Captures settings. This route stays as a permanent redirect (308) so old
// App links and the onboarding emails that point here land on the routing-rules section.
export default function CaptureInboxAppRedirectPage() {
  permanentRedirect("/app/captures/settings#routing-rules");
}
