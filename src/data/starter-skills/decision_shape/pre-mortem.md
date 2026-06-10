---
name: pre-mortem
description: "Before committing, assume the plan already failed and write down why — so you fix the likely failures before they happen."
when_to_use: "Before launching something real — a service, a campaign, a big spend. When the plan feels solid and that confidence needs a stress test."
tier_required: studio_plus
category: decision_shape
prerequisites: []
---

# Run a Pre-Mortem

A pre-mortem is a post-mortem you run before the failure. Assume the plan has already failed, six months out, then write the story of how — and use that story to fix the weak points now.

## The technique

- Imagine it's six months later and this clearly failed. Don't ask if — assume it did.
- Write the story of how it failed. The specific causes, not "it didn't work": the demand wasn't there, the crew burned out, the price was wrong, a competitor moved first.
- Rank the failure modes by likelihood and damage — which of these stories is most plausible and most costly.
- Fix the top one or two now, while it's cheap. A pre-mortem that doesn't change the plan was just theater.
- Keep the list. When something starts going sideways later, you've already named it and can act fast.

## Do this, not that

**Do:** "Pre-mortem on the maintenance plan: it failed because (1) only 5 of 40 customers signed up — demand was thin; (2) the recurring work ate crew time we needed for storm jobs; (3) churn after month two because the value wasn't visible. Fix now: test demand with 10 calls first, cap enrollment to protect crew capacity, build in a monthly 'here's what we did' touch."

**Don't:** Launch on pure optimism — "this is going to be great" — and run the actual post-mortem in six months after the avoidable failures have already cost real money.

## Why this works

Confidence makes you blind to a plan's weak points right when you most need to see them. A pre-mortem gets around that by giving everyone permission to imagine failure — it's easier to spot what could go wrong when you start from "it did" instead of defending "it will work." The failures you name in advance are the ones you can still prevent cheaply; the ones you don't name, you pay for later at full price.
