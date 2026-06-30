// mime.ts — build a multipart/mixed RFC 2822 message with the proposal PDF attached. The existing
// Gmail send builder (connectors/gmail/actions/send) is text-only, so the Proposal Generator carries
// its own attachment-capable builder. createGmailDraft base64url-encodes the whole string for the API,
// so this returns the UNENCODED MIME (both parts base64-encoded inside it for UTF-8 + binary safety).

const BOUNDARY = "=_pa_proposal_boundary_=" // safe: both parts are base64, so neither contains this token

function wrapBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n")
}

function encodeHeaderWord(value: string): string {
  // RFC 2047 encode a header value if it has non-ASCII; plain ASCII passes through.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

/** Build the raw (unencoded) MIME message: a text body + a PDF attachment. */
export function buildProposalMime(params: {
  to: string
  fromEmail: string | null
  subject: string
  bodyText: string
  pdfBytes: Buffer
  pdfFilename: string
}): string {
  const textPart = Buffer.from(params.bodyText, "utf8").toString("base64")
  const pdfPart = params.pdfBytes.toString("base64")

  const headers = [
    params.fromEmail ? `From: ${params.fromEmail}` : null,
    `To: ${params.to}`,
    `Subject: ${encodeHeaderWord(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  ]
    .filter((h): h is string => h !== null)
    .join("\r\n")

  return [
    headers,
    "",
    `--${BOUNDARY}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(textPart),
    "",
    `--${BOUNDARY}`,
    `Content-Type: application/pdf; name="${params.pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${params.pdfFilename}"`,
    "",
    wrapBase64(pdfPart),
    "",
    `--${BOUNDARY}--`,
    "",
  ].join("\r\n")
}
