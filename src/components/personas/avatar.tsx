// avatar.tsx — the persona avatar, now rendered by Poc (PA-POS-33 on top of PA-POS-23). One
// character in different roles, shown wherever a Persona shows up: the /app/personas catalog +
// detail pages, the new-agent template picker, the vertical onboarding tiles, the Home
// example-agent card, and the /for/[persona] marketing pages. The slug→variant map and the
// art file contract live in lib/personas/poc-variants.ts; when a variant's Poc art hasn't
// shipped, the component falls back to the pre-Poc placeholder SVG at
// public/avatars/personas/<slug>.svg. Swapping the art never touches this component.
//
// No hooks, no client directive — renders in server components (marketing pages) and client
// components (app surfaces) alike.

import Image from "next/image";
import {
  PERSONA_AVATAR_NAMES,
  PERSONA_AVATAR_SIZES,
  personaAvatarSrc,
  type PersonaAvatarSize,
} from "@/lib/personas/avatars";
import { resolvePocArt, type PocVariant } from "@/lib/personas/poc-variants";

const ROUNDING: Record<PersonaAvatarSize, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

export function PersonaAvatar({
  slug,
  size = "md",
  alt,
  className,
  variant,
}: {
  /** Avatar slug — a persona template's avatarSlug or a vertical's avatarSlug. */
  slug: string;
  size?: PersonaAvatarSize;
  /** Defaults to the persona display name for the slug. */
  alt?: string;
  className?: string;
  /** Explicit Poc variant — overrides the slug→variant map when set. */
  variant?: PocVariant;
}) {
  const px = PERSONA_AVATAR_SIZES[size];
  const art = resolvePocArt(slug, variant);
  const label = alt ?? PERSONA_AVATAR_NAMES[slug] ?? slug;
  const rounding = ROUNDING[size];
  const extra = className ? ` ${className}` : "";

  if (art.src === null) {
    return (
      <Image
        src={personaAvatarSrc(art.fallbackAvatarSlug)}
        width={px}
        height={px}
        alt={label}
        className={`shrink-0 ${rounding}${extra}`}
      />
    );
  }

  // The Poc PNGs are transparent — the card behind them carries the navy (or the
  // vertical's tint), matching the rounded-card framing of the pre-Poc SVGs.
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${rounding} ${art.cardClass}${extra}`}
      style={{ width: px, height: px }}
    >
      <Image src={art.src} width={px} height={px} alt={label} />
    </span>
  );
}
