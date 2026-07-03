# Persona avatars — naming convention + design brief (PA-POS-23)

The 13 SVGs in this directory are **temporary geometric placeholders**. They render everywhere a
Persona shows up — the `/app/personas` catalog and detail pages, the new-agent template picker,
the vertical onboarding tiles, the Home example-agent card, and the `/for/[persona]` marketing
pages — via the `PersonaAvatar` component (`src/components/personas/avatar.tsx`). This file is
the brief for the real art that replaces them.

## Naming convention

One file per avatar slug. The component resolves `/avatars/personas/<slug>.svg`, so replacement
art keeps the exact filenames (swap the extension in `personaAvatarSrc` if the final art ships
as PNG).

**Seven role Personas** (`src/lib/personas/templates.ts`, PA-PERSONA-30 — the five legacy
templates map onto these via their `avatarSlug`):

| File | Persona |
|---|---|
| `admin.svg` | Admin Assistant |
| `sales.svg` | Sales Assistant |
| `followup.svg` | Follow-Up Agent |
| `content.svg` | Content Creator |
| `email.svg` | Email Drafter |
| `lead-research.svg` | Lead Researcher |
| `ops-cos.svg` | Chief of Staff |

**Six onboarding verticals** (`src/lib/onboarding/verticals.ts`, PA-POS-22):

| File | Vertical |
|---|---|
| `coach.svg` | Coach |
| `consultant.svg` | Consultant |
| `contractor.svg` | Contractor |
| `med-spa.svg` | Med spa |
| `agency.svg` | Agency |
| `sales-team.svg` | Sales team |

## Target art direction

- **Cohesive illustrated portraits** — one artist, one style, all 13 in a single pass. The bar
  is a set that reads as one uniformed team, the way Twin's illustrated agents read as one
  crew. Not photos, not 3D renders, not emoji.
- **512×512, transparent background, PNG** (or SVG if the illustration style allows it).
- **Bust/portrait framing** — head and shoulders, facing slightly off-center, consistent camera
  angle across all 13.
- **Palette anchored to the product**: dark navy `#05070a` environments, cyan `#22d3ee` as the
  shared accent, one distinguishing tint per avatar (the placeholders carry a starting palette —
  each file's fill colors are the suggested per-persona tint).
- **Role read at a glance**: each role Persona carries one prop or wardrobe cue (envelope for
  the Email Drafter, magnifier for the Lead Researcher, headset for the Admin Assistant, and so
  on). Vertical avatars cue the business, not a person's demographic — hard hat for contractor,
  whistle for coach.
- **Works at 32px**: the smallest render is a 32×32 catalog chip. Silhouettes must stay
  readable there; detail lives in the 96px+ renders.
- **No text in the art** — the placeholder initials go away with the placeholders.

## Replacement checklist

1. Export all 13 at 512×512 with transparency, filenames exactly as above.
2. Drop them in this directory (and update `personaAvatarSrc` if the extension changed).
3. Delete the placeholder note comments — nothing else references the placeholder internals.
4. `src/lib/personas/__tests__/avatars.test.ts` pins that every slug has a file; it keeps
   passing as long as the filenames hold.
