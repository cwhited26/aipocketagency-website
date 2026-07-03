import { createClient } from "@/lib/supabase/server"
import { fetchBrowserJob, listBrowserSteps } from "@/lib/browser-agent/db"
import { signJobScreenshotUrl } from "@/lib/browser-agent/screenshots"
import { toJobDetailView, toStepView } from "@/lib/browser-agent/views"
import { notFound, redirect } from "next/navigation"
import JobDetailClient from "./JobDetailClient"

export const dynamic = "force-dynamic"

export default async function BrowserJobDetailPage({
  params,
}: {
  params: { jobId: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/app/login")

  const jobRes = await fetchBrowserJob({ jobId: params.jobId, ownerId: user.id })
  if (!jobRes.ok || !jobRes.data) notFound()

  const stepsRes = await listBrowserSteps({ jobId: params.jobId, ownerId: user.id })
  const stepRows = stepsRes.ok ? stepsRes.data : []
  const steps = await Promise.all(
    stepRows.map(async (row) =>
      toStepView(row, row.screenshot_path ? await signJobScreenshotUrl(row.screenshot_path) : null),
    ),
  )

  return <JobDetailClient initialJob={toJobDetailView(jobRes.data, steps)} />
}
