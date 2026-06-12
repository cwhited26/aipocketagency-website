---
slug: medara-healthcare-ai-chat-input-hero
name: Medara — Healthcare AI Chat-Input Hero
vibe: clean, clinical, serif-led, calm, product-forward
industries: healthcare ai, telehealth, preventive medicine, wellness platforms, medical saas, health analytics, concierge medicine, digital clinics
source: motionsites.ai archive (catalog title "Vitara", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A healthcare AI landing page whose hero centerpiece is a working-looking CHAT INPUT BOX — the page sells the product by putting its interface front and center. Above it, a full-screen background video (object-position bottom, autoplay/loop/muted) with a 32px gradient at the foot fading into the page's dark green `#2B3534`. The headline ("Smart Care Begins with Data + Insight", 4xl mobile to 7xl desktop) and subheading both animate in word by word: each word fades up 20px over 0.6s with a 0.1s stagger, so the copy types itself onto the screen.

The input box is a max-w-xl centered card in `#2B3534` with 2xl rounded corners and a deep shadow. Inside: a transparent textarea with a welcome placeholder, a horizontal row of three pill action chips with icons ("Start Wellness Check" / "Chat with MedAI" / "View Insights" — 15%-white borders, hover fill at 10% white, horizontally scrollable with a right-edge fade), and a white send button. It reads like the product, not like a marketing form.

The nav is plain white: wordmark left in semibold gray-900, five gray-600 links center (desktop only), Login text link plus a gray-800 "Sign up" button right.

## Page layout
Two sections. Hero (video + headline + input box) then a full-width `#2B3534` statement band: two-column grid with a large white Inria Serif heading left ("Your proactive shield against disease") and a right-aligned body paragraph in gray-300, both running the same word-by-word fade-up. Single column on mobile. Padding scales px-6 → px-12 → px-20.

## Typography
- Display: Inria Serif (Google Fonts, weights 300/400/700) — all headings, with tight `-0.07em` letter-spacing
- Body: Helvetica Neue (system stack; Inter is the closest Google substitute)
- Headline scale: text-4xl mobile / 6xl tablet / 7xl desktop

## Color palette
- Primary dark: deep green-slate `#2B3534` (input card, second section, bottom video fade)
- Nav text: gray-900 `#111827` on white
- Secondary text: gray-600 / gray-300 on dark
- Buttons: gray-800 fill with white text; white send button with gray-800 icon
- Chips: white borders at 15% opacity, hover white at 10%

## Visual motifs
- **Chat input box as the hero CTA** — textarea, icon action chips, and a send button styled like the live product; visitors "use" the app before signing up
- **Word-by-word fade-up copy** — every heading and paragraph animates in one word at a time (0.1s stagger, 0.6s ease-out)
- **Video fading into the section below** — a 32px gradient at the video's foot dissolves into the dark green band, stitching hero and statement together
- **Scrollable action chips with edge fade** — the three pill buttons scroll horizontally with a hidden scrollbar and a right-side fade gradient
- **Serif-on-clinical pairing** — Inria Serif headings over a neutral sans body keeps it warm without losing the medical tone
- **White utility nav** — plain white bar with quiet gray links; the drama stays in the hero

## When to use
- Healthcare AI products, telehealth platforms, and digital clinics
- Wellness and preventive-medicine brands that lead with data
- Any health product where showing the chat interface sells better than describing it
- Medical SaaS that wants to feel calm and premium rather than startup-loud
- Concierge or membership medicine with a sign-up flow

## When to NOT use
- Brick-and-mortar practices that need location, hours, and booking up top (use `medspa-booking-calendar-first`)
- Products without a chat or AI interface — the input-box hero would be a false promise
- Brands without calm, high-quality footage; the video sits behind white text with no overlay
- Emergency or urgent-care services where speed-to-phone matters more than mood

## Build complexity
LOW — the AnimatedText word-splitter and the input card are two small components; everything else is standard two-section layout.

## Library cross-references
- Motif: `chat-input-box-hero`
- Motif: `word-by-word-fade-up-copy`
- Motif: `video-gradient-stitch-to-section`
- Motif: `scrollable-pill-chips-edge-fade`
- Typography: `inria-serif-tight-tracking`
- Color palette: `deep-green-slate-white-clinical`
