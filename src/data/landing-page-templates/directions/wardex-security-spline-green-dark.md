---
slug: wardex-security-spline-green-dark
name: Wardex AI — Dark Charcoal Security 3D
vibe: dark, technical, vivid-green, confident, minimal
industries: security systems, surveillance, access control, cybersecurity, smart building tech, alarm companies, it services, facility management
source: motionsites.ai archive (catalog title "Sentinel AI", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen dark hero for a security systems company with an embedded interactive Spline 3D scene as the entire background (lazy-loaded via React.lazy + Suspense with a flat dark fallback, under a `bg-black/30` overlay). Content anchors bottom-left: the brand name at `clamp(3rem, 8vw, 6rem)` bold uppercase with tracking -0.05em — "WARDEX" in near-white, " AI" in vivid green — over a one-line promise ("We implement security correctly."), a plain-spoken description paragraph, two CTAs ("Book a Call" green-filled, "Our Work" white-filled, both small-radius with active scale-down), and a quiet trust line ("Trusted security partner. Columbus, OH. 12 systems deployed."). Every element enters with a fade-up that also unblurs (translateY 20px + blur 4px → 0) on a `cubic-bezier(0.16, 1, 0.3, 1)` curve, staggered 0.2s through 0.85s.

The content container is `pointer-events-none` so the visitor's cursor reaches the 3D scene through the text — only the buttons re-enable pointer events. The 3D background stays interactive, the copy floats over it.

## Page layout
One viewport: fixed transparent navbar (wordmark left; Services / About Us / Projects / Team / Contacts center in small uppercase widetracked muted gray; a dark-gray "Get Quote" button right) over the full-screen hero. Mobile simply hides the nav links and CTA — no hamburger. Fluid clamp() typography throughout; content is left-and-bottom weighted so the 3D scene owns the upper two-thirds.

## Typography
- Display + body: Sora (Google Fonts, weights 300-700) — bold tight-tracked uppercase heading, light weights for sub and description, tiny widetracked uppercase nav

## Color palette
- Hero background: near-black charcoal `#141414` (hsl 0 0% 8%); page background `#1a1a1a`
- Foreground: near-white `#f5f5f5`; muted text at 60% gray
- Accent: vivid green `#05e901` (hsl 119 99% 46%) — the " AI" in the wordmark, the primary CTA, and focus rings
- Nav button: dark gray `#2e2e2e`; description text `rgba(245,245,245,0.6)`

## Visual motifs
- **Interactive 3D scene background** — a Spline embed fills the viewport and responds to the cursor; clicks pass through the copy layer to reach it
- **Bottom-left anchored copy** — heading, promise, description, CTAs, and trust line stack in the lower-left corner, leaving the scene clear
- **One green word** — the accent color appears in exactly one place in the headline plus the primary button; everything else is grayscale
- **Blur-up entrances** — elements fade in while unblurring from 4px, staggered down the stack
- **Widetracked uppercase nav** — small muted links across a fully transparent fixed bar
- **Plain trust line** — city, role, and a real install count in small quiet text instead of logos or badges
- **Click-through content layer** — pointer-events pass through the text so the 3D background stays touchable

## When to use
- Security system installers, surveillance and access-control companies selling to facilities
- Cybersecurity and IT service firms that want dark-technical without being cyberpunk
- Smart building and alarm companies pitching competence over flash
- Local B2B operators who want one strong page with a "Book a Call" ask
- Brands with (or willing to commission) a single good 3D scene

## When to NOT use
- Anyone without a 3D scene asset — the background IS the design; a static photo swap deflates it
- Warm consumer brands — charcoal plus signal green reads industrial and technical
- Content-deep sites — this is a one-viewport hero pattern; full marketing sites need more structure (see `cognitra-ai-agency-gray-panel` for a fuller dark AI layout)
- Audiences on weak connections — the Spline runtime is a heavy dependency even lazy-loaded

## Build complexity
LOW. One section, standard Tailwind tokens, staggered CSS keyframes; the Spline embed does the visual heavy lifting through one component.

## Library cross-references
- Motif: `interactive-3d-scene-background`
- Motif: `bottom-left-anchored-hero-copy`
- Motif: `single-accent-word-headline`
- Motif: `blur-up-staggered-entrances`
- Motif: `click-through-content-layer`
- Typography: `sora-uppercase-tight`
- Color palette: `charcoal-vivid-green-near-white`
