"use client";

import { useState, useRef, useCallback, DragEvent } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type UploadResult = {
  ok: boolean;
  stored?: boolean;
  absorbed?: boolean;
  noKey?: boolean;
  message?: string;
  memoryPath?: string;
  assetPath?: string;
  summary?: string;
  error?: string;
};

type UploadState =
  | { status: "idle" }
  | { status: "dragging" }
  | { status: "selected"; file: File }
  | { status: "uploading"; fileName: string }
  | { status: "done"; result: UploadResult; fileName: string }
  | { status: "error"; message: string };

type Props = {
  compact?: boolean;
  onAbsorbed?: (result: UploadResult) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const ACCEPT = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

// ─── Absorbing animation ───────────────────────────────────────────────────────

function AbsorbingVisual() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
        <div
          className="absolute inset-0 rounded-full border border-[#22d3ee]/20 pointer-events-none"
          style={{ animation: "halo-out 2.5s ease-out 0s infinite" }}
        />
        <div
          className="absolute inset-0 rounded-full border border-[#22d3ee]/10 pointer-events-none"
          style={{ animation: "halo-out 2.5s ease-out 1s infinite" }}
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.18) 0%, transparent 70%)",
            animation: "alien-morph 4s ease-in-out infinite",
          }}
        />
        <div
          className="relative z-10 rounded-full animate-pulse"
          style={{
            width: 10,
            height: 10,
            background: "radial-gradient(circle, #22d3ee 0%, rgba(34,211,238,0.3) 100%)",
            boxShadow: "0 0 8px rgba(34,211,238,0.6)",
          }}
        />
      </div>
      <span className="text-[11px] font-mono text-[#22d3ee]/70 tracking-[0.15em] animate-pulse">
        ABSORBING…
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FileUploadZone({ compact = false, onAbsorbed }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setState({ status: "selected", file });
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((s) => (s.status === "idle" ? { status: "dragging" } : s));
  }, []);

  const handleDragLeave = useCallback(() => {
    setState((s) => (s.status === "dragging" ? { status: "idle" } : s));
  }, []);

  async function upload(file: File) {
    setState({ status: "uploading", fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/app/brain/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as UploadResult & { error?: string };

      if (!res.ok && res.status !== 207) {
        setState({ status: "error", message: data.error ?? `Upload failed (${res.status}).` });
        return;
      }

      const result: UploadResult = { ...data };
      setState({ status: "done", result, fileName: file.name });
      onAbsorbed?.(result);
    } catch {
      setState({ status: "error", message: "Network error. Check your connection and try again." });
    }
  }

  function reset() {
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Compact idle drop zone ─────────────────────────────────────────────────

  if (state.status === "idle" || state.status === "dragging") {
    const isDragging = state.status === "dragging";
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border transition-all duration-200 ${
          compact ? "px-4 py-3" : "px-6 py-8"
        } ${
          isDragging
            ? "border-[#22d3ee]/60 bg-[#22d3ee]/8"
            : "border-dashed border-slate-700/80 hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/4 bg-slate-900/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className={`flex items-center gap-3 ${compact ? "" : "flex-col text-center"}`}>
          <div
            className="shrink-0 flex items-center justify-center rounded-lg border border-dashed"
            style={{
              width: compact ? 28 : 40,
              height: compact ? 28 : 40,
              borderColor: isDragging ? "rgba(34,211,238,0.5)" : "rgba(100,116,139,0.4)",
              background: isDragging ? "rgba(34,211,238,0.06)" : "transparent",
            }}
          >
            <svg
              width={compact ? 12 : 16}
              height={compact ? 12 : 16}
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: isDragging ? "#22d3ee" : "#475569" }}
            >
              <path
                d="M8 2v9M5 5L8 2l3 3M2.5 11.5A2.5 2.5 0 005 14h6a2.5 2.5 0 002.5-2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p
              className={`font-medium text-slate-300 ${compact ? "text-[12px]" : "text-sm"}`}
              style={{ color: isDragging ? "#22d3ee" : undefined }}
            >
              {compact
                ? "Drop files or photos to feed your brain"
                : "Drop files or photos about your business"}
            </p>
            {!compact && (
              <p className="text-xs text-slate-500 mt-1">
                PDF, PNG, JPG, WebP, TXT, MD · up to 10 MB · the agent absorbs them into memory
              </p>
            )}
            {compact && (
              <p className="text-[10px] text-slate-600 mt-0.5">PDF, PNG, JPG, TXT, MD · 10 MB max</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── File selected ──────────────────────────────────────────────────────────

  if (state.status === "selected") {
    const { file } = state;
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-lg border border-slate-700"
            style={{ width: 32, height: 32, background: "rgba(34,211,238,0.06)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 1.5h5.5L11 4v8.5H3v-11z"
                stroke="#22d3ee"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <path d="M8.5 1.5V4H11" stroke="#22d3ee" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate font-medium">{file.name}</p>
            <p className="text-[10px] text-slate-500 font-mono">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-slate-600 hover:text-slate-400 transition-colors p-1"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => upload(file)}
          className="w-full rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
        >
          Absorb into brain →
        </button>
      </div>
    );
  }

  // ── Uploading ──────────────────────────────────────────────────────────────

  if (state.status === "uploading") {
    return (
      <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-4 py-6 flex flex-col items-center gap-3">
        <AbsorbingVisual />
        <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{state.fileName}</p>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (state.status === "done") {
    const { result, fileName } = state;
    const isAbsorbed = result.absorbed === true;
    const isNoKey = result.noKey === true;

    return (
      <div
        className={`rounded-xl border px-4 py-4 space-y-3 ${
          isAbsorbed
            ? "border-[#22d3ee]/30 bg-[#22d3ee]/6"
            : isNoKey
            ? "border-amber-500/25 bg-amber-500/5"
            : "border-slate-700/60 bg-slate-900/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className="text-xs mt-0.5 shrink-0"
            style={{ color: isAbsorbed ? "#22d3ee" : isNoKey ? "#f59e0b" : "#64748B" }}
          >
            {isAbsorbed ? "◈" : isNoKey ? "○" : "○"}
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            <p
              className="text-sm font-medium"
              style={{ color: isAbsorbed ? "#22d3ee" : isNoKey ? "#fbbf24" : "#94a3b8" }}
            >
              {isAbsorbed ? "Absorbed" : isNoKey ? "Stored (not yet absorbed)" : "Stored"}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">{result.message}</p>
            {isAbsorbed && result.memoryPath && (
              <p className="text-[10px] font-mono text-[#22d3ee]/60 mt-1">→ {result.memoryPath}</p>
            )}
            {isNoKey && (
              <a
                href="/app/settings"
                className="inline-block text-[11px] font-mono text-[#22d3ee] hover:underline mt-1"
              >
                Add Anthropic key in Settings →
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            Upload another →
          </button>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-4 space-y-3">
      <p className="text-sm text-red-400">{state.message}</p>
      <button
        type="button"
        onClick={reset}
        className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← Try again
      </button>
    </div>
  );
}
