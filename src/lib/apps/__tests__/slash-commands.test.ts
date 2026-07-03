import { describe, it, expect } from "vitest";
import { APP_CATALOG } from "../catalog";
import {
  appSlashCommandSchema,
  appSlashAutocomplete,
  appSlashCommandsForTier,
  formatAppSlashList,
  parseAppSlash,
  resolveAppSlashCommand,
  tierAllowsApp,
} from "../slash-commands";

describe("slash command parser (PA-SLASH-1)", () => {
  it("parses a bare command", () => {
    expect(parseAppSlash("/quote")).toEqual({ command: "quote", args: "" });
  });

  it("parses inline args after the command", () => {
    expect(parseAppSlash("/email a thank-you note to Mike")).toEqual({
      command: "email",
      args: "a thank-you note to Mike",
    });
  });

  it("lowercases the token and tolerates leading whitespace", () => {
    expect(parseAppSlash("   /Quote")).toEqual({ command: "quote", args: "" });
  });

  it("accepts hyphenated multi-word slugs", () => {
    expect(parseAppSlash("/follow-up-sweeps")).toEqual({ command: "follow-up-sweeps", args: "" });
  });

  it("rejects non-slash input and malformed tokens", () => {
    expect(parseAppSlash("quote")).toBeNull(); // no leading slash
    expect(parseAppSlash("/")).toBeNull(); // empty token
    expect(parseAppSlash("/123")).toBeNull(); // must start with a letter
    expect(parseAppSlash("/-x")).toBeNull(); // illegal lead char
    expect(parseAppSlash("/has space")).toEqual({ command: "has", args: "space" }); // first token only
  });

  it("the Zod schema rejects a token the parser would never emit", () => {
    expect(appSlashCommandSchema.safeParse({ command: "BAD TOKEN", args: "" }).success).toBe(false);
    expect(appSlashCommandSchema.safeParse({ command: "quote", args: "" }).success).toBe(true);
    // args defaults to "" when omitted.
    const parsed = appSlashCommandSchema.parse({ command: "quote" });
    expect(parsed.args).toBe("");
  });
});

describe("resolution — open a known App (PA-SLASH-1)", () => {
  it("opens a core App on any tier", () => {
    const res = resolveAppSlashCommand("/quote", "starter");
    expect(res.kind).toBe("open");
    if (res.kind === "open") {
      expect(res.app.id).toBe("quote");
      expect(res.href).toBe("/app/apps/quote");
      expect(res.args).toBe("");
    }
  });

  it("carries inline args as a url-encoded prefill param", () => {
    const res = resolveAppSlashCommand("/email a note to Mike & Sarah", "starter");
    expect(res.kind).toBe("open");
    if (res.kind === "open") {
      expect(res.app.id).toBe("email-drafter");
      expect(res.href).toBe("/app/apps/email?prefill=a%20note%20to%20Mike%20%26%20Sarah");
      expect(res.args).toBe("a note to Mike & Sarah");
    }
  });

  it("resolves forgiving aliases to the canonical App", () => {
    const landing = resolveAppSlashCommand("/landing-page", "studio");
    expect(landing.kind).toBe("open");
    if (landing.kind === "open") expect(landing.app.id).toBe("landing-page-builder");

    const ideas = resolveAppSlashCommand("/ideas", "pro_plus");
    expect(ideas.kind).toBe("open");
    if (ideas.kind === "open") expect(ideas.app.id).toBe("idea-engine");
  });
});

describe("resolution — unknown command path (PA-SLASH-1)", () => {
  it("returns a polite unknown with the available list", () => {
    const res = resolveAppSlashCommand("/does-not-exist", "starter");
    expect(res.kind).toBe("unknown");
    if (res.kind === "unknown") {
      expect(res.attempted).toBe("does-not-exist");
      expect(res.commands.length).toBeGreaterThan(0);
      expect(res.commands.every((c) => c.command.length > 0)).toBe(true);
    }
  });

  it("treats a malformed slash token as unknown rather than crashing", () => {
    const res = resolveAppSlashCommand("/123", "starter");
    expect(res.kind).toBe("unknown");
    if (res.kind === "unknown") expect(res.attempted).toBe("123");
  });

  it("bare slash returns the help list", () => {
    const res = resolveAppSlashCommand("/", "starter");
    expect(res.kind).toBe("help");
    if (res.kind === "help") expect(res.commands.length).toBe(appSlashCommandsForTier("starter").length);
  });
});

describe("tier-gated invocation (PA-SLASH-1)", () => {
  it("does not open a build-grade App below its unlock tier — surfaces the upgrade path", () => {
    const res = resolveAppSlashCommand("/landing-page-builder", "pro");
    expect(res.kind).toBe("locked");
    if (res.kind === "locked") {
      expect(res.app.id).toBe("landing-page-builder");
      expect(res.reason).toContain("Studio");
      expect(res.reason).toContain("/landing-page-builder");
    }
  });

  it("opens the build-grade App once the tier clears the gate", () => {
    expect(resolveAppSlashCommand("/landing-page-builder", "studio").kind).toBe("open");
    expect(resolveAppSlashCommand("/competitor-inspector", "pro_plus").kind).toBe("open");
    expect(resolveAppSlashCommand("/competitor-inspector", "pro").kind).toBe("locked");
    expect(resolveAppSlashCommand("/idea-engine", "pro").kind).toBe("locked");
  });

  it("tierAllowsApp mirrors the per-App gates", () => {
    expect(tierAllowsApp("starter", "quote")).toBe(true);
    expect(tierAllowsApp("pro", "landing-page-builder")).toBe(false);
    expect(tierAllowsApp("studio", "landing-page-builder")).toBe(true);
    expect(tierAllowsApp("pro_plus", "idea-engine")).toBe(true);
    expect(tierAllowsApp("pro", "idea-engine")).toBe(false);
  });

  it("the tier popover hides locked Apps and grows with tier", () => {
    const starter = appSlashCommandsForTier("starter").map((c) => c.appId);
    const studio = appSlashCommandsForTier("studio").map((c) => c.appId);
    const studioPlus = appSlashCommandsForTier("studio_plus").map((c) => c.appId);
    expect(starter).not.toContain("landing-page-builder");
    expect(starter).not.toContain("competitor-inspector");
    expect(starter).not.toContain("idea-engine");
    expect(studio).toContain("landing-page-builder");
    expect(studio).toContain("competitor-inspector");
    expect(studio).toContain("idea-engine");
    // Two Apps sit above Studio: iMessage (Channels Gateway Phase 3) and the Browser Agent
    // (PA-POS-19, hosted browser sessions) — both unlock at Studio+.
    expect(studio).not.toContain("imessage-channel");
    expect(studio).not.toContain("browser-agent");
    expect(studio.length).toBe(APP_CATALOG.length - 2);
    expect(studioPlus).toContain("browser-agent");
    expect(studioPlus.length).toBe(APP_CATALOG.length);
  });
});

describe("autocomplete", () => {
  it("suggests unlocked Apps matching the partial token", () => {
    const out = appSlashAutocomplete("/qu", "starter");
    expect(out.map((e) => e.command)).toContain("quote");
  });

  it("never suggests a locked App", () => {
    const out = appSlashAutocomplete("/landing", "pro");
    expect(out).toHaveLength(0);
    const unlocked = appSlashAutocomplete("/landing", "studio");
    expect(unlocked.map((e) => e.command)).toContain("landing-page-builder");
  });

  it("stops suggesting once a space is typed (args mode)", () => {
    expect(appSlashAutocomplete("/quote ", "starter")).toHaveLength(0);
  });

  it("lists every unlocked App on a bare slash, capped", () => {
    const out = appSlashAutocomplete("/", "studio", 6);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("catalog invariants the dispatcher relies on", () => {
  it("every App has a slug-shaped slashCommand and they are unique", () => {
    const tokens = APP_CATALOG.map((a) => a.slashCommand);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const a of APP_CATALOG) {
      expect(a.slashCommand).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(a.slashCommand).toBe(a.id); // matches the slug — no drift
    }
  });

  it("formats the available-commands list as one line per command", () => {
    const text = formatAppSlashList(appSlashCommandsForTier("starter"));
    expect(text.split("\n").length).toBe(appSlashCommandsForTier("starter").length);
    expect(text.startsWith("/quote — ")).toBe(true);
  });
});
