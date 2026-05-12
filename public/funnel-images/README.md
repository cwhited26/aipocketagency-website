# Funnel image slots

Image assets used across the APA funnel. All 7 final assets delivered by
Chase (ChatGPT-generated) are now wired live.

## Asset inventory (all LIVE)

| File | Dimensions | Aspect | Used on |
| :--- | :--- | :--- | :--- |
| `bundle-hero.png` | 1672×941 | ~16:9 | `/upsell-bundle/[session_id]` (hero, top of page) · all 5 `/[kit-slug]/checkout` pages (passive footer / social-proof below form) |
| `dispatch-playbook-hero.png` | 1200×800 | 3:2 | `/dispatch-playbook/checkout` (hero between subhead and form) · `/dispatch-playbook` marketing page (hero between subhead and CTA) |
| `dev-team-document-set-hero.png` | 1200×800 | 3:2 | `/dev-team-document-set/checkout` (hero between subhead and form) |
| `claude-md-template-library-hero.png` | 1200×800 | 3:2 | `/claude-md-template-library/checkout` (hero between subhead and form) |
| `discovery-to-mvp-prompt-pack-hero.png` | 1200×800 | 3:2 | `/discovery-to-mvp-prompt-pack/checkout` (hero between subhead and form) |
| `wire-brain-to-stack-guide-hero.png` | 1200×800 | 3:2 | `/wire-brain-to-stack-guide/checkout` (hero between subhead and form) |
| `skool-community-card.png` | 1200×675 | 16:9 | `/skool-invite/[session_id]` (hero, top of page) |

## Divergences from original plan

- **Per-kit hero aspect = 3:2, not 16:9.** Original placeholder dimensions
  in this README assumed 1200×675. Final delivered assets are 1200×800
  (3:2). All `<Image>` components use natural `width={1200} height={800}`
  so the surrounding layout flows from the asset, not a fixed
  `aspect-[16/9]` box. Bundle hero (16:9-ish) and Skool card (16:9)
  retained the planned aspect.

## Where each is referenced in code

- `src/app/upsell-bundle/[session_id]/page.tsx` — `bundle-hero.png` at top.
- `src/app/_kit/KitCheckoutPage.tsx` — per-kit hero from
  `/funnel-images/${kit.slug}-hero.png` (resolves to 5 distinct files),
  rendered between the title block and the form. Bundle-hero footer below
  the form remains as passive social-proof for the upsell.
- `src/app/dispatch-playbook/page.tsx` — `dispatch-playbook-hero.png`
  between hero subhead and CTA on the marketing page.
- `src/app/skool-invite/[session_id]/page.tsx` — `skool-community-card.png`
  at top.

## Add-future-images pattern

If a new asset comes in:

1. Drop it into `public/funnel-images/<slot-name>.png`.
2. Use natural dimensions in the `<Image>` component (don't crop to a
   fixed aspect — let the asset breathe).
3. Use `priority` only on above-the-fold conversion images.
4. Update this README's table with the new row + the page references.
