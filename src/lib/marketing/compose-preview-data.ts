// compose-preview-data.ts — assembles the Agent Builder hero's preview data from the real
// catalogs (persona templates, Apps catalog, starter Skills). Imported by SERVER components
// only: the client hero receives the slim resolved shape as props so the full catalogs
// (starter-skill bodies especially) never enter the client bundle.
//
// Every name is resolved through the catalog lookups — a renamed template, App, or Skill
// fails the build here instead of shipping an invented name (PA-POS-24's no-invented-
// capabilities rule applies to the hero preview too).

import { getTemplate } from "@/lib/personas/templates";
import { getApp } from "@/lib/apps/catalog";
import { starterSkillBySlug } from "@/lib/starter-skills/catalog";
import type { ComposeCategory, ComposeData, ComposeEntry } from "./compose-preview";

function personaEntry(templateKey: string, keywords: readonly string[]): ComposeEntry {
  const template = getTemplate(templateKey);
  if (!template) {
    throw new Error(`compose-preview-data: unknown persona template "${templateKey}"`);
  }
  return { name: template.suggestedName, keywords };
}

function appEntry(appId: string, keywords: readonly string[]): ComposeEntry {
  const app = getApp(appId);
  if (!app) throw new Error(`compose-preview-data: unknown App id "${appId}"`);
  return { name: app.label, keywords };
}

function skillEntry(slug: string, keywords: readonly string[]): ComposeEntry {
  const skill = starterSkillBySlug(slug);
  if (!skill) throw new Error(`compose-preview-data: unknown starter Skill "${slug}"`);
  return { name: skill.name, keywords };
}

function personaName(templateKey: string): string {
  return personaEntry(templateKey, []).name;
}

export function buildComposeData(): ComposeData {
  const personas: ComposeEntry[] = [
    personaEntry("email", ["gmail", "email", "inbox", "reply", "respond"]),
    personaEntry("followup", ["follow-up", "follow up", "no reply", "stale", "ghost", "went quiet"]),
    personaEntry("sales", ["outreach", "pipeline", "deal", "cold", "book a call", "close"]),
    personaEntry("content", ["content", "post", "blog", "newsletter", "caption", "skool", "comment", "social"]),
    personaEntry("lead-research", ["lead", "zillow", "listing", "scan", "search", "qualif", "competitor", "intel"]),
    personaEntry("vcsa", ["support", "ticket", "complaint", "customer email"]),
    personaEntry("ops-cos", ["summar", "brief", "digest", "report", "weekly", "monday", "ritual"]),
    personaEntry("admin", ["capture", "organize", "voice memo", "file them", "screenshot"]),
  ];

  const apps: ComposeEntry[] = [
    appEntry("email-drafter", ["gmail", "email", "draft", "repl", "respond", "inbox"]),
    appEntry("follow-up-sweeps", ["follow", "stale", "no reply", "went quiet", "reactivate"]),
    appEntry("ritual-scheduler", ["ritual", "weekly", "every monday", "every week", "recurring", "8am", "every morning", "daily"]),
    appEntry("lead-scout", ["lead", "zillow", "prospect", "listing", "qualif", "google maps"]),
    appEntry("competitor-inspector", ["competitor"]),
    appEntry("landing-page-builder", ["landing page", "web page"]),
    appEntry("idea-engine", ["idea", "mvp", "signup form", "build me"]),
    appEntry("channels", ["slack", "whatsapp", "text me", "imessage"]),
    appEntry("daily-brief", ["brief", "digest", "summar"]),
    appEntry("podcasts", ["podcast"]),
    appEntry("youtube", ["youtube"]),
    appEntry("browser-agent", ["dashboard", "portal", "logs in", "log in", "browser"]),
  ];

  const skills: ComposeEntry[] = [
    skillEntry("write-like-the-user", ["my voice", "on-brand", "sound like me", "in my tone"]),
    skillEntry("lead-qualification", ["qualif"]),
    skillEntry("cold-intro-structure", ["cold", "outreach", "intro"]),
    skillEntry("quote-follow-up", ["quote", "follow"]),
    skillEntry("subject-line-not-filtered", ["subject line"]),
    skillEntry("customer-reply-tone-match", ["repl", "respond", "customer"]),
  ];

  const categoryPersona: Record<ComposeCategory, string> = {
    sales: personaName("sales"),
    content: personaName("content"),
    ops: personaName("ops-cos"),
    research: personaName("lead-research"),
    support: personaName("vcsa"),
    "idea-mvp": personaName("ops-cos"),
  };

  return { personas, apps, skills, categoryPersona };
}
