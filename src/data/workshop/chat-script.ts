// Fake-live chat registry for the Business Brain Workshop (PA-POS-38, Positioning Lock §24.4).
// The workshop player polls video.currentTime and fires each `live` message when its trigger_sec
// is crossed. The lobby plays the `pre_show` segment against seconds-since-lobby-open instead.
//
// Every attendee is a composite — no real customer names in product copy (PA-POS-13). Messages
// are voice-checked: real operators typing mid-workshop, not a hype track. No exclamation-point
// cheer, no "mind blown", no testimonial theater. The vitest gate in
// src/data/workshop/__tests__/chat-script.test.ts pins ordering and the slop scan covers copy.
//
// Chase tunes this file directly — add/remove/re-time entries; keep trigger_sec ascending
// within each segment.

export type WorkshopChatSegment = "pre_show" | "live";

export type WorkshopChatMessage = {
  segment: WorkshopChatSegment;
  /** Seconds into the segment: video time for `live`, seconds after lobby open for `pre_show`. */
  trigger_sec: number;
  attendee_name: string;
  /** Deterministic avatar seed — same seed, same generated avatar everywhere. */
  avatar_seed: string;
  message: string;
};

export const WORKSHOP_CHAT_SCRIPT: readonly WorkshopChatMessage[] = [
  // ---- Pre-show (lobby) — fires against seconds since lobby open (T-15 min window) ----
  { segment: "pre_show", trigger_sec: 20, attendee_name: "Dana R.", avatar_seed: "dana-r", message: "made it. coffee in hand" },
  { segment: "pre_show", trigger_sec: 75, attendee_name: "Tom H.", avatar_seed: "tom-h", message: "Is the workbook the same PDF from the email? Want to make sure I have the right one open." },
  { segment: "pre_show", trigger_sec: 150, attendee_name: "Priya S.", avatar_seed: "priya-s", message: "yes — check the second email, the one with the download link" },
  { segment: "pre_show", trigger_sec: 300, attendee_name: "Ben K.", avatar_seed: "ben-k", message: "signed up for github last night per the homework email. felt like 2009" },
  { segment: "pre_show", trigger_sec: 480, attendee_name: "Rosa G.", avatar_seed: "rosa-g", message: "Running a landscaping company, hoping this fixes me re-explaining my crew schedule to ChatGPT every monday" },
  { segment: "pre_show", trigger_sec: 700, attendee_name: "Carl W.", avatar_seed: "carl-w", message: "checklist done. blocked the full 65" },

  // ---- Live — fires against video.currentTime across the 60-minute recording ----
  // Opening: the problem (repeating yourself to your AI)
  { segment: "live", trigger_sec: 45, attendee_name: "Dana R.", avatar_seed: "dana-r", message: "here we go" },
  { segment: "live", trigger_sec: 180, attendee_name: "Steph L.", avatar_seed: "steph-l", message: "the 'my AI has amnesia' line is painfully accurate" },
  { segment: "live", trigger_sec: 320, attendee_name: "Omar F.", avatar_seed: "omar-f", message: "I keep a google doc I paste into every new chat. it's 40 pages now and half of it is stale" },
  { segment: "live", trigger_sec: 470, attendee_name: "Kate B.", avatar_seed: "kate-b", message: "same, except mine is scattered across 6 docs and my notes app" },
  { segment: "live", trigger_sec: 720, attendee_name: "Marcus C.", avatar_seed: "marcus-c", message: "Same. I forget to update Claude every week." },
  { segment: "live", trigger_sec: 850, attendee_name: "Nina P.", avatar_seed: "nina-p", message: "question — why a github repo and not just a notion page?" },

  // Min 15: fork the template repo
  { segment: "live", trigger_sec: 940, attendee_name: "Tom H.", avatar_seed: "tom-h", message: "Forked. That was easier than I expected." },
  { segment: "live", trigger_sec: 1000, attendee_name: "Rosa G.", avatar_seed: "rosa-g", message: "ok mine says business-brain under my username now. first repo I have ever owned" },
  { segment: "live", trigger_sec: 1060, attendee_name: "Jeff D.", avatar_seed: "jeff-d", message: "the folder structure alone is worth writing down. zones make more sense than my 40-page doc" },

  // Min 20-25: voice zone
  { segment: "live", trigger_sec: 1260, attendee_name: "Priya S.", avatar_seed: "priya-s", message: "for the voice zone — do I paste actual emails I've written or describe how I write?" },
  { segment: "live", trigger_sec: 1330, attendee_name: "Ben K.", avatar_seed: "ben-k", message: "he just covered this — real samples beat descriptions. pasting 3 of my client emails in" },
  { segment: "live", trigger_sec: 1450, attendee_name: "Dana R.", avatar_seed: "dana-r", message: "voice zone saved. watching my own repo fill up is a strange feeling" },

  // Min 25-30: customers zone
  { segment: "live", trigger_sec: 1560, attendee_name: "Carl W.", avatar_seed: "carl-w", message: "putting my top 10 accounts in the customers zone with what each one actually buys. never had this written down in one place" },
  { segment: "live", trigger_sec: 1680, attendee_name: "Steph L.", avatar_seed: "steph-l", message: "do past customers go in here too or just active ones?" },
  { segment: "live", trigger_sec: 1740, attendee_name: "Omar F.", avatar_seed: "omar-f", message: "he said include the churned ones with the reason they left. that's the useful part" },

  // Min 30-35: products zone
  { segment: "live", trigger_sec: 1890, attendee_name: "Kate B.", avatar_seed: "kate-b", message: "products zone question — I have one service with 3 pricing tiers, is that one entry or 3?" },
  { segment: "live", trigger_sec: 1980, attendee_name: "Marcus C.", avatar_seed: "marcus-c", message: "putting my whole price list in. tired of my AI inventing prices when I draft quotes" },
  { segment: "live", trigger_sec: 2100, attendee_name: "Nina P.", avatar_seed: "nina-p", message: "3 zones in. this is the most organized my business info has ever been, which is mildly embarrassing" },

  // Min 35-40: competitive + decisions zones
  { segment: "live", trigger_sec: 2220, attendee_name: "Jeff D.", avatar_seed: "jeff-d", message: "competitive zone feels weird to write but he's right — I compare us against the same 2 companies on every sales call anyway" },
  { segment: "live", trigger_sec: 2400, attendee_name: "Rosa G.", avatar_seed: "rosa-g", message: "decisions zone is the one I needed. 'we tried yard signs in 2024, don't again' — that kind of thing dies in my head otherwise" },
  { segment: "live", trigger_sec: 2470, attendee_name: "Nina P.", avatar_seed: "nina-p", message: "put my 'no net-60 clients ever again' rule in decisions. felt good to write down" },
  { segment: "live", trigger_sec: 2530, attendee_name: "Tom H.", avatar_seed: "tom-h", message: "All five zones done. Repo went from empty template to an actual brain in half an hour." },

  // Min 45: connect to Claude
  { segment: "live", trigger_sec: 2760, attendee_name: "Ben K.", avatar_seed: "ben-k", message: "connected. asked it to draft a follow-up and it used my actual tone and my actual prices. no pasting" },
  { segment: "live", trigger_sec: 2880, attendee_name: "Priya S.", avatar_seed: "priya-s", message: "it referenced a customer from my customers zone by name in the draft. ok. I get it now" },
  { segment: "live", trigger_sec: 3000, attendee_name: "Dana R.", avatar_seed: "dana-r", message: "the difference vs my paste-a-doc routine is that this one doesn't rot. as long as I keep it updated" },

  // Min 50-55: the maintenance problem → PA
  { segment: "live", trigger_sec: 3180, attendee_name: "Omar F.", avatar_seed: "omar-f", message: "'as long as I keep it updated' is doing a lot of work in that sentence though. that's where my 40-page doc died" },
  { segment: "live", trigger_sec: 3330, attendee_name: "Kate B.", avatar_seed: "kate-b", message: "logged in. it already sees my repo. the agent picked up my voice zone without setup" },
  { segment: "live", trigger_sec: 3420, attendee_name: "Carl W.", avatar_seed: "carl-w", message: "so the agent maintains the brain and the brain stays in my github. that split is the part I trust" },

  // Close
  { segment: "live", trigger_sec: 3510, attendee_name: "Steph L.", avatar_seed: "steph-l", message: "walking out of this with a repo I own and a filled workbook. friday lab — I'll be there" },
  { segment: "live", trigger_sec: 3560, attendee_name: "Marcus C.", avatar_seed: "marcus-c", message: "thanks chase. see everyone in skool" },
];
