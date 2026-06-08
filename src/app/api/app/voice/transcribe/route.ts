import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, WHISPER_MAX_BYTES } from "@/lib/voice/transcribe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/app/voice/transcribe
// multipart/form-data: { file: <audio blob> }
// Forwards the audio to OpenAI Whisper (whisper-1) and returns { text }.
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an audio file." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio file received." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The recording was empty." }, { status: 400 });
  }
  if (file.size > WHISPER_MAX_BYTES) {
    return NextResponse.json(
      { error: `Recording too long (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 25 MB.` },
      { status: 413 },
    );
  }

  // Whisper wants a filename with an audio extension; the browser sends WebM/Opus.
  const result = await transcribeAudio({
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name || "voice-memo.webm",
    mimeType: file.type || "audio/webm",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ text: result.text });
}
