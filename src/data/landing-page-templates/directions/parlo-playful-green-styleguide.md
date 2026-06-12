---
slug: parlo-playful-green-styleguide
name: Parlo — Playful Learning App / Green 3D-Button Styleguide
vibe: playful, chunky, rounded, bright, gamified
industries: language learning, education apps, kids products, gamified consumer apps, edtech, tutoring, habit apps, quiz and trivia products
source: motionsites.ai archive (catalog title "Duolingo Styleguide", free tier — apes a real language-app brand; placeholder brand and copy reference only the aesthetic — extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
This is a STYLEGUIDE page, not a marketing hero — a living design-system reference in the style of the big gamified language apps: chunky rounded everything, a loud mascot green, and buttons that physically press. The hero is a centered green-to-white gradient band: a lowercase display headline ("parlo design") in a fat rounded face at 52px in brand green, a one-paragraph description, and the two signature buttons — a green primary with a solid 4px darker-green shadow underneath ("GET STARTED") and an outlined secondary with a gray 3D shadow and blue text. On press, the shadow disappears and the button translates down 4px: the tactile push-button that defines the whole aesthetic.

## Page layout
A fixed white 64px navbar (logo, hairline divider, a letterspaced "STYLE GUIDE" label, anchor links with green hover states), then a 2-column panel grid at 1440px max: color palette (12 hoverable swatches with name + hex), a type ramp, light button variants (primary / secondary / danger / ghost, each with small and disabled states), dark-navy button panel, course cards with image headers and tag badges, dark-theme cards, a components panel (pill badges, input + subscribe row, toggles, animated progress bars, tooltip, a fire-emoji streak counter), and a dark components panel (flag-pill language selector, overlapping avatar group, dark progress bars and badges). Every panel carries an 11px letterspaced uppercase label with a rule extending right. Collapses to one column at 900px.

## Typography
- Display: Fredoka (substitute for the prompt's rounded Feather Bold face) — lowercase display headings in brand green, 28-52px
- Body: Nunito (Google Fonts, 400-900) — everything else; bold 700 for headings and buttons, heavy letterspaced uppercase for labels and button text

## Color palette
- Brand green `#58CC02`, hover `#4BB200`, button shadow `#61B800`
- Blue `#1CB0F6`, dark navy `#100F3E`
- Status set: red `#FF4B4B`, orange `#FF9600`, golden `#FFC800`
- Grays: text `#4B4B4B`, light `#777777`, label `#AFAFAF`, border `#E5E5E5`

## Visual motifs
- **Push-down 3D buttons** (the signature) — a solid 4px colored shadow below each button; on press the shadow vanishes and the button drops 4px, like a physical key
- **Lowercase chunky display type** — fat rounded letterforms in brand green, always lowercase
- **Pill badges in tinted fills** — status chips (COMPLETED / IN PROGRESS / STREAK) in their color at 12-15% background opacity
- **Hoverable swatch grid** — square color tiles that scale 1.05 with a soft shadow, name and hex below
- **Card lift hover** — 2px-bordered 16px-radius cards rising 4px with a wide soft shadow
- **Streak counter chip** — fire emoji + bold orange number in a tinted pill, the gamification tell
- **Flag-pill selector** — bordered pills with small flag images, active state in brand green
- **Side-by-side light/dark panels** — every component family shown on white and on dark navy

## When to use
- Language, tutoring, and quiz apps that want friendly, game-like energy
- Kids and family products — the chunky shapes and loud colors read safe and fun
- Habit and streak-based consumer apps
- Any client who needs a design SYSTEM page — this direction doubles as a component inventory the build can reuse
- Brands whose identity is one loud color plus a rounded typeface

## When to NOT use
- This is a styleguide layout, not a conversion page — pair it with a real landing direction for the actual site
- Premium, serious, or B2B brands — the toy-like buttons undercut gravity
- Editorial or photography-led brands (use `prisma-cinematic-cream-collective`)
- Anyone wanting subtlety — every element here is loud by design

## Build complexity
MEDIUM. No animation engineering, but a high volume of components — eight panels, light and dark variants, toggles, tooltips, and progress bars all need consistent spacing and states.

## Library cross-references
- Motif: `push-down-3d-shadow-buttons`
- Motif: `tinted-pill-status-badges`
- Motif: `hover-scale-swatch-grid`
- Motif: `card-lift-hover`
- Motif: `streak-counter-chip`
- Motif: `light-dark-panel-pairs`
- Typography: `fredoka-nunito-playful`
- Color palette: `mascot-green-navy-status-set`
