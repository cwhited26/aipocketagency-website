// sse.ts — turns a provider's raw SSE byte stream into a normalized
// ReadableStream<LlmStreamEvent>. Each adapter supplies a `handleData` callback that
// parses ONE `data:` payload line and emits zero or more normalized events. This module
// owns the line-buffering, the terminal `done` event, and error surfacing so the
// adapters stay tiny.

import type { LlmStreamEvent } from "../types";

export type SseDataHandler = (
  data: string,
  emit: (event: LlmStreamEvent) => void,
) => void;

export function sseToEvents(
  upstream: ReadableStream<Uint8Array>,
  handleData: SseDataHandler,
): ReadableStream<LlmStreamEvent> {
  const decoder = new TextDecoder();
  const reader = upstream.getReader();

  return new ReadableStream<LlmStreamEvent>({
    async start(controller) {
      const emit = (event: LlmStreamEvent) => controller.enqueue(event);
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              handleData(trimmed.slice(5).trim(), emit);
            }
          }
        }
        // Flush any trailing buffered data line.
        const tail = buffer.trim();
        if (tail.startsWith("data:")) handleData(tail.slice(5).trim(), emit);
        emit({ type: "done" });
      } catch (err) {
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "stream read error",
        });
      } finally {
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
