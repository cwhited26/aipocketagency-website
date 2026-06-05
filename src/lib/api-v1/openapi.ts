// openapi.ts — builds the OpenAPI 3.1 document for the Public REST API v1. Request +
// response component schemas are derived from the same Zod schemas the route handlers
// validate against (z.toJSONSchema), so the spec can never drift from the wire format.

import { z } from "zod";
import * as S from "./schemas";

type Json = Record<string, unknown>;

// Zod 4 emits JSON-Schema draft-2020-12, which is exactly OpenAPI 3.1's schema dialect.
function jsonSchema(schema: z.ZodType): Json {
  return z.toJSONSchema(schema) as Json;
}

function jsonResponse(schema: z.ZodType, description: string): Json {
  return {
    description,
    content: { "application/json": { schema: jsonSchema(schema) } },
  };
}

const ERR = (description: string): Json => jsonResponse(S.errorResponseSchema, description);

export function buildOpenApiDocument(baseUrl: string): Json {
  const bearer = [{ ApiKeyAuth: [] as string[] }];

  return {
    openapi: "3.1.0",
    info: {
      title: "Pocket Agent — Public REST API",
      version: "1.0.0",
      description:
        "PA is your brain. Bring any agent. This API exposes your brain files, memory " +
        "tiers, personas, and privacy zones to any client that speaks REST. " +
        "Authenticate with a `pa_live_` API key as a Bearer token. Every brain-reading " +
        "endpoint enforces your Privacy zones (ContainmentGuard).",
    },
    servers: [{ url: baseUrl }],
    security: bearer,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "pa_live_<key>",
          description: "Generate a key in Settings → API keys. Pass as `Authorization: Bearer pa_live_…`.",
        },
      },
    },
    paths: {
      "/brain/tree": {
        get: {
          summary: "List brain files + folders",
          description: "Privacy-zone filtered — private-zone files are omitted.",
          security: bearer,
          responses: {
            "200": jsonResponse(S.brainTreeResponseSchema, "The brain tree."),
            "401": ERR("Invalid or missing API key."),
            "404": ERR("No brain repo connected."),
            "429": ERR("Rate limit exceeded."),
          },
        },
      },
      "/brain/file": {
        get: {
          summary: "Read a brain file",
          security: bearer,
          parameters: [
            { name: "path", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": jsonResponse(S.brainFileReadResponseSchema, "The file content."),
            "403": ERR("Path is in a private zone."),
            "404": ERR("File not found."),
            "422": ERR("Invalid path."),
          },
        },
        post: {
          summary: "Write a brain file",
          security: bearer,
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(S.brainFileWriteBodySchema) } },
          },
          responses: {
            "200": jsonResponse(S.brainFileWriteResponseSchema, "Committed."),
            "403": ERR("Path is in a private zone."),
            "409": ERR("No write token."),
            "422": ERR("Invalid body."),
          },
        },
      },
      "/memory/tier": {
        get: {
          summary: "List memory entries in a tier",
          security: bearer,
          parameters: [
            {
              name: "tier",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["work", "knowledge", "patterns"] },
            },
          ],
          responses: {
            "200": jsonResponse(S.memoryTierResponseSchema, "Entries in the tier."),
            "422": ERR("Invalid tier."),
          },
        },
      },
      "/memory/entry": {
        post: {
          summary: "Write a memory entry",
          description: "Tier is taken from the body when present, else auto-classified.",
          security: bearer,
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(S.memoryEntryBodySchema) } },
          },
          responses: {
            "201": jsonResponse(S.memoryEntryResponseSchema, "Created."),
            "409": ERR("No write token."),
            "422": ERR("Invalid body."),
          },
        },
      },
      "/personas": {
        get: {
          summary: "List your personas",
          security: bearer,
          responses: {
            "200": jsonResponse(S.personaListResponseSchema, "Your personas."),
          },
        },
      },
      "/personas/{id}/invoke": {
        post: {
          summary: "Invoke a persona (streams)",
          description:
            "Streams a Server-Sent Events response (`data: {json}` lines: meta, delta, " +
            "done, error). ContainmentGuard is scoped to the persona's knowledge zone.",
          security: bearer,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(S.personaInvokeBodySchema) } },
          },
          responses: {
            "200": { description: "An SSE stream of the persona response." },
            "404": ERR("Persona not found."),
            "409": ERR("Persona not active."),
            "429": ERR("Persona monthly cap or rate limit reached."),
          },
        },
      },
      "/zones": {
        get: {
          summary: "List your privacy zones",
          security: bearer,
          responses: {
            "200": jsonResponse(S.zonesResponseSchema, "Your privacy zones."),
          },
        },
      },
    },
  };
}
