import type { Metadata } from "next";
import { LegalSection, LegalShell } from "../../_components/LegalShell";

const PAGE_URL = "https://capture.aipocketagent.com/terms";

export const metadata: Metadata = {
  title: "Terms — Pocket Capture",
  description:
    "The terms for Pocket Capture: a $47 one-time purchase, a 30-day money-back guarantee, and what you can expect from the service.",
  metadataBase: new URL("https://capture.aipocketagent.com"),
  alternates: { canonical: PAGE_URL },
};

export default function PocketCaptureTerms() {
  return (
    <LegalShell title="Terms of Service" updated="June 23, 2026">
      <p>
        Pocket Capture is a product of Pocket Agent, built and run by Whited Consulting. By
        buying or using Pocket Capture, you agree to these terms. Plain language, no surprises.
      </p>

      <LegalSection heading="What you're buying">
        <p>
          Pocket Capture is a $47 one-time purchase, not a subscription. You pay once and the
          product is yours — four capture surfaces (Share Sheet, Voice Shortcut, Email Forward,
          SMS) and a private feed with search and tags. There is no recurring charge and nothing
          to cancel.
        </p>
      </LegalSection>

      <LegalSection heading="30-day money-back guarantee">
        <p>
          If Pocket Capture isn’t for you, email us within 30 days of your purchase and we
          refund the full $47. No form to fill out, no reason required. Reach us at{" "}
          <a
            href="mailto:support@aipocketagent.com"
            className="text-cyan-300 hover:underline"
          >
            support@aipocketagent.com
          </a>
          . After a refund, your account and captures are closed.
        </p>
      </LegalSection>

      <LegalSection heading="Your account and your content">
        <p>
          You’re responsible for what you capture and for keeping your sign-in secure. Don’t use
          Pocket Capture for anything illegal or to store content you don’t have the right to
          keep. You own your captures; we store and display them back to you and don’t claim any
          rights to them.
        </p>
      </LegalSection>

      <LegalSection heading="Upgrading to Pocket Agent">
        <p>
          You can upgrade to Pocket Agent at any time. Pocket Agent is a separate paid
          subscription with its own terms. When you upgrade, your Pocket Capture feed comes with
          you and Pocket Capture rides along as part of your plan.
        </p>
      </LegalSection>

      <LegalSection heading="The service as-is">
        <p>
          We run Pocket Capture on the same backend as Pocket Agent and work to keep it up and
          your captures safe. The service is provided as-is, and we aren’t liable for indirect
          or consequential damages. If a capture surface depends on a third party — email,
          telephony, your phone’s operating system — its availability can affect delivery.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We may update these terms; the date at the top reflects the latest version. Questions?
          Email{" "}
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
