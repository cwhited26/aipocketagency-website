"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-slate-100 mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.16em] mt-8 mb-3 pb-2 border-b border-slate-800/60">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-[#22d3ee] mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-slate-300 leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="flex flex-col gap-1.5 mb-3 pl-1">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed">
      <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-200">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="not-italic font-mono text-[11px] text-[#22d3ee]/70 px-1.5 py-0.5 rounded border border-[#22d3ee]/20 bg-[#22d3ee]/5">
      {children}
    </em>
  ),
  hr: () => (
    <hr className="border-slate-800/60 my-6" />
  ),
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      className="text-[#22d3ee] hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-slate-700 pl-4 text-slate-500 text-sm italic my-3">
      {children}
    </blockquote>
  ),
};

export default function ChangelogRenderer({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7">

        {/* Header */}
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            What&apos;s new
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Changelog</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Everything shipped in Pocket Agent, newest first.
          </p>
        </div>

        {/* Content */}
        <div className="prose-pa">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {/* Skip the first h1 since we render our own header above */}
            {content.replace(/^# Changelog\n\n[^\n]+\n\n---\n\n/, "")}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="mt-12 rounded-xl border border-slate-800/40 px-5 py-4">
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
            Pocket Agent ships weekly. New features appear here when they land on main.
          </p>
        </div>

      </div>
    </div>
  );
}
