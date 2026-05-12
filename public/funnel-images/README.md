# Funnel image slots

Image assets used across the APA funnel. Chase generates these in ChatGPT
(or hands them to a designer); the per-page slots below note dimensions and
status. Drop a final asset into this directory and replace the placeholder
`<div>` with a Next.js `<Image>` at the same dimensions.

## Asset inventory

| File | Dimensions | Status | Used on |
| :--- | :--- | :--- | :--- |
| `bundle-hero.png` | 1672×941 (~16:9) | LIVE 2026-05-11 | `/upsell-bundle/[session_id]` (hero) · all 5 `/[kit-slug]/checkout` pages (passive footer / social proof) |
| `dispatch-playbook-hero.png` | 1200×675 (16:9) | PENDING | (slot reserved; not yet referenced on a page) |
| `dev-team-document-set-hero.png` | 1200×675 (16:9) | PENDING | (slot reserved) |
| `claude-md-template-library-hero.png` | 1200×675 (16:9) | PENDING | (slot reserved) |
| `discovery-to-mvp-prompt-pack-hero.png` | 1200×675 (16:9) | PENDING | (slot reserved) |
| `wire-brain-to-stack-guide-hero.png` | 1200×675 (16:9) | PENDING | (slot reserved) |
| `skool-community-card.png` | 1200×675 (16:9) | PENDING | `/skool-invite/[session_id]` (hero) |

## Bundle hero (`bundle-hero.png`) — shipped

Composed shot showing all 5 APA kits on real devices: MacBook (Dispatch
Playbook), iPad (Dev-Team Document Set), iPhone (CLAUDE.md Template
Library), plus two physical PDFs in front (Discovery → MVP, Wire-Brain-to-
Stack). Dark slate background, cyan/indigo accents, monospace bracket
markers, "AI POCKET AGENCY" wordmark.

Wired live at:

- `src/app/upsell-bundle/[session_id]/page.tsx` — full-width hero above the
  bundle pricing block
- `src/app/_kit/KitCheckoutPage.tsx` — passive footer image below the
  checkout form on every kit checkout page (preview of "the full stack")

## Swap pattern (for pending slots)

When the final image is ready:

1. Save it into `public/funnel-images/<slot-name>.png` (or `.webp` — match
   the filename in the table above).
2. Find the placeholder `<div>` in the page (search for the `IMAGE-SLOT:`
   comment — e.g. `src/app/skool-invite/[session_id]/page.tsx`).
3. Replace the placeholder block with:

   ```tsx
   import Image from "next/image";

   <Image
     src="/funnel-images/skool-community-card.png"
     alt="AI Pocket Agency Skool community classroom"
     width={1200}
     height={675}
     priority
     className="block w-full h-auto rounded-xl"
   />
   ```

4. Remove the `IMAGE-SLOT:` comment line so a future grep doesn't flag it
   as still pending.

## Notes

- Use `priority` on the bundle / skool images since they're above-the-fold
  on conversion pages.
- Keep the 16:9 ratio — the placeholder divs use `aspect-[16/9]` and the
  surrounding layout was sized against that ratio.
- If you ship `.webp` instead of `.png`, also keep the filename aligned
  with the table — update this README in the same commit.
- Per-kit single-product hero images are reserved slots; no page references
  them yet. When they ship, decide whether to swap them into the existing
  kit checkout pages (replacing the bundle-hero footer) or use them on the
  kit landing pages.
