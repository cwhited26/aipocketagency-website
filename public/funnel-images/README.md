# Funnel image slots

Image assets used across the APA funnel.

## Asset inventory

| File | Dimensions | Aspect | Used on | Status |
| :--- | :--- | :--- | :--- | :--- |
| `bundle-hero.png` | 1672×941 | ~16:9 | `/[kit-slug]/upgrade-bundle/[lead_id]` (hero) | LIVE — clean |
| `skool-community-card.png` | 1200×675 | 16:9 | `/skool-invite/[session_id]` (hero) | LIVE — clean |
| `dispatch-playbook-hero.png` | 1200×800 | 3:2 | `/[kit-slug]` (per-kit hero, gated) | PENDING REGEN |
| `dev-team-document-set-hero.png` | 1200×800 | 3:2 | `/[kit-slug]` (per-kit hero, gated) | PENDING REGEN |
| `claude-md-template-library-hero.png` | 1200×800 | 3:2 | `/[kit-slug]` (per-kit hero, gated) | PENDING REGEN |
| `discovery-to-mvp-prompt-pack-hero.png` | 1200×800 | 3:2 | `/[kit-slug]` (per-kit hero, gated) | PENDING REGEN |
| `wire-brain-to-stack-guide-hero.png` | 1200×800 | 3:2 | `/[kit-slug]` (per-kit hero, gated) | PENDING REGEN |

## PENDING REGEN — pulled 2026-05-12

The five per-kit hero PNGs were deleted on 2026-05-12 because they shipped with a baked-in agent caption ("Premium PDF mockup · dark-mode launch asset") that rendered as visible artwork in the upper-left of every per-kit landing page. Internal description, not customer copy.

Until clean replacements land, the per-kit hero `<Image>` element is gated by `KIT_CONFIG[slug].heroAvailable` (default `false`). Pages render hero text + form only — no broken-image box.

**To re-enable a kit's hero after regenerating:**

1. Drop the new PNG at `public/funnel-images/<slug>-hero.png`. Confirm with eyes (not just file presence) that no agent caption / mockup label / "premium PDF" subtitle is baked into the artwork.
2. Flip `heroAvailable: true` for that kit in `src/lib/kit-config.ts`.
3. Smoke: `bun run dev` → load `/<slug>` → verify the image renders and contains zero internal-asset language.

## Where each is referenced in code

- `src/app/[kit-slug]/upgrade-bundle/[lead_id]/page.tsx` — `bundle-hero.png` at top.
- `src/app/_kit/KitLandingPage.tsx` — per-kit hero from `/funnel-images/${kit.slug}-hero.png`, gated by `kit.heroAvailable`.
- `src/app/[kit-slug]/upgrade-pair/[lead_id]/page.tsx` — pair-kit hero, also gated by `bumpKit.heroAvailable`.
- `src/app/skool-invite/[session_id]/page.tsx` — `skool-community-card.png` at top.

## Add-future-images pattern

If a new asset comes in:

1. Drop it into `public/funnel-images/<slot-name>.png`.
2. Use natural dimensions in the `<Image>` component (don't crop to a fixed aspect — let the asset breathe).
3. Use `priority` only on above-the-fold conversion images.
4. Update this README's table with the new row + the page references.
5. Confirm zero internal-asset captions or agent-prompt language are visible in the rendered artwork before committing.
