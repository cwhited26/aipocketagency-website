import { describe, it, expect } from "vitest";
import { WorkspaceIssueSchema } from "../schema";

describe("master-keys/schema", () => {
  const valid = {
    external_workspace_id: "ws_123",
    slug: "acme-co",
    owner_email: "owner@acme.co",
    source: "buildout-schedule",
  };

  it("accepts a well-formed body", () => {
    expect(WorkspaceIssueSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing field", () => {
    const { owner_email: _omit, ...rest } = valid;
    expect(WorkspaceIssueSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-email owner_email", () => {
    expect(WorkspaceIssueSchema.safeParse({ ...valid, owner_email: "not-an-email" }).success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(WorkspaceIssueSchema.safeParse({ ...valid, external_workspace_id: "" }).success).toBe(false);
    expect(WorkspaceIssueSchema.safeParse({ ...valid, slug: "" }).success).toBe(false);
  });
});
