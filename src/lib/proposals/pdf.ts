// pdf.ts — render proposal markdown to a PDF using the shipped headless-Chromium pool
// (lib/browser/playwright-pool — playwright-core + @sparticuz/chromium on Vercel). page.pdf() runs in
// Chromium's headless print path. A tiny, escape-first markdown→HTML converter handles the subset the
// generator emits (h1/h2/h3, bullet lists, bold, paragraphs, rules) — no third-party markdown dep.

import { runInPool } from "@/lib/browser/playwright-pool"

export type RenderResult = { ok: true; bytes: Buffer } | { ok: false; error: string }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function inline(text: string): string {
  // Escape first, then re-introduce bold. Order matters so a literal ** in content can't inject HTML.
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
}

/** Convert the proposal-markdown subset to body HTML. Deterministic + safe (everything is escaped). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n")
  const out: string[] = []
  let listOpen = false
  let paraBuf: string[] = []

  const flushPara = (): void => {
    if (paraBuf.length) {
      out.push(`<p>${inline(paraBuf.join(" "))}</p>`)
      paraBuf = []
    }
  }
  const closeList = (): void => {
    if (listOpen) {
      out.push("</ul>")
      listOpen = false
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "")
    if (line.trim() === "") {
      flushPara()
      closeList()
      continue
    }
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    const li = line.match(/^\s*[-*]\s+(.+)$/)
    const hr = /^\s*---+\s*$/.test(line)

    if (h2) {
      flushPara()
      closeList()
      out.push(`<h2>${inline(h2[1])}</h2>`)
    } else if (h3) {
      flushPara()
      closeList()
      out.push(`<h3>${inline(h3[1])}</h3>`)
    } else if (h1) {
      flushPara()
      closeList()
      out.push(`<h1>${inline(h1[1])}</h1>`)
    } else if (hr) {
      flushPara()
      closeList()
      out.push("<hr/>")
    } else if (li) {
      flushPara()
      if (!listOpen) {
        out.push("<ul>")
        listOpen = true
      }
      out.push(`<li>${inline(li[1])}</li>`)
    } else {
      closeList()
      paraBuf.push(line.trim())
    }
  }
  flushPara()
  closeList()
  return out.join("\n")
}

function wrapDocument(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { margin: 56px 56px 64px; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #11161c; font-size: 12.5px; line-height: 1.55; }
    h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: -0.01em; }
    h2 { font-size: 15px; margin: 22px 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #e2e8f0; color: #0f172a; }
    h3 { font-size: 13px; margin: 14px 0 4px; color: #334155; }
    p { margin: 0 0 9px; }
    ul { margin: 0 0 10px; padding-left: 20px; }
    li { margin: 0 0 4px; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
    strong { font-weight: 650; }
  </style></head><body>${bodyHtml}</body></html>`
}

/**
 * Render proposal markdown to PDF bytes. Never throws — a pool/launch/timeout failure returns
 * { ok:false, error }. Runs inside the shared concurrency-bounded pool with its own deadline.
 */
export async function renderProposalPdf(markdown: string): Promise<RenderResult> {
  const html = wrapDocument(markdownToHtml(markdown))
  const result = await runInPool(
    "proposal-pdf",
    async (page) => {
      await page.setContent(html, { waitUntil: "load" })
      return page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "56px", bottom: "64px", left: "56px", right: "56px" },
      })
    },
    { timeoutMs: 30_000 },
  )
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, bytes: result.value }
}
