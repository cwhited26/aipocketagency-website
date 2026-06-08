"use client";

// AttachControls — the paperclip (+ mobile-only camera) affordances on the Ask box composer, plus
// the staged-attachment chips. The paperclip opens a multi-file picker; the camera button (shown
// only at mobile breakpoints) uses capture="environment" to open the rear camera straight to a
// photo. Both call onAddFiles; the parent owns the staged-file state and the upload on send.

import { useRef } from "react";

// PNG / JPG / WEBP / HEIC / GIF / PDF — the Ask box upload set (server re-validates).
export const ATTACH_ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,application/pdf";
export const MAX_ATTACH_FILES = 5;
export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

export function AttachControls({
  onAddFiles,
  disabled,
}: {
  onAddFiles: (files: FileList | null) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ATTACH_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label="Attach images or PDFs"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 disabled:opacity-40 transition-all"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Take a photo"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 disabled:opacity-40 transition-all"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
    </>
  );
}

export function AttachmentChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      {files.map((file, i) => (
        <span
          key={`${file.name}-${i}`}
          className="inline-flex items-center gap-1.5 max-w-[180px] rounded-md border border-slate-700/60 bg-slate-800/70 px-2 py-1 text-[11px] font-mono text-slate-300"
        >
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(i)}
            className="text-slate-500 hover:text-slate-200 leading-none"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
