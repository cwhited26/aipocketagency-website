---
slug: outpace-ai-sales-serif-gradient-hero
name: Outpace — AI Sales Agent / Serif + Radial Gradient Italic
vibe: polished, editorial-tech, light, premium, serif-led
industries: ai sales tools, sales automation, b2b SaaS, lead generation software, crm tools, outbound agencies, recruiting tech, marketing automation
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "EcoVolta V2" — misaligned; content is an AI sales-agent hero for brand "closer", best premium match uncertain; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Light, serif-led hero for an AI sales product, sitting on a streamed background video (HLS via hls.js, tuned to force the highest quality level once the manifest loads — the footage is treated as a first-class asset, not a backdrop). The headline is the whole show: "An AI that does your outbound while you close deals." set in Instrument Serif at 48px mobile / 70px desktop in near-black `#212121` — except the closing phrase "close deals." which switches to ITALIC and takes a radial gradient text fill running blue → sky → sage → sand → soft yellow (`#368CFB` → `#5CAEFE` → `#85BDE0` → `#AECDC2` → `#D6DCA3` → `#FFEB85`). The roman-to-italic pivot plus the blue-to-yellow gradient on the payoff words is the signature move.

The subheadline is one plain sentence in Manrope with its own subtle gradient (dark slate at 70% opacity, barely-there). The CTA is a small skeuomorphic dark button: 152x52px, rounded 12px, a `#444` → `#292929` gradient, black border, outer drop shadows plus inset white highlights top and left — a physical-feeling key on an otherwise flat page.

## Page layout
One hero screen. Nav floats 20px from the top inside a 1110px centered row: a 23px radial-gradient logo mark (same blue-to-yellow ramp) beside a lowercase serif wordmark, five Manrope nav links center (hidden on mobile), and a white bordered "Login" button right. Hero content centers absolutely, max-w-984px, slightly above true center. No sections below — the headline, one sentence, and one button carry the entire pitch.

## Typography
- Display: Instrument Serif (Google Fonts, regular + italic) — roman for the setup, italic for the gradient payoff phrase; 48-70px, 0.9 opacity
- Body: Manrope (Google Fonts, weights 400-600) — 18-20px subheadline with -0.4px tracking; Instrument Sans for button labels
- The serif wordmark at 26px doubles as the logotype

## Color palette
- Ink: near-black `#212121` on light video
- Headline gradient: radial `#368CFB` → `#5CAEFE` → `#85BDE0` → `#AECDC2` → `#D6DCA3` → `#FFEB85`
- Subheadline: slate `rgba(37,44,50,0.7)` → `rgba(55,65,74,0.7)` gradient clip
- CTA: `#444` → `#292929` gradient with inset white highlights
- Login button: white with `#dde2e4` border

## Visual motifs
- **Roman-to-italic gradient payoff** — the headline switches to italic serif on its final phrase and pours a blue-to-yellow radial gradient through just those words
- **Blue-to-yellow radial identity** — one gradient ramp shared by the headline accent and the logo mark, tying brand to message
- **Skeuomorphic dark key button** — a small gradient CTA with stacked outer shadows and inset white highlights that reads as a pressable object
- **Quality-forced streaming video** — HLS background tuned to lock the top quality level; the footage is meant to look expensive
- **Gradient-clipped subtext** — even the secondary sentence carries a faint two-stop gradient instead of flat gray
- **Serif lowercase wordmark** — the brand name set small in the display serif, no separate logotype style

## When to use
- AI sales, outbound, and lead-gen products pitching "it works while you don't"
- B2B SaaS that wants an editorial, expensive look instead of standard product-shot heroes
- Single-promise launch pages where one sentence is the entire pitch
- Brands with premium abstract or lifestyle footage
- Products naming a clear payoff ("close deals", "book meetings") that the italic gradient can spotlight

## When to NOT use
- Feature-comparison buyers — there is no product UI, no proof section, no detail
- Dark-theme brands; this direction depends on light footage under near-black type
- Phone-first local services (use `trades-phone-first-emergency`)
- Teams without streaming-grade video; a compressed MP4 undercuts the premium read

## Build complexity
LOW-MEDIUM. One screen and few elements, but the SVG radial gradient text fill, the layered button shadows, and the hls.js quality configuration each need exact reproduction to land the look.

## Library cross-references
- Motif: `italic-gradient-payoff-phrase`
- Motif: `radial-blue-yellow-identity`
- Motif: `skeuomorphic-dark-key-cta`
- Motif: `hls-quality-forced-video`
- Motif: `gradient-clipped-subtext`
- Typography: `instrument-serif-manrope-light`
- Color palette: `near-black-blue-yellow-radial`
