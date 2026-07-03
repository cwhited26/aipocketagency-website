// Registry for the six persona landing pages at /for/[slug] (PA-POS-17). The full copy
// lives in each page file under src/app/(marketing)/for/ — this file only carries what
// shared surfaces need: the header "For" menu and the cross-link chip strip on each page.
export type PersonaLink = {
  slug: string;
  /** Short label for chips and the nav menu — "Coaches", "Med Spas". */
  label: string;
  /** One-line hook shown in the header dropdown. */
  hook: string;
};

export const PERSONA_LINKS: PersonaLink[] = [
  { slug: "coaches", label: "Coaches", hook: "Recaps, check-ins, and content handled between sessions" },
  { slug: "consultants", label: "Consultants", hook: "Proposals and follow-up off your billable hours" },
  { slug: "contractors", label: "Contractors", hook: "Quotes and office work done from the truck" },
  { slug: "med-spas", label: "Med Spas", hook: "Bookings, rebooking, and reviews between clients" },
  { slug: "agencies", label: "Agencies", hook: "Client updates and proposals across every account" },
  { slug: "sales-teams", label: "Sales Teams", hook: "Every follow-up staged before a deal goes quiet" },
];

export function otherPersonas(slug: string): PersonaLink[] {
  return PERSONA_LINKS.filter((p) => p.slug !== slug);
}
