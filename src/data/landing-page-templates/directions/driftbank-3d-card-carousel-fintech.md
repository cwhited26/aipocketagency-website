---
slug: driftbank-3d-card-carousel-fintech
name: Driftbank — 3D Card Carousel Fintech
vibe: dark, premium, kinetic, fintech, product-led
industries: fintech, neobanks, payment cards, credit unions, crypto wallets, financial apps, rewards programs, banking-as-a-service
source: motionsites.ai archive (catalog title "FinancialFocus", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single full-screen black hero where the product IS the animation: five bank cards at true credit-card ratio (1.59:1) orbit vertically through a 3D cylinder in the center of the screen, rendered with CSS `perspective: 1200px` and a hand-rolled 60fps requestAnimationFrame loop — no 3D library. Each card auto-advances upward on a slow continuous progress (`+0.0016` per frame) with a magnetic dwell ease (`sign(d) * (|d|*2)^4.2 / 2`) so the front card pauses face-on before accelerating to the next. Position is computed in three smoothstep zones: center card at translateZ 400 / 0° rotation, adjacent at Z 220 / 132° tilt, then a perspective-aware formula that parks the next card peeking 55px past the screen edge before it leaves entirely. The whole stack carries a constant -3° rotateZ, and the center card adds mouse-driven parallax tilt (up to 15° Y / 12° X) with lerp damping at 0.08.

Each card is physically thick: five stacked slices from -1.47px to +1.47px translateZ — a gray `#808080` core, a front face playing a looping product video with a metallic chip SVG, wordmark, and twin-circle logo, and a back face showing the same video blurred 16px behind a magnetic stripe and monospace card number / name / CVV. Headline sits bottom-left: "Get More" in a green `#00FF88` script face flowing into white Manrope semibold ("With Our Bank Cards – Easy, Secure, Rewarding"), with a right-aligned 50%-white supporting paragraph. A full-width wave line-art graphic sits behind the cards, and the header holds two white pill buttons (Order Card + hamburger) on the black field.

## Page layout
One viewport, no scroll — `overflow: hidden` on the body. Header overlays top (logo left, pill buttons right), headline block bottom-left (centered on mobile), partner logo bottom-right (hidden on mobile). Card size and all type scale fluidly from window width AND height via resize math (cards clamp 150-336px wide; type scales 0.48-1.0), so the composition holds from phone to ultrawide.

## Typography
- Display: Manrope (Google Fonts, weights 300-800) — headline semibold, tracking tight, line-height 1.1
- Body: Inter (Google Fonts) for UI; JetBrains Mono for card number, holder name, and CVV on card backs
- Accent: Mr Dafoe (Google Fonts cursive) — the script "Get More" in green, sized ~1.3x the headline

## Color palette
- Background: pure black `#000000`; card faces `#0f0f0f`
- Accent: `#00FF88` (the script words and nothing else)
- Card edge slices: `#808080`; borders `rgba(255,255,255,0.15)`
- Supporting text: `rgba(255,255,255,0.5)`; CTAs solid white pills with black text

## Visual motifs
- **Rotating card cylinder** — five physical-ratio bank cards orbit vertically in 3D, auto-advancing with a pause at front-center before each step
- **Cards with real thickness** — five stacked translateZ slices give each card a visible gray edge when it tilts, like an actual piece of plastic
- **Two-sided cards** — front face plays a looping video with chip and wordmark; back face shows blurred video, a magnetic stripe, and monospace card details
- **Mouse-tilt on the front card** — the centered card leans toward the cursor up to 15°, with damped easing back to rest
- **Script-plus-sans headline** — one green cursive phrase spliced into a white semibold sentence, the only color on the page
- **Line-art backdrop** — a full-width wave graphic sits behind the carousel, giving the black field depth without competing
- **White pill header buttons** — Order Card and a round menu button, full-radius, on bare black

## When to use
- Neobanks, card programs, and fintech apps where the card itself is the product
- Crypto wallets and rewards programs launching a physical or virtual card
- Any financial brand that wants one unforgettable hero instead of a long page
- Product reveals where a single object deserves a 360-degree look
- Dark-theme brands with strong motion appetite and good product renders or videos

## When to NOT use
- Multi-section marketing sites — this is one viewport with no scroll; bolt sections on and the spell breaks
- Traditional banks and advisors selling trust to older audiences — the kinetic dark look reads consumer-app
- Anyone without card artwork or product video — the carousel exposes placeholder assets brutally
- Content or SEO-driven plays — there is almost no copy on the page
- Low-powered device audiences — the 60fps transform loop with five video elements is heavy on old phones

## Build complexity
HIGH. The carousel is custom 3D math (smoothstep zones, perspective-aware edge parking, wrap-around offsets), plus volumetric card layering, mouse-tilt damping, and fluid size computation — all hand-rolled and all load-bearing.

## Library cross-references
- Motif: `rotating-3d-card-cylinder`
- Motif: `volumetric-card-thickness-slices`
- Motif: `two-sided-product-card`
- Motif: `mouse-tilt-parallax-center-object`
- Motif: `script-accent-inline-headline`
- Motif: `single-viewport-no-scroll-hero`
- Typography: `manrope-inter-jetbrains-mrdafoe`
- Color palette: `black-neon-green-white-pills`
