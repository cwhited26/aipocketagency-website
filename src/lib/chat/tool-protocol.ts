// tool-protocol.ts — the text-mode tool-call protocol shared by every LLM provider.
//
// The BYO dispatcher (lib/llm/dispatch.ts) normalizes all six providers to a plain text stream —
// it has no native tool-use surface. Rather than fork per-provider tool schemas, the agent loop
// asks the model to emit a single JSON object when it wants a tool and plain prose otherwise.
// This module is the pure parser for one model turn: zero I/O, exhaustively unit-testable.
//
// Protocol (instructed in system-prompt.ts):
//   • To use a tool, reply with ONLY a JSON object: {"tool":"<id>","input":{...}}
//   • Otherwise, reply with the answer as plain text.
// We tolerate a ```json fence or leading/trailing prose around the object (smaller models leak
// it), extracting the first balanced {...} that carries a string "tool" field.

export type ToolCall = { tool: string; input: Record<string, unknown> };

export type ParsedTurn =
  | { kind: "tool"; call: ToolCall }
  | { kind: "final"; text: string };

/**
 * Scans `text` for the first balanced JSON object (brace-matched, string-aware) and returns its
 * raw substring, or null when there is no complete object. Respects quotes + backslash escapes so
 * a `}` inside a string value doesn't end the scan early.
 */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stripFences(text: string): string {
  // Drop a single surrounding ```/```json fence pair if present; otherwise return as-is.
  const fence = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  return fence ? fence[1] : text;
}

/**
 * Parse one model turn into either a tool call or a final answer. A turn is a tool call only when
 * it contains a JSON object with a non-empty string `tool` field; anything else is a final answer
 * (with any wrapping code fence stripped).
 */
export function parseAgentTurn(raw: string): ParsedTurn {
  const text = raw ?? "";
  const candidate = firstJsonObject(text);
  if (candidate) {
    try {
      const obj = JSON.parse(candidate) as unknown;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const rec = obj as Record<string, unknown>;
        const tool = rec.tool;
        if (typeof tool === "string" && tool.trim()) {
          const input =
            rec.input && typeof rec.input === "object" && !Array.isArray(rec.input)
              ? (rec.input as Record<string, unknown>)
              : {};
          return { kind: "tool", call: { tool: tool.trim(), input } };
        }
      }
    } catch {
      // Not valid JSON → treat the whole turn as a final answer.
    }
  }
  return { kind: "final", text: stripFences(text).trim() };
}
