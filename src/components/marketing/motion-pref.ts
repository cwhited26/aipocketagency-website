"use client";

// The persisted "Pause animations" preference (the footer toggle) plus the shared GPU
// compositing hint for animated marketing elements. localStorage only — no cookie, no
// server involvement. Every motion shot and the Agent Builder hero subscribe; flipping
// the preference freezes them into their poster frames.
import { useSyncExternalStore, type CSSProperties } from "react";

const STORAGE_KEY = "pa-motion-paused";
const CHANGE_EVENT = "pa:motion-paused";

/**
 * Compositing hint for the elements framer-motion actually moves — never their
 * containers, which would bloat layer memory. translateZ(0) promotes opacity-only
 * movers to their own layer; framer replaces the transform on elements it translates,
 * where will-change carries the promotion instead.
 */
export const MOTION_LAYER: CSSProperties = {
  willChange: "transform, opacity",
  transform: "translateZ(0)",
};

// In-memory source of truth, seeded lazily from storage so a blocked localStorage
// (private mode / cookie settings) still honors the choice for the session.
let paused: boolean | null = null;

function readPaused(): boolean {
  if (paused === null) {
    try {
      paused = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage blocked — fall back to the in-memory default: not paused.
      paused = false;
    }
  }
  return paused;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = () => {
    paused = null; // re-seed from storage on cross-tab changes
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** True when the owner flipped the footer "Pause animations" toggle. */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, readPaused, () => false);
}

export function setMotionPaused(next: boolean): void {
  paused = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Storage blocked — the in-memory value above still applies for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Live prefers-reduced-motion. Deliberately not framer's useReducedMotion: that hook
 * snapshots once with no subscription, so when the server-rendered `data-motion`
 * attribute disagrees at hydration React never re-renders to patch it. This store
 * renders the server value first, then corrects on mount — and tracks OS changes live.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}
