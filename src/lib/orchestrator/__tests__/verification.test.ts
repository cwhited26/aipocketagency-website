import { describe, it, expect } from "vitest";
import { advisoryVerdict } from "../verification";

const spec = (definitionOfDone: string) => ({
  spec_json: { objective: "x", toolScopes: [], readZones: [], definitionOfDone, context: {} },
});

describe("advisoryVerdict", () => {
  it("fails a run that ended failed or canceled", () => {
    expect(advisoryVerdict(spec(""), { status: "failed", resultSummary: "anything" }).verdict).toBe("fail");
    expect(advisoryVerdict(spec(""), { status: "canceled", resultSummary: "x" }).verdict).toBe("fail");
  });

  it("abstains when a done run left no result summary", () => {
    expect(advisoryVerdict(spec("ship it"), { status: "done", resultSummary: "" }).verdict).toBe("abstain");
    expect(advisoryVerdict(spec("ship it"), { status: "done", resultSummary: "   " }).verdict).toBe("abstain");
  });

  it("abstains when a definition of done exists but the evidence is too thin", () => {
    const r = advisoryVerdict(spec("send all three"), { status: "done", resultSummary: "done" });
    expect(r.verdict).toBe("abstain");
  });

  it("passes a substantive completion against a definition of done", () => {
    const r = advisoryVerdict(spec("send all three follow-ups"), {
      status: "done",
      resultSummary: "Sent all three follow-up emails and logged them to the brain.",
    });
    expect(r.verdict).toBe("pass");
  });

  it("passes a done run with no definition of done (advisory acceptance)", () => {
    const r = advisoryVerdict(spec(""), { status: "done", resultSummary: "ok" });
    expect(r.verdict).toBe("pass");
    expect(r.reason).toMatch(/advisory/i);
  });
});
