// schemas.ts — Zod input + response schemas for every Public REST API v1 endpoint.
// These are the single source of truth: route handlers validate against them and the
// OpenAPI generator (openapi.ts) derives its component schemas from the same shapes.

import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────────────────

// A repo-relative brain path. Rejects absolute paths and `..` traversal segments.
export const brainPathSchema = z
  .string()
  .min(1)
  .max(400)
  .refine((p) => !p.startsWith("/"), "Path must be repo-relative (no leading slash)")
  .refine((p) => !p.split("/").includes(".."), "Path may not contain '..' segments");

// API memory tiers map to internal folders: work→memory/work, knowledge→memory/knowledge,
// patterns→memory/learning. The public name is "patterns"; on disk it is "learning".
export const apiMemoryTierSchema = z.enum(["work", "knowledge", "patterns"]);
export type ApiMemoryTier = z.infer<typeof apiMemoryTierSchema>;

export const writeModeSchema = z.enum(["append", "replace"]);

// ── brain/tree ──────────────────────────────────────────────────────────────────────────

export const brainTreeResponseSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["blob", "tree"]),
    }),
  ),
  blockedCount: z.number().int().nonnegative(),
});

// ── brain/file ──────────────────────────────────────────────────────────────────────────

export const brainFileQuerySchema = z.object({ path: brainPathSchema });

export const brainFileReadResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const brainFileWriteBodySchema = z.object({
  path: brainPathSchema,
  content: z.string().max(1_000_000),
  mode: writeModeSchema.default("replace"),
  commitMessage: z.string().max(200).optional(),
});

export const brainFileWriteResponseSchema = z.object({
  path: z.string(),
  sha: z.string(),
  committed: z.literal(true),
});

// ── memory ──────────────────────────────────────────────────────────────────────────────

export const memoryTierQuerySchema = z.object({ tier: apiMemoryTierSchema });

export const memoryTierResponseSchema = z.object({
  tier: apiMemoryTierSchema,
  entries: z.array(z.object({ name: z.string(), path: z.string() })),
});

export const memoryEntryBodySchema = z.object({
  // The filename (slugged automatically if it has no .md) OR a full relative name.
  name: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(200_000),
  // Optional explicit tier; when omitted the entry is auto-classified.
  tier: apiMemoryTierSchema.optional(),
});

export const memoryEntryResponseSchema = z.object({
  path: z.string(),
  tier: apiMemoryTierSchema,
  sha: z.string(),
  classifiedReason: z.string(),
});

// ── personas ────────────────────────────────────────────────────────────────────────────

export const personaListResponseSchema = z.object({
  personas: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      mode: z.string(),
      status: z.string(),
    }),
  ),
});

export const personaInvokeBodySchema = z.object({
  message: z.string().min(1).max(8_000),
  conversationId: z.string().uuid().optional(),
});

// ── zones ───────────────────────────────────────────────────────────────────────────────

export const zonesResponseSchema = z.object({
  zones: z.array(
    z.object({
      name: z.string(),
      patterns: z.array(z.string()),
      private: z.boolean(),
    }),
  ),
  isDefault: z.boolean(),
});

// ── error envelope ────────────────────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({ error: z.string() });
