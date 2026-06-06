"use client";

import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { DocPreviewPayload, FilterTag } from "@/lib/chat/types";

function humanSize(bytes?: number): string | null {
  if (bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocPreviewCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: DocPreviewPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  const size = humanSize(payload.sizeBytes);
  return (
    <CardShell
      title={payload.fileName}
      accent="#38bdf8"
      icon={<RailIcon iconKey="docs" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <div className="flex gap-3">
        {payload.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.thumbnailUrl}
            alt={payload.fileName}
            className="h-16 w-16 rounded-md object-cover border border-slate-800 shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
            {payload.mimeType && <span>{payload.mimeType}</span>}
            {size && <span>· {size}</span>}
          </div>
          {payload.excerpt && (
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed line-clamp-3">
              {payload.excerpt}
            </p>
          )}
        </div>
      </div>
      {payload.openHref && (
        <a
          href={payload.openHref}
          className="mt-2.5 inline-block text-[12px] font-mono text-[#38bdf8] hover:underline"
        >
          Open file →
        </a>
      )}
    </CardShell>
  );
}
