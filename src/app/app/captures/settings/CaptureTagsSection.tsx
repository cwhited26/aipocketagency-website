"use client";

// CaptureTagsSection — the Settings → Capture Tags editor (the owner-editable tab strip behind the
// Captures Dashboard). List the owner's tags with color swatches; add (name + 12-color palette
// picker); rename / recolor / delete; reorder by drag. Backed by /api/app/pocket-capture/tags
// (collection: GET list, POST create, PATCH reorder) and /[id] (PATCH rename/recolor, DELETE).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTURE_TAG_PALETTE,
  nextPaletteColor,
  type CaptureTag,
} from "@/lib/pocket-capture/tags";

function Swatches({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPTURE_TAG_PALETTE.map((c) => {
        const active = c.hex.toLowerCase() === selected.toLowerCase();
        return (
          <button
            key={c.hex}
            type="button"
            aria-label={c.name}
            aria-pressed={active}
            onClick={() => onPick(c.hex)}
            className={`h-6 w-6 rounded-full transition active:scale-90 ${
              active ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0e13]" : "hover:scale-110"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        );
      })}
    </div>
  );
}

function TagRow({
  tag,
  dragging,
  onRename,
  onRecolor,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  tag: CaptureTag;
  dragging: boolean;
  onRename: (name: string) => void;
  onRecolor: (hex: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [showColors, setShowColors] = useState(false);
  useEffect(() => setName(tag.name), [tag.name]);

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== tag.name) onRename(trimmed);
    else setName(tag.name);
  };

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="cursor-grab text-slate-600 active:cursor-grabbing">
          ⠿
        </span>
        <button
          type="button"
          aria-label="Change color"
          onClick={() => setShowColors((v) => !v)}
          className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/10"
          style={{ backgroundColor: tag.colorHex }}
        />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setName(tag.name);
                setEditing(false);
              }
            }}
            maxLength={40}
            className="min-w-0 flex-1 rounded-md bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-200 hover:text-white"
          >
            {tag.name}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200"
        >
          Delete
        </button>
      </div>
      {showColors && (
        <div className="mt-2.5 pl-7">
          <Swatches
            selected={tag.colorHex}
            onPick={(hex) => {
              onRecolor(hex);
              setShowColors(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

export default function CaptureTagsSection() {
  const [tags, setTags] = useState<CaptureTag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CAPTURE_TAG_PALETTE[0].hex);
  const [creating, setCreating] = useState(false);

  const dragFrom = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/app/pocket-capture/tags");
      if (!res.ok) {
        setLoadError(`Couldn't load your tags (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { tags?: CaptureTag[] };
      setTags(body.tags ?? []);
    } catch {
      setLoadError("Network error loading tags.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pre-pick a non-colliding color whenever the set changes.
  useEffect(() => {
    if (tags) setNewColor(nextPaletteColor(tags.map((t) => t.colorHex)));
  }, [tags]);

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setActionError(null);
    try {
      const res = await fetch("/api/app/pocket-capture/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, colorHex: newColor }),
      });
      const body = (await res.json().catch(() => ({}))) as { tag?: CaptureTag; error?: string };
      if (!res.ok || !body.tag) {
        setActionError(body.error ?? `Couldn't add that tag (${res.status}).`);
        return;
      }
      setTags((prev) => (prev ? [...prev, body.tag!] : [body.tag!]));
      setNewName("");
    } catch {
      setActionError("Network error adding a tag.");
    } finally {
      setCreating(false);
    }
  }, [newName, newColor]);

  const patchTag = useCallback(async (id: string, patch: { name?: string; colorHex?: string }) => {
    setActionError(null);
    // Optimistic.
    setTags((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
    try {
      const res = await fetch(`/api/app/pocket-capture/tags/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(body.error ?? "Couldn't update that tag.");
        await load(); // resync to authoritative state
      }
    } catch {
      setActionError("Network error updating a tag.");
      await load();
    }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    setActionError(null);
    const prev = tags;
    setTags((cur) => (cur ? cur.filter((t) => t.id !== id) : cur));
    try {
      const res = await fetch(`/api/app/pocket-capture/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        setActionError("Couldn't delete that tag.");
        setTags(prev);
      }
    } catch {
      setActionError("Network error deleting a tag.");
      setTags(prev);
    }
  }, [tags]);

  // ── Drag reorder ────────────────────────────────────────────────────────────────────
  const onDragStart = (i: number) => {
    dragFrom.current = i;
    setDragIndex(i);
  };
  const onDragEnter = (i: number) => {
    const from = dragFrom.current;
    if (from === null || from === i || !tags) return;
    const next = tags.slice();
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    dragFrom.current = i;
    setDragIndex(i);
    setTags(next);
  };
  const onDragEnd = useCallback(async () => {
    dragFrom.current = null;
    setDragIndex(null);
    if (!tags) return;
    try {
      const res = await fetch("/api/app/pocket-capture/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: tags.map((t) => t.id) }),
      });
      if (!res.ok) {
        setActionError("Couldn't save the new order.");
        await load();
      }
    } catch {
      setActionError("Network error saving order.");
      await load();
    }
  }, [tags, load]);

  const duplicateName = useMemo(() => {
    const n = newName.trim().toLowerCase();
    return Boolean(n && tags?.some((t) => t.name.toLowerCase() === n));
  }, [newName, tags]);

  return (
    <section id="capture-tags" className="scroll-mt-20 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-base">
          🏷️
        </span>
        <h2 className="text-sm font-bold text-slate-100">Capture tags</h2>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        These are the colored tabs across the top of your Captures dashboard. Drag to reorder, tap a
        name to rename, or tap the dot to recolor.
      </p>

      {loadError && <p className="mb-2 text-sm text-rose-300">{loadError}</p>}

      {tags === null && !loadError ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(tags ?? []).map((t, i) => (
            <TagRow
              key={t.id}
              tag={t}
              dragging={dragIndex === i}
              onRename={(name) => void patchTag(t.id, { name })}
              onRecolor={(hex) => void patchTag(t.id, { colorHex: hex })}
              onDelete={() => void remove(t.id)}
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={() => void onDragEnd()}
            />
          ))}
          {tags && tags.length === 0 && <p className="text-sm text-slate-500">No tags yet — add one below.</p>}
        </ul>
      )}

      {/* Add a tag */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Add a tag</p>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !duplicateName) void create();
            }}
            placeholder="Tag name (e.g. Clients)"
            maxLength={40}
            className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !newName.trim() || duplicateName}
            className="shrink-0 rounded-lg bg-cyan-400 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {creating ? "Adding…" : "Add"}
          </button>
        </div>
        <div className="mt-3">
          <Swatches selected={newColor} onPick={setNewColor} />
        </div>
        {duplicateName && <p className="mt-2 text-xs text-amber-300/90">You already have a tag with that name.</p>}
      </div>

      {actionError && <p className="mt-2 text-sm text-rose-300">{actionError}</p>}
    </section>
  );
}
