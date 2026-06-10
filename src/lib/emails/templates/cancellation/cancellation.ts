// lib/emails/templates/cancellation/* — the cancellation confirmation email (Part 5J). The save-flow
// itself is UI (/cancel); this is the transactional confirmation sent when the subscription is gone.

import { composeEmail, SITE_ORIGIN, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

export function cancellationConfirmation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    transactional: true,
    subject: "Your Pocket Agent subscription was canceled",
    blocks: [
      { kind: "p", text: "Your Pocket Agent subscription has been canceled." },
      {
        kind: "p",
        text: "If you canceled because you did not finish setup, the fastest path is still: Business Brain. Persona. Workflow. Mission Control.",
      },
      { kind: "p", text: "Generic AI starts from zero. Pocket Agent starts from your business." },
      { kind: "p", text: `You can restart anytime at: ${SITE_ORIGIN.replace("https://", "")}` },
      { kind: "button", label: "Restart Pocket Agent", href: LINKS.start },
    ],
  });
}
