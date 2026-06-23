import type { Metadata } from "next";
import { LegalSection, LegalShell } from "../../_components/LegalShell";

const PAGE_URL = "https://capture.aipocketagent.com/privacy";

export const metadata: Metadata = {
  title: "Privacy — Pocket Capture",
  description:
    "How Pocket Capture handles what you capture: a private feed only you can see, no selling your data, download or delete any time.",
  metadataBase: new URL("https://capture.aipocketagent.com"),
  alternates: { canonical: PAGE_URL },
};

export default function PocketCapturePrivacy() {
  return (
    <LegalShell title="Privacy Policy" updated="June 23, 2026">
      <p>
        Pocket Capture is a product of Pocket Agent, built and run by Whited Consulting. This
        page explains what we collect, why, and what you control. Pocket Capture and Pocket
        Agent share the same backend, so your captures live in the same secure system Pocket
        Agent uses.
      </p>

      <LegalSection heading="What you capture is private">
        <p>
          Your captures land in a feed only you can see. There are no team accounts, no shared
          inboxes, and no public view. We do not read your captures to train models, and we do
          not sell or rent them to anyone.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <p>
          Your account email and the content you send through the four capture surfaces — Share
          Sheet, Voice Shortcut, Email Forward, and SMS — including any text, links, and
          attachments. We collect the minimum we need to run the service and bill the one-time
          charge.
        </p>
        <p>
          Payment is processed by Stripe. We never see or store your full card number. If you
          run ads-driven sign-ups, standard analytics pixels (TikTok, Meta) may record that you
          visited the landing page; they do not see your captures.
        </p>
      </LegalSection>

      <LegalSection heading="The capture surfaces">
        <p>
          Email forwards arrive through our inbound email provider and are stored with their
          attachments. SMS and MMS messages route through a telephony provider to reach your
          feed. Voice captures are transcribed to text; the text is saved, the audio file is
          not kept. We use these providers only to deliver your captures.
        </p>
      </LegalSection>

      <LegalSection heading="Your control">
        <p>
          Edit or delete any capture at any time. Deleting a capture removes it from your feed.
          Ask us to close your account and we delete your captures. If you upgrade to Pocket
          Agent, your captures move with you and become part of your business brain, which you
          can download in full whenever you want.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about your data? Email{" "}
          <a
            href="mailto:support@aipocketagent.com"
            className="text-cyan-300 hover:underline"
          >
            support@aipocketagent.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
