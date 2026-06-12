// oklch.ts — sRGB → OKLCH conversion for the Design DNA palette (PA-DNA-3: every color is the
// oklch the engine computed). Chrome serializes computed colors as rgb()/rgba() for sRGB-gamut
// values; this converts those to the Tailwind-v4-native oklch space using Björn Ottosson's OKLab
// matrices. Dependency-free and pure so the math is unit-tested in isolation.

export type ParsedRgb = { r: number; g: number; b: number; alpha: number };

/** Parse a computed CSS color (rgb / rgba / #hex). Returns null for anything else. */
export function parseCssColor(value: string): ParsedRgb | null {
  const v = value.trim().toLowerCase();

  const rgbMatch = v.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgbMatch) {
    return {
      r: Math.min(255, Number(rgbMatch[1])),
      g: Math.min(255, Number(rgbMatch[2])),
      b: Math.min(255, Number(rgbMatch[3])),
      alpha: rgbMatch[4] === undefined ? 1 : Math.min(1, Number(rgbMatch[4])),
    };
  }

  // Modern space-separated form: rgb(13 17 23 / 0.8)
  const modernMatch = v.match(
    /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)$/,
  );
  if (modernMatch) {
    const alphaRaw = modernMatch[4];
    const alpha =
      alphaRaw === undefined
        ? 1
        : alphaRaw.endsWith("%")
          ? Math.min(1, Number(alphaRaw.slice(0, -1)) / 100)
          : Math.min(1, Number(alphaRaw));
    return {
      r: Math.min(255, Number(modernMatch[1])),
      g: Math.min(255, Number(modernMatch[2])),
      b: Math.min(255, Number(modernMatch[3])),
      alpha,
    };
  }

  const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        alpha: 1,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  return null;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Convert a computed CSS color to an oklch() string ("oklch(0.145 0.004 285.8)", with "/ a" when
 * translucent). A value already in oklch passes through; an unparseable value returns null —
 * the palette builder omits it rather than guessing (SPEC principle 4).
 */
export function cssColorToOklch(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("oklch(")) return trimmed;

  const rgb = parseCssColor(trimmed);
  if (!rgb) return null;

  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // OKLab (Björn Ottosson, 2020) — linear sRGB → LMS → cube root → Lab.
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);

  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  // Hue is meaningless at zero chroma — serialize as 0 so equal grays compare equal.
  if (C < 0.0005) H = 0;

  const lStr = Number(L.toFixed(3));
  const cStr = Number(C.toFixed(3));
  const hStr = Number(H.toFixed(1));
  const base = `oklch(${lStr} ${cStr} ${hStr})`;
  if (rgb.alpha >= 1) return base;
  return `oklch(${lStr} ${cStr} ${hStr} / ${Number(rgb.alpha.toFixed(3))})`;
}

/** True when the computed color is fully transparent (Chrome's "rgba(0, 0, 0, 0)"). */
export function isTransparent(value: string): boolean {
  const rgb = parseCssColor(value);
  return rgb !== null && rgb.alpha === 0;
}

/** Relative luminance proxy from the parsed color — used for dark/light mode + contrast checks. */
export function approxLuminance(value: string): number | null {
  const rgb = parseCssColor(value);
  if (!rgb) return null;
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}
