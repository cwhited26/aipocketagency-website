// vertical-seed.test.ts — ensureVerticalSeed lands the picked vertical's Personas exactly once,
// defers cleanly when no brain is connected, respects the tier's persona cap, and leaves a
// skipped owner's workspace empty. The state store, PA row, tier caps, persona DB, creation
// sequence, and starter-skill backfill are all mocked — no network, no GitHub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VERTICALS, getVertical } from "../verticals";
import { getTemplate } from "@/lib/personas/templates";
import { slugifyPersonaName } from "@/lib/personas/types";

const h = vi.hoisted(() => ({
  fetchOnboardingState: vi.fn(),
  recordSeededPersonas: vi.fn(),
  fetchPaUser: vi.fn(),
  canCreatePersona: vi.fn(),
  listPersonasForBusiness: vi.fn(),
  createPersonaFromTemplate: vi.fn(),
  backfillStarterSkillsForOwner: vi.fn(),
}));

vi.mock("../state-db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../state-db")>()),
  fetchOnboardingState: h.fetchOnboardingState,
  recordSeededPersonas: h.recordSeededPersonas,
}));
vi.mock("@/lib/pa-supabase", () => ({ fetchPaUser: h.fetchPaUser }));
vi.mock("@/lib/personas/tier-caps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/personas/tier-caps")>()),
  canCreatePersona: h.canCreatePersona,
}));
vi.mock("@/lib/personas/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/personas/db")>()),
  listPersonasForBusiness: h.listPersonasForBusiness,
}));
vi.mock("@/lib/personas/create", () => ({
  createPersonaFromTemplate: h.createPersonaFromTemplate,
}));
vi.mock("@/lib/launch-kit/seed", () => ({
  backfillStarterSkillsForOwner: h.backfillStarterSkillsForOwner,
}));

import { ensureVerticalSeed } from "../vertical-seed";

const OWNER = "owner-1";

function stateRow(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: OWNER,
    vertical: "coach",
    vertical_picked_at: "2026-07-02T00:00:00Z",
    personas_seeded_at: null,
    seeded_persona_slugs: [],
    suggested_app_ids: [],
    created_at: "2026-07-02T00:00:00Z",
    updated_at: "2026-07-02T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
  h.fetchOnboardingState.mockResolvedValue(stateRow());
  h.recordSeededPersonas.mockResolvedValue(undefined);
  h.fetchPaUser.mockResolvedValue({
    ok: true,
    data: { brain_repo: "owner/brain", github_token: "gh-token" },
  });
  h.canCreatePersona.mockResolvedValue({ ok: true });
  h.listPersonasForBusiness.mockResolvedValue([]);
  h.createPersonaFromTemplate.mockImplementation(
    async ({ template, name }: { template: { key: string }; name: string }) => ({
      ok: true,
      persona: { id: `p-${template.key}`, slug: slugifyPersonaName(name), template_key: template.key },
    }),
  );
  h.backfillStarterSkillsForOwner.mockResolvedValue({ seeded: [], skipped: 0, failed: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("ensureVerticalSeed", () => {
  it("seeds the right three Personas for each of the six verticals", async () => {
    for (const v of VERTICALS) {
      h.createPersonaFromTemplate.mockClear();
      h.fetchOnboardingState.mockResolvedValue(stateRow({ vertical: v.slug }));

      const outcome = await ensureVerticalSeed(OWNER);

      expect(outcome.status).toBe("seeded");
      const seededKeys = h.createPersonaFromTemplate.mock.calls.map(
        (c) => (c[0] as { template: { key: string } }).template.key,
      );
      expect(seededKeys).toEqual(v.personaTemplates);
      // Each Persona is created with its template's defaults — name, tone, apps.
      for (const call of h.createPersonaFromTemplate.mock.calls) {
        const arg = call[0] as {
          template: { key: string };
          name: string;
          apps: string[];
        };
        const template = getTemplate(arg.template.key);
        expect(arg.name).toBe(template?.suggestedName);
        // sanitizeAppIds normalizes to catalog order — compare as sets.
        expect(new Set(arg.apps)).toEqual(new Set(template?.defaultApps));
      }
    }
  });

  it("skip leaves the workspace empty — no Personas created, nothing recorded", async () => {
    h.fetchOnboardingState.mockResolvedValue(stateRow({ vertical: null }));

    const outcome = await ensureVerticalSeed(OWNER);

    expect(outcome.status).toBe("skipped");
    expect(h.createPersonaFromTemplate).not.toHaveBeenCalled();
    expect(h.recordSeededPersonas).not.toHaveBeenCalled();
    expect(h.backfillStarterSkillsForOwner).not.toHaveBeenCalled();
  });

  it("no decision yet → skipped, and no writes", async () => {
    h.fetchOnboardingState.mockResolvedValue(null);
    const outcome = await ensureVerticalSeed(OWNER);
    expect(outcome.status).toBe("skipped");
    expect(h.createPersonaFromTemplate).not.toHaveBeenCalled();
  });

  it("defers when no brain is connected — the pick survives, the seed waits", async () => {
    h.fetchPaUser.mockResolvedValue({ ok: true, data: { brain_repo: null, github_token: null } });

    const outcome = await ensureVerticalSeed(OWNER);

    expect(outcome.status).toBe("deferred");
    expect(h.createPersonaFromTemplate).not.toHaveBeenCalled();
    expect(h.recordSeededPersonas).not.toHaveBeenCalled();
  });

  it("is idempotent: personas_seeded_at set → no creates on a re-run", async () => {
    h.fetchOnboardingState.mockResolvedValue(
      stateRow({ personas_seeded_at: "2026-07-02T01:00:00Z" }),
    );
    const outcome = await ensureVerticalSeed(OWNER);
    expect(outcome.status).toBe("already");
    expect(h.createPersonaFromTemplate).not.toHaveBeenCalled();
  });

  it("never duplicates a role the owner already holds", async () => {
    const admin = getTemplate("admin");
    h.listPersonasForBusiness.mockResolvedValue([
      { template_key: "admin", slug: slugifyPersonaName(admin?.suggestedName ?? "") },
    ]);

    const outcome = await ensureVerticalSeed(OWNER); // coach: admin, sales, content

    expect(outcome.status).toBe("seeded");
    const seededKeys = h.createPersonaFromTemplate.mock.calls.map(
      (c) => (c[0] as { template: { key: string } }).template.key,
    );
    expect(seededKeys).toEqual(["sales", "content"]);
  });

  it("pauses at the tier's persona cap without stamping completion", async () => {
    h.canCreatePersona.mockResolvedValue({ ok: false, reason: "Persona limit reached." });

    const outcome = await ensureVerticalSeed(OWNER);

    expect(outcome.status).toBe("partial");
    expect(h.createPersonaFromTemplate).not.toHaveBeenCalled();
    // Nothing landed, so nothing to record — the next run (post-upgrade) retries from scratch.
    expect(h.recordSeededPersonas).not.toHaveBeenCalled();
  });

  it("stamps completion and backfills starter Skills once the full plan lands", async () => {
    const coach = getVertical("coach");
    const outcome = await ensureVerticalSeed(OWNER);

    expect(outcome.status).toBe("seeded");
    expect(outcome.createdSlugs).toHaveLength(coach?.personaTemplates.length ?? 0);
    expect(h.recordSeededPersonas).toHaveBeenCalledWith({
      ownerId: OWNER,
      seededSlugs: outcome.createdSlugs,
      complete: true,
    });
    expect(h.backfillStarterSkillsForOwner).toHaveBeenCalledWith(OWNER);
  });

  it("never throws — a state-store failure resolves to an error outcome", async () => {
    h.fetchOnboardingState.mockRejectedValue(new Error("supabase down"));
    const outcome = await ensureVerticalSeed(OWNER);
    expect(outcome.status).toBe("error");
    expect(outcome.createdSlugs).toEqual([]);
  });
});
