// avatar.tsx — the illustrated persona avatar (PA-POS-23). One consistent visual identity for
// every agent, rendered wherever a Persona shows up: the /app/personas catalog + detail pages,
// the new-agent template picker, the vertical onboarding tiles, the Home example-agent card,
// and the /for/[persona] marketing pages. Art lives at public/avatars/personas/<slug>.svg —
// geometric placeholders today, real illustrated portraits when the design task lands (the
// brief is public/avatars/personas/README.md). Swapping the art never touches this component.
//
// No hooks, no client directive — renders in server components (marketing pages) and client
// components (app surfaces) alike. The slug/size/path contract lives in lib/personas/avatars.ts
// so the drift-guard test stays JSX-free.

import Image from "next/image";
import {
  PERSONA_AVATAR_NAMES,
  PERSONA_AVATAR_SIZES,
  personaAvatarSrc,
  type PersonaAvatarSize,
} from "@/lib/personas/avatars";

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
}: {
  /** Avatar slug — a persona template's avatarSlug or a vertical's avatarSlug. */
  slug: string;
  size?: PersonaAvatarSize;
  /** Defaults to the persona display name for the slug. */
  alt?: string;
  className?: string;
}) {
  const px = PERSONA_AVATAR_SIZES[size];
  return (
    <Image
      src={personaAvatarSrc(slug)}
      width={px}
      height={px}
      alt={alt ?? PERSONA_AVATAR_NAMES[slug] ?? slug}
      className={`shrink-0 ${ROUNDING[size]}${className ? ` ${className}` : ""}`}
    />
  );
}
