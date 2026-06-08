// csv.ts — render a run's leads as a downloadable CSV.
//
// Plain RFC-4180-ish CSV (quote a field when it contains a comma, quote, or newline; double internal
// quotes). The dynamic columns are the union of every lead's extracted `fields` keys, so whatever the
// owner's extraction pattern asked for shows up as its own column.

import type { LeadScoutLead } from "./types";

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function leadsToCsv(leads: LeadScoutLead[]): string {
  const fieldKeys: string[] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    for (const key of Object.keys(lead.profile ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        fieldKeys.push(key);
      }
    }
  }

  const header = ["url", "domain", "name", "contact", "classification", "summary", "status", ...fieldKeys];
  const rows = leads.map((lead) => {
    const base = [
      lead.url,
      lead.domain,
      lead.name,
      lead.contact,
      lead.classification,
      lead.summary,
      lead.status,
    ];
    const profile = (lead.profile ?? {}) as Record<string, unknown>;
    const extras = fieldKeys.map((key) => {
      const v = profile[key];
      return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
    });
    return [...base, ...extras].map(csvCell).join(",");
  });

  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}
