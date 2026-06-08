"use client";

// UploadCard — renders the upload_result inline card in the Ask box thread. When the owner drops
// a screenshot/PDF into chat, the bytes are stored and read by Claude vision; this card shows the
// thumbnail(s), the text the agent pulled out, and an honest footer about whether the agent can
// read it. The OCR text also rides in the message body, so the agent answers about it directly.

import { useState } from "react";
import type { UploadResultPayload, UploadCardFile } from "@/lib/chat/upload-card";

function assetUrl(path: string): string {
  return `/api/app/brain/asset?path=${encodeURIComponent(path)}`;
}

function FileBlock({ file }: { file: UploadCardFile }) {
  const [showText, setShowText] = useState(false);
  const isPdf = file.mimeType === "application/pdf";
  const hasThumb = Boolean(file.assetPath) && !isPdf;

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <div className="flex gap-3 p-2.5">
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- private-repo asset proxied by /api/app/brain/asset; next/image can't auth it.
          <img
            src={assetUrl(file.assetPath)}
            alt={file.fileName}
            className="w-16 h-16 rounded-md object-cover border border-slate-700/60 bg-[#0b1016] shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-md border border-slate-700/60 bg-[#0b1016] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono text-slate-500">{isPdf ? "PDF" : "FILE"}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-mono text-slate-300 truncate">{file.fileName}</p>
          {file.ocrOk ? (
            <>
              {file.structuredDescription && (
                <p className="mt-0.5 text-[12px] text-slate-400 leading-snug line-clamp-2">
                  {file.structuredDescription}
                </p>
              )}
              {file.extractedText && (
                <button
                  onClick={() => setShowText((v) => !v)}
                  className="mt-1 text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
                >
                  {showText ? "Hide extracted text" : "Show extracted text"}
                </button>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-[12px] text-amber-300/80 leading-snug">
              {file.note ?? "Saved — couldn't read its text automatically."}
            </p>
          )}
        </div>
      </div>
      {file.ocrOk && file.extractedText && showText && (
        <pre className="max-h-56 overflow-auto border-t border-slate-800/60 bg-[#0b1016] px-3 py-2 text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap">
          {file.extractedText}
        </pre>
      )}
    </div>
  );
}

export default function UploadCard({ payload }: { payload: UploadResultPayload }) {
  const anyReadable = payload.files.some((f) => f.ocrOk);
  return (
    <div className="max-w-[85%] flex flex-col gap-2 items-end">
      {payload.caption && (
        <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap bg-slate-800 border border-slate-700/60">
          {payload.caption}
        </div>
      )}
      <div className="w-full flex flex-col gap-1.5">
        {payload.files.map((file, i) => (
          <FileBlock key={`${file.assetPath}-${i}`} file={file} />
        ))}
      </div>
      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
        <span className={anyReadable ? "text-[#22d3ee]" : "text-amber-400/70"}>●</span>
        {anyReadable
          ? payload.files.length > 1
            ? "Agent can see these."
            : "Agent can see this."
          : "Saved to your brain — the agent can't read the text."}
      </p>
    </div>
  );
}
