// lib/channels/voice/catalog.ts — the curated 12-voice ElevenLabs catalog the setup surface shows
// (spec §setup-flow step 2). These are the public, first-party ElevenLabs voice ids (stable across
// accounts) — not secrets, so they live as static data and ship in the bundle. Studio+ unlocks
// entering an arbitrary "use my own ElevenLabs voice ID" (tierAllowsCustomVoiceId in lib/tiers/voice).
//
// The id is what we POST to /v1/text-to-speech/{voice_id}/stream-input; the label + blurb are for the
// picker UI only. If an owner's saved voice id isn't in this list (a custom Studio+ id), the picker
// shows it as "Custom voice".

export type VoiceCatalogEntry = {
  /** ElevenLabs voice id — the {voice_id} path segment for the streaming TTS endpoint. */
  id: string;
  /** Display name in the picker. */
  label: string;
  /** One-line character blurb for the picker card. */
  blurb: string;
};

// The 12 first-party ElevenLabs voices. Ids are ElevenLabs' published default-voice ids.
export const VOICE_CATALOG: readonly VoiceCatalogEntry[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", blurb: "Warm, calm, professional — the default." },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", blurb: "Deep, measured, grounded." },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", blurb: "Well-rounded, friendly, clear." },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", blurb: "Soft, gentle, reassuring." },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi", blurb: "Confident, upbeat, energetic." },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", blurb: "Bright, youthful, expressive." },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", blurb: "Casual, approachable, easygoing." },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold", blurb: "Strong, direct, no-nonsense." },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam", blurb: "Neutral, even, dependable." },
  { id: "EXAVITQu4vr4xnSDxMxL", label: "Sarah", blurb: "Polished, articulate, poised." },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie", blurb: "Natural, conversational, relaxed." },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", blurb: "Light, clear, pleasant." },
] as const;

/** The default voice when a Persona has no configured voice id — Rachel (first-party, neutral). */
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Whether a given voice id is one of the curated 12 (vs a custom Studio+ id). */
export function isCatalogVoiceId(id: string): boolean {
  return VOICE_CATALOG.some((v) => v.id === id);
}

/** The catalog entry for an id, or null if it isn't one of the curated 12. */
export function voiceCatalogEntry(id: string): VoiceCatalogEntry | null {
  return VOICE_CATALOG.find((v) => v.id === id) ?? null;
}
