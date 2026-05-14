// AI Pocket Agency — Ebook / Lead Magnet Template
// For free guide content. Same brand as kit.typ but without price/kit-number metadata.
// Brand: dark cover #05070a, cyan #22d3ee accent, indigo #6366f1 secondary.

#let ink = rgb("#0b1118")
#let muted = rgb("#475569")
#let accent = rgb("#0891b2")
#let accent-soft = rgb("#22d3ee")
#let indigo = rgb("#4338ca")
#let rule-color = rgb("#cbd5e1")
#let code-bg = rgb("#f1f5f9")
#let code-ink = rgb("#0f172a")
#let cover-bg = rgb("#05070a")
#let cover-ink = rgb("#e6edf3")
#let cover-accent = rgb("#22d3ee")
#let pullquote-bg = rgb("#f0f9ff")
#let pullquote-border = rgb("#0891b2")

#let mono = ("JetBrains Mono", "SF Mono", "Menlo", "Consolas", "monospace")
#let sans = ("Inter", "Helvetica Neue", "Arial", "sans-serif")

#let ebook(
  title: "Ebook Title",
  subtitle: "Subtitle",
  tag: "[ apa · free guide ]",
  pages: "12 pages",
  author: "Chase Whited",
  date: "2026-05-14",
  body
) = {
  set document(title: title, author: author)
  set text(font: sans, size: 10.5pt, fill: ink, lang: "en")
  set par(justify: false, leading: 0.75em)

  // ─── COVER PAGE ───────────────────────────────────────────────
  page(
    paper: "us-letter",
    margin: 0pt,
    fill: cover-bg,
    background: {
      // deep background
      place(top + left, dx: 0pt, dy: 0pt, rect(
        width: 100%,
        height: 100%,
        fill: cover-bg,
      ))
      // top-center glow (cyan)
      place(top + center, dy: -30pt, circle(
        radius: 300pt,
        fill: gradient.radial(
          rgb(34, 211, 238, 45),
          rgb(34, 211, 238, 0),
        ),
      ))
      // upper-right glow (indigo)
      place(top + right, dx: 60pt, dy: 100pt, circle(
        radius: 200pt,
        fill: gradient.radial(
          rgb(99, 102, 241, 40),
          rgb(99, 102, 241, 0),
        ),
      ))
      // lower-left ambient
      place(bottom + left, dx: -40pt, dy: 40pt, circle(
        radius: 160pt,
        fill: gradient.radial(
          rgb(34, 211, 238, 20),
          rgb(34, 211, 238, 0),
        ),
      ))
    },
  )[
    #set text(fill: cover-ink)

    // ─── TOP WORDMARK ─────────────────────────────────────────
    #pad(top: 72pt, x: 60pt)[
      #text(
        font: mono,
        size: 9pt,
        fill: cover-accent,
        tracking: 1.2pt,
        weight: 600,
      )[A I  P O C K E T  A G E N C Y]
      #v(6pt)
      #text(font: mono, size: 8pt, fill: rgb("#64748b"))[
        aipocketagency.com
      ]
    ]

    #v(1fr)

    // ─── MAIN CONTENT ─────────────────────────────────────────
    #pad(x: 60pt)[
      // Tag
      #text(font: mono, size: 10.5pt, fill: rgb("#67e8f9"), tracking: 0.5pt)[
        #tag
      ]
      #v(22pt)

      // Title — large, tight
      #text(
        size: 38pt,
        weight: 800,
        fill: cover-ink,
        tracking: -0.8pt,
      )[#title]

      #v(16pt)

      // Subtitle
      #text(size: 14pt, fill: rgb("#94a3b8"), weight: 400, style: "italic")[
        #subtitle
      ]

      #v(20pt)

      // Horizontal rule with cyan accent
      #line(length: 80pt, stroke: 2pt + cover-accent)
    ]

    #v(1fr)

    // ─── COVER FOOTER ─────────────────────────────────────────
    #pad(x: 60pt, bottom: 56pt)[
      #line(length: 100%, stroke: 0.5pt + rgb("#22d3ee33"))
      #v(16pt)
      #grid(
        columns: (1fr, 1fr, 1fr),
        gutter: 12pt,
        [
          #text(font: mono, size: 7pt, fill: rgb("#475569"), tracking: 1pt)[FORMAT]
          #v(3pt)
          #text(font: mono, size: 9.5pt, fill: cover-accent)[FREE GUIDE]
        ],
        [
          #text(font: mono, size: 7pt, fill: rgb("#475569"), tracking: 1pt)[LENGTH]
          #v(3pt)
          #text(font: mono, size: 9.5pt, fill: cover-accent)[#pages]
        ],
        [
          #text(font: mono, size: 7pt, fill: rgb("#475569"), tracking: 1pt)[PUBLISHED]
          #v(3pt)
          #text(font: mono, size: 9.5pt, fill: cover-accent)[#date]
        ],
      )
      #v(18pt)
      #text(size: 9pt, fill: rgb("#64748b"))[
        #author · AI Pocket Agency
      ]
    ]
  ]

  // ─── BODY PAGES ───────────────────────────────────────────────
  set page(
    paper: "us-letter",
    margin: (top: 58pt, bottom: 62pt, x: 70pt),
    fill: white,
    header: context {
      let page-num = counter(page).get().first()
      if page-num > 1 {
        grid(
          columns: (1fr, auto),
          align: (left + horizon, right + horizon),
          [
            #text(font: mono, size: 7.5pt, fill: muted, tracking: 0.8pt)[
              AIPOCKETAGENCY · FREE GUIDE
            ]
          ],
          [
            #text(font: mono, size: 7.5pt, fill: accent, tracking: 0.5pt)[
              #tag
            ]
          ],
        )
        v(-4pt)
        line(length: 100%, stroke: 0.4pt + rule-color)
      }
    },
    footer: context {
      let page-num = counter(page).get().first()
      if page-num > 1 {
        line(length: 100%, stroke: 0.4pt + rule-color)
        v(-2pt)
        grid(
          columns: (1fr, auto, 1fr),
          align: (left + horizon, center + horizon, right + horizon),
          [
            #text(font: mono, size: 7.5pt, fill: muted)[
              aipocketagency.com
            ]
          ],
          [
            #text(font: mono, size: 8.5pt, weight: 600, fill: accent)[
              · #page-num ·
            ]
          ],
          [
            #text(font: mono, size: 7.5pt, fill: muted)[
              Chase Whited
            ]
          ],
        )
      }
    },
  )

  // ─── HEADING STYLES ───────────────────────────────────────────
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(6pt)
    block[
      #text(font: mono, size: 8pt, fill: accent, tracking: 1.4pt)[
        SECTION #counter(heading).display()
      ]
      #v(7pt)
      #text(size: 23pt, weight: 800, fill: ink, tracking: -0.3pt)[#it.body]
      #v(3pt)
      #line(length: 52pt, stroke: 2pt + accent)
    ]
    v(14pt)
  }

  show heading.where(level: 2): it => {
    v(14pt)
    block[
      #text(size: 15pt, weight: 700, fill: ink)[#it.body]
    ]
    v(3pt)
  }

  show heading.where(level: 3): it => {
    v(10pt)
    block[
      #text(font: mono, size: 9pt, weight: 600, fill: accent, tracking: 0.8pt)[
        #upper(it.body)
      ]
    ]
    v(3pt)
  }

  // ─── CODE ─────────────────────────────────────────────────────
  show raw.where(block: true): it => {
    block(
      width: 100%,
      fill: code-bg,
      inset: (x: 14pt, y: 12pt),
      radius: 6pt,
      stroke: 0.5pt + rule-color,
      [
        #set text(font: mono, size: 9pt, fill: code-ink)
        #it
      ],
    )
  }
  show raw.where(block: false): it => {
    box(
      fill: code-bg,
      inset: (x: 4pt, y: 1pt),
      outset: (y: 2pt),
      radius: 2pt,
      [
        #set text(font: mono, size: 9.5pt, fill: code-ink)
        #it
      ],
    )
  }

  // ─── LINKS ────────────────────────────────────────────────────
  show link: it => {
    text(fill: accent, weight: 500)[#it]
  }

  // ─── LISTS ────────────────────────────────────────────────────
  set list(indent: 12pt, body-indent: 6pt, marker: ([›], [—]))
  set enum(indent: 12pt, body-indent: 6pt)

  set heading(numbering: "1.")
  counter(heading).update(0)
  counter(page).update(1)

  body
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────

#let toc-page(entries) = {
  pagebreak(weak: true)
  text(font: mono, size: 9pt, fill: accent, tracking: 1.4pt)[
    TABLE OF CONTENTS
  ]
  v(6pt)
  line(length: 52pt, stroke: 2pt + accent)
  v(22pt)
  for (num, title, page) in entries {
    block(below: 14pt)[
      #grid(
        columns: (30pt, 1fr, auto),
        align: (left, left, right),
        gutter: 10pt,
        [
          #text(font: mono, size: 10pt, fill: accent, weight: 600)[#num]
        ],
        [
          #text(size: 13pt, weight: 600, fill: ink)[#title]
        ],
        [
          #text(font: mono, size: 10pt, fill: muted)[p.#page]
        ],
      )
    ]
  }
}

#let lede(body) = {
  block(below: 16pt)[
    #text(size: 13pt, fill: rgb("#1e293b"), weight: 400)[
      #body
    ]
  ]
}

#let callout(label: "NOTE", body) = {
  block(
    width: 100%,
    fill: rgb("#f0f9ff"),
    inset: (x: 16pt, y: 13pt),
    radius: 4pt,
    stroke: (left: 3pt + rgb("#0891b2")),
    [
      #text(font: mono, size: 7.5pt, fill: rgb("#0891b2"), tracking: 1.2pt, weight: 600)[
        #upper(label)
      ]
      #v(5pt)
      #body
    ],
  )
}

#let pullquote(body) = {
  block(
    width: 100%,
    fill: rgb("#f8fafc"),
    inset: (x: 20pt, y: 16pt),
    radius: 4pt,
    stroke: (left: 4pt + rgb("#22d3ee")),
    [
      #set text(size: 13pt, fill: rgb("#0f172a"), weight: 600, style: "italic")
      #body
    ],
  )
}
