// approve.test.ts — test d: the approval callback creates the Persona through the shipped
// sequence and stages the CORRECT files via the GitHub Build connector — push_files, always
// single-approval, targeting the owner's own Business Brain repo with the agent config, the
// persona spec copy, and the candidate Skill file.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pa-supabase", () => ({ fetchPaUser: vi.fn() }));
vi.mock("@/lib/personas/create", () => ({ createPersonaFromTemplate: vi.fn() }));
vi.mock("@/lib/orchestrator/tool-use", () => ({ stageConnectorAction: vi.fn() }));
vi.mock("@/lib/pa-github-build-connections", () => ({
  fetchGithubBuildConnectionFull: vi.fn(),
}));
vi.mock("../db", () => ({ updateAgentBuild: vi.fn(async () => ({ ok: true, data: {} })) }));

import { acceptAgentBuildProposal, rejectAgentBuildProposal } from "../approve";
import { fetchPaUser } from "@/lib/pa-supabase";
import { createPersonaFromTemplate } from "@/lib/personas/create";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { fetchGithubBuildConnectionFull } from "@/lib/pa-github-build-connections";
import { updateAgentBuild } from "../db";
import type { ComposedAgent } from "../types";

const mockFetchPaUser = vi.mocked(fetchPaUser);
const mockCreatePersona = vi.mocked(createPersonaFromTemplate);
const mockStage = vi.mocked(stageConnectorAction);
const mockBuildConn = vi.mocked(fetchGithubBuildConnectionFull);
const mockUpdateBuild = vi.mocked(updateAgentBuild);

const COMPOSED: ComposedAgent = {
  buildId: "build-1",
  specText: "Watch my Gmail for adjuster emails and draft SRA responses in my voice.",
  intent: {
    summary: "Watch Gmail for adjuster emails and draft SRA responses",
    jobNoun: "Adjuster Follow-Up",
    role: "email",
    watches: "Gmail inbox",
    does: "Drafts SRA responses staged for approval",
    voice: "owner",
    schedule: null,
    brainZones: ["voice", "customers"],
    capabilities: ["draft_email"],
    neededTechniques: ["sra response drafting"],
  },
  personaTemplateKey: "email",
  personaName: "Email Drafter — Adjuster Follow-Up",
  personaSlug: "email-drafter-adjuster-follow-up",
  tone: "direct",
  starterPrompt: "Run a first pass now: watch Gmail for adjuster emails",
  customFields: { goal: "Watch Gmail for adjuster emails and draft SRA responses" },
  apps: ["email-drafter", "followups"],
  skillSlugs: ["customer-reply-tone-match"],
  brainScopes: ["voice", "customers"],
  schedule: null,
  candidateSkill: {
    slug: "sra-response-drafting",
    name: "Sra Response Drafting",
    description: "Drafting SRA responses for adjuster emails.",
    whenToUse: "Use when an adjuster email needs an SRA response.",
    body: "# SRA Response Drafting\n\n1. Read the brain.\n2. Draft.\n3. Stage for approval.",
  },
};

function payloadOf(composed: ComposedAgent): Record<string, unknown> {
  return { buildId: composed.buildId, composed } as unknown as Record<string, unknown>;
}

describe("acceptAgentBuildProposal", () => {
  beforeEach(() => {
    mockFetchPaUser.mockReset();
    mockCreatePersona.mockReset();
    mockStage.mockReset();
    mockBuildConn.mockReset();
    mockUpdateBuild.mockClear();

    mockFetchPaUser.mockResolvedValue({
      ok: true,
      data: { brain_repo: "chase/whited-brain", github_token: "gh", anthropic_api_key: "sk" },
    } as unknown as Awaited<ReturnType<typeof fetchPaUser>>);
    mockBuildConn.mockResolvedValue({
      ok: true,
      data: { status: "active" },
    } as unknown as Awaited<ReturnType<typeof fetchGithubBuildConnectionFull>>);
    mockCreatePersona.mockResolvedValue({
      ok: true,
      persona: { slug: "email-drafter-adjuster-follow-up" },
    } as unknown as Awaited<ReturnType<typeof createPersonaFromTemplate>>);
    mockStage.mockResolvedValue({
      inboxItemId: "inbox-push-1",
      actionApprovalId: "appr-1",
      connectorActionLogId: "log-1",
      autoApproved: false,
    });
  });

  it("creates the persona and stages push_files with the exact agent bundle", async () => {
    const result = await acceptAgentBuildProposal({
      ownerId: "owner-1",
      payload: payloadOf(COMPOSED),
      overrides: {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.personaSlug).toBe("email-drafter-adjuster-follow-up");
    expect(result.pushInboxItemId).toBe("inbox-push-1");

    // The persona rode the shipped creation sequence with the composed toolkit.
    expect(mockCreatePersona).toHaveBeenCalledTimes(1);
    const personaArgs = mockCreatePersona.mock.calls[0][0];
    expect(personaArgs.name).toBe("Email Drafter — Adjuster Follow-Up");
    expect(personaArgs.apps).toEqual(["email-drafter", "followups"]);

    // The repo write is the GitHub Build connector's push_files, single-approval, into the
    // owner's OWN brain repo — with all three bundle files.
    expect(mockStage).toHaveBeenCalledTimes(1);
    const staged = mockStage.mock.calls[0][0];
    expect(staged.connector).toBe("github_build");
    expect(staged.action).toBe("push_files");
    expect(staged.kind).toBe("build_action_approval");
    const payload = staged.payload as {
      repo: string;
      branch: string;
      files: { path: string; content: string }[];
    };
    expect(payload.repo).toBe("chase/whited-brain");
    expect(payload.branch).toBe("main");
    expect(payload.files.map((f) => f.path)).toEqual([
      "agents/email-drafter-adjuster-follow-up/AGENT.md",
      "agents/email-drafter-adjuster-follow-up/persona.md",
      "skills/sra-response-drafting/SKILL.md",
    ]);
    const agentMd = payload.files[0].content;
    expect(agentMd).toContain("Email Drafter — Adjuster Follow-Up");
    expect(agentMd).toContain("apps: [email-drafter, followups]");
    expect(agentMd).toContain("brain_scopes: [voice, customers]");
    expect(agentMd).toContain(COMPOSED.specText.trim());

    // Build row flipped to approved.
    expect(mockUpdateBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "build-1",
        patch: expect.objectContaining({ status: "approved" }),
      }),
    );
  });

  it("honors the owner's inline edits (persona name + starter prompt)", async () => {
    const result = await acceptAgentBuildProposal({
      ownerId: "owner-1",
      payload: payloadOf(COMPOSED),
      overrides: { personaName: "Adjuster Desk", starterPrompt: "Start with today's inbox" },
    });
    expect(result.ok).toBe(true);
    expect(mockCreatePersona.mock.calls[0][0].name).toBe("Adjuster Desk");
    const staged = mockStage.mock.calls[0][0];
    const payload = staged.payload as { files: { path: string; content: string }[] };
    expect(payload.files[0].content).toContain("Start with today's inbox");
  });

  it("deploys the scoped version when the owner drops the gated Apps (PA-POS-34)", async () => {
    const withGated: ComposedAgent = {
      ...COMPOSED,
      apps: ["email-drafter", "followups", "browser-agent"],
    };
    const result = await acceptAgentBuildProposal({
      ownerId: "owner-1",
      payload: payloadOf(withGated),
      overrides: { excludeApps: ["browser-agent"] },
    });
    expect(result.ok).toBe(true);
    // The persona goes live WITHOUT the dropped App — the scoped version, not a block.
    expect(mockCreatePersona.mock.calls[0][0].apps).toEqual(["email-drafter", "followups"]);
  });

  it("refuses before creating anything when GitHub Build isn't connected", async () => {
    mockBuildConn.mockResolvedValue({
      ok: true,
      data: null,
    } as unknown as Awaited<ReturnType<typeof fetchGithubBuildConnectionFull>>);
    const result = await acceptAgentBuildProposal({
      ownerId: "owner-1",
      payload: payloadOf(COMPOSED),
      overrides: {},
    });
    expect(result.ok).toBe(false);
    expect(mockCreatePersona).not.toHaveBeenCalled();
    expect(mockStage).not.toHaveBeenCalled();
  });

  it("skips the candidate Skill file when none was drafted", async () => {
    const noCandidate = { ...COMPOSED, candidateSkill: null };
    await acceptAgentBuildProposal({
      ownerId: "owner-1",
      payload: payloadOf(noCandidate),
      overrides: {},
    });
    const staged = mockStage.mock.calls[0][0];
    const payload = staged.payload as { files: { path: string }[] };
    expect(payload.files.map((f) => f.path)).toEqual([
      "agents/email-drafter-adjuster-follow-up/AGENT.md",
      "agents/email-drafter-adjuster-follow-up/persona.md",
    ]);
  });
});

describe("rejectAgentBuildProposal", () => {
  it("flips the build row to rejected and persists nothing else", async () => {
    mockUpdateBuild.mockClear();
    mockCreatePersona.mockClear();
    await rejectAgentBuildProposal({ ownerId: "owner-1", payload: payloadOf(COMPOSED) });
    expect(mockUpdateBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "build-1",
        patch: { status: "rejected" },
      }),
    );
    expect(mockCreatePersona).not.toHaveBeenCalled();
  });
});
