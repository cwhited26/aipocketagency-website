# Pocket Capture — Email Inbound DNS & Resend setup (PC-CORE-2)

This is the one-time DNS + Resend configuration that turns on the Email Forward capture surface.
Code ships independently; **email won't flow until these records are live and the webhook secret is
set.** Chase owns this step (DNS + secret minting); the app code is already deployed.

The forwarding address each user gets is `<slug>@capture.aipocketagent.com`. Everything below
configures that subdomain to deliver inbound mail to Resend, and Resend to POST it to our webhook.

---

## 1. Receiving subdomain

We use the dedicated subdomain **`capture.aipocketagent.com`** (locked in the SPEC, PA-CAPTURE-1).
Keep it separate from the existing `inbound.aipocketagent.com` / `bcc.aipocketagent.com` subdomains —
those route to a different feature (the email assistant) and a different webhook + secret.

## 2. Add the domain to Resend (Inbound)

1. Resend dashboard → **Domains → Add Domain** → `capture.aipocketagent.com`.
2. Enable **Inbound** on that domain (Resend → Inbound / Receiving).
3. Resend shows the exact records to add. They are of the form below — **use the values Resend
   shows you**, not these placeholders, in case Resend's infra hostnames change.

## 3. DNS records on `capture.aipocketagent.com`

Add these at the DNS provider for `aipocketagent.com`.

### MX (required — routes inbound mail to Resend)

| Type | Name (host)                  | Priority | Value                          |
|------|------------------------------|----------|--------------------------------|
| MX   | `capture` (→ capture.aipocketagent.com) | 10 | `inbound.resend.com` (use the host Resend shows) |

> Only one MX record on this subdomain. If a wildcard or parent MX exists, make sure the
> `capture` subdomain's MX points at Resend specifically.

### SPF (required — authorizes Resend to handle mail for the subdomain)

| Type | Name      | Value                                   |
|------|-----------|-----------------------------------------|
| TXT  | `capture` | `v=spf1 include:amazonses.com ~all` (use the include Resend shows) |

### DKIM (required — Resend publishes the exact CNAME/TXT records)

Resend generates per-domain DKIM records (typically a `resend._domainkey` CNAME, or several). Add
exactly what the Resend dashboard lists for `capture.aipocketagent.com`.

### DMARC (recommended)

| Type | Name              | Value                                                        |
|------|-------------------|--------------------------------------------------------------|
| TXT  | `_dmarc.capture`  | `v=DMARC1; p=none; rua=mailto:dmarc@aipocketagent.com`       |

Verify all records show **green / Verified** in Resend before moving on.

## 4. Configure the inbound webhook

1. Resend → **Webhooks / Inbound** → add an endpoint pointing at:

   ```
   https://aipocketagent.com/api/webhooks/resend-inbound
   ```

   (Use the production host the PA app is served from.)

2. Subscribe it to the **inbound email** event for `capture.aipocketagent.com`.
3. Copy the endpoint's **Signing Secret** (a `whsec_…` value — Resend signs inbound webhooks via Svix).
4. Set it on Vercel (Production + Preview):

   ```
   RESEND_INBOUND_WEBHOOK_SECRET = whsec_…
   ```

   This is a **new, separate** secret from `RESEND_INBOUND_SIGNING_SECRET` (that one belongs to the
   `inbound`/`bcc` email-assistant endpoint). The capture endpoint fails closed (HTTP 500) until this
   is set, so no unsigned mail is ever processed.

## 5. Attachment storage (no manual step)

Attachments are staged in the private Supabase Storage bucket **`pocket-capture`**, created
automatically on first use by the webhook (idempotent). Object paths are
`pocket-capture/<owner_id>/<capture_id>/<filename>`. Override the bucket name with
`PA_POCKET_CAPTURE_BUCKET` if needed. No DNS or manual provisioning required.

## 6. Smoke test

1. Sign in as a Pocket Capture user, hit `GET /api/app/pocket-capture/inbound-config` to provision +
   read your address (`<slug>@capture.aipocketagent.com`).
2. Forward any email to that address.
3. Confirm: a new entry appears in your Capture Inbox (`memory/inbox.md`, tagged
   `source: "email_forward"`), and a row lands in `pa_pocket_capture_email_inbound_log` with
   `processed = true`.
4. Forward the same message again → Resend redelivery is deduped (no second capture; the second
   delivery short-circuits on the `dedup_key` unique index).

## 7. Notes / gotchas

- **Unknown slug** (mail to a `<slug>@capture…` that no user owns) is audited with a null `owner_id`
  and acknowledged 200 — Resend won't retry a permanently-bad recipient.
- **No brain connected**: a matched user who hasn't connected a brain repo gets an audit row with
  `error_text` and a 200 (we don't retry a persistent state). Their captures begin flowing once they
  connect a brain.
- The webhook returns non-2xx **only** for its own transient faults (missing secret, a GitHub commit
  blip), so Resend's retry can recover; on a commit blip the claim row is released so the retry
  re-captures.
