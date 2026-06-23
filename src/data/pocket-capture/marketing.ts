// Pocket Capture standalone landing-page content (PC-MARK-1).
//
// Copy is voice-checked against voice/chase-spec.md §10 — no "leverage" / "unlock" /
// "seamlessly" / "game-changing", no three-adjective stacks, lead with the fact. Hero copy
// is lifted verbatim from the SPEC (§4.3); persona props verbatim from SPEC §4.4.
// Content lives here so copy edits never touch layout, and PC-MARK-4/PC-MARK-6 can swap the
// testimonial / video slots without editing the page components.

export const HERO = {
  headline: "Stop losing ideas.",
  sub: "Speak them, share them, forward them, or text them. Pocket Capture saves whatever's worth remembering — into a private feed only you can see. No app to download. No setup. Whatever's closest to your hand.",
  cta: "Get Pocket Capture — $47 one-time",
} as const;

export const PRICE_LABEL = "$47 one-time";

/** Internal checkout endpoint (PC-MARK-2 owns the handler). */
export const CHECKOUT_ACTION = "/api/pocket-capture/checkout";

export type CaptureSurfaceKey = "share" | "voice" | "email" | "sms";

export type CaptureSurface = {
  key: CaptureSurfaceKey;
  label: string;
  icon: string;
  tagline: string;
  body: string;
};

// The four surfaces, in the order they appear on the page (SPEC §1, §5).
export const SURFACES: CaptureSurface[] = [
  {
    key: "share",
    label: "Share Sheet",
    icon: "🔗",
    tagline: "One tap from inside any app.",
    body: "Reading an article, looking at a screenshot, holding a link — tap Share, tap Pocket Capture, it's saved. Works on iOS and Android once you add Pocket Capture to your home screen. The lowest-friction surface, and the default.",
  },
  {
    key: "voice",
    label: "Voice Shortcut",
    icon: "🎤",
    tagline: "Wake word, speak, done. Eyes free.",
    body: "Install one iOS Shortcut, then say \"Hey Siri, save this\" and talk. Driving, walking, hands full — the thought lands in your feed without you touching the keyboard. Runs from your Apple Watch too.",
  },
  {
    key: "email",
    label: "Email Forward",
    icon: "✉️",
    tagline: "Forward it from the inbox you already use.",
    body: "You get a private address. Forward or BCC any email to it and the body plus attachments land in your feed. The thing that came in by email stays in the place you keep everything else.",
  },
  {
    key: "sms",
    label: "SMS",
    icon: "📱",
    tagline: "Text it like you'd text a friend.",
    body: "You get a personal number. Text or MMS it and it's captured. No app open, no login, works on any phone. The universal fallback for when you're somewhere weird.",
  },
];

// Persona spray — 16 named ICPs, value props lifted verbatim from SPEC §4.4.
export type Persona = { name: string; prop: string };

export const PERSONAS: Persona[] = [
  { name: "Creators", prop: "Save content ideas, hooks, captions, screenshots, trends." },
  { name: "Writers", prop: "Save story ideas, quotes, research, drafts, observations." },
  { name: "Founders", prop: "Save startup ideas, marketing angles, late-night thoughts." },
  {
    name: "Roofers / HVAC techs / Field service",
    prop: "Voice-capture customer notes between jobs without pulling over.",
  },
  { name: "Real estate agents", prop: "Speak listing observations as you walk the property." },
  { name: "Sales pros", prop: "Forward the email you just received with the lead detail." },
  { name: "Coaches", prop: "Capture client insights between sessions." },
  { name: "Developers", prop: "Save code snippets, errors, fixes, commands, APIs, prompts." },
  { name: "AI users", prop: "Save prompts, workflows, outputs, automations." },
  { name: "Designers", prop: "Save UI inspiration, color palettes, layouts, references." },
  { name: "Students", prop: "Save lecture notes, study guides, research, links." },
  { name: "Researchers", prop: "Save articles, sources, findings, rabbit holes." },
  { name: "Journalists", prop: "Save sources, interview notes, ideas, references." },
  { name: "Marketers", prop: "Save ad ideas, hooks, copywriting angles, winning creatives." },
  { name: "Photographers", prop: "Save poses, locations, lighting ideas, references." },
  { name: "Musicians", prop: "Save lyrics, melodies, ideas, samples, inspiration." },
];

// Placeholder testimonials. Role-only attribution, no fabricated names or dollar receipts —
// Chase swaps these for real quotes once the first 10 customers land (SPEC §4.2 / §6 PC-MARK-1).
export type Testimonial = { quote: string; role: string };

export const TESTIMONIALS_PLACEHOLDER: Testimonial[] = [
  {
    quote: "I used to lose half my ideas between the truck and the next job. Now I just talk and it's there at the end of the day.",
    role: "Field service owner",
  },
  {
    quote: "Forwarding an email to one address beats copying it into a notes app I never open again.",
    role: "Sales rep",
  },
  {
    quote: "The share sheet is the whole thing for me. One tap and the article is saved with the rest of my research.",
    role: "Writer",
  },
];

export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: "Who can see my captures?",
    a: "Only you. Your feed is private — there are no team accounts, no shared inboxes, no public view. You sign in and you're the only one looking at it.",
  },
  {
    q: "How long do my captures stick around?",
    a: "They stay until you delete them. There's no auto-expiry. Search the feed, edit the tags, or remove a capture whenever you want.",
  },
  {
    q: "Can I cancel? What happens to my captures if I do?",
    a: "It's a $47 one-time purchase, not a subscription, so there's nothing to cancel. Your feed stays yours. If you ever upgrade to Pocket Agent, your captures come with you and become part of your business brain.",
  },
  {
    q: "Can I upgrade to the full Pocket Agent later?",
    a: "Yes. Pocket Capture is the capture layer. Pocket Agent adds the agents that act on what you capture — draft your emails, find leads, answer customer follow-ups. When you upgrade, Pocket Capture rides along as part of your plan.",
  },
  {
    q: "Is this for my personal life or my business?",
    a: "Both. The same four surfaces work for a song lyric at midnight and a customer note between jobs. One private feed holds whatever you point it at.",
  },
  {
    q: "Do I need to download an app?",
    a: "No. Pocket Capture runs in your browser and adds to your home screen on iOS and Android. The Voice Shortcut installs in one tap from Apple's gallery. Nothing to download from an app store.",
  },
];
