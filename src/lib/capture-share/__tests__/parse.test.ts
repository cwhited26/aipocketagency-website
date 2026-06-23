import { describe, it, expect } from "vitest";
import { parseShareForm, buildCaptureBody, pickShareKind } from "../parse";

function formWith(fields: Record<string, string>, files: File[] = []): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("files", f);
  return form;
}

describe("parseShareForm", () => {
  it("parses a title-only share", async () => {
    const parsed = await parseShareForm(formWith({ title: "A headline" }));
    expect(parsed.title).toBe("A headline");
    expect(parsed.text).toBeUndefined();
    expect(parsed.url).toBeUndefined();
    expect(parsed.files).toEqual([]);
  });

  it("parses a text-only share", async () => {
    const parsed = await parseShareForm(formWith({ text: "just a thought" }));
    expect(parsed.text).toBe("just a thought");
    expect(parsed.title).toBeUndefined();
    expect(parsed.url).toBeUndefined();
  });

  it("parses a url-only share", async () => {
    const parsed = await parseShareForm(formWith({ url: "https://example.com/post" }));
    expect(parsed.url).toBe("https://example.com/post");
    expect(parsed.title).toBeUndefined();
    expect(parsed.text).toBeUndefined();
  });

  it("parses a files-only share", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const parsed = await parseShareForm(formWith({}, [file]));
    expect(parsed.title).toBeUndefined();
    expect(parsed.text).toBeUndefined();
    expect(parsed.url).toBeUndefined();
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fileName).toBe("shot.png");
    expect(parsed.files[0].mimeType).toBe("image/png");
    expect(parsed.files[0].buffer).toBeInstanceOf(Buffer);
    expect(parsed.files[0].buffer.length).toBe(3);
  });

  it("parses an all-combined share (title + text + url + file)", async () => {
    const file = new File([new Uint8Array([9])], "doc.pdf", { type: "application/pdf" });
    const parsed = await parseShareForm(
      formWith(
        { title: "T", text: "body", url: "https://x.test" },
        [file],
      ),
    );
    expect(parsed.title).toBe("T");
    expect(parsed.text).toBe("body");
    expect(parsed.url).toBe("https://x.test");
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fileName).toBe("doc.pdf");
  });

  it("trims blank fields to undefined", async () => {
    const parsed = await parseShareForm(formWith({ title: "   ", text: "real" }));
    expect(parsed.title).toBeUndefined();
    expect(parsed.text).toBe("real");
  });

  it("skips empty files and records them", async () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    const parsed = await parseShareForm(formWith({}, [empty]));
    expect(parsed.files).toHaveLength(0);
    expect(parsed.skipped).toEqual([{ fileName: "empty.png", reason: "empty" }]);
  });
});

describe("buildCaptureBody", () => {
  it("concatenates title, text, and url each on its own line", () => {
    expect(
      buildCaptureBody({ title: "T", text: "body", url: "https://x.test" }),
    ).toBe("T\nbody\nhttps://x.test");
  });

  it("omits absent fields", () => {
    expect(buildCaptureBody({ text: "only text" })).toBe("only text");
  });

  it("returns empty string for a files-only share", () => {
    expect(buildCaptureBody({})).toBe("");
  });
});

describe("pickShareKind", () => {
  it("is 'url' when a url is present", () => {
    expect(pickShareKind({ url: "https://x.test" })).toBe("url");
  });

  it("is 'note' when no url is present", () => {
    expect(pickShareKind({ title: "T", text: "body" })).toBe("note");
  });
});
