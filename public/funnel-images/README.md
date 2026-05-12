# Funnel image slots

Image placeholders used across the APA funnel. Chase generates these in
ChatGPT (or hands them to a designer); the placeholder div on each page is
labeled with the exact slot name and dimensions below. Drop the final asset
into this directory and replace the placeholder `<div>` with an `<Image>`
component (Next.js) at the same dimensions.

## Slots

| Slot | Dimensions | Page(s) | Suggested content |
| :--- | :--- | :--- | :--- |
| `stack-of-5-pdfs.png` | 1200×675 (16:9) | `/upsell-bundle/[session_id]` (page.tsx) | All 5 PDFs displayed on an iPad / phone / desktop — Chase generating the kits via ChatGPT, hero-style stack shot. |
| `skool-community.png` | 1200×675 (16:9) | `/skool-invite/[session_id]` (page.tsx) | AI Pocket Agency Skool community screenshot or composed mockup (classroom view + a couple live members). |

## Swap pattern

When the final image is ready:

1. Save it into `public/funnel-images/<slot-name>.png` (or `.webp` — match the
   filename in the table above).
2. Find the placeholder `<div>` in the page (search for the
   `IMAGE-SLOT:` comment — see for example
   `src/app/upsell-bundle/[session_id]/page.tsx`).
3. Replace the placeholder block with:

   ```tsx
   import Image from "next/image";

   <Image
     src="/funnel-images/stack-of-5-pdfs.png"
     alt="All 5 APA kits on iPad, phone, and desktop"
     width={1200}
     height={675}
     className="w-full rounded-xl"
     priority
   />
   ```

4. Remove the `IMAGE-SLOT:` comment line so a future grep doesn't flag it
   as still pending.

## Notes

- Use `priority` on the bundle/skool images since they're above-the-fold on
  conversion pages.
- Keep the 16:9 ratio — the placeholder divs use `aspect-[16/9]` and the
  surrounding layout was sized against that ratio.
- If you ship a `.webp` instead of `.png`, also keep the file name aligned
  with the table — update this README in the same PR.
