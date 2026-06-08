import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getProject,
  listProjectMemory,
  listProjectReferences,
  type ProjectMemoryEntry,
  type ProjectReference,
} from "@/lib/pa-projects";
import {
  listProjectConversationThreads,
  type ConversationThread,
} from "@/lib/pa-conversations";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { redirect, notFound } from "next/navigation";
import ProjectWorkspace from "./ProjectWorkspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Project — Pocket Agent" };
  const project = await getProject(params.id, user.id);
  const title = project.ok && project.data ? project.data.title : "Project";
  return { title: `${title} — Pocket Agent` };
}

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const userResult = await fetchPaUser(user.id);
  const paUser = userResult.ok ? userResult.data : null;
  if (!paUser) redirect("/app/onboarding");

  const projectResult = await getProject(params.id, user.id);
  if (!projectResult.ok || !projectResult.data) notFound();
  const project = projectResult.data;

  const [threadsResult, refsResult, memResult] = await Promise.all([
    listProjectConversationThreads(user.id, params.id),
    listProjectReferences(params.id, user.id),
    listProjectMemory(params.id, user.id),
  ]);
  const threads: ConversationThread[] = threadsResult.ok ? threadsResult.data : [];
  const references: ProjectReference[] = refsResult.ok ? refsResult.data : [];
  const memory: ProjectMemoryEntry[] = memResult.ok ? memResult.data : [];

  // The Plan tab shows the brain scaffolds (milestones + tasks) — the execution side of a project.
  let scaffolds: ScaffoldEntry[] = [];
  if (paUser.brain_repo) {
    scaffolds = await listScaffolds(paUser.brain_repo, paUser.github_token);
  }

  return (
    <ProjectWorkspace
      project={project}
      threads={threads}
      references={references}
      memory={memory}
      scaffolds={scaffolds}
    />
  );
}
