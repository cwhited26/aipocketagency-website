// Enterprise application — shared types + the option sets for the 31-question form (Part 8E).
//
// The option arrays are the single source of truth for the select/checkbox choices: the apply form
// renders them and the scoring logic reads the stored values back. Keep these in lockstep with the
// migration column list (075_enterprise_applications.sql) and Part 8E.

export const ROLE_OPTIONS = [
  "Founder / Owner",
  "CEO",
  "COO",
  "Marketing lead",
  "Sales lead",
  "Operations lead",
  "Agency owner",
  "Consultant",
  "Other",
] as const;

export const BUSINESS_TYPE_OPTIONS = [
  "Coach / consultant",
  "Agency",
  "Service business",
  "Software",
  "Local business",
  "Lead generation",
  "E-commerce",
  "Information product",
  "Professional services",
  "Other",
] as const;

export const REVENUE_OPTIONS = [
  "Under $10K/month",
  "$10K–$50K/month",
  "$50K–$100K/month",
  "$100K–$250K/month",
  "$250K–$500K/month",
  "$500K+/month",
  "Prefer not to say",
] as const;

export const TEAM_SIZE_OPTIONS = ["1", "2–5", "6–10", "11–25", "26–50", "51+"] as const;

export const AI_TOOL_OPTIONS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Perplexity",
  "Zapier / Make AI workflows",
  "Custom AI agents",
  "AI consultants / contractors",
  "Internal tools",
  "None",
  "Other",
] as const;

export const CONTEXT_LOCATION_OPTIONS = [
  "Gmail / inbox",
  "CRM",
  "Google Docs",
  "Notion",
  "Spreadsheets",
  "Screenshots",
  "Slack",
  "Project management tools",
  "Past AI chats",
  "Voice notes",
  "YouTube / podcasts",
  "My head",
  "Other",
] as const;

export const WORKFLOW_OPTIONS = [
  "Admin",
  "Email drafting",
  "Follow-up",
  "Lead research",
  "Content creation",
  "Podcast / YouTube ingestion",
  "Landing pages",
  "Idea validation",
  "Sales pages",
  "First prospect lists",
  "Decision support",
  "Operations",
  "Client communication",
  "Team approvals",
  "Custom integrations",
  "Other",
] as const;

export const APP_OPTIONS = [
  "Lead Scout",
  "Email Drafter",
  "Follow-Up Sweeps",
  "Capture Inbox",
  "YouTube Ingester",
  "Podcast Ingester",
  "Landing Page Builder",
  "Decision Roundtable",
  "Build Tools",
  "Brain Map",
  "Mission Control",
  "Idea Engine",
] as const;

export const HIGH_VOLUME_OPTIONS = [
  "Yes, high lead research volume",
  "Yes, high audio / Whisper hours",
  "Yes, high sub-agent runs",
  "Yes, multiple workflows running often",
  "Not sure yet",
  "No",
] as const;

export const YES_NO_NOTSURE_OPTIONS = ["Yes", "No", "Not sure"] as const;

export const YES_NO_MAYBELATER_OPTIONS = ["Yes", "No", "Maybe later"] as const;

export const TIMELINE_OPTIONS = [
  "Immediately",
  "Within 2 weeks",
  "Within 30 days",
  "Within 60 days",
  "Just researching",
] as const;

export const IMPLEMENTATION_OWNER_OPTIONS = [
  "Me",
  "Operations lead",
  "Marketing lead",
  "Sales lead",
  "Technical lead",
  "Assistant / VA",
  "Not sure",
] as const;

export const WILLING_TO_GATHER_OPTIONS = ["Yes", "No", "Need help"] as const;

export const USED_BEFORE_OPTIONS = [
  "No",
  "Yes, Personal Brain",
  "Yes, Business Agent",
  "Yes, Pro+",
  "Yes, Studio",
  "Yes, AI Agent Workspace",
  "Yes, 14-Day Pilot",
] as const;

export const BUDGET_OPTIONS = [
  "Under $1,000/month",
  "$1,000–$2,500/month",
  "$2,500–$5,000/month",
  "$5,000–$10,000/month",
  "$10,000+/month",
  "Not sure",
] as const;

export const DWY_INTEREST_OPTIONS = [
  "Yes, Premium Done-With-You Setup",
  "Yes, Standard Done-With-You Setup",
  "Maybe",
  "No",
] as const;

// Recommended routing buckets (Part 8G). Drives the redirect + the /enterprise/thanks headline.
export type QualificationRoute =
  | "enterprise"
  | "workspace_premium_dwy"
  | "business_standard_dwy"
  | "pilot"
  | "educational";

// The submitted application — what the form sends and the API validates before insert.
export type EnterpriseApplicationInput = {
  // Section 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  role: string;
  // Section 2
  businessType: string;
  whatYouSell: string;
  whoYouSellTo: string;
  monthlyRevenueRange: string;
  teamSize: string;
  // Section 3
  currentAiTools: string[];
  currentAiPain: string;
  contextLocations: string[];
  // Section 4
  desiredWorkflows: string[];
  biggestBottleneck: string;
  successOutcome: string;
  interestedApps: string[];
  // Section 5
  highVolumeUsage: string;
  needsPermissions: string;
  needsByoLlm: string;
  needsIntegrations: string;
  integrationSystems: string;
  // Section 6
  timeline: string;
  implementationOwner: string;
  willingToGatherContext: string;
  usedPocketAgentBefore: string;
  // Section 7
  budgetRange: string;
  dwyInterest: string;
  additionalNotes: string;
};
