---
slug: modern-agency-mental-wellness
name: Modern Agency — Mental Wellness ("mėntality")
vibe: clean, soft, modern, wellness, approachable, premium-but-warm
industries: mental health, wellness, therapy, coaching, healthcare, education centers, patient resources
source: motionsites.ai (Modern Agency prompt — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Full viewport hero with a soft warm light-gray background (`#EDEEF5`), a glassmorphic top nav, a centered/left-aligned headline with a giant inline UI element (a pill-shaped "eye" element with a dot inside, set inline between words), and a centered "Search Pill" component with placeholder "Ask me anything..." plus a black circular action button. Background video sits BELOW the headline with a soft gradient fade into the page color, NOT as a fullscreen wash. The accent color is a single bright green (`#9fff00`) used ONLY for selection (selection highlight and selection text), not in the layout — which makes the page feel restrained and high-end.

## Page layout
Single-section hero designed around the inline UI element. The brand wordmark "mėntality" uses a special character (e with dot above), set in a display sans (Outfit). The hero text mixes a dark color (`#1a1a1a`) and a soft mid-gray (`#8e8e8e`) on the same line, calling out which words are emphasized. Architectural anchors at bottom-left and bottom-right ("2024", "mental health tools") give the page a magazine masthead feel without dominating.

## Typography
- Display: Outfit (Google Fonts) — for the wordmark and emphasis
- Body: Inter (Google Fonts) — global default, sets `--font-sans`
- Tracking: `tracking-wider` on small labels
- Headline mixes two colors mid-line — emphasizes selective words rather than the whole heading

## Color palette
- Background: `#EDEEF5` (warm off-white / light gray with a slight pink hint)
- Primary text: `#1a1a1a` (near-black)
- Secondary text: `#8e8e8e` (mid-gray for emphasis)
- Accent: `#9fff00` (electric green — used ONLY in text selection)
- Wrapper: `selection:bg-brand-green selection:text-black` — selection becomes part of the brand experience

## Visual motifs
- **Inline pill-shaped "eye" UI element** in the middle of a heading — `w-[16px] md:w-[42px] lg:w-[62px] border-[2px] border-[#1a1a1a] rounded-full inline-flex items-center justify-center` containing a tiny black dot (`w-2 h-2`). This is the standout visual — an interactive-looking inline component nested in the text.
- **Glassmorphic top navbar** with `bg-gradient-to-b from-[#f1f1f1]/80 to-transparent backdrop-blur-[2px]` — feels integrated, not floating
- **Mixed-color heading** where different words within the same line take different colors (dark + mid-gray)
- **Search pill component** as the primary CTA — input + black circular button, feels conversational (matches the "wellness" promise of "ask me anything")
- **Slide-up fade headline animation** (Framer Motion: `initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}`)
- **Animated hamburger** for mobile drawer (AnimatePresence + motion.div slides down)
- **Bottom-corner editorial anchors** ("2024" left, "mental health tools" right) — magazine masthead vibe
- **Selection accent** — green selection highlight is the only brand color in the layout, making any selected text feel branded

## When to use
- Mental health / therapy practices
- Wellness clinics, spas with a calm aesthetic
- Health coaches, life coaches
- Education centers, patient resource libraries
- Pediatric practices wanting to feel warm but professional
- Wellness-tech SaaS (meditation apps, sleep tracking, supplement brands)
- Any brand that wants to feel approachable, calm, premium WITHOUT feeling sterile

## When to NOT use
- Anything where bold/loud first impression matters (trades, gyms, e-commerce)
- Anything where conversion needs to happen in the first viewport — this is exploratory, not transactional
- Anywhere the color palette demands strong brand colors (the only color here is electric green in selection)
- Anyone whose audience finds the inline UI element gimmicky

## Reference source
motionsites.ai "Modern Agency" prompt — actually builds the "mėntality" brand. Title on the catalog is misleading: this is a mental-wellness aesthetic, not a generic agency direction. Extracted Jun 11 2026.

## Library cross-references
- Motif: `inline-ui-element-in-heading` (the pill-eye element)
- Motif: `mixed-color-headline-within-line`
- Motif: `glassmorphic-top-navbar`
- Motif: `selection-as-brand-accent`
- Motif: `search-pill-as-primary-cta`
- Typography: `inter-outfit-pairing`
- Color palette: `warm-off-white-electric-green-selection`
