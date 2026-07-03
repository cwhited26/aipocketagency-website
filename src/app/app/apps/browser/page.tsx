import { createClient } from "@/lib/supabase/server"
import { fetchPaUser } from "@/lib/pa-supabase"
import { listPersonasForBusiness } from "@/lib/personas/db"
import {
  browserAgentJobLimits,
  getCurrentTier,
  tierAllowsBrowserAgent,
} from "@/lib/personas/tier-caps"
import { listBrowserJobs } from "@/lib/browser-agent/db"
import { toJobListView } from "@/lib/browser-agent/views"
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

  const tier = await getCurrentTier(user.id)
  const unlocked = tierAllowsBrowserAgent(tier)

  const [jobsResult, personas] = await Promise.all([
    unlocked ? listBrowserJobs(user.id) : Promise.resolve({ ok: true as const, data: [] }),
    unlocked ? listPersonasForBusiness(user.id) : Promise.resolve([]),
  ])
  const jobs = jobsResult.ok ? jobsResult.data.map(toJobListView) : []
  const limits = browserAgentJobLimits(tier)

  return (
    <BrowserAgentClient
      unlocked={unlocked}
      initialJobs={jobs}
      personas={personas.map((p) => ({ id: p.id, name: p.name }))}
      limits={limits}
    />
  )
}
