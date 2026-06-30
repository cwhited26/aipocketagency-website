// gen-starter-skills.mjs — [2026-06-09] Claude Code
//
// Single source of truth for the 30 starter Skills shipped in the AI Office Launch Kit bonus
// (decisions PA-STARTERSKILL-1..6). Run it to (re)generate two committed outputs:
//   1. src/data/starter-skills/<category>/<slug>.md  — the SPEC §3 SKILL.md shape, one per skill,
//      written in the open agentskills.io frontmatter shape (PA-SKILL-INTEROP-1..3): `name` is the
//      lowercase-hyphen identifier (== the file slug), `description` is the required summary, the
//      human title lives in `title`, and PA's extras carry alongside + under the standard `metadata`
//      map. This is the file the auto-seeder copies (its body) into the owner's brain at signup; the
//      brain SKILL.md is then emitted by lib/skills/format.ts in the same agentskills.io shape.
//   2. src/data/starter-skills/manifest.ts            — a typed array the app imports (bundler-safe,
//      no runtime fs): tier-gating in the dispatcher, the Starter Pack surface, and the seeder all
//      read this. Generated → never hand-edit; edit the SKILLS array below and re-run:
//
//        node scripts/gen-starter-skills.mjs
//
// Voice: every skill is written in Chase's operator voice (voice/chase-spec.md) — declare before
// explain, specific over generic, imperatives for prescriptions, no AI-slop banned phrases
// ("leverage", "genuinely", "honestly", "straightforward", hedge stacks, "let's dive in", …).

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src", "data", "starter-skills");

/**
 * The 30 starter Skills, by category. tier: "free" | "pro_plus" | "studio_plus" | "enterprise".
 * Each skill renders to the SPEC §3 shape: overview → technique bullets → do/don't → why.
 */
const SKILLS = [
  // ── Voice + Style (5 · free — every owner gets these) ──────────────────────────────────
  {
    category: "voice_style",
    tier: "free",
    slug: "write-like-the-user",
    title: "Write Like the Owner",
    description: "Pull the owner's voice from their past writing and mirror its cadence and word choices instead of defaulting to generic prose.",
    whenToUse: "Any time you draft something the owner will send under their own name — email, post, proposal, reply. Skip it for internal scratch notes nobody reads.",
    overview:
      "The fastest way to sound like the owner is to read three things they already wrote and copy the moves. Don't invent a voice — find the one that's already in the brain and match it.",
    technique: [
      "Before drafting, pull 2–3 real examples the owner wrote — a past email, a note, a post. The brain has them.",
      "Read for the moves, not the topic: sentence length, how they greet, whether they use first names, where they put the ask.",
      "Match the cadence. If they write short and blunt, write short and blunt. If they ramble warm, don't clip them into a memo.",
      "Reuse their actual words for recurring things — their name for a product, a customer, a service. Don't swap in a synonym.",
      "Draft, then read it back against the example. If a sentence sounds like you and not like them, rewrite that sentence.",
    ],
    doThis:
      "Read the owner's last three sent emails, notice they open with just a first name and a dash, and open your draft the same way: \"Mike —\".",
    dontThat:
      "Open with \"I hope this email finds you well\" because that's how a generic assistant starts — the owner has never written that sentence in their life.",
    why:
      "Voice isn't a setting, it's a pattern you can read off real writing. The owner already proved how they sound every time they hit send. Copying that beats guessing at a tone, and it's why a draft can come back right the first time instead of after three rounds of \"make it sound more like me.\"",
  },
  {
    category: "voice_style",
    tier: "free",
    slug: "lead-with-the-action",
    title: "Lead With the Action",
    description: "Put the claim, the finding, or the ask in the first sentence — then explain. Never bury the point in the middle.",
    whenToUse: "Every draft, every reply, every brief. The longer the piece, the more it matters.",
    overview:
      "Declare before you explain. The first sentence of a paragraph is the point; the next two or three are the why. The reader should know the conclusion by sentence one.",
    technique: [
      "Write the point first. The claim, the answer, the thing you need them to do — sentence one.",
      "Put the reasoning after, not before. Context that leads up to a point makes the reader wait; context that follows a point makes sense.",
      "If there's an ask, it lives in the first or last sentence — never the middle, never after a hedge.",
      "Cut the runway. \"I wanted to reach out because\" and \"After giving this some thought\" are throat-clearing. Delete them and start at the point.",
      "Read the first sentence alone. If it doesn't carry the message, you buried it — move the real point up.",
    ],
    doThis:
      "\"The roof passed inspection — we're clear to invoice.\" Then the detail: what was checked, what's next.",
    dontThat:
      "\"So I went out this morning and spent some time looking at a few things on the property, and after walking the whole roof and checking the flashing, I think we're probably in good shape to move forward with billing.\"",
    why:
      "People skim. They read the first sentence of every paragraph and stop when they have what they need. If the point is in the middle, half your readers never reach it. Leading with the action respects that — they get the conclusion immediately and read the why only if they want it.",
  },
  {
    category: "voice_style",
    tier: "free",
    slug: "dont-be-a-chatbot",
    title: "Don't Sound Like a Chatbot",
    description: "Cut the assistant filler — \"I'd be happy to,\" \"let me know if there's anything else,\" \"great question\" — that marks writing as machine-made.",
    whenToUse: "Everything customer-facing, and most internal writing too. The owner is a person talking to a person.",
    overview:
      "The tells that scream \"an AI wrote this\" are filler phrases no real operator uses. Strip them. What's left is shorter and sounds human.",
    technique: [
      "Kill the eager openers: \"I'd be happy to help with that,\" \"Great question,\" \"Absolutely!\" Start at the answer instead.",
      "Kill the trailing offer: \"Let me know if there's anything else I can help with,\" \"Feel free to reach out.\" End on the last real thing.",
      "Kill the hedged enthusiasm: \"I'd love to,\" \"happy to,\" \"excited to.\" Say what you'll do, not how you feel about doing it.",
      "Drop \"here's what I found\" preambles. State the finding. The reader can see it's an answer.",
      "No padded summary at the end. The last sentence is a fact or the next step, not \"Hopefully this helps!\"",
    ],
    doThis:
      "\"Sent the quote. It's $4,200, valid through Friday. Want me to follow up Monday if they're quiet?\"",
    dontThat:
      "\"Absolutely, I'd be happy to help with that! I've gone ahead and sent the quote over. Let me know if there's anything else I can assist you with! 😊\"",
    why:
      "Filler is the cheapest signal that something was mass-produced. Customers feel it even when they can't name it — the writing sounds like a help desk, not the person they hired. Stripping it costs nothing and makes every message read like a real person who's busy and respects their time.",
  },
  {
    category: "voice_style",
    tier: "free",
    slug: "honest-hedging",
    title: "Commit, Don't Hedge",
    description: "Drop the hedge stacks — \"probably,\" \"likely,\" \"might want to consider,\" \"could potentially.\" Commit to the call or say plainly what you don't know.",
    whenToUse: "Recommendations, follow-ups, decisions, anything where the reader wants a position. Especially when you're tempted to soften.",
    overview:
      "Hedging reads as either weakness or evasion. Either commit to the recommendation, or name the exact thing you don't know yet. Both beat a pile of soft words.",
    technique: [
      "Replace the hedge with a position: \"You might want to consider following up\" becomes \"Follow up Thursday.\"",
      "When you don't know, say what's missing — not \"probably,\" but \"I don't have their budget yet, so I can't size this.\"",
      "Never stack hedges. \"I think it's probably likely that\" is three softeners doing one job badly. Pick zero.",
      "\"In practice\" and \"usually\" are honest — they say a pattern holds without overclaiming. Hedge words pretend to knowledge you don't have.",
      "Read it back: if you could delete a qualifier and the sentence got stronger and stayed true, delete it.",
    ],
    doThis:
      "\"Their last three jobs all closed within a week of the quote. Send it today; they move fast.\"",
    dontThat:
      "\"It seems like they might possibly be the kind of client who could potentially be ready to move forward relatively soon, so it may be worth considering sending something over at some point.\"",
    why:
      "The owner is paying for judgment, not a weather forecast. A committed call they can act on — or a clean statement of what's unknown — is worth more than a paragraph that covers every base and says nothing. Hedging protects the writer and abandons the reader. Commit.",
  },
  {
    category: "voice_style",
    tier: "free",
    slug: "specific-over-generic",
    title: "Specific Over Generic",
    description: "Name the person, the dollar amount, the date, the file. Replace \"stakeholders,\" \"soon,\" and \"several\" with the real thing.",
    whenToUse: "Always. Every claim, every plan, every follow-up. If a real detail exists, use it.",
    overview:
      "Specificity is the difference between writing that lands and writing that evaporates. If a number, a name, or a date exists, use it. If it doesn't, say so — don't paper over the gap with \"many\" or \"several.\"",
    technique: [
      "Swap vague nouns for real ones: not \"the stakeholders,\" but \"Sarah and the two crew leads.\"",
      "Swap vague time for real time: not \"soon\" or \"shortly,\" but \"Thursday\" or \"by the 15th.\"",
      "Swap vague quantity for the count: not \"several leads,\" but \"four leads,\" or pull the actual number from the brain.",
      "Cite the source inline: the customer's name, the dollar figure, the date of the call. Receipts beat adjectives.",
      "When you don't have the specific, name the gap plainly: \"I don't have the close date yet\" — not a fuzzy stand-in.",
    ],
    doThis:
      "\"Patrick paid $3,500 plus monthly hosting; his next invoice is the 1st.\"",
    dontThat:
      "\"The client made a significant payment and there are some ongoing costs that will recur periodically.\"",
    why:
      "Generic writing could be about anyone, so it convinces no one. A specific number or name proves you actually know the situation — it's a receipt, not a claim. The owner trusts work that names things, because vagueness is what people hide behind when they don't have the facts.",
  },

  // ── Email Drafting (5 · pro_plus) ──────────────────────────────────────────────────────
  {
    category: "email_drafting",
    tier: "pro_plus",
    slug: "cold-intro-structure",
    title: "Cold Intro That Gets a Reply",
    description: "Open a cold email on the prospect's pain, show the one thing that's different about you, then make a single small ask.",
    whenToUse: "First-touch outreach to someone who doesn't know the owner. Not for warm leads or existing customers — those get a different open.",
    overview:
      "A cold email earns a reply by being about them, not you. Lead with the pain they actually feel, name the one way you're different, and ask for something small enough to say yes to.",
    technique: [
      "Open on their pain in one concrete sentence — the specific problem someone in their seat lives with, not a generic compliment.",
      "Skip the company autobiography. They don't care what year you were founded.",
      "Name one differentiator, plainly. The single thing you do that the alternative doesn't. One, not five.",
      "Make the ask small: a 10-minute call, a yes/no question, a look at one example. Not \"let's set up a meeting to explore synergies.\"",
      "Keep it under 120 words. A cold email that needs scrolling gets archived.",
    ],
    doThis:
      "\"Most roofers in town quote off a ladder and a guess. We measure off satellite and hand you the supplement language carriers actually approve. Worth a 10-minute look at one of your open claims?\"",
    dontThat:
      "\"We are a full-service, industry-leading provider of innovative roofing solutions committed to excellence. We'd love to schedule a meeting to explore how we can leverage our expertise to add value to your organization.\"",
    why:
      "A stranger gives you one sentence before they decide to keep reading or hit delete. Spend it on their problem and they lean in; spend it on your mission statement and they're gone. The small ask works because a busy person will trade ten minutes long before they'll commit to a relationship.",
  },
  {
    category: "email_drafting",
    tier: "pro_plus",
    slug: "quote-follow-up",
    title: "Follow Up on a Quote",
    description: "Re-send the value, not just a nudge — restack what they get and add a real reason the window is closing, without fake urgency.",
    whenToUse: "A quote or proposal went out and the prospect went quiet. Use after a few days of silence, before they forget the conversation entirely.",
    overview:
      "A good quote follow-up reminds them what they're getting, not just that you're waiting. Restate the value in their terms, then give one honest reason to decide now.",
    technique: [
      "Don't open with \"just checking in\" — that's a nudge with no value. Open with the outcome they wanted.",
      "Restack the value in one tight list: what the price actually includes, framed as what it solves for them.",
      "Add one real reason to move now — your calendar fills next month, the material price holds until the 1st, the storm-season window. Real, not invented.",
      "Make the next step a single decision: \"reply yes and I'll book the crew,\" not \"let me know your thoughts.\"",
      "Keep the door open without groveling. One follow-up that respects them beats five that beg.",
    ],
    doThis:
      "\"Quick recap on the $4,200: that's the full tear-off, new underlayment, and the supplement filed with your carrier — not just shingles on top. I've got a crew slot the week of the 14th; after that it's June. Want me to hold it?\"",
    dontThat:
      "\"Hi, just circling back to see if you had any thoughts on the quote I sent. Let me know if you have any questions. Looking forward to hearing from you!\"",
    why:
      "By the time you follow up, they've half-forgotten why the price was worth it. A bare nudge makes them re-justify the whole thing from scratch; restating the value does that work for them. And an honest reason to decide now — a real deadline, not a manufactured one — gives a stalled buyer permission to move without feeling pressured.",
  },
  {
    category: "email_drafting",
    tier: "pro_plus",
    slug: "customer-reply-tone-match",
    title: "Match the Customer's Tone",
    description: "Read the tone of the inbound message — clipped, warm, frustrated, formal — and answer in a register that fits instead of one flat default.",
    whenToUse: "Replying to any customer or prospect message. Especially when they're upset or unusually casual — a mismatch reads as tone-deaf.",
    overview:
      "Read how they wrote before you decide how to answer. A frustrated customer needs acknowledgment first; a one-line text gets a one-line reply. Matching the register makes the answer land.",
    technique: [
      "Read the inbound for tone, not just content: word count, punctuation, whether they're warm or clipped, calm or hot.",
      "If they're frustrated, lead by naming the problem and owning it — not with a defense and not with forced cheer.",
      "If they wrote two casual lines, don't answer with five formal paragraphs. Mirror the length.",
      "Stay in the owner's voice while you match their register — match energy, not their exact words or grammar.",
      "Never out-escalate. If they're annoyed, you're calm and direct; you don't match anger with anger.",
    ],
    doThis:
      "They wrote: \"Still no invoice. This is the third time I've asked.\" You answer: \"That's on me — sending it in the next five minutes, and I'll confirm once it's in your inbox. Sorry you had to ask three times.\"",
    dontThat:
      "Answer that same frustrated message with \"Thank you so much for reaching out! We truly value your business and appreciate your patience. We'll look into this for you!\" — chipper at someone who's mad reads as not listening.",
    why:
      "Tone is most of the message. The same words land completely differently depending on whether they meet the customer where they are. A frustrated person who gets a cheerful auto-reply feels unheard and gets angrier; one who gets a calm, owning answer feels handled. Reading the register first is how a reply defuses instead of inflames.",
  },
  {
    category: "email_drafting",
    tier: "pro_plus",
    slug: "subject-line-not-filtered",
    title: "Subject Lines That Get Opened",
    description: "Write subject lines that are concrete and specific — a real thing the reader would say out loud — not clickbait and not vague.",
    whenToUse: "Every email that needs to be opened. Cold outreach, follow-ups, anything competing in a full inbox.",
    overview:
      "A subject line is a promise about what's inside. Make it concrete enough that the reader knows the email is for them, without the clickbait that gets it filtered or ignored.",
    technique: [
      "Be specific: name the thing the email is about — the job, the number, the date — not \"Following up\" or \"Quick question.\"",
      "Write it like a sentence the reader would actually say, not a marketing headline.",
      "No clickbait, no fake urgency, no all-caps, no \"Don't miss out.\" Those train the reader to ignore you and train filters to bury you.",
      "Shorter wins on mobile — the first 4–5 words carry it. Front-load the specific.",
      "If the email has one ask or one fact, put it in the subject: \"Crew slot open the week of the 14th.\"",
    ],
    doThis:
      "\"Your supplement got approved — $3,100\"",
    dontThat:
      "\"IMPORTANT: Don't miss this exclusive opportunity!!! 🚨\"",
    why:
      "The subject line is the only thing that competes for the open. Vague ones (\"Touching base\") give no reason to click; clickbait ones get the open once and the unsubscribe right after. A concrete, honest subject earns the open and sets up the email to be believed — the reader already knows you don't waste their attention.",
  },
  {
    category: "email_drafting",
    tier: "pro_plus",
    slug: "boundary-setting-decline",
    title: "Say No Without Burning the Bridge",
    description: "Decline a request — a discount, a deadline, an out-of-scope ask — clearly and warmly, so the relationship survives the no.",
    whenToUse: "When the answer has to be no: a price you won't drop, work you don't do, a timeline you can't hit. Anytime softening into a maybe would make it worse.",
    overview:
      "A clean no is kinder than a fake maybe. Give the decision plainly, give the one real reason, and offer the door you can hold open — without pretending the answer is yes.",
    technique: [
      "Lead with the no, gently but clearly. Don't bury it under three paragraphs of cushioning that make them think it's a yes.",
      "Give one honest reason, not a defensive essay. \"I can't hit Friday and do it right\" beats a paragraph of excuses.",
      "Offer the alternative you can actually deliver — a different date, a different scope, a referral. A no with a door beats a no with a wall.",
      "Don't apologize five times. One acknowledgment is respect; five is begging.",
      "Keep your voice warm. A firm no said warmly keeps the relationship; a mushy maybe said to avoid conflict destroys it later.",
    ],
    doThis:
      "\"I can't take the price below $4,000 — below that I'm cutting corners I won't put my name on. What I can do is split it into two payments if cash flow's the issue. Want me to set that up?\"",
    dontThat:
      "\"Hmm, let me see what I can do… I'll try to work something out and get back to you\" — when you already know the answer is no, and the maybe just delays the disappointment and adds a broken promise to it.",
    why:
      "People respect a clear no and resent a slow one. A fake maybe buys you a few comfortable days and then costs you trust when it turns into a no anyway. Saying it straight, warmly, with a real alternative shows the customer you take the relationship seriously enough to be honest with them — which is exactly why they come back.",
  },

  // ── Sales (5 · pro_plus) ───────────────────────────────────────────────────────────────
  {
    category: "sales",
    tier: "pro_plus",
    slug: "lead-qualification",
    title: "Qualify a Lead Fast",
    description: "Sort a new lead on fit, pain, budget, and timing so the owner spends time on the ones who'll actually close.",
    whenToUse: "A new lead comes in and you need to decide how hard to chase it. Use before booking a long call with someone who may never buy.",
    overview:
      "Qualifying is deciding who deserves the owner's hours. Four reads — are they a fit, do they feel the pain, can they pay, are they ready — tell you whether to chase, nurture, or let go.",
    technique: [
      "Fit: are they the kind of customer the owner serves well? Wrong-fit leads cost more than they pay, even when they buy.",
      "Pain: do they have the problem badly enough to act? No pain, no purchase — a curious tire-kicker isn't a lead.",
      "Budget: can they afford it without a fight? You don't need the exact number, just whether the price will be a shock.",
      "Timing: are they ready now, or someday? \"Someday\" goes to nurture, not the calendar.",
      "Score it hot / warm / cold and act accordingly — hot gets a call today, warm gets a sequence, cold gets a note and a wait.",
    ],
    doThis:
      "\"They run a 12-truck HVAC shop (fit), said they're losing jobs to slow quotes (pain), didn't blink at the range I floated (budget), and want it before summer (timing). Hot — book the call today.\"",
    dontThat:
      "Spend an hour on a discovery call with someone who liked a post, has no specific problem, hasn't mentioned money, and is \"just exploring for now\" — then wonder why it didn't close.",
    why:
      "The owner's time is the scarcest thing in the business, and the fastest way to waste it is treating every lead as equal. Most leads aren't going to buy; a few are. Qualifying up front tells you which is which, so the hours go to the people who'll close instead of the people who'll politely ghost.",
  },
  {
    category: "sales",
    tier: "pro_plus",
    slug: "objection-handling",
    title: "Handle the Real Objection",
    description: "Find the actual objection hiding behind the stated one, then address the fear of loss driving it instead of arguing the surface.",
    whenToUse: "A prospect pushes back — on price, timing, \"I need to think about it.\" Use before you discount or walk, when there's still a real conversation to have.",
    overview:
      "The first objection is rarely the real one. \"Too expensive\" usually means \"I'm not sure this is worth it\" or \"I'm scared of getting burned again.\" Surface the real one, then speak to the loss behind it.",
    technique: [
      "Don't take the first objection at face value. \"Too expensive\" compared to what? Ask the question that surfaces the real worry.",
      "Listen for loss aversion — most objections are fear of making a wrong call, not the price itself. People dread the loss more than they want the gain.",
      "Name the fear out loud: \"Sounds like you've been burned by a contractor before and you don't want to repeat it.\" Naming it defuses it.",
      "Answer the real objection, not the stated one. If the fear is being abandoned mid-job, talk about how you stay reachable — not about the price.",
      "Don't argue. You're not winning a debate; you're removing the reason they're scared to say yes.",
    ],
    doThis:
      "They say \"it's a lot of money.\" You ask, \"Is it the number, or is it that the last guy took a deposit and disappeared?\" — and now you can actually solve the thing.",
    dontThat:
      "Hear \"it's a lot of money\" and immediately drop the price 15% — you just discounted to solve a fear that wasn't about money, left margin on the table, and taught them to push.",
    why:
      "People rarely tell you the real reason they're hesitating on the first try — partly because they haven't named it themselves. If you answer the surface objection, you solve the wrong problem and they still don't buy. Surfacing the real one, usually a fear of loss, lets you address what's actually in the way — and most of the time it costs you nothing, where a reflexive discount costs margin every time.",
  },
  {
    category: "sales",
    tier: "pro_plus",
    slug: "discovery-call-note-capture",
    title: "Capture What Matters From a Call",
    description: "Log the few things from a discovery call that change the deal — pain, budget signals, decision process, exact words — and skip the transcript.",
    whenToUse: "After a sales or discovery call, when turning a messy conversation into notes the owner and the next draft can use.",
    overview:
      "A discovery call has five useful minutes buried in thirty. Capture the parts that move the deal — what hurts, who decides, what they can spend, the exact phrases they used — and let the rest go.",
    technique: [
      "Log the pain in their words. The exact phrase they used (\"I'm drowning in paperwork\") is gold for the follow-up — quote it back later.",
      "Log the decision process: who else signs off, what has to happen before they can say yes, when they need it.",
      "Log budget signals — a number, a range, a flinch, a \"we spent X on the last guy.\"",
      "Log the one thing they care about most. Every deal has a center of gravity; name it.",
      "Skip the play-by-play. Nobody needs \"then we talked about the weather.\" Notes are for what changes the next move.",
    ],
    doThis:
      "\"Pain: 'losing two days a week to invoicing.' Decision: she decides, but her partner Dave has to bless anything over $5k. Budget: paid $6k for a system that didn't work. Cares most about: not having to retrain staff. Wants it live by August.\"",
    dontThat:
      "Write a paragraph that recaps the whole call chronologically — \"We started by introducing ourselves, then she told me about her business history…\" — burying the three facts that actually decide the deal.",
    why:
      "Notes you can act on beat notes that are complete. A transcript of the whole call is a haystack; the owner needs the needles — the pain, the decision-maker, the budget, the one thing they care about. Capturing the exact words matters because quoting a prospect back to themselves in the follow-up proves you listened, and that's often what closes.",
  },
  {
    category: "sales",
    tier: "pro_plus",
    slug: "proposal-drafting-framework",
    title: "Turn Notes Into a Proposal",
    description: "Build a proposal from messy call notes by leading with their problem, scoping the work in their terms, and pricing it as an outcome.",
    whenToUse: "After discovery, when the owner needs a proposal or scope of work that actually reflects what the prospect said.",
    overview:
      "A proposal that wins reflects the call back to them. Open on the problem they described, scope the work as the solution to that problem, and price it against the outcome — not as a parts list.",
    technique: [
      "Open with their problem in their words — proof you were listening, before a single line item.",
      "Scope the work as outcomes, then the steps under each. \"Stop losing jobs to slow quotes\" → the system that fixes it. Not a naked feature list.",
      "Price against the outcome, not the hours. Anchor to what the problem costs them, so the number reads as a deal.",
      "Make the path obvious: what happens first, what you need from them, when it's done. No mystery.",
      "One clear next step at the end — sign here, reply yes, book the kickoff. Not three options that stall the decision.",
    ],
    doThis:
      "Open: \"You said you're losing two days a week to invoicing and it's costing you jobs.\" Then scope the fix, price it against the cost of those lost days, and end with \"Reply 'go' and we start Monday.\"",
    dontThat:
      "Send a generic template that opens with your company bio and lists features and hourly rates with no connection to anything they said on the call.",
    why:
      "A prospect reads a proposal asking one question: does this person understand my problem? Leading with their own words answers yes before you've asked for the sale. Pricing against the outcome reframes the number from a cost to a return — \"$5k to stop losing $2k a week\" sells itself, where the same $5k as a line item invites haggling.",
  },
  {
    category: "sales",
    tier: "pro_plus",
    slug: "stack-the-deck-close",
    title: "Restack the Value Before the Ask",
    description: "Right before the close, line up everything the buyer gets in one stack so the price lands as small against the total — then ask.",
    whenToUse: "At the moment of decision — the end of a proposal, the close of a call, the upsell page. When the buyer is about to weigh price against value.",
    overview:
      "Before you name the price, remind them of everything they're getting. Stack the pieces — each a real, specific thing — so the total dwarfs the number, then make the ask. The order is the whole trick.",
    technique: [
      "List the components right before the price, each one concrete: not \"support,\" but \"a same-day answer whenever a job's on the line.\"",
      "Make every line a real thing with standalone worth — something the buyer would pay for on its own.",
      "Stack the total so it visibly beats the price. The number should feel small against the pile, not the other way around.",
      "Name the price once, plainly, right after the stack — not buried, not apologized for.",
      "Then ask, clearly. The stack earns the right to a direct ask; don't waste it on \"let me know your thoughts.\"",
    ],
    doThis:
      "\"You're getting the full build, the brain set up from your real business, three workers configured to your jobs, and a call where I hand you the keys. Separately that's well into four figures of work. It's $997. Want me to send the booking link?\"",
    dontThat:
      "Lead with \"It's $997\" cold, before they've been reminded what's in it — so the number is the first and biggest thing in their head and everything after sounds like justifying.",
    why:
      "Price feels expensive or cheap only relative to what it's next to. Name it before the value and it's a big number standing alone; name it after a stack of real things and it's a small number against a large total. Same price, opposite feeling. The stack does the persuading; the ask just collects the yes.",
  },

  // ── Research (5 · pro_plus) ────────────────────────────────────────────────────────────
  {
    category: "research",
    tier: "pro_plus",
    slug: "competitor-pricing-extract",
    title: "Pull a Competitor's Pricing",
    description: "Read a competitor's page and extract their real pricing — tiers, what's included, what's hidden — into a clean comparison.",
    whenToUse: "Sizing up a competitor, setting the owner's own prices, or arming a sales conversation with what the other guy charges.",
    overview:
      "A pricing page hides as much as it shows. Pull the actual tiers, what each includes, and the games — the \"contact us\" tier, the annual-only discount, the add-ons that aren't in the headline number.",
    technique: [
      "Find every tier and its real monthly number — annualized if they only show the discounted yearly price.",
      "List what each tier includes, and note where the page is vague on purpose.",
      "Flag the hidden costs: setup fees, per-seat add-ons, overage charges, the \"call us\" enterprise tier that has no number.",
      "Note the anchor — the tier they're steering you toward, usually the middle one made to look obvious.",
      "Lay it out as a table the owner can read in ten seconds, and cite the page you pulled it from.",
    ],
    doThis:
      "\"Three tiers: $29, $79 (their anchor — 'most popular'), $199. The $29 caps at 100 contacts and has no integrations; the real entry price for a working setup is $79. Enterprise is 'contact us.' Annual billing knocks ~20%. Source: their /pricing, pulled today.\"",
    dontThat:
      "Report \"they're cheaper than us\" off the headline $29 without noticing it's a stripped tier nobody actually uses, the real comparison is their $79 to your plan, and half their value is locked behind add-ons.",
    why:
      "Pricing pages are designed to look simple and hide the real cost. The headline number is bait; the working price is a tier or two up with add-ons attached. Pulling the actual structure — not the marketing number — is what lets the owner price against reality and lets sales say \"their real cost is X\" with a receipt instead of a guess.",
  },
  {
    category: "research",
    tier: "pro_plus",
    slug: "customer-voice-extract",
    title: "Pull Real Customer Quotes",
    description: "Mine a transcript or review for the lines that sound like a real person, not a paraphrase — the exact words you can use in copy.",
    whenToUse: "Building marketing copy, case studies, or messaging from a call recording, a review, or a testimonial. Anytime you need the customer's actual voice.",
    overview:
      "The best copy is words a customer already said. Pull the verbatim lines that carry emotion and specificity, not your smoothed-over summary of them — the rough, real phrasing is what other customers recognize.",
    technique: [
      "Pull verbatim. The exact phrase (\"I was drowning in paperwork\") beats your paraphrase (\"the client experienced administrative challenges\") every time.",
      "Look for emotion and specificity — the lines where they got real, named a number, or described the moment it clicked.",
      "Keep the rough edges. Real speech has them; polishing a quote into marketing-speak kills the thing that made it believable.",
      "Tag each quote with what it proves — the pain, the result, the objection it overcomes — so you know where to use it.",
      "Never invent or \"clean up\" a quote into something they didn't say. A fabricated testimonial is a liability, not an asset.",
    ],
    doThis:
      "Pull: \"Honestly I'd given up on finding someone who'd just show up when they said they would.\" — it's specific, emotional, and overcomes the no-show objection in the customer's own voice.",
    dontThat:
      "Summarize it into \"The customer valued our reliability and professionalism\" — true, dead, and indistinguishable from every other company's testimonials.",
    why:
      "Prospects trust other customers' words far more than the company's. A verbatim quote with its rough edges intact reads as real — someone like them, talking like them. The moment you paraphrase it into clean marketing language, it sounds like you wrote it, and it stops doing the one job a testimonial has: proof from a peer.",
  },
  {
    category: "research",
    tier: "pro_plus",
    slug: "tactic-extraction",
    title: "Pull the Plays, Skip the Fluff",
    description: "Read a long video or podcast transcript and extract the named, specific tactics worth keeping — not the stories and filler around them.",
    whenToUse: "Processing a YouTube transcript, a podcast, or a long talk into something useful. When the owner wants the moves, not a book report.",
    overview:
      "Most of a talk is throat-clearing and stories. The value is the handful of specific, repeatable plays. Pull those — named, concrete, actionable — and drop the rest.",
    technique: [
      "Hunt for the specific move: a number, a sequence, a rule, a script. \"Default to the highest package\" is a play; \"always provide value\" is filler.",
      "Skip the stories unless the story IS the tactic. A war story that demonstrates a repeatable move is worth keeping; one that's just a flex isn't.",
      "Keep it concrete enough to act on. If you can't picture doing it tomorrow, it's not a tactic, it's a vibe.",
      "Name each play in a few words so it's findable later — that's how it becomes reusable instead of lost in a transcript.",
      "Note who said it and where, so the owner can go back to the source if a play pays off.",
    ],
    doThis:
      "\"Play: on the order form, default-select the highest-margin package and let buyers downsize — most stay on the default, turning a 1-unit sale into 3. (Brunson, on order-form design.)\"",
    dontThat:
      "Write \"He talked about the importance of optimizing your sales funnel and providing massive value to your audience\" — a summary of nothing the owner can actually do.",
    why:
      "A 60-minute talk has maybe five minutes of plays you can run. The rest is rapport, repetition, and stories. Extracting the named, concrete tactics turns hours of content into a short list the owner can act on this week — and naming each one makes it a reusable move instead of a half-remembered idea that evaporates by Friday.",
  },
  {
    category: "research",
    tier: "pro_plus",
    slug: "vertical-landscape-scan",
    title: "One-Page Market Scan",
    description: "Turn a handful of sources into a one-page read on a market or vertical — players, pricing, gaps, and where the opening is.",
    whenToUse: "Entering a new vertical, sizing an opportunity, or briefing the owner before a decision about a market they don't know yet.",
    overview:
      "A market scan is a one-page answer to \"what's the lay of the land and where's the opening?\" Pull from several sources, then compress to the players, the pricing reality, the gap, and the move.",
    technique: [
      "Read several sources, not one — a single page gives you one company's spin, not the market.",
      "Map the players in a line each: who they are, who they serve, what they charge. No essays.",
      "Find the pricing reality across them — the real range, not any one headline number.",
      "Name the gap: who's underserved, what nobody's doing well, where the complaints cluster.",
      "End with the opening — the one move the gap suggests — and keep the whole thing to a page someone reads standing up.",
    ],
    doThis:
      "\"Roofing-measurement SaaS: three real players, $79–$299/mo, all aimed at big firms. Gap: nothing priced or simple enough for a 2–3 truck shop, and they all hide the supplement language solo operators actually need. Opening: a stripped, cheap tier for small contractors. Sources: 4 pricing pages + 2 forum threads, pulled today.\"",
    dontThat:
      "Hand over ten pages of raw notes per competitor with no synthesis, no pricing comparison, and no answer to the only question that matters — where's the opening.",
    why:
      "The owner is making a decision, not writing a thesis. Ten pages of raw research pushes the synthesis work back onto them, which is the part they wanted done. A one-page scan that names the players, the pricing, the gap, and the move is something they can act on in a meeting — and pulling from several sources is what keeps it from being one competitor's marketing repeated back as fact.",
  },
  {
    category: "research",
    tier: "pro_plus",
    slug: "source-verification",
    title: "Every Claim Points at Its Source",
    description: "Attach the URL or source to every factual claim in research, and flag anything you couldn't verify instead of stating it as fact.",
    whenToUse: "Any research deliverable the owner will act on or repeat. Especially numbers, prices, and competitive claims that could be wrong.",
    overview:
      "A research claim without a source is a guess wearing a suit. Point every fact at where it came from, and when you can't verify something, say so plainly rather than laundering it into certainty.",
    technique: [
      "Every number, price, and named fact gets its source inline — the URL, the page, the date pulled.",
      "If you can't find the source, the claim doesn't ship as fact. Flag it: \"unverified — couldn't confirm.\"",
      "Separate what you found from what you inferred. An inference is fine; passing it off as a sourced fact isn't.",
      "Date the pull. Prices and pages change; a fact true last month may be stale, and the date tells the reader how much to trust it.",
      "When two sources disagree, say so and show both — don't silently pick one and present it as settled.",
    ],
    doThis:
      "\"Their entry price is $79/mo (their /pricing page, pulled 2026-06-09). Their churn is reportedly high — unverified, that's from one forum thread, treat as a rumor, not a number.\"",
    dontThat:
      "State \"they charge $79 and have terrible retention\" as flat fact, where the price is sourced but the retention is a stranger's comment you can't back up — now the owner repeats a rumor as data.",
    why:
      "Research gets repeated. The owner will say it on a call, put it in a deck, price against it. If a claim is wrong and there's no source, nobody catches it until it's already cost something. Sourcing every fact makes the work checkable and the mistakes findable, and flagging the unverified keeps a guess from hardening into a \"fact\" that wasn't.",
  },

  // ── Operations (5 · studio_plus) ───────────────────────────────────────────────────────
  {
    category: "operations",
    tier: "studio_plus",
    slug: "inbox-triage",
    title: "Triage the Inbox",
    description: "Sort a full inbox into respond-now, respond-this-week, archive, and delegate — so the owner sees the few things that actually need them.",
    whenToUse: "A backed-up inbox, a morning review, or a daily brief. Anytime the volume is hiding the few messages that matter.",
    overview:
      "Most of an inbox is noise. Triage it into four piles — now, this week, archive, delegate — so the owner spends their attention on the handful that's actually time-sensitive and theirs to handle.",
    technique: [
      "Respond-now: money on the line, an angry customer, a deadline today, a deal that moves if you move. These surface first.",
      "Respond-this-week: real but not urgent. Batch them so they don't interrupt the now-pile.",
      "Archive: newsletters, receipts, FYIs, threads that resolved themselves. Out of the way, not deleted.",
      "Delegate: things someone else (or the agent) can handle — draft the reply, route it, flag it for a person.",
      "Surface the now-pile as a short list with one line each, so the owner sees what needs them at a glance.",
    ],
    doThis:
      "\"3 need you now: the Henderson invoice dispute, a hot lead asking to book, and the supplier's deadline today. 6 can wait till Thursday. Archived 40 receipts and newsletters. I can draft replies to the 6 — want me to?\"",
    dontThat:
      "Hand back \"You have 49 unread emails\" with no sort — which is the same as handing back the problem, since now the owner has to triage all 49 themselves.",
    why:
      "An inbox punishes the owner for every minute they're away by burying the three messages that matter under forty that don't. Triage flips that — it does the sorting so the owner spends attention only where it counts. The four-pile split works because it maps to the only decision that matters per message: does this need me, now, ever, or not at all.",
  },
  {
    category: "operations",
    tier: "studio_plus",
    slug: "project-scaffolding",
    title: "Break a Goal Into Steps",
    description: "Turn a vague goal into milestones, then milestones into concrete tasks, so a big ask becomes a sequence someone can actually run.",
    whenToUse: "The owner names a goal that's too big to act on directly — \"launch the new service,\" \"clean up the books.\" Use before any of it gets dispatched as work.",
    overview:
      "A goal you can't start is a goal stated too big. Break it into a few milestones — the real phases — then break each milestone into tasks small enough to do. The scaffold is what makes it run.",
    technique: [
      "Restate the goal as a finished outcome, so \"done\" is unambiguous before you plan a single step.",
      "Split into milestones — 3 to 5 real phases, each a chunk that ends in something you can point at.",
      "Under each milestone, list tasks small enough to actually do — a task is one clear action, not another mini-project.",
      "Order them by dependency: what has to finish before the next thing can start. Surface what can run in parallel.",
      "Name the first task precisely. A plan that doesn't make the next move obvious is a plan nobody starts.",
    ],
    doThis:
      "\"Goal: launch the maintenance plan. Milestone 1: define the offer (price it, write what's included, set the terms). Milestone 2: build it (Stripe product, sign-up page, contract). Milestone 3: sell it (email the 40 past customers, add it to quotes). First task: write the three-tier price list — start there.\"",
    dontThat:
      "Take \"launch the maintenance plan\" and either freeze because it's too big, or jump straight to building a sign-up page before the offer or price even exists.",
    why:
      "Big goals stall because there's no obvious first move — the whole thing has to be held in your head at once. Scaffolding externalizes the structure: milestones make the size manageable, tasks make each piece doable, and ordering by dependency stops you from building the sign-up page before you've decided what you're selling. The named first task is what turns a plan into momentum.",
  },
  {
    category: "operations",
    tier: "studio_plus",
    slug: "quote-drafting-from-notes",
    title: "Draft a Quote From Messy Notes",
    description: "Turn rough notes — a photo, a voice memo, a few scribbled lines — into a clean, structured quote with scope, line items, and a total.",
    whenToUse: "The owner captured a job in the field — a quick note, a photo, a memo — and needs it turned into a quote they can send.",
    overview:
      "Field notes are messy on purpose; the owner was busy. Turn them into a real quote: the scope in plain terms, line items with quantities and prices, a total, and the terms — structured so it's ready to send.",
    technique: [
      "Pull the job out of the mess — what's being done, where, what condition things are in. Reconstruct the scope from the notes and photos.",
      "Break it into line items: each piece of work with a quantity and a price the owner can stand behind.",
      "Use the owner's real pricing from the brain, not made-up numbers. If a price is missing, flag it — don't invent it.",
      "Add the terms: what's included, what's not, how long the quote holds, payment schedule.",
      "Total it, write a one-line cover in the owner's voice, and stage it for the owner to check before it goes out.",
    ],
    doThis:
      "From \"roof, 20sq, some rot on the north side, customer wants gutters too\" → a quote with tear-off (20 sq), decking replacement (north section, flagged: confirm sq footage), new gutters (linear ft), each priced from the owner's list, totaled, with a 'valid 30 days' line.",
    dontThat:
      "Either hand back the raw notes reformatted with no prices, or invent prices the owner never set — both leave the owner doing the actual quoting or, worse, sending a number they can't honor.",
    why:
      "The gap between a captured job and a sent quote is where deals go cold — the owner means to write it up tonight and it's still sitting there Friday. Turning the notes into a ready-to-send quote closes that gap. Pulling real prices from the brain (and flagging the ones you don't have) is what keeps it honest: a fast quote that quotes the wrong number is worse than a slow one.",
  },
  {
    category: "operations",
    tier: "studio_plus",
    slug: "vendor-invoice-categorization",
    title: "Categorize a Vendor Invoice",
    description: "Read a vendor invoice and log it to the right account so the books stay clean and tax time isn't a scramble.",
    whenToUse: "A vendor bill or receipt comes in and needs to land in the books under the correct category.",
    overview:
      "Every invoice has a right home in the books. Read what it's actually for, match it to the correct account, and log it with enough detail that it makes sense at tax time without a second look.",
    technique: [
      "Read what the invoice is for, not just who it's from — a hardware-store receipt could be materials, tools, or an office supply, and the category depends on the line items.",
      "Match it to the right account in the owner's chart of accounts. Use the categories that already exist; don't invent a new one for a one-off.",
      "Split it when it's mixed — if one receipt covers materials and equipment, split the lines rather than dumping it all in one bucket.",
      "Note the job or customer when it's billable, so it can be tied back to revenue later.",
      "When the category is actually unclear, flag it for the owner instead of guessing — a wrong category quietly compounds into a tax-time mess.",
    ],
    doThis:
      "\"Supplier invoice $1,240: $1,100 shingles → Materials (job: Henderson, billable); $140 nail gun → Tools & Equipment. Split logged. The $90 'misc' line is unclear — flagged for you.\"",
    dontThat:
      "Dump the whole $1,240 into \"Supplies\" because it came from a supplier — mixing a capital tool purchase with billable job materials, which throws off both job costing and the deduction.",
    why:
      "Miscategorized invoices don't hurt today — they hurt in April, when the books don't reconcile and the deductions are wrong. Logging each one to the right account as it comes in keeps the books clean continuously, ties costs back to the jobs that earned the revenue, and means tax time is a review instead of a forensic reconstruction. Flagging the unclear ones beats a confident wrong guess that nobody catches for months.",
  },
  {
    category: "operations",
    tier: "studio_plus",
    slug: "end-of-day-reflection",
    title: "End-of-Day Reflection",
    description: "Pull the day's real activity — what shipped, what moved, what's stuck — and hand the owner a short read on what changed.",
    whenToUse: "End of the workday, as a routine or on demand. When the owner wants to close the day knowing what actually happened.",
    overview:
      "At day's end the owner should know what changed without reconstructing it from memory. Pull the real activity — what got done, what moved forward, what's stuck — and hand back a short, honest read.",
    technique: [
      "Pull what actually happened from the day's real activity — sent emails, closed tasks, calls, approvals — not a vibe.",
      "Lead with what shipped: the things that are done and verified, named specifically.",
      "Name what moved but isn't finished, and what's stuck and why — the blockers are the part the owner needs most.",
      "Surface anything that needs the owner tomorrow — a decision waiting, a follow-up due, a deadline approaching.",
      "Keep it short. A reflection that takes ten minutes to read defeats the point; the owner wants the day in thirty seconds.",
    ],
    doThis:
      "\"Today: sent 3 quotes (Henderson, Diaz, the gutter job), closed the Miller invoice, booked Thursday's crew. Stuck: the supplier still hasn't confirmed the material price — that's blocking the Diaz start. Tomorrow needs you: call Dave back, and the Miller follow-up is due.\"",
    dontThat:
      "Hand back \"It was a productive day with good progress across several areas!\" — a feeling, not a read, that tells the owner nothing and surfaces no blocker.",
    why:
      "Owners carry the whole business in their head, and at the end of a busy day that head is full and unreliable. A reflection built from real activity — not memory, not vibes — lets them close the day knowing what actually changed and start tomorrow knowing what needs them. The blockers matter most: those are the things that quietly stall the business while everyone assumes they're handled.",
  },

  // ── Decision-shape (5 · studio_plus) ───────────────────────────────────────────────────
  {
    category: "decision_shape",
    tier: "studio_plus",
    slug: "three-option-framing",
    title: "Always Three Options",
    description: "Frame a decision as three real options with their trade-offs, never a single take-it-or-leave-it recommendation.",
    whenToUse: "Any time the owner faces a real choice — a vendor, a price, a direction. When you'd otherwise just hand them one answer.",
    overview:
      "One option is an order; three options is a decision. Give the owner three real paths with honest trade-offs so they're choosing, not just approving the one thing you put in front of them.",
    technique: [
      "Build three genuine options, not one real choice padded with two strawmen. Each has to be something a reasonable person might pick.",
      "Name the trade-off on each — what you give up to get what it offers. No option is free; show the cost.",
      "Make them actually different: a cheap-and-fast, a safe-and-thorough, a bold-and-risky — not three shades of the same move.",
      "Say which you'd pick and why, but after laying out all three — a recommendation, not a foregone conclusion.",
      "Keep it scannable: three options, the trade-off on each, your pick last. The owner decides in a minute.",
    ],
    doThis:
      "\"Three ways to go on the hire: (A) contractor now — fast, flexible, costs more per hour. (B) part-timer — cheaper, slower to ramp, you manage them. (C) wait a quarter — no cost, but you stay the bottleneck. I'd do A — the bottleneck's costing more than the rate. Your call.\"",
    dontThat:
      "Hand back \"You should hire a contractor\" with no alternatives — so the owner either rubber-stamps it or has to go generate the options themselves to feel like they actually decided.",
    why:
      "A single recommendation puts the owner in a corner: agree or push back, with no map of the territory. Three real options with trade-offs hands them the map — they see what each path costs and choose with their eyes open. It also surfaces the option you might have missed, and it respects that it's their business and their call, not yours to make by omission.",
  },
  {
    category: "decision_shape",
    tier: "studio_plus",
    slug: "load-bearing-assumption",
    title: "Name the Load-Bearing Assumption",
    description: "Find the one assumption that makes a decision wrong if it's false, and check it before committing.",
    whenToUse: "Before a real commitment — a hire, a spend, a direction. When a plan depends on something being true that nobody's actually checked.",
    overview:
      "Every plan rests on one or two assumptions that, if wrong, sink it. Find the load-bearing one — the thing that has to be true for this to work — and pressure-test it before you commit, not after.",
    technique: [
      "Ask what has to be true for this decision to be right. List the assumptions underneath it.",
      "Find the load-bearing one — the assumption that, if false, makes the whole thing a mistake. There's usually one that matters most.",
      "Check whether you actually know it's true, or just hope it is. Hope is not a check.",
      "If it's unverified, verify it before committing — a cheap test now beats an expensive correction later.",
      "If you can't verify it, size the downside: what does being wrong cost? That tells you how much to bet.",
    ],
    doThis:
      "\"This whole plan assumes the 40 past customers actually want a maintenance plan — that's load-bearing. Before we build it, I'll email ten of them and ask. If half say yes, build it. If nobody bites, we just saved the build.\"",
    dontThat:
      "Build the entire maintenance-plan system, the page, the Stripe product, the contracts — on the unchecked assumption that demand exists, then discover after launch that nobody wanted it.",
    why:
      "Plans don't usually fail on the details; they fail on a wrong assumption nobody questioned. Naming the load-bearing one turns an invisible bet into a visible one you can actually test. Most of the time the test is cheap — an email, a few calls — and finding out the assumption is false before you build is the difference between a saved week and a wasted month.",
  },
  {
    category: "decision_shape",
    tier: "studio_plus",
    slug: "devils-advocate-first-pass",
    title: "Argue the Other Side First",
    description: "Before agreeing with a plan, find its strongest counter-argument and state it — so the owner decides against a real objection, not a yes-man.",
    whenToUse: "When the owner proposes something and you're inclined to agree. Especially on big or expensive calls where easy agreement is dangerous.",
    overview:
      "The most useful thing an agent can do with a plan it likes is attack it first. Find the strongest case against it — not a token objection — and put it on the table before you sign off.",
    technique: [
      "Before agreeing, ask: what's the best argument against this? Build the case a smart skeptic would make.",
      "Make it the strongest version, not a strawman you can easily knock down. If the counter is weak, you haven't found the real one.",
      "Name the specific failure: how this goes wrong, who it hurts, what it costs — concretely, not \"there are risks.\"",
      "Then weigh it straight. Sometimes the counter wins and the plan should change; sometimes it loses and you proceed with eyes open.",
      "Surface the counter even when you ultimately agree — the owner deserves to decide against a real objection, not a chorus.",
    ],
    doThis:
      "\"I think the maintenance plan's a good move, but here's the strongest case against it: it ties up your crew on low-margin recurring work right when storm season pays triple. If your crew's already maxed, this could cost you the high-margin jobs. Worth checking your capacity before we commit.\"",
    dontThat:
      "Reply \"Great idea, let's do it!\" because the owner sounded confident — adding nothing, catching nothing, and leaving the real risk for them to discover the hard way.",
    why:
      "An agent that always agrees is worthless on the decisions that matter — it just echoes the owner's confidence back at them, including the overconfidence. Arguing the other side first is how you earn your seat: you catch the failure mode the owner was too close to see. Even when the plan survives, it survives a real test, which is exactly the kind of pressure a good decision should pass.",
  },
  {
    category: "decision_shape",
    tier: "studio_plus",
    slug: "reversibility-check",
    title: "Check Whether It's Reversible",
    description: "Decide how much to deliberate by whether the decision can be undone — move fast on reversible calls, slow down on the one-way doors.",
    whenToUse: "Any decision where you're unsure how much time it deserves. The check tells you whether to just decide or to slow down.",
    overview:
      "Not every decision deserves the same care. Ask whether you can undo it cheaply. If yes, decide fast and move. If no — a one-way door — slow down, because the cost of being wrong is permanent.",
    technique: [
      "Ask: if this is wrong, how hard is it to reverse? Cheap-to-undo and costly-to-undo are different decisions.",
      "Reversible calls: decide fast, with less information. Over-deliberating a thing you can take back is its own kind of waste.",
      "One-way doors — a fire, a contract you can't exit, money you can't get back, a public move: slow down and gather more before committing.",
      "Don't treat every decision as permanent. Most aren't, and acting like they are grinds the business to a halt.",
      "Don't treat a permanent one as casual either. The whole skill is matching the deliberation to the reversibility.",
    ],
    doThis:
      "\"Switching email tools? Reversible — try it, switch back if it's worse, decide in an afternoon. Signing the two-year lease on the second location? One-way door — that one gets the slow, careful look.\"",
    dontThat:
      "Spend two weeks agonizing over which $20 software to use (reversible, just pick one) while signing a major lease on a gut feeling because it felt exciting in the moment (irreversible, deserved the agonizing).",
    why:
      "People burn their deliberation budget backwards — they over-think the small reversible stuff and under-think the big permanent stuff, because urgency and stakes don't line up with reversibility. Sorting by whether a decision can be undone fixes that: fast on the two-way doors, slow on the one-way doors. It's the single best filter for how much a decision is worth worrying about.",
  },
  {
    category: "decision_shape",
    tier: "studio_plus",
    slug: "pre-mortem",
    title: "Run a Pre-Mortem",
    description: "Before committing, assume the plan already failed and write down why — so you fix the likely failures before they happen.",
    whenToUse: "Before launching something real — a service, a campaign, a big spend. When the plan feels solid and that confidence needs a stress test.",
    overview:
      "A pre-mortem is a post-mortem you run before the failure. Assume the plan has already failed, six months out, then write the story of how — and use that story to fix the weak points now.",
    technique: [
      "Imagine it's six months later and this clearly failed. Don't ask if — assume it did.",
      "Write the story of how it failed. The specific causes, not \"it didn't work\": the demand wasn't there, the crew burned out, the price was wrong, a competitor moved first.",
      "Rank the failure modes by likelihood and damage — which of these stories is most plausible and most costly.",
      "Fix the top one or two now, while it's cheap. A pre-mortem that doesn't change the plan was just theater.",
      "Keep the list. When something starts going sideways later, you've already named it and can act fast.",
    ],
    doThis:
      "\"Pre-mortem on the maintenance plan: it failed because (1) only 5 of 40 customers signed up — demand was thin; (2) the recurring work ate crew time we needed for storm jobs; (3) churn after month two because the value wasn't visible. Fix now: test demand with 10 calls first, cap enrollment to protect crew capacity, build in a monthly 'here's what we did' touch.\"",
    dontThat:
      "Launch on pure optimism — \"this is going to be great\" — and run the actual post-mortem in six months after the avoidable failures have already cost real money.",
    why:
      "Confidence makes you blind to a plan's weak points right when you most need to see them. A pre-mortem gets around that by giving everyone permission to imagine failure — it's easier to spot what could go wrong when you start from \"it did\" instead of defending \"it will work.\" The failures you name in advance are the ones you can still prevent cheaply; the ones you don't name, you pay for later at full price.",
  },

  // ══ Plug & Play expansion (PA-STARTERSKILL-7) ════════════════════════════════════════════
  // Six more skills sourced from the open "Plug & Play Skills" operator catalog (kept generic,
  // not branded). Marketing skills unlock at Pro+; the two tool wrappers at Pro+; the diagram
  // generator at Studio+.

  // ── Marketing (3 · pro_plus) ───────────────────────────────────────────────────────────
  {
    category: "marketing",
    tier: "pro_plus",
    slug: "mkt-icp",
    title: "Define the Ideal Customer Profile",
    description: "Build a sharp ICP from the owner's real best customers — who they are, what they're worth, and the signals that spot the next one.",
    whenToUse: "Before any outreach, ad, or page that targets a market. Use when the owner says \"everyone\" is their customer, or when a campaign is missing and you don't know who it's for.",
    overview:
      "An ICP is a description specific enough to recognize a good-fit customer on sight. Build it from the owner's real winners in the brain — the customers who paid well, stayed, and were easy to serve — not from a fantasy of who they wish they sold to.",
    technique: [
      "Start from real customers in the brain. Pull the 5–10 best ones — high pay, low drama, stuck around — and look for what they share.",
      "Name the firmographics and the human: industry, size, role, and the actual person who signs — \"the owner of a 3–8 truck HVAC shop,\" not \"SMBs.\"",
      "Capture the trigger: what was happening in their world the week they bought. The event that turns a someday into a now.",
      "Write the disqualifiers too — who looks like a fit but isn't. A tight ICP says no as clearly as it says yes.",
      "Pull their pain in their own words from the brain's voice data, so the profile carries language you can reuse in copy.",
    ],
    doThis:
      "\"ICP: owner-operator of a 3–8 truck home-services business (HVAC, roofing, plumbing) doing $1–3M, losing jobs to slow quotes. Trigger: just missed a big bid because the estimate took three days. Not a fit: pre-revenue, or 50+ employees with an ops manager already.\"",
    dontThat:
      "\"Our ideal customer is any small business owner who wants to grow and values quality\" — true of everyone, useful for no one, and impossible to target.",
    why:
      "Targeting everyone is targeting no one — the message goes generic and lands nowhere. A specific ICP built from real winners tells you who to chase, what to say, and who to skip, so the owner's outreach and ad spend goes at the people most likely to buy and stay. The disqualifiers matter as much as the fit: they stop the owner from pouring effort into leads that look good and never close.",
  },
  {
    category: "marketing",
    tier: "pro_plus",
    slug: "mkt-positioning",
    title: "Write a One-Paragraph Positioning Statement",
    description: "Compress what the owner sells into one paragraph — the problem, the promise, the proof, and the price — that anchors every other piece of copy.",
    whenToUse: "Before writing a landing page, an ad, or a pitch — anything that has to say what the business is in a sentence. Use when the messaging feels scattered or every page describes the offer differently.",
    overview:
      "Positioning is the one paragraph everything else hangs off. Four parts: the problem you solve, the promise you make, the proof it's real, and the price it costs. Get those straight and the page, the ad, and the pitch all write themselves from it.",
    technique: [
      "State the problem first, in the customer's words — the specific pain, not a category. \"Quotes take three days and you lose the job\" beats \"inefficient workflows.\"",
      "Make one promise — the outcome, not the feature. What's true for them after, that wasn't before.",
      "Back it with proof: a number, a result, a named customer, a guarantee. The promise is a claim until proof makes it believable.",
      "Name the price band and what it's anchored against, so the number reads as a deal, not a surprise.",
      "Compress to one paragraph. If it takes a page to position, it isn't positioned — keep cutting until a stranger gets it in one read.",
    ],
    doThis:
      "\"Home-services owners lose jobs because quotes take days. We turn your field notes into a sent, branded quote in under an hour — our customers close 30% more bids in their first month. It's $297/mo, less than one lost job.\"",
    dontThat:
      "\"We're a cutting-edge, AI-powered platform that empowers businesses to streamline their operations and unlock growth through innovative solutions\" — four buzzwords, zero problem, no proof, no price.",
    why:
      "Without a fixed position, every piece of copy drifts and the market never forms a clear idea of what the business is. The four-part paragraph forces the decisions that matter — what problem, what promise, what proof, what price — into one place, so the landing page, the ad, and the sales call all tell the same story. Proof and price are what separate it from a slogan: they make the promise something a buyer can actually weigh.",
  },
  {
    category: "marketing",
    tier: "pro_plus",
    slug: "mkt-ugc-scripts",
    title: "Write a UGC-Style Short-Form Script",
    description: "Turn an angle and an offer into a 30–45 second creator-style script — hook, problem, demo, proof, one CTA — that sounds like a real person, not an ad.",
    whenToUse: "Producing short-form video for TikTok, Reels, or Shorts from a marketing angle. Use when the owner has an offer and a hook in mind but needs the spoken script that holds attention.",
    overview:
      "A UGC script wins or dies in the first two seconds. Open on a hook that stops the scroll, name the problem fast, show the thing working, drop one piece of proof, and end on a single ask. It has to sound like someone talking to a friend, not a brand reading a brochure.",
    technique: [
      "Open with a hook in the first line — a bold claim, a callout, a result. \"I booked 3 jobs this week from one video\" earns the next two seconds.",
      "Name the problem in one breath, in plain speech, so the right viewer thinks \"that's me.\"",
      "Show, don't describe: a beat that demonstrates the thing working — over the shoulder, on the screen, in the field.",
      "Drop one proof point — a number, a before/after, a real customer. One, not a list.",
      "End on a single CTA — \"comment QUOTE and I'll send the link.\" One ask; a script with three asks gets zero.",
      "Write it for the ear: short lines, contractions, the way the owner actually talks. Read it out loud; if you stumble, rewrite it.",
    ],
    doThis:
      "\"Hook: 'Roofers — stop losing bids because your quote takes three days.' Problem: 'By the time you write it up, they hired the other guy.' Demo: [phone screen] 'I take a photo, talk for 30 seconds, and the quote's done.' Proof: 'Closed 4 of my last 5 this way.' CTA: 'Comment QUOTE, I'll send you the tool.'\"",
    dontThat:
      "Write a 90-second monologue that opens with \"Hey guys, so today I wanted to talk about\" — no hook, no demo, buried offer, and a generic \"link in bio\" nobody acts on.",
    why:
      "Short-form is a two-second audition for the next twenty-eight. A script that opens with throat-clearing loses the viewer before the offer ever lands, and a polished ad voice gets scrolled past because the feed is full of real people. Leading with a hook, showing the thing work, and ending on one clear ask is what turns a scroll into a watch and a watch into a comment — which is the whole point of the post.",
  },

  // ── Tool wrappers (2 · pro_plus) ─────────────────────────────────────────────────────────
  {
    category: "tool",
    tier: "pro_plus",
    slug: "tool-firecrawl-scraper",
    title: "Scrape a URL to Clean Markdown (Firecrawl)",
    description: "Pull a web page into clean markdown via the Firecrawl API so it can be filed in the brain — with a graceful fallback when the key isn't set.",
    whenToUse: "When the owner drops a URL they want captured into the brain as readable text — a competitor page, an article, a doc. Use when you need the page's content, not a live screenshot.",
    overview:
      "Firecrawl turns a messy web page into clean markdown the brain can ingest. Call it with the URL, get back the main content stripped of nav and ads, and file that. If the FIRECRAWL_API_KEY isn't set, don't fail loudly — tell the owner the scraper isn't configured and offer the manual paste path.",
    technique: [
      "Check for FIRECRAWL_API_KEY before anything. No key → return a graceful 503-style notice (\"web scraping isn't set up yet\") and offer to ingest a pasted copy instead. Never throw a stack trace at the owner.",
      "POST the target URL to the Firecrawl scrape endpoint with the API key in the Authorization header — a direct REST call, no SDK.",
      "Ask for markdown output and the main content only, so the result is readable, not a dump of menus and footers.",
      "Verify before filing: if the response is empty or an error, say so and stop — don't write a blank or an error page into the brain.",
      "File the cleaned markdown into the brain with the source URL and the date pulled, so the capture is traceable later.",
    ],
    doThis:
      "Owner drops a competitor's pricing page → confirm the key is set, scrape to markdown, check it actually has the pricing text, then file it under research with the URL and today's date.",
    dontThat:
      "Call the API with no key and let it throw a 401 the owner sees as a crash — or scrape a page that returned an empty body and file the blank into the brain as if it were content.",
    why:
      "A clean-markdown capture is worth far more to the brain than a raw HTML dump full of navigation and tracking junk — it's readable, searchable, and quotable. Checking the key first and degrading gracefully is what keeps a missing setup from looking like a broken product: the owner gets a clear \"not configured yet\" and a way forward, not a stack trace. Verifying the body before filing stops the brain from quietly filling with empty pages that look like real captures.",
  },
  {
    category: "tool",
    tier: "pro_plus",
    slug: "tool-humanizer",
    title: "Strip the AI Tells From a Draft",
    description: "Rewrite a passage in the owner's (or a persona's) voice, cutting the AI slop — inflated phrasing, rule-of-three, em-dash overuse, hedge stacks, and filler — per the voice spec.",
    whenToUse: "Any draft that reads like a machine wrote it, or any text pasted in from another AI tool. Use as the last pass before something goes out under the owner's name.",
    overview:
      "AI writing has a fingerprint: inflated words, lists of three, em-dashes everywhere, hedge stacks, and tidy little summaries. Humanizing means hunting those tells and rewriting them in the owner's actual voice — pulled from their real writing in the brain — until a reader can't tell a machine touched it.",
    technique: [
      "Pull the target voice from the brain first — the owner's real writing, or the named persona's. You're matching a specific human, not \"sounding casual.\"",
      "Cut the AI vocabulary: \"leverage,\" \"delve,\" \"robust,\" \"seamless,\" \"unlock,\" \"in today's fast-paced world.\" Replace with the plain word the owner would use.",
      "Break the rule of three. AI loves \"fast, simple, and powerful.\" Real people don't list everything in threes — vary it or cut to one.",
      "Kill the hedge stacks and filler — \"it's important to note that,\" \"in order to,\" \"that being said\" — and the chipper sign-off summary at the end.",
      "Fix the em-dash habit: AI scatters them everywhere. Keep the few that earn their place; turn the rest into periods or commas.",
      "Read it back against a real sample. If a sentence still sounds like a press release and not like the owner, rewrite that sentence.",
    ],
    doThis:
      "Turn \"In today's fast-paced world, our robust solution empowers you to seamlessly leverage cutting-edge tools — efficiently, effectively, and effortlessly\" into \"This does the boring part of your day for you, so you can get back to the work that pays.\"",
    dontThat:
      "Run a find-and-replace on a few buzzwords and call it done, leaving the rule-of-three lists, the em-dash spray, and the \"Hopefully this helps!\" sign-off that still scream machine-made.",
    why:
      "Readers can feel AI writing even when they can't name why, and the moment they do, they trust the message less — it reads as mass-produced, not personal. The tells are specific and findable: inflated vocabulary, lists of three, em-dash overuse, hedge stacks, filler transitions. Hunting them down and rewriting in the owner's real voice is the difference between a draft that sounds like the person the customer hired and one that sounds like every other bot in the inbox.",
  },

  // ── Visualization (1 · studio_plus) ──────────────────────────────────────────────────────
  {
    category: "viz",
    tier: "studio_plus",
    slug: "viz-excalidraw-diagram",
    title: "Generate an Excalidraw Diagram",
    description: "Turn a description into a valid .excalidraw JSON file the owner can open at excalidraw.com — boxes, arrows, and labels laid out so it reads at a glance.",
    whenToUse: "When the owner wants a quick diagram — a flow, an org chart, a system sketch, a funnel — as an editable file rather than a static image. Use when they'll want to tweak it themselves after.",
    overview:
      "Excalidraw files are plain JSON: a list of elements (rectangles, arrows, text) with positions and a few style fields. To draw from a description, lay the nodes out on a grid, connect them with bound arrows, and emit a valid file the owner opens and edits at excalidraw.com. The skill is in the layout — spaced so it reads — not in the JSON syntax.",
    technique: [
      "Parse the description into nodes and edges first: what are the boxes, and what connects to what. Get the structure before you place anything.",
      "Lay nodes on a grid with real spacing — left-to-right for a flow, top-down for a hierarchy. Crowded boxes make an unreadable diagram no matter how correct the JSON.",
      "Emit valid Excalidraw JSON: type \"excalidraw\", a version, and an elements array of rectangles, text, and arrows, each with id, x, y, width, height. Don't invent fields the format doesn't have.",
      "Bind arrows to their endpoints (startBinding / endBinding by element id) so the diagram stays connected when the owner drags a box.",
      "Label every node and key arrow. An unlabeled diagram is a puzzle; the text is what makes it a map.",
      "Hand back a downloadable .excalidraw file and tell the owner to open it at excalidraw.com — confirm it loads rather than assuming the JSON is right.",
    ],
    doThis:
      "\"Lead flow\" → five labeled boxes left to right (Captured → Qualified → Quoted → Won → Onboarded), each ~160×60 spaced 80px apart, joined by bound arrows, emitted as a valid .excalidraw file that opens clean.",
    dontThat:
      "Stack every box at the same coordinates with no spacing, leave arrows unbound and nodes unlabeled, or emit JSON with made-up fields that Excalidraw refuses to open — a file the owner can't use is worse than a sentence.",
    why:
      "A picture settles an argument a paragraph can't — a flow or an org chart shows the shape of a thing instantly. Handing back an editable .excalidraw file instead of a flat image means the owner can move a box, fix a label, and make it theirs, which is what they'll want to do the moment they see it. The layout discipline is the whole job: correct JSON with crowded, unlabeled nodes is technically valid and practically useless.",
  },
];

// ── Render + emit ──────────────────────────────────────────────────────────────────────────

const CATEGORY_DIRS = [
  "voice_style",
  "email_drafting",
  "sales",
  "research",
  "operations",
  "decision_shape",
  "marketing",
  "tool",
  "viz",
];

const TIERS = new Set(["free", "pro_plus", "studio_plus", "enterprise"]);

/** Render one skill's markdown body (everything after the frontmatter). This exact string is what
 *  the auto-seeder copies into the brain as the SKILL.md technique body. */
function renderBody(s) {
  const lines = [];
  lines.push(`# ${s.title}`, "");
  lines.push(s.overview, "");
  lines.push("## The technique", "");
  for (const t of s.technique) lines.push(`- ${t}`);
  lines.push("");
  lines.push("## Do this, not that", "");
  lines.push(`**Do:** ${s.doThis}`, "");
  lines.push(`**Don't:** ${s.dontThat}`, "");
  lines.push("## Why this works", "");
  lines.push(s.why);
  return lines.join("\n").trim();
}

/** Render the full SKILL.md file (frontmatter + body), the SPEC §3 shape the brain expects. */
function renderFile(s) {
  const prereqs =
    s.prerequisites && s.prerequisites.length > 0
      ? `prerequisites:\n${s.prerequisites.map((p) => `  - ${JSON.stringify(p)}`).join("\n")}`
      : "prerequisites: []";
  const fm = [
    "---",
    `name: ${s.slug}`,
    `title: ${JSON.stringify(s.title)}`,
    `description: ${JSON.stringify(s.description)}`,
    `when_to_use: ${JSON.stringify(s.whenToUse)}`,
    `tier_required: ${s.tier}`,
    `category: ${s.category}`,
    `license: Proprietary`,
    `agentskills_io_compatible: true`,
    "metadata:",
    `  source: "Pocket Agent Starter Pack"`,
    `  tier_required: ${JSON.stringify(s.tier)}`,
    `  category: ${JSON.stringify(s.category)}`,
    prereqs,
    "---",
  ].join("\n");
  return `${fm}\n\n${renderBody(s)}\n`;
}

function validate() {
  const slugs = new Set();
  for (const s of SKILLS) {
    if (!CATEGORY_DIRS.includes(s.category)) throw new Error(`bad category: ${s.category}`);
    if (!TIERS.has(s.tier)) throw new Error(`bad tier: ${s.tier}`);
    if (!/^[a-z0-9-]+$/.test(s.slug)) throw new Error(`bad slug: ${s.slug}`);
    if (slugs.has(s.slug)) throw new Error(`duplicate slug: ${s.slug}`);
    slugs.add(s.slug);
    if (s.technique.length < 3 || s.technique.length > 8)
      throw new Error(`${s.slug}: technique must be 3–8 bullets`);
  }
  if (SKILLS.length !== 36) throw new Error(`expected 36 skills, got ${SKILLS.length}`);
}

function emit() {
  validate();

  // Clean + rewrite the per-category .md tree.
  for (const cat of CATEGORY_DIRS) {
    const dir = join(DATA_DIR, cat);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  for (const s of SKILLS) {
    writeFileSync(join(DATA_DIR, s.category, `${s.slug}.md`), renderFile(s), "utf8");
  }

  // Emit the typed manifest the app imports (no runtime fs).
  const records = SKILLS.map((s) => ({
    slug: s.slug,
    name: s.title,
    description: s.description,
    whenToUse: s.whenToUse,
    tierRequired: s.tier,
    category: s.category,
    prerequisites: s.prerequisites ?? [],
    body: renderBody(s),
  }));
  const manifest = `// manifest.ts — GENERATED by scripts/gen-starter-skills.mjs. Do not edit by hand.
// Edit the SKILLS array in the generator and re-run \`node scripts/gen-starter-skills.mjs\`.
//
// The 36 starter Skills shipped in the AI Office Launch Kit (PA-STARTERSKILL-1..6, plus the
// Plug & Play expansion PA-STARTERSKILL-7). The \`body\` is the SKILL.md technique copied verbatim
// into the owner's brain at seed time; the metadata drives tier-gating (lib/skills/resolve.ts) and
// the Starter Pack surface.

export type StarterSkillTier = "free" | "pro_plus" | "studio_plus" | "enterprise";
export type StarterSkillCategory =
  | "voice_style"
  | "email_drafting"
  | "sales"
  | "research"
  | "operations"
  | "decision_shape"
  | "marketing"
  | "tool"
  | "viz";

export type StarterSkillRecord = {
  slug: string;
  name: string;
  description: string;
  whenToUse: string;
  tierRequired: StarterSkillTier;
  category: StarterSkillCategory;
  prerequisites: string[];
  /** The SKILL.md technique body (markdown), copied into the brain verbatim at seed time. */
  body: string;
};

export const STARTER_SKILL_MANIFEST: readonly StarterSkillRecord[] = ${JSON.stringify(records, null, 2)};
`;
  writeFileSync(join(DATA_DIR, "manifest.ts"), manifest, "utf8");

  console.log(`Wrote ${SKILLS.length} SKILL.md files + manifest.ts to ${DATA_DIR}`);
}

emit();
