# Poc variant art — file contract + design brief (PA-POS-33)

The 8 PNGs in this directory are **temporary geometric placeholders** for Poc, Pocket Agent's
character — a friendly alien who lives in the customer's pocket and does the work. They render
wherever a Persona shows up, via the `PersonaAvatar` component
(`src/components/personas/avatar.tsx`) and the variant registry
(`src/lib/personas/poc-variants.ts`). Chase is iterating the real character art in Adobe
Firefly / Midjourney; the swap is a file drop per variant — same filenames, no code changes.

## File contract

- `poc-<variant>.png`, **512×512, transparent background**, one file per variant.
- A drift-guard test (`src/lib/personas/__tests__/poc-variants.test.ts`) pins every declared
  variant to a file here and rejects orphan files — rename nothing without updating the
  registry.

| File | Variant | Role it renders for |
|---|---|---|
| `poc-default.png` | default | Email Drafter, all six verticals, everything unmapped |
| `poc-glasses.png` | glasses | Lead Researcher |
| `poc-headset.png` | headset | Sales Assistant |
| `poc-clipboard.png` | clipboard | Admin Assistant |
| `poc-spatula.png` | spatula | Content Creator |
| `poc-coffee.png` | coffee | Follow-Up Agent |
| `poc-compass.png` | compass | Operations Chief of Staff |
| `poc-hammer.png` | hammer | reserved (Ops / trades verticals) |

## Design brief (Positioning Lock §23.1)

- Small, palm-scale alien. Round or bean-shaped body. **The eyes carry the personality.**
- Navy `#05070a` body with cyan `#22d3ee` accents. Placeholders use the persona-card navy
  family (`#0a1f28` / `#0b2b35` / `#0c333e`) so they sit flush with the shipped SVGs.
- One signature prop per role. Same lineweight, same palette, same lighting, same eye style
  across every variant — different props, one Poc.
- Not a robot. Not a superhero. Not gendered. Friendly, not childish.

Voice bio: `whited-brain/voice/poc-character-bio.md`.
