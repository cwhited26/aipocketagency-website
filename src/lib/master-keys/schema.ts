// schema.ts — Zod validation for the POST /api/v1/workspaces request body. Validated at the
// route boundary; the handler works only with the parsed, typed value.

import { z } from "zod";

export const WorkspaceIssueSchema = z.object({
  external_workspace_id: z.string().min(1),
  slug: z.string().min(1),
  owner_email: z.string().email(),
  // The external product's own name for the source. The authoritative source is the master key
  // row (product_slug); this field is carried for parity with the caller contract + audit.
  source: z.string().min(1),
});

export type WorkspaceIssueBody = z.infer<typeof WorkspaceIssueSchema>;
