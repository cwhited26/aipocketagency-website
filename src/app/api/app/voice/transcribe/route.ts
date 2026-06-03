import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Whisper accepts up to 25 MB per request.
const MAX_BYTES = 25 * 1024 * 1024;

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

type WhisperResponse = { text?: string };
type WhisperError = { error?: { message?: string } };

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription isn't configured yet. Set OPENAI_API_KEY to enable voice memos." },
      { status: 503 },
    );
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Recording too long (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 25 MB.` },
      { status: 413 },
    );
  }

  // Whisper wants a filename with an audio extension; the browser sends WebM/Opus.
  const upstream = new FormData();
  upstream.append("file", file, file.name || "voice-memo.webm");
  upstream.append("model", "whisper-1");

  let res: Response;
  try {
    res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Transcription service unreachable: ${e.message}` : "Transcription service unreachable." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as WhisperError;
    const message = detail.error?.message ?? `Whisper returned ${res.status}.`;
    return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 502 });
  }

  const data = (await res.json()) as WhisperResponse;
  const text = (data.text ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "No speech was detected in the recording." },
      { status: 422 },
    );
  }

  return NextResponse.json({ text });
}
