// sections.ts — shared serialize/parse for the "# Title + ## Heading body" markdown
// shape used by both the ISA (Specs) and TELOS (North Star) artifacts. Keeping one
// implementation means both artifacts round-trip identically and there's a single
// place to harden the parser.

export type SectionDef = {
  // Stable machine key used in API payloads and form state.
  key: string;
  // The exact `## ` heading written to / read from the markdown file.
  heading: string;
};

/**
 * Builds a markdown document: a top-level `# title`, then one `## heading` per section
 * in declaration order with the field's body beneath it. Empty fields are written as a
 * muted placeholder so the file stays human-readable and the section headings always
 * survive a round-trip.
 */
export function buildSectionedMarkdown(
  title: string,
  sections: SectionDef[],
  values: Record<string, string>,
  placeholder = "_Not yet filled in._",
): string {
  const parts: string[] = [`# ${title}`, ""];
  for (const s of sections) {
    const body = (values[s.key] ?? "").trim();
    parts.push(`## ${s.heading}`);
    parts.push(body || placeholder);
    parts.push("");
  }
  return parts.join("\n").trimEnd() + "\n";
}

/**
 * Parses a sectioned markdown doc back into a key→body map. Only the known headings
 * are captured; unrecognised `##` headings start a new (ignored) section so their body
 * doesn't bleed into the previous known field. The leading placeholder is normalised
 * back to an empty string.
 */
export function parseSectionedMarkdown(
  md: string,
  sections: SectionDef[],
  placeholder = "_Not yet filled in._",
): Record<string, string> {
  const headingToKey = new Map<string, string>();
  for (const s of sections) headingToKey.set(s.heading.toLowerCase(), s.key);

  const out: Record<string, string> = {};
  for (const s of sections) out[s.key] = "";

  let currentKey: string | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (currentKey) {
      const body = buf.join("\n").trim();
      out[currentKey] = body === placeholder ? "" : body;
    }
    buf.length = 0;
  };

  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      const heading = line.slice(3).trim().toLowerCase();
      currentKey = headingToKey.get(heading) ?? null;
    } else if (line.startsWith("# ")) {
      // top-level title line — ignore
      flush();
      currentKey = null;
    } else if (currentKey) {
      buf.push(line);
    }
  }
  flush();
  return out;
}
