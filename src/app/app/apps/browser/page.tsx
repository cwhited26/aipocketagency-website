import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { listPersonasForBusiness } from "@/lib/personas/db"
import { getPersonaDisplayName } from "@/lib/personas/types"
import { browserAgentJobLimits, getCurrentTier } from "@/lib/personas/tier-caps"
import { hasAppEntitlement } from "@/lib/metering/entitlement"
import { getPassDef, passPriceCents } from "@/data/project-passes"
import { listBrowserJobs } from "@/lib/browser-agent/db"
import { toJobListView } from "@/lib/browser-agent/views"
import { MeteringPanel } from "@/components/metering/MeteringPanel"
import { PassOfferCard } from "@/components/metering/PassOfferCard"
import { redirect } from "next/navigation"
import BrowserAgentClient from "./BrowserAgentClient"

export const dynamic = "force-dynamic"

export default async function BrowserAgentPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/app/login")

  const result = await fetchPaUser(user.id)
  const paUser = result.ok ? result.data : null
  if (!paUser) redirect("/app/onboarding")

  // Tier OR active Project Pass (PA-POS-31) — the widened gate.
  const tier = await getCurrentTier(user.id)
  const access = await hasAppEntitlement(user.id, "browser_agent", { tier })
  const unlocked = access.allowed

  const [jobsResult, personas] = await Promise.all([
    unlocked ? listBrowserJobs(user.id) : Promise.resolve({ ok: true as const, data: [] }),
    unlocked ? listPersonasForBusiness(user.id) : Promise.resolve([]),
  ])
  const jobs = jobsResult.ok ? jobsResult.data.map(toJobListView) : []
  // Pass-entitled jobs run at the Studio+ ceilings; the $5/run cost cap inside them still holds.
  const limits = browserAgentJobLimits(access.source === "project_pass" ? "studio_plus" : tier)

  const passDef = getPassDef("browser_agent")
  const showPassOffer = !unlocked && passDef !== null

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-4 space-y-3">
        {/* Credits chip (Studio+/Enterprise only — renders null below), active-pass chip, nudge. */}
        <MeteringPanel ownerId={user.id} appSlug="browser_agent" access={access} />
        {showPassOffer && passDef ? (
          <PassOfferCard
            offer={{
              appSlug: "browser_agent",
              label: passDef.label,
              priceCents: passPriceCents(passDef, tier),
              windowLabel: passDef.windowLabel,
            }}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <BrowserAgentClient
          unlocked={unlocked}
          initialJobs={jobs}
          personas={personas.map((p) => ({ id: p.id, name: getPersonaDisplayName(p) }))}
          limits={limits}
        />
      </div>
    </div>
  )
}
