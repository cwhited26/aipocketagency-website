import { redirect } from "next/navigation";

// /app/agent — the Agent tab landing is the mascot page at /app/ask (creature + Ask box + recent
// threads + activity, all on one surface). Anyone hitting /app/agent directly is sent there.
export default function AgentRootPage() {
  redirect("/app/ask");
}
