// AI Pocket Agency — Kit PDF Template
// Shared across all $15 kit deliverables.
// Brand: ink #05070a body, cyan #22d3ee accent, indigo #6366f1 secondary.

#let ink = rgb("#0b1118")
#let muted = rgb("#475569")
#let accent = rgb("#0891b2")
#let accent-soft = rgb("#22d3ee")
#let indigo = rgb("#4338ca")
#let rule = rgb("#cbd5e1")
#let code-bg = rgb("#f1f5f9")
#let code-ink = rgb("#0f172a")
#let cover-bg = rgb("#05070a")
#let cover-ink = rgb("#e6edf3")
#let cover-accent = rgb("#22d3ee")

#let mono = ("JetBrains Mono", "SF Mono", "Menlo", "Consolas", "monospace")
#let sans = ("Inter", "Helvetica Neue", "Arial", "sans-serif")

#let kit(
  title: "Kit Title",
  subtitle: "AI Pocket Agency",
  kit-number: "01",
  kit-tag: "[ apa · kit ]",
  pages: "8 pages",
  author: "Chase Whited",
  date: "2026-05-12",
  body
) = {
  set document(title: title, author: author)
  set text(font: sans, size: 10.5pt, fill: ink, lang: "en")
  set par(justify: false, leading: 0.7em)

  // ─── COVER PAGE ───────────────────────────────────────────────
  page(
    paper: "us-letter",
    margin: 0pt,
    fill: cover-bg,
    background: {
      // grid backdrop
      place(top + left, dx: 0pt, dy: 0pt, rect(
        width: 100%,
        height: 100%,
        fill: cover-bg,
      ))
      // radial glow (approximated via overlay)
      place(top + center, dy: -50pt, circle(
        radius: 280pt,
        fill: gradient.radial(
          rgb(34, 211, 238, 50),
          rgb(34, 211, 238, 0),
        ),
      ))
      place(top + right, dx: 50pt, dy: 120pt, circle(
        radius: 180pt,
        fill: gradient.radial(
          rgb(99, 102, 241, 45),
          rgb(99, 102, 241, 0),
        ),
      ))
    },
  )[
    #set text(fill: cover-ink)
    #pad(top: 80pt, x: 56pt)[
      // Wordmark
      #text(
        font: mono,
        size: 9pt,
        fill: cover-accent,
        tracking: 1pt,
      )[A I  P O C K E T  A G E N C Y]
      #v(8pt)
      #text(font: mono, size: 8pt, fill: rgb("#94a3b8"))[
        aipocketagency.com
      ]
    ]

    #v(1fr)

    #pad(x: 56pt)[
      // Kit tag
      #text(font: mono, size: 10pt, fill: rgb("#67e8f9"))[
        #kit-tag
      ]
      #v(20pt)

      // Title
      #text(
        size: 44pt,
        weight: 800,
        fill: cover-ink,
        tracking: -1pt,
      )[#title]

      #v(12pt)

      // Subtitle / blurb
      #text(size: 15pt, fill: rgb("#cbd5e1"), weight: 400)[
        #subtitle
      ]
    ]

    #v(1fr)

    #pad(x: 56pt, bottom: 60pt)[
      #line(length: 100%, stroke: 0.5pt + rgb("#22d3ee44"))
      #v(14pt)
      #grid(
        columns: (1fr, 1fr, 1fr),
        gutter: 12pt,
        [
          #text(font: mono, size: 7.5pt, fill: rgb("#64748b"), tracking: 1pt)[KIT]
          #v(2pt)
          #text(font: mono, size: 10pt, fill: cover-accent)[#kit-number / 05]
        ],
        [
          #text(font: mono, size: 7.5pt, fill: rgb("#64748b"), tracking: 1pt)[PRICE]
          #v(2pt)
          #text(font: mono, size: 10pt, fill: cover-accent)[\$15 USD]
        ],
        [
          #text(font: mono, size: 7.5pt, fill: rgb("#64748b"), tracking: 1pt)[FORMAT]
          #v(2pt)
          #text(font: mono, size: 10pt, fill: cover-accent)[#pages]
        ],
      )
      #v(18pt)
      #text(size: 9pt, fill: rgb("#94a3b8"))[
        #author · #date
      ]
    ]
  ]

  // ─── BODY PAGES ───────────────────────────────────────────────
  set page(
    paper: "us-letter",
    margin: (top: 60pt, bottom: 64pt, x: 72pt),
    fill: white,
    header: context {
      let page-num = counter(page).get().first()
      if page-num > 1 {
        grid(
          columns: (1fr, auto),
          align: (left + horizon, right + horizon),
          [
            #text(font: mono, size: 7.5pt, fill: muted, tracking: 0.8pt)[
              AIPOCKETAGENCY · #upper(title)
            ]
          ],
          [
            #text(font: mono, size: 7.5pt, fill: accent)[
              #kit-tag
            ]
          ],
        )
        v(-4pt)
        line(length: 100%, stroke: 0.4pt + rule)
      }
    },
    footer: context {
      let page-num = counter(page).get().first()
      if page-num > 1 {
        line(length: 100%, stroke: 0.4pt + rule)
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
            #text(font: mono, size: 8pt, weight: 600, fill: accent)[
              · #page-num ·
            ]
          ],
          [
            #text(font: mono, size: 7.5pt, fill: muted)[
              \$15 · Chase Whited
            ]
          ],
        )
      }
    },
  )

  // Heading styles
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(8pt)
    block[
      #text(font: mono, size: 8pt, fill: accent, tracking: 1.2pt)[
        SECTION #counter(heading).display()
      ]
      #v(6pt)
      #text(size: 24pt, weight: 800, fill: ink, tracking: -0.5pt)[#it.body]
      #v(2pt)
      #line(length: 56pt, stroke: 2pt + accent)
    ]
    v(14pt)
  }
  show heading.where(level: 2): it => {
    v(12pt)
    block[
      #text(size: 15pt, weight: 700, fill: ink)[#it.body]
    ]
    v(2pt)
  }
  show heading.where(level: 3): it => {
    v(8pt)
    block[
      #text(font: mono, size: 9.5pt, weight: 600, fill: accent, tracking: 0.6pt)[
        #upper(it.body)
      ]
    ]
    v(2pt)
  }

  // Code blocks
  show raw.where(block: true): it => {
    block(
      width: 100%,
      fill: code-bg,
      inset: (x: 14pt, y: 12pt),
      radius: 6pt,
      stroke: 0.5pt + rule,
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

  // Links
  show link: it => {
    text(fill: accent, weight: 500)[#it]
  }

  // Lists
  set list(indent: 12pt, body-indent: 6pt, marker: ([›], [—]))
  set enum(indent: 12pt, body-indent: 6pt)

  set heading(numbering: "1.")
  counter(heading).update(0)
  counter(page).update(1)

  body
}

#let toc-page(entries) = {
  pagebreak(weak: true)
  text(font: mono, size: 9pt, fill: accent, tracking: 1.2pt)[
    TABLE OF CONTENTS
  ]
  v(6pt)
  line(length: 56pt, stroke: 2pt + accent)
  v(20pt)
  for (num, title, page) in entries {
    block(below: 14pt)[
      #grid(
        columns: (32pt, 1fr, auto),
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

#let callout(label: "NOTE", body) = {
  block(
    width: 100%,
    fill: rgb("#f0f9ff"),
    inset: (x: 16pt, y: 12pt),
    radius: 4pt,
    stroke: (left: 3pt + accent),
    [
      #text(font: mono, size: 8pt, fill: accent, tracking: 1pt, weight: 600)[
        #upper(label)
      ]
      #v(4pt)
      #body
    ],
  )
}

#let lede(body) = {
  block(below: 14pt)[
    #text(size: 13pt, fill: rgb("#1e293b"), weight: 400, style: "normal")[
      #body
    ]
  ]
}

#let kvtable(rows) = {
  block(below: 12pt)[
    #table(
      columns: (90pt, 1fr),
      stroke: none,
      inset: (x: 0pt, y: 5pt),
      align: (left + top, left + top),
      ..rows.map(row => (
        text(font: mono, size: 8.5pt, fill: muted, tracking: 0.8pt)[
          #upper(row.at(0))
        ],
        text(size: 10pt, fill: ink)[#row.at(1)],
      )).flatten()
    )
  ]
}
