---
slug: spd-luxury-automation-cinematic
name: S.P.D — Luxury Automation Cinematic
vibe: cinematic, dramatic, luxury, two-section reveal, signature-flourish
industries: ops automation SaaS, premium consultancies, founder-led services, brand identity studios, high-end personal brands
source: motionsites.ai (catalog title "Luxury Real Estate" — actual brand "S.P.D" — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Two-section dramatic scroll experience. Section 1 is a fullscreen video hero with a brand wordmark logo (top-left), CTA pill ("Get started", top-right), tagline + paragraph (left column), and a giant "Italiana" serif headline (bottom-right) reading "Intelligent Daily / Routine Automation / For Your Business. / You Relax." Section 2 is a deep RED (`#FF0000`) background that the visitor scrolls INTO, with a parallax cloud image at the top transitioning between sections. Inside section 2: the same wordmark logo (centered, larger), an uppercase-tracking paragraph, a HUGE script-font signature ("S.P.D" in Marck Script at 120px) as the founder's signature flourish, plus a bottom video block with a gradient fade.

## Page layout
Two sequential sections with smooth parallax cloud transition. The first reads luxury-cinematic; the second reads founder-personal-brand (the giant cursive signature anchors the brand to a real person). The progression is "we are this premium thing" → "and a real person stands behind it."

## Typography
- Display 1: Italiana (Google Fonts) — serif display for the bottom headline, all the "luxury" feels live here
- Display 2: Marck Script (Google Fonts) — cursive signature font, used ONLY for the giant "S.P.D" signature in section 2
- Body + nav: Manrope (Google Fonts, weights 400/600)
- Headline sizing: `text-[36px]` mobile → `text-[96px]` desktop, `leading-[1.1] / md:leading-[88px]`
- Tracking-widest on uppercase tagline blocks

## Color palette
- Section 1 background: black with video footage providing tone
- Section 1 text: white (`text-white` with `border-white` CTAs)
- CTA pill: transparent + `bg-black/10 backdrop-blur-sm` on mobile, fully transparent on desktop, `border border-white`, hover `bg-white/10 backdrop-blur-[48px]`
- Section 2 background: `#FF0000` (pure red — the dramatic register shift)
- Section 2 text: white
- Cloud overlay: photographic clouds providing the transition between sections (not a CSS gradient — an actual cloud PNG)

## Visual motifs
- **Two-section scroll experience** with deep-red section 2 (the visual hook — most pages stay one tone; this one shifts dramatically)
- **Parallax cloud transition** between sections — a giant cloud image (PNG) sits at the top of section 2, translated up by scroll progress (`useTransform(scrollY, [0, 300], [0, -100])` desktop, `[0, -24]` mobile)
- **Founder signature flourish** — a 120px Marck Script signature ("S.P.D") as the visual centerpiece of section 2. Makes the brand feel like a real person, not a faceless brand
- **Italiana serif display** for the main headline — high-end editorial feel
- **Frosted CTA pill** with backdrop-blur on hover — classic luxury treatment
- **Brand wordmark as inline-SVG logo** (custom path, white fill) appearing in BOTH sections at different sizes — provides continuity through the section shift
- **Tagline split desktop vs mobile** — different line breaks per viewport (the prompt explicitly writes both)
- **Gradient mask** on the bottom video block fades the video into the red background

## When to use
- Premium ops / automation SaaS for service businesses
- Founder-led premium consultancies (especially solo or duo founders)
- Brand identity studios with a personal brand at the front
- High-end coaches and consultants
- Luxury services where the founder's name IS the brand (designer-founders, architect-founders, surgeon-founders)
- Hanes Environmental tier if a different visual register were needed
- Boutique financial advisors
- Astrology / spiritual / ritual brands (the dramatic register works)

## When to NOT use
- Anything with a team brand where the signature flourish would feel weird
- Anything where conversion needs to happen fast (the two-section reveal is for browsing visitors)
- Anywhere RED is wrong for the brand (the red section is load-bearing)
- Local services / blue collar — too dramatic, too slow
- Mobile-dominant traffic — the parallax cloud effect is muted on small screens

## Reference source
motionsites.ai catalog title "Luxury Real Estate" — actual brand inside the prompt is "S.P.D" (an automation SaaS). Extracted Jun 11 2026. The catalog title is misleading; the AESTHETIC is luxury / cinematic / signature, not literal real estate.

## Library cross-references
- Motif: `parallax-cloud-transition-between-sections`
- Motif: `founder-signature-flourish-display`
- Motif: `two-section-scroll-reveal`
- Motif: `frosted-cta-pill-with-backdrop-blur`
- Typography: `italiana-marck-manrope` (serif display + cursive signature + sans body)
- Color palette: `black-video-to-red-section`
