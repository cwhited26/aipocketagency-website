---
slug: mainframe-mouse-scrub-agency
name: Mainframe — Mouse-Scrub Agency
vibe: brutalist, creative agency, conversational AI-forward, technical-but-warm, premium
industries: creative agencies, AI/tech studios, dev shops with personality, design collectives, product studios, brand identity studios that lean technical
source: motionsites.ai (catalog title "Liquid Glass Agency" — actual brand "Mainframe(R)" — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Full viewport hero with a MOUSE-SCRUB CONTROLLED video as the background — the video doesn't autoplay; it advances/rewinds based on horizontal mouse movement (the cursor literally scrubs through the video). All content is overlaid: a blurred intro label (deliberately fuzzy: "Hey there, meet A.R.I.A, Mainframe's Adaptive Response Interface Agent"), a typewriter-revealed agent greeting ("Glad you stopped in. Good taste tends to find us. Now, what are we building?"), and a stack of 5 pill buttons offering pre-canned conversational entry points ("Pitch us an idea / Come work here / Send a brief hello / See how we operate / Reach us: hello@mainframe.co").

The brand wordmark "Mainframe(R)" sits in a tight top-left navbar pairing with a decorative asterisk character. Nav links are comma-separated inline at large display sizing ("Labs, Studio, Openings, Shop"). The whole page reads as if you've started a conversation with the agency rather than landed on a website.

## Page layout
Single full-viewport hero with bottom-anchored content on mobile (`justify-end pb-12`), centered on desktop. The content sits in a `max-w-xl` block — narrow, like a chat thread — overlaid on the mouse-scrub video. The pill buttons are LEFT-aligned (not centered) which makes the page feel like a real interface, not a marketing landing page.

## Typography
- Display: HelveticaNowDisplay-Medium (via custom @font-face from `db.onlinewebfonts.com`)
- Body: HelveticaNowDisplayW01-Rg (custom font)
- CSS variables: `--font-heading` for the wordmark, `--font-body` everywhere else
- Body sizing: `clamp(18px, 4vw, 26px)` for the headline and typewriter content (large but responsive)
- Pill buttons: `text-[13px] sm:text-[15px]` (small, deliberately interface-like)

## Color palette
- Background: video provides ambient tone (Mainframe's video is dark/moody)
- Primary text: black (`#000000`)
- Body text: dark on light video sections
- Pill buttons: white pills with black text, hover inverts to black with white text
- Outline pill (for the email): white text with white border, hover inverts to white bg with black text
- Mobile overlay: `bg-white/95 backdrop-blur-sm`

## Visual motifs
- **Mouse-scrub controlled video** (the signature mechanic) — the video doesn't autoplay; horizontal mouse movement advances or rewinds through it. Implementation: `mousemove` listener with `delta = currentX - prevX`, `(delta / window.innerWidth) * SENSITIVITY * video.duration`, `SENSITIVITY = 0.8`, clamp `targetTime` to `[0, video.duration]`, seek via `video.currentTime`, use `onSeeked` handler to queue the next seek (prevents flooding)
- **Deliberately blurred intro label** with `filter: blur(4px)` — the visitor sees there's text, but it's not for them yet; it's an intro to the AGENT, not the visitor
- **Typewriter agent greeting** with custom hook (38ms per char, 600ms start delay, blinking cursor that disappears when done)
- **Pre-canned conversation entry pill buttons** — 4 white pills + 1 outline pill (the email contact with a copy icon that copies the email to clipboard on click)
- **Comma-separated inline nav** — "Labs, Studio, Openings, Shop" with literal commas between, set at `text-[23px]` so they read as a sentence not a menu
- **Decorative asterisk** (`✳︎`) alongside the brand wordmark — a tiny visual flourish that signals "we have a sense of style"
- **Animated hamburger** with 3 bars that rotate to an X on toggle (300ms transitions)
- **Stagger-in pill buttons** (fade + slide up after 400ms, INDEPENDENT of the typewriter — visitors don't have to wait for typing to finish to interact)

## When to use
- Creative agencies and design studios with a strong "we have personality" brand
- AI-adjacent studios (the agent framing is on-brand)
- Brand identity studios that lean technical (not arts-only)
- Dev shops with a polished brand
- Product studios pitching enterprise work
- Agencies that want their site to feel like a chat with the founder, not a brochure
- BOS Studios's own next-tier site if it ever needed a refresh (the agent framing fits the BOS narrative)

## When to NOT use
- Anyone without great existing video (the mouse-scrub is the whole point — needs interesting footage)
- Anyone whose audience finds AI/agent framing performative
- Local services / blue collar — wrong audience entirely
- Conversion-driven landing pages where visitors need to find a phone number fast
- E-commerce — the conversation framing doesn't fit "browse products"
- Accessibility-critical sites — the mouse-scrub is hard to translate to touch/keyboard

## Reference source
motionsites.ai catalog title "Liquid Glass Agency" — actual brand inside the prompt is "Mainframe(R)" with a decorative asterisk and a real AI-agent framing. Extracted Jun 11 2026. The "Liquid Glass" catalog name doesn't reflect the actual design.

## Library cross-references
- Motif: `mouse-scrub-video-control` (the signature mechanic)
- Motif: `typewriter-agent-greeting`
- Motif: `pre-canned-conversation-pill-buttons`
- Motif: `comma-separated-inline-nav`
- Motif: `deliberately-blurred-intro-label`
- Motif: `decorative-asterisk-flourish`
- Typography: `helvetica-now-display`
- Color palette: `video-overlay-black-white-inverting-pills`
