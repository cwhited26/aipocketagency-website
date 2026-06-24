#!/usr/bin/env node
// @ts-check
/**
 * PC-MARK-6 — Generate the four Pocket Capture demo videos.
 *
 * One video per capture surface (Share Sheet / Voice Shortcut / Email Forward / SMS).
 * Each is a ~10-second portrait (720x1280, 9:16) deterministic mockup recorded with
 * Playwright (one screenshot per frame, animation driven by a pure `window.seek(p)`
 * function so output is reproducible — no wall-clock jitter), narrated in Chase's
 * cloned ElevenLabs voice via the existing `~/Desktop/video-narration/narrate.sh`
 * pipeline, then muxed with ffmpeg into a web-optimized H.264 + AAC MP4.
 *
 * Output: public/pocket-capture/demos/{share-sheet,voice-shortcut,email-forward,sms}.mp4
 * These are picked up by the PC-MARK-1 landing page DemoSlot via `data-demo-surface`.
 *
 * Credentials are NEVER hardcoded — narrate.sh reads ~/.config/elevenlabs/{api_key,voice_id}
 * at runtime. This script only verifies they exist and fails loudly if they don't.
 *
 * Run:  node scripts/pocket-capture/generate-demo-videos.mjs
 * Env overrides:
 *   VIDEO_NARRATION_DIR  path to the video-narration toolkit (default ~/Desktop/video-narration)
 *   PC_DEMO_CHROMIUM     explicit chromium/chrome executable path (default: auto-resolve)
 *   PC_DEMO_ONLY         comma-separated surface keys to (re)generate, e.g. "sms,voice"
 */

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, access, readdir, stat } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const OUT_DIR = join(REPO_ROOT, "public", "pocket-capture", "demos");

const NARRATION_DIR =
  process.env.VIDEO_NARRATION_DIR || join(homedir(), "Desktop", "video-narration");
const NARRATE_SH = join(NARRATION_DIR, "narrate.sh");
const ELEVEN_KEY_FILE = join(homedir(), ".config", "elevenlabs", "api_key");
const ELEVEN_VOICE_FILE = join(homedir(), ".config", "elevenlabs", "voice_id");

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;
const MIN_DUR = 8;
const MAX_DUR = 12;
const TAIL = 1.2; // seconds of held final frame after the voiceover ends
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * @typedef {Object} Surface
 * @property {string} key       marketing.ts CaptureSurfaceKey
 * @property {string} file      output basename (no extension)
 * @property {string} script    voiceover text (Chase voice, spec §10 checked)
 * @property {() => string} html full HTML document with a deterministic window.seek(p)
 */

// ---------------------------------------------------------------------------
// Shared mockup chrome — dark theme matching the landing page (cyan on slate).
// ---------------------------------------------------------------------------

const BASE_CSS = /* css */ `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    color: #e2e8f0;
    background:
      radial-gradient(1200px 700px at 50% -10%, rgba(34,211,238,0.10), transparent 60%),
      linear-gradient(180deg, #060a14 0%, #0a1322 100%);
  }
  .grid {
    position: absolute; inset: 0; opacity: 0.18; pointer-events: none;
    background-image:
      linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .statusbar {
    position: absolute; top: 0; left: 0; right: 0; height: 56px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px; font-size: 22px; font-weight: 600; color: #f1f5f9; z-index: 50;
  }
  .statusbar .right { display: flex; gap: 8px; align-items: center; font-size: 18px; }
  .brandbar {
    position: absolute; top: 56px; left: 0; right: 0; height: 64px;
    display: flex; align-items: center; gap: 12px; padding: 0 32px; z-index: 40;
  }
  .brandbar .dot {
    width: 30px; height: 30px; border-radius: 9px;
    background: linear-gradient(135deg, #22d3ee, #0891b2);
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .brandbar .name { font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
  .brandbar .name b { color: #67e8f9; }
  .layer { position: absolute; inset: 0; }
  .panel {
    position: absolute; left: 0; right: 0; top: 120px; bottom: 0;
    padding: 28px 32px; opacity: 0; will-change: opacity, transform;
  }
  .card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
    border-radius: 22px; padding: 24px;
  }
  .muted { color: #94a3b8; }
  .cyan { color: #67e8f9; }
  .h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
  .h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
  .body { font-size: 20px; line-height: 1.5; color: #cbd5e1; }
  .skelline { height: 16px; border-radius: 8px; background: rgba(148,163,184,0.22); margin: 14px 0; }
  .toast {
    position: absolute; left: 50%; top: 46%; transform: translate(-50%,-50%) scale(0.6);
    width: 360px; text-align: center; opacity: 0; z-index: 60;
  }
  .check {
    width: 132px; height: 132px; margin: 0 auto 24px; border-radius: 50%;
    background: radial-gradient(circle at 50% 40%, rgba(34,211,238,0.30), rgba(8,145,178,0.08));
    border: 3px solid #22d3ee; display: flex; align-items: center; justify-content: center;
  }
  .check svg { width: 70px; height: 70px; }
  .feedcard {
    display: flex; gap: 16px; align-items: flex-start;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(34,211,238,0.25);
    border-radius: 20px; padding: 22px; box-shadow: 0 0 0 1px rgba(34,211,238,0.05);
  }
  .feedcard .ic {
    width: 52px; height: 52px; border-radius: 14px; flex: 0 0 auto;
    background: rgba(34,211,238,0.12); display: flex; align-items: center;
    justify-content: center; font-size: 26px;
  }
  .feedcard .t { font-size: 20px; font-weight: 600; color: #e2e8f0; }
  .feedcard .meta { font-size: 15px; color: #64748b; margin-top: 8px; display: flex; gap: 10px; }
  .feedlabel { font-size: 15px; text-transform: uppercase; letter-spacing: 0.14em; color: #38bdf8; margin-bottom: 18px; }
`;

const SEEK_HELPERS = /* js */ `
  const $ = (id) => document.getElementById(id);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const seg = (p, a, b) => clamp01((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const show = (el, o) => { el.style.opacity = String(o); };
  const slice = (full, r) => full.slice(0, Math.round(clamp01(r) * full.length));
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
`;

/** Common <head> + status/brand bars + grid. Body content + scene script injected. */
function doc(/** @type {string} */ bodyHtml, /** @type {string} */ sceneScript, /** @type {string} */ brand) {
  return /* html */ `<!doctype html><html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head>
<body>
  <div class="grid"></div>
  <div class="statusbar"><span>9:41</span><span class="right">●●●  Wi-Fi  100%</span></div>
  <div class="brandbar"><span class="dot">🧠</span><span class="name">Pocket <b>Capture</b></span></div>
  ${bodyHtml}
  <script>${SEEK_HELPERS}\n${sceneScript}\nwindow.seek(0);</script>
</body></html>`;
}

/** Beat-4 feed card shared markup. */
function feedPanel(/** @type {string} */ id, /** @type {string} */ icon, /** @type {string} */ title, /** @type {string} */ source) {
  return /* html */ `
  <div class="panel" id="${id}">
    <div class="feedlabel">Your feed · just now</div>
    <div class="feedcard">
      <div class="ic">${icon}</div>
      <div>
        <div class="t">${title}</div>
        <div class="meta"><span>${source}</span><span>·</span><span>now</span><span>·</span><span class="cyan">auto-tagged</span></div>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Surface 1 — Share Sheet
// ---------------------------------------------------------------------------

function shareHtml() {
  const body = /* html */ `
    <div class="panel" id="article">
      <div class="muted" style="font-size:16px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px 18px;margin-bottom:24px;">🔒 theverge.com/article</div>
      <div class="h1">The tool that finally made me stop losing ideas</div>
      <div class="skelline" style="width:96%"></div>
      <div class="skelline" style="width:88%"></div>
      <div class="skelline" style="width:92%"></div>
      <div class="skelline" style="width:70%"></div>
      <div class="skelline" style="width:90%"></div>
      <div class="skelline" style="width:64%"></div>
      <div id="sharebtn" style="position:absolute;left:50%;bottom:40px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div style="width:84px;height:84px;border-radius:50%;background:rgba(34,211,238,0.12);border:2px solid rgba(34,211,238,0.5);display:flex;align-items:center;justify-content:center;font-size:38px;">⎙</div>
        <span class="cyan" style="font-size:16px;">Share</span>
      </div>
      <div id="ripple1" style="position:absolute;left:50%;bottom:82px;width:40px;height:40px;border-radius:50%;border:3px solid #22d3ee;transform:translate(-50%,50%) scale(0);"></div>
    </div>

    <div id="sheet" style="position:absolute;left:0;right:0;bottom:0;top:380px;transform:translateY(100%);background:linear-gradient(180deg,#0d1726,#0a1322);border-top-left-radius:32px;border-top-right-radius:32px;border-top:1px solid rgba(255,255,255,0.12);padding:28px 28px 40px;z-index:30;">
      <div style="width:54px;height:5px;border-radius:3px;background:rgba(148,163,184,0.4);margin:0 auto 24px;"></div>
      <div class="muted" style="font-size:16px;margin-bottom:20px;">Share to…</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;">
        <div style="text-align:center;"><div style="width:72px;height:72px;border-radius:18px;background:#1d4ed8;margin:0 auto 8px;"></div><span style="font-size:14px;color:#94a3b8;">Messages</span></div>
        <div style="text-align:center;"><div style="width:72px;height:72px;border-radius:18px;background:#0a8d48;margin:0 auto 8px;"></div><span style="font-size:14px;color:#94a3b8;">Mail</span></div>
        <div id="pctile" style="text-align:center;"><div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#22d3ee,#0891b2);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 0 0 0 rgba(34,211,238,0.6);" id="pcicon">🧠</div><span style="font-size:14px;color:#67e8f9;font-weight:600;">Pocket Capture</span></div>
        <div style="text-align:center;"><div style="width:72px;height:72px;border-radius:18px;background:#334155;margin:0 auto 8px;"></div><span style="font-size:14px;color:#94a3b8;">More</span></div>
      </div>
      <div id="ripple2" style="position:absolute;left:0;top:0;width:36px;height:36px;border-radius:50%;border:3px solid #fff;opacity:0;transform:scale(0);"></div>
    </div>

    <div class="toast" id="toast">
      <div class="check"><span id="toastcheck"></span></div>
      <div class="h2">Saved to your brain</div>
      <div class="muted" style="margin-top:8px;font-size:18px;">One tap. It's in your feed.</div>
    </div>

    ${feedPanel("feed", "🔗", "The tool that finally made me stop losing ideas", "🔗 Share Sheet")}
  `;

  const scene = /* js */ `
    $('toastcheck').innerHTML = CHECK_SVG;
    window.seek = function (p) {
      const a = $('article'), sheet = $('sheet'), toast = $('toast'), feed = $('feed');
      // Beat 1: article visible
      show(a, p < 0.66 ? 1 : 1 - seg(p, 0.66, 0.74));
      // share button tap ripple ~0.20-0.30
      const r1 = seg(p, 0.20, 0.30);
      $('ripple1').style.transform = 'translate(-50%,50%) scale(' + (1 + r1 * 3) + ')';
      $('ripple1').style.opacity = String(r1 < 1 ? 1 - r1 : 0);
      // Beat 2: sheet slides up 0.28-0.44
      const up = ease(seg(p, 0.28, 0.44));
      sheet.style.transform = 'translateY(' + (100 - up * 100) + '%)';
      // highlight pulse on Pocket Capture tile 0.44-0.56
      const pulse = seg(p, 0.44, 0.56);
      $('pcicon').style.boxShadow = '0 0 0 ' + (pulse * 14) + 'px rgba(34,211,238,' + (0.5 * (1 - pulse)) + ')';
      // Beat 3: tap PC tile 0.52-0.60 -> ripple, then sheet slides down 0.58-0.68
      const r2 = seg(p, 0.52, 0.62);
      const tile = $('pctile').getBoundingClientRect();
      $('ripple2').style.left = (tile.left + tile.width / 2 - $('sheet').getBoundingClientRect().left - 18) + 'px';
      $('ripple2').style.top = (tile.top - $('sheet').getBoundingClientRect().top + 18) + 'px';
      $('ripple2').style.opacity = String(r2 > 0 && r2 < 1 ? 1 - r2 : 0);
      $('ripple2').style.transform = 'scale(' + (r2 * 3) + ')';
      const down = ease(seg(p, 0.60, 0.70));
      sheet.style.transform = 'translateY(' + (up * 0 + down * 100) + '%)';
      if (up < 1) sheet.style.transform = 'translateY(' + (100 - up * 100) + '%)';
      // Beat 3b: toast 0.62-0.80
      const tShow = seg(p, 0.62, 0.72), tHide = seg(p, 0.80, 0.88);
      show(toast, tShow * (1 - tHide));
      toast.style.transform = 'translate(-50%,-50%) scale(' + lerp(0.6, 1, ease(tShow)) + ')';
      // Beat 4: feed 0.80-1
      show(feed, ease(seg(p, 0.80, 0.92)));
      feed.style.transform = 'translateY(' + (1 - ease(seg(p, 0.80, 0.94))) * 30 + 'px)';
    };
  `;
  return doc(body, scene, "share");
}

// ---------------------------------------------------------------------------
// Surface 2 — Voice Shortcut
// ---------------------------------------------------------------------------

function voiceHtml() {
  const body = /* html */ `
    <div class="panel" id="listen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div id="orb" style="width:240px;height:240px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(34,211,238,0.5),rgba(8,145,178,0.05));border:2px solid rgba(34,211,238,0.5);display:flex;align-items:center;justify-content:center;">
        <div id="orbcore" style="width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#67e8f9,#0891b2);"></div>
      </div>
      <div class="h2" style="margin-top:40px;">“Hey Siri, save this.”</div>
      <div class="muted" id="lstatus" style="margin-top:12px;font-size:20px;">Listening…</div>
    </div>

    <div class="panel" id="transcribe" style="display:flex;flex-direction:column;justify-content:center;">
      <div class="feedlabel">Heard you</div>
      <div class="card"><div class="body" id="ttext" style="min-height:120px;"></div><span id="caret" class="cyan">▍</span></div>
    </div>

    <div class="toast" id="toast">
      <div class="check"><span id="toastcheck"></span></div>
      <div class="h2">Saved</div>
      <div class="muted" style="margin-top:8px;font-size:18px;">Eyes on the road. Idea in your feed.</div>
    </div>

    ${feedPanel("feed", "🎤", "Follow up on the Johnson roof quote tomorrow", "🎤 Voice")}
  `;

  const scene = /* js */ `
    $('toastcheck').innerHTML = CHECK_SVG;
    const FULL = 'Follow up on the Johnson roof quote tomorrow.';
    window.seek = function (p) {
      const listen = $('listen'), tr = $('transcribe'), toast = $('toast'), feed = $('feed');
      // Beat 1: listening orb 0-0.34
      show(listen, p < 0.30 ? 1 : 1 - seg(p, 0.30, 0.36));
      const pulse = 0.5 + 0.5 * Math.sin(p * 38);
      $('orbcore').style.transform = 'scale(' + lerp(0.8, 1.18, pulse) + ')';
      $('orb').style.boxShadow = '0 0 ' + lerp(20, 70, pulse) + 'px rgba(34,211,238,0.45)';
      // Beat 2: transcription 0.30-0.62
      show(tr, seg(p, 0.30, 0.36) * (1 - seg(p, 0.66, 0.72)));
      $('ttext').textContent = slice(FULL, seg(p, 0.34, 0.58));
      $('caret').style.opacity = String((p > 0.30 && p < 0.62) ? (Math.sin(p * 50) > 0 ? 1 : 0.2) : 0);
      // Beat 3: toast 0.64-0.82
      const tShow = seg(p, 0.64, 0.72), tHide = seg(p, 0.82, 0.88);
      show(toast, tShow * (1 - tHide));
      toast.style.transform = 'translate(-50%,-50%) scale(' + lerp(0.6, 1, ease(tShow)) + ')';
      // Beat 4: feed
      show(feed, ease(seg(p, 0.82, 0.93)));
      feed.style.transform = 'translateY(' + (1 - ease(seg(p, 0.82, 0.95))) * 30 + 'px)';
    };
  `;
  return doc(body, scene, "voice");
}

// ---------------------------------------------------------------------------
// Surface 3 — Email Forward
// ---------------------------------------------------------------------------

function emailHtml() {
  const body = /* html */ `
    <div class="panel" id="mail">
      <div class="muted" style="font-size:16px;">Inbox</div>
      <div class="h2" style="margin:14px 0 18px;">Re: Q3 supplier contract — final terms</div>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:22px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#475569;"></div>
        <div><div style="font-weight:600;">Dana Whitfield</div><div class="muted" style="font-size:15px;">to me · 9:38 AM</div></div>
      </div>
      <div class="skelline" style="width:94%"></div>
      <div class="skelline" style="width:86%"></div>
      <div class="skelline" style="width:90%"></div>
      <div class="skelline" style="width:60%"></div>
      <div id="fwdbtn" style="position:absolute;left:32px;right:32px;bottom:40px;height:64px;border-radius:16px;border:2px solid rgba(34,211,238,0.5);background:rgba(34,211,238,0.10);display:flex;align-items:center;justify-content:center;gap:10px;font-size:20px;color:#67e8f9;font-weight:600;">↪ Forward</div>
    </div>

    <div class="panel" id="compose">
      <div class="feedlabel">Forward</div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:20px 22px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:12px;align-items:center;">
          <span class="muted" style="font-size:18px;">To:</span>
          <span class="cyan" id="toaddr" style="font-size:18px;font-weight:600;"></span><span id="caret2" class="cyan">▍</span>
        </div>
        <div style="padding:20px 22px;border-bottom:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-size:18px;">Fwd: Q3 supplier contract — final terms</div>
        <div style="padding:20px 22px;"><div class="skelline" style="width:90%"></div><div class="skelline" style="width:80%"></div><div class="skelline" style="width:86%"></div></div>
      </div>
      <div id="sendbtn" style="position:absolute;right:32px;bottom:40px;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#0891b2);display:flex;align-items:center;justify-content:center;font-size:30px;">➤</div>
    </div>

    <div class="toast" id="toast">
      <div class="check"><span id="toastcheck"></span></div>
      <div class="h2">Forwarded &amp; saved</div>
      <div class="muted" style="margin-top:8px;font-size:18px;">Body and attachments, in your feed.</div>
    </div>

    ${feedPanel("feed", "✉️", "Re: Q3 supplier contract — final terms", "✉️ Email")}
  `;

  const scene = /* js */ `
    $('toastcheck').innerHTML = CHECK_SVG;
    const ADDR = 'u8fk2q@capture.aipocketagent.com';
    window.seek = function (p) {
      const mail = $('mail'), comp = $('compose'), toast = $('toast'), feed = $('feed');
      show(mail, p < 0.30 ? 1 : 1 - seg(p, 0.30, 0.36));
      // forward button press 0.22-0.30
      const fp = seg(p, 0.22, 0.30);
      $('fwdbtn').style.transform = 'scale(' + (1 - 0.06 * Math.sin(fp * Math.PI)) + ')';
      // compose 0.30-0.66, address types 0.36-0.58
      show(comp, seg(p, 0.30, 0.36) * (1 - seg(p, 0.66, 0.72)));
      $('toaddr').textContent = slice(ADDR, seg(p, 0.36, 0.58));
      $('caret2').style.opacity = String((p > 0.30 && p < 0.62) ? (Math.sin(p * 50) > 0 ? 1 : 0.2) : 0);
      // send press 0.60-0.66
      const sp = seg(p, 0.60, 0.66);
      $('sendbtn').style.transform = 'scale(' + (1 - 0.18 * Math.sin(sp * Math.PI)) + ')';
      // toast 0.64-0.82
      const tShow = seg(p, 0.66, 0.74), tHide = seg(p, 0.82, 0.88);
      show(toast, tShow * (1 - tHide));
      toast.style.transform = 'translate(-50%,-50%) scale(' + lerp(0.6, 1, ease(tShow)) + ')';
      // feed
      show(feed, ease(seg(p, 0.82, 0.93)));
      feed.style.transform = 'translateY(' + (1 - ease(seg(p, 0.82, 0.95))) * 30 + 'px)';
    };
  `;
  return doc(body, scene, "email");
}

// ---------------------------------------------------------------------------
// Surface 4 — SMS
// ---------------------------------------------------------------------------

function smsHtml() {
  const body = /* html */ `
    <div class="panel" id="thread">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#0891b2);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:34px;">🧠</div>
        <div style="font-weight:700;font-size:22px;">Pocket Capture</div>
        <div class="muted" style="font-size:15px;">+1 (415) 555-0142</div>
      </div>
      <div id="outbubble" style="margin-left:auto;max-width:78%;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;border-radius:24px 24px 6px 24px;padding:18px 22px;font-size:20px;line-height:1.4;opacity:0;transform:translateY(40px);">
        Idea: bundle the gutter-cleaning add-on into the spring promo.
      </div>
      <div id="inbubble" style="margin-top:16px;max-width:60%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.10);border-radius:24px 24px 24px 6px;padding:16px 22px;font-size:20px;opacity:0;transform:translateY(30px);">
        Saved <span class="cyan">✓</span>
      </div>
    </div>

    <div class="panel" id="search">
      <div class="feedlabel">Search your feed</div>
      <div class="card" style="display:flex;align-items:center;gap:12px;padding:18px 22px;margin-bottom:20px;">
        <span style="font-size:22px;">🔎</span><span class="body" id="query"></span><span id="caret3" class="cyan">▍</span>
      </div>
      <div class="feedcard">
        <div class="ic">📱</div>
        <div>
          <div class="t">Idea: bundle the gutter-cleaning add-on…</div>
          <div class="meta"><span>📱 SMS</span><span>·</span><span>now</span><span>·</span><span class="cyan">#promo</span></div>
        </div>
      </div>
    </div>
  `;

  const scene = /* js */ `
    const QUERY = 'gutter promo';
    window.seek = function (p) {
      const thread = $('thread'), search = $('search');
      show(thread, p < 0.62 ? 1 : 1 - seg(p, 0.62, 0.70));
      // outgoing bubble flies in 0.16-0.34
      const o = ease(seg(p, 0.16, 0.34));
      $('outbubble').style.opacity = String(o);
      $('outbubble').style.transform = 'translateY(' + (1 - o) * 40 + 'px)';
      // incoming reply 0.40-0.56
      const inc = ease(seg(p, 0.40, 0.56));
      $('inbubble').style.opacity = String(inc);
      $('inbubble').style.transform = 'translateY(' + (1 - inc) * 30 + 'px)';
      // search panel 0.62-1, query types 0.68-0.86
      show(search, ease(seg(p, 0.64, 0.72)));
      $('query').textContent = slice(QUERY, seg(p, 0.68, 0.84));
      $('caret3').style.opacity = String((p > 0.64 && p < 0.88) ? (Math.sin(p * 50) > 0 ? 1 : 0.2) : 0);
    };
  `;
  return doc(body, scene, "sms");
}

/** @type {Surface[]} */
const SURFACES = [
  {
    key: "share",
    file: "share-sheet",
    script: "See this article? Tap Share. Tap Pocket Capture. Done — it's in your brain.",
    html: shareHtml,
  },
  {
    key: "voice",
    file: "voice-shortcut",
    script: "Hey Siri, save this. Hands on the wheel, an idea hits — done. It's saved.",
    html: voiceHtml,
  },
  {
    key: "email",
    file: "email-forward",
    script: "This email matters. Forward it to your Pocket Capture address. Done — it's saved.",
    html: emailHtml,
  },
  {
    key: "sms",
    file: "sms",
    script: "Just text it. Anything worth remembering. Your brain saves it — and you can search it later.",
    html: smsHtml,
  },
];

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

/**
 * Run a command, streaming stderr. Rejects (no silent swallow) on non-zero exit.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv}} [opts]
 * @returns {Promise<string>} stdout
 */
function sh(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", rej);
    child.on("close", (code) => {
      if (code === 0) res(out.trim());
      else rej(new Error(`${cmd} exited ${code}\n${err.trim() || out.trim()}`));
    });
  });
}

/** @param {string} file @returns {Promise<number>} duration in seconds */
async function probeDuration(file) {
  const out = await sh("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nokey=1:noprint_wrappers=1",
    file,
  ]);
  const d = Number.parseFloat(out);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`bad duration for ${file}: "${out}"`);
  return d;
}

/** @param {string} p @returns {Promise<boolean>} */
async function exists(p) {
  try {
    await access(p, FS.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a usable Chrome/Chromium binary: explicit env → playwright's own →
 * highest installed ms-playwright revision. Throws if none found.
 * @returns {Promise<string>}
 */
async function resolveChromium() {
  if (process.env.PC_DEMO_CHROMIUM) {
    if (!(await exists(process.env.PC_DEMO_CHROMIUM)))
      throw new Error(`PC_DEMO_CHROMIUM not found: ${process.env.PC_DEMO_CHROMIUM}`);
    return process.env.PC_DEMO_CHROMIUM;
  }
  const own = chromium.executablePath();
  if (own && (await exists(own))) return own;

  const cacheRoot = join(homedir(), "Library", "Caches", "ms-playwright");
  if (await exists(cacheRoot)) {
    const dirs = (await readdir(cacheRoot))
      .filter((d) => d.startsWith("chromium-"))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    const candidates = [
      "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const dir of dirs) {
      for (const c of candidates) {
        const full = join(cacheRoot, dir, c);
        if (await exists(full)) return full;
      }
    }
  }
  throw new Error(
    `no chromium found (tried PC_DEMO_CHROMIUM, playwright default ${own}, and ${cacheRoot}). ` +
      `Run: npx playwright install chromium`
  );
}

// ---------------------------------------------------------------------------
// Per-surface generation
// ---------------------------------------------------------------------------

/**
 * @param {import('playwright-core').Browser} browser
 * @param {Surface} surface
 * @param {string} workRoot
 */
async function generateOne(browser, surface, workRoot) {
  const work = await mkdtemp(join(workRoot, `${surface.file}-`));
  const outPath = join(OUT_DIR, `${surface.file}.mp4`);
  console.log(`\n▶ ${surface.file}`);

  // 1. Voiceover via the existing video-narration pipeline (Chase's cloned voice).
  //    narrate.sh's elevenlabs CLI only accepts output paths inside its cwd, so run
  //    from the work dir with a relative filename (mirrors the toolkit's own usage).
  console.log("  · narrating via narrate.sh (ElevenLabs cloned voice)…");
  await sh("bash", [NARRATE_SH, surface.script, "narration.mp3", "--similarity-boost", "0.8"], {
    cwd: work,
  });
  const audioPath = join(work, "narration.mp3");
  if (!(await exists(audioPath))) throw new Error(`narrate.sh produced no audio for ${surface.file}`);
  const audioDur = await probeDuration(audioPath);
  console.log(`    audio: ${audioDur.toFixed(2)}s`);

  // 2. Video duration tracks the voiceover (+ a held tail), clamped to ~10s.
  const videoDur = Math.min(MAX_DUR, Math.max(MIN_DUR, audioDur + TAIL));
  const frameCount = Math.round(videoDur * FPS);

  // 3. Render frames deterministically via window.seek(p).
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(surface.html(), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const framesDir = join(work, "frames");
    await mkdir(framesDir, { recursive: true });
    console.log(`  · rendering ${frameCount} frames (${videoDur.toFixed(1)}s @ ${FPS}fps)…`);
    for (let i = 0; i < frameCount; i++) {
      const p = frameCount > 1 ? i / (frameCount - 1) : 0;
      await page.evaluate((prog) => {
        const w = /** @type {{seek?: (n: number) => void}} */ (window);
        if (typeof w.seek !== "function") throw new Error("window.seek missing");
        w.seek(prog);
      }, p);
      await page.screenshot({
        path: join(framesDir, `f-${String(i).padStart(5, "0")}.png`),
        animations: "disabled",
      });
    }

    // 4. Encode frames + audio → web-optimized H.264/AAC MP4. Bump CRF until <2MB.
    console.log("  · encoding (ffmpeg)…");
    let crf = 28;
    let bytes = Infinity;
    while (crf <= 40) {
      await sh("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", String(FPS),
        "-i", join(framesDir, "f-%05d.png"),
        "-i", audioPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        outPath,
      ]);
      bytes = (await stat(outPath)).size;
      if (bytes <= MAX_BYTES) break;
      console.log(`    ${(bytes / 1024 / 1024).toFixed(2)}MB at crf ${crf} — too big, retrying`);
      crf += 4;
    }
    const finalDur = await probeDuration(outPath);
    console.log(
      `  ✓ ${outPath} — ${(bytes / 1024 / 1024).toFixed(2)}MB, ${finalDur.toFixed(1)}s, crf ${crf}`
    );
    if (bytes > MAX_BYTES) throw new Error(`${surface.file} still ${(bytes / 1024 / 1024).toFixed(2)}MB > 2MB cap`);
    return { file: `${surface.file}.mp4`, bytes, audioDur, videoDur: finalDur };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Fail loudly if anything the pipeline needs is missing.
  for (const [label, path] of [
    ["narrate.sh", NARRATE_SH],
    ["ElevenLabs api_key", ELEVEN_KEY_FILE],
    ["ElevenLabs voice_id", ELEVEN_VOICE_FILE],
  ]) {
    if (!(await exists(path))) throw new Error(`missing ${label} at ${path}`);
  }

  const only = process.env.PC_DEMO_ONLY
    ? new Set(process.env.PC_DEMO_ONLY.split(",").map((s) => s.trim()))
    : null;
  const targets = only ? SURFACES.filter((s) => only.has(s.key) || only.has(s.file)) : SURFACES;
  if (targets.length === 0) throw new Error(`PC_DEMO_ONLY matched no surfaces`);

  await mkdir(OUT_DIR, { recursive: true });
  const executablePath = await resolveChromium();
  console.log(`chromium: ${executablePath}`);

  const workRoot = await mkdtemp(join(tmpdir(), "pc-demo-"));
  const browser = await chromium.launch({ executablePath, headless: true });
  /** @type {{file: string, bytes: number, audioDur: number, videoDur: number}[]} */
  const results = [];
  try {
    for (const surface of targets) {
      results.push(await generateOne(browser, surface, workRoot));
    }
  } finally {
    await browser.close();
    await rm(workRoot, { recursive: true, force: true });
  }

  console.log("\n── summary ──");
  for (const r of results) {
    console.log(
      `  ${r.file.padEnd(18)} ${(r.bytes / 1024 / 1024).toFixed(2)}MB  audio ${r.audioDur.toFixed(1)}s  video ${r.videoDur.toFixed(1)}s`
    );
  }
  console.log(`\nwrote ${results.length} video(s) to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  process.exit(1);
});
