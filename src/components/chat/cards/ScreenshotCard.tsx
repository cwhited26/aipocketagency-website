"use client";

import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { FilterTag, ScreenshotPayload } from "@/lib/chat/types";

export default function ScreenshotCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: ScreenshotPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  return (
    <CardShell
      title={payload.fileName ?? "Screenshot"}
      accent="#34d399"
      icon={<RailIcon iconKey="capture" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <div className="flex gap-3">
        {payload.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.thumbnailUrl}
            alt={payload.fileName ?? "Screenshot"}
            className="h-20 w-20 rounded-md object-cover border border-slate-800 shrink-0"
          />
        )}
        {payload.extractedText && (
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
              Extracted text
            </p>
            <p className="text-sm text-slate-300 leading-relaxed line-clamp-5">
              {payload.extractedText}
            </p>
          </div>
        )}
      </div>
      {payload.openHref && (
        <a
          href={payload.openHref}
          className="mt-2.5 inline-block text-[12px] font-mono text-[#34d399] hover:underline"
        >
          Open →
        </a>
      )}
    </CardShell>
  );
}
