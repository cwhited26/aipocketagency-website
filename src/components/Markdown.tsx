// Markdown.tsx — a tiny, deterministic markdown renderer for the static Launch Kit docs.
//
// No external library is installed, so we parse a small subset by hand: headings (# / ## / ###),
// checklist lines (- [ ] / - [x] rendered as a non-interactive glyph), bullet lists, inline **bold**,
// and blank-line-separated paragraphs. No dangerouslySetInnerHTML — every node is real React.

import { Fragment, type ReactNode } from "react";

// Split a single line on **bold** spans into React nodes (simple, no nesting).
function renderInline(text: string): ReactNode[] {
  const parts = text.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-slate-100">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "checklist"; items: { done: boolean; text: string }[] };

// Group the raw lines into blocks. Consecutive bullets / checklist lines collapse into one list.
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") continue;

    if (line.startsWith("### ")) blocks.push({ kind: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ kind: "h1", text: line.slice(2) });
    else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      const done = line.startsWith("- [x] ");
      const text = line.slice(6);
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "checklist") last.items.push({ done, text });
      else blocks.push({ kind: "checklist", items: [{ done, text }] });
    } else if (line.startsWith("- ")) {
      const text = line.slice(2);
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "ul") last.items.push(text);
      else blocks.push({ kind: "ul", items: [text] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

export default function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="flex flex-col gap-3 text-slate-300">
      {blocks.map((block, i) => {
        if (block.kind === "h1")
          return (
            <h1 key={i} className="text-xl font-bold text-slate-100 mt-2">
              {renderInline(block.text)}
            </h1>
          );
        if (block.kind === "h2")
          return (
            <h2 key={i} className="text-lg font-semibold text-slate-100 mt-2">
              {renderInline(block.text)}
            </h2>
          );
        if (block.kind === "h3")
          return (
            <h3 key={i} className="text-sm font-semibold text-slate-200 mt-1">
              {renderInline(block.text)}
            </h3>
          );
        if (block.kind === "ul")
          return (
            <ul key={i} className="flex flex-col gap-1 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="text-[#22d3ee]/50 shrink-0">·</span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        if (block.kind === "checklist")
          return (
            <ul key={i} className="flex flex-col gap-1 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="shrink-0 text-[#22d3ee]/70" aria-hidden>
                    {item.done ? "▣" : "▢"}
                  </span>
                  <span className={item.done ? "text-slate-400" : "text-slate-300"}>
                    {renderInline(item.text)}
                  </span>
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-sm leading-relaxed">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
