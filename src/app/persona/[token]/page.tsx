import { fetchPersona, fetchShareToken } from "@/lib/personas/db";
import { isTokenLive } from "@/lib/personas/tokens";
import PersonaChatClient from "./PersonaChatClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat — Pocket Agent" };

export default async function PersonaChatPage({ params }: { params: { token: string } }) {
  let invalid = false;
  let paused = false;
  let personaId = "";
  let personaName = "";

  try {
    const tokenRow = await fetchShareToken(params.token);
    if (!tokenRow || !isTokenLive(tokenRow)) {
      invalid = true;
    } else {
      const persona = await fetchPersona(tokenRow.persona_id);
      if (!persona || persona.status === "archived") {
        invalid = true;
      } else if (persona.status !== "active") {
        paused = true;
        personaName = persona.name;
      } else {
        personaId = persona.id;
        personaName = persona.name;
      }
    }
  } catch {
    invalid = true;
  }

  if (invalid) {
    return <Centered title="This link isn't valid" body="Ask whoever shared it for a new one." />;
  }
  if (paused) {
    return <Centered title={`${personaName} is paused`} body="Please check back later." />;
  }

  return (
    <PersonaChatClient personaId={personaId} personaName={personaName} token={params.token} />
  );
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070a] text-slate-100 px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-slate-500 mt-2">{body}</p>
        <p className="text-[11px] text-slate-600 mt-6">Built with Pocket Agent.</p>
      </div>
    </div>
  );
}
