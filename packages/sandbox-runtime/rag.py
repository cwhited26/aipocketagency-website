"""rag.py — the turbovec RAG core for the PA sub-agent runtime (Personas SPEC §3.5, PA-RAG-1..7).

Path (1) of the SPEC's binding decision: Python on the Modal sub-agent runtime. This module is the
pure logic — embedding (OpenAI REST, no SDK), index build/query (turbovec), and the index-level
ContainmentGuard — kept out of the Modal/network shell in app.py so it is unit-testable with pytest.

Indexes are turbovec files on a Modal volume, laid out per owner + zone:

    <volume_root>/<owner_id>/<sha256(zone_path)>/
        index.tvim   # IdMapIndex — the searchable index (stable uint64 doc ids, allowlist support)
        index.tq     # TurboQuantIndex — the simple companion the SPEC names alongside .tvim
        meta.json    # { zone_path, embedding_model, dim, docs: [{ id, docPath, snippet, tokens }] }

ContainmentGuard is STRUCTURAL here: a query for zone Z hashes to exactly one directory and can only
ever open Z's index — another zone's index is a different directory, unreachable. meta.json carries
the canonical zone_path and a mismatch raises OutOfZoneError (the SPEC's "reject out-of-zone queries
structurally"). Owner id is in the path too, so one owner can never reach another's index.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
import numpy as np
from turbovec import IdMapIndex, TurboQuantIndex

import rag_fallback

# turbovec bit width — 4 bits gives ~8x compression at near-FAISS recall (SPEC §3.5, TurboQuant).
BIT_WIDTH = 4
# Per-doc char cap so one giant file can't blow the embedding token budget; snippet shown in results.
MAX_DOC_CHARS = 8_000
SNIPPET_CHARS = 320
# OpenAI embeddings accept many inputs per call; batch to stay well under request limits.
EMBED_BATCH = 128
OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"


class RagError(Exception):
    """Base for RAG failures the endpoint maps to an HTTP status."""


class OutOfZoneError(RagError):
    """A query targeted a zone that doesn't match the loaded index — structural containment block."""


class NotBuiltError(RagError):
    """No index exists for this (owner, zone) yet — the caller should fall back to grep."""


class EmbeddingError(RagError):
    """The embedding provider call failed or returned an unusable payload."""


def normalize_zone(zone_path: str) -> str:
    """Canonical zone form: no leading/trailing slashes, no '.'/'..' segments. Mirrors the TS side."""
    return "/".join(
        seg.strip()
        for seg in zone_path.split("/")
        if seg.strip() and seg.strip() not in (".", "..")
    )


def _zone_hash(zone_path: str) -> str:
    return hashlib.sha256(normalize_zone(zone_path).encode("utf-8")).hexdigest()[:32]


def zone_dir(volume_root: str, owner_id: str, zone_path: str) -> str:
    """The on-volume directory for a (owner, zone) index. Owner + zone hash = structural isolation."""
    safe_owner = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:32]
    return os.path.join(volume_root, safe_owner, _zone_hash(zone_path))


# ── Embedding (OpenAI REST, no SDK) ─────────────────────────────────────────────────────────────

def _openai_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise EmbeddingError("OPENAI_API_KEY is not set on the runtime")
    return key


def embed_texts(texts: list[str], model: str) -> tuple[list[list[float]], int]:
    """Embed a list of texts with the BYO model. Returns (vectors, total_tokens). Direct REST."""
    if not texts:
        return [], 0
    key = _openai_key()
    vectors: list[list[float]] = []
    total_tokens = 0
    with httpx.Client(timeout=120.0) as client:
        for start in range(0, len(texts), EMBED_BATCH):
            batch = texts[start : start + EMBED_BATCH]
            resp = client.post(
                OPENAI_EMBEDDINGS_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "input": batch},
            )
            if resp.status_code != 200:
                raise EmbeddingError(f"embeddings HTTP {resp.status_code}: {resp.text[:200]}")
            payload: dict[str, Any] = resp.json()
            data = payload.get("data", [])
            if len(data) != len(batch):
                raise EmbeddingError("embeddings response length mismatch")
            # The API returns embeddings in input order, but sort by index defensively.
            for item in sorted(data, key=lambda d: int(d.get("index", 0))):
                vectors.append([float(x) for x in item["embedding"]])
            usage = payload.get("usage", {})
            total_tokens += int(usage.get("total_tokens", 0) or usage.get("prompt_tokens", 0) or 0)
    return vectors, total_tokens


def _to_matrix(vectors: list[list[float]]) -> np.ndarray:
    return np.asarray(vectors, dtype=np.float32)


# ── Build ───────────────────────────────────────────────────────────────────────────────────────

@dataclass
class BuildStats:
    doc_count: int
    token_count: int
    embedding_tokens: int
    dim: int
    cpu_seconds: float


def _approx_tokens(text: str) -> int:
    # Cheap heuristic (~4 chars/token) for the corpus token_count the threshold reads. The exact
    # embedding token count comes from the provider usage payload (embedding_tokens).
    return max(1, len(text) // 4)


def build_index(
    volume_root: str,
    owner_id: str,
    zone_path: str,
    embedding_model: str,
    docs: list[dict[str, str]],
) -> BuildStats:
    """Embed every doc, build the turbovec indexes, write .tvim + .tq + meta.json. docs: [{docPath,text}]."""
    start = time.monotonic()
    zone = normalize_zone(zone_path)
    if not zone:
        raise RagError("empty zone_path")

    clean: list[dict[str, str]] = []
    for d in docs:
        path = str(d.get("docPath", "")).strip()
        text = str(d.get("text", ""))
        if not path or not text.strip():
            continue
        clean.append({"docPath": path, "text": text[:MAX_DOC_CHARS]})
    if not clean:
        raise RagError("no usable documents in zone")

    vectors, embedding_tokens = embed_texts([d["text"] for d in clean], embedding_model)
    matrix = _to_matrix(vectors)
    dim = int(matrix.shape[1])
    ids = np.arange(1, len(clean) + 1, dtype=np.uint64)

    id_index = IdMapIndex(dim=dim, bit_width=BIT_WIDTH)
    id_index.add_with_ids(matrix, ids)
    simple_index = TurboQuantIndex(dim=dim, bit_width=BIT_WIDTH)
    simple_index.add(matrix)

    out_dir = zone_dir(volume_root, owner_id, zone)
    os.makedirs(out_dir, exist_ok=True)
    id_index.write(os.path.join(out_dir, "index.tvim"))
    simple_index.write(os.path.join(out_dir, "index.tq"))
    # Recovery store: the same float32 vectors, row-major, for the exact-cosine fallback at query time
    # if turbovec can't load/search the index (PA-RAG-8). Row order matches meta.json's docs (id = i+1).
    rag_fallback.write_fallback_vectors(out_dir, matrix.tolist())

    token_count = sum(_approx_tokens(d["text"]) for d in clean)
    meta = {
        "zone_path": zone,
        "owner_id_hash": hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:32],
        "embedding_model": embedding_model,
        "dim": dim,
        "docs": [
            {"id": int(ids[i]), "docPath": clean[i]["docPath"], "snippet": clean[i]["text"][:SNIPPET_CHARS]}
            for i in range(len(clean))
        ],
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh)

    return BuildStats(
        doc_count=len(clean),
        token_count=token_count,
        embedding_tokens=embedding_tokens,
        dim=dim,
        cpu_seconds=round(time.monotonic() - start, 4),
    )


# ── Query ─────────────────────────────────────────────────────────────────────────────────────

@dataclass
class QueryHit:
    doc_path: str
    score: float
    snippet: str


@dataclass
class QueryResult:
    hits: list[QueryHit]
    embedding_tokens: int
    cpu_seconds: float
    # True when the search ran off the exact-cosine fallback because turbovec was unusable. The Node
    # tier stamps this onto the cost-event metadata so Mission Control surfaces the degraded path.
    fallback: bool = False


def _load_meta(out_dir: str) -> dict[str, Any]:
    meta_path = os.path.join(out_dir, "meta.json")
    if not os.path.exists(meta_path):
        raise NotBuiltError("no index for this zone")
    with open(meta_path, "r", encoding="utf-8") as fh:
        meta: dict[str, Any] = json.load(fh)
    return meta


def query_index(
    volume_root: str,
    owner_id: str,
    zone_path: str,
    embedding_model: str,
    query: str,
    top_n: int,
) -> QueryResult:
    """Embed the query, search the zone's index, return top-N hits. Raises OutOfZoneError on a zone
    mismatch and NotBuiltError when no index exists. Structural containment: the directory is keyed by
    owner + zone hash, so this can only ever open this zone's index for this owner."""
    start = time.monotonic()
    zone = normalize_zone(zone_path)
    if not zone:
        raise OutOfZoneError("empty zone_path")

    out_dir = zone_dir(volume_root, owner_id, zone)
    index_path = os.path.join(out_dir, "index.tvim")
    if not os.path.exists(index_path):
        raise NotBuiltError("no index for this zone")

    meta = _load_meta(out_dir)
    # Belt over the structural key: the stored zone MUST equal the requested zone. A mismatch means a
    # caller reached an index that isn't theirs to query — fail closed (PA-RAG-3).
    if normalize_zone(str(meta.get("zone_path", ""))) != zone:
        raise OutOfZoneError(f"index zone {meta.get('zone_path')!r} != requested {zone!r}")
    expected_owner = hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:32]
    if str(meta.get("owner_id_hash", "")) != expected_owner:
        raise OutOfZoneError("index owner mismatch")

    docs_meta = meta.get("docs", [])
    by_id: dict[int, dict[str, Any]] = {int(d["id"]): d for d in docs_meta}

    qvec, embedding_tokens = embed_texts([query], embedding_model)
    if not qvec:
        raise EmbeddingError("query produced no embedding")

    # Primary path: turbovec. If loading or searching the index throws — a version mismatch, an
    # index-format change, a package upgrade — fall back to an exact cosine over the same embedded docs
    # (PA-RAG-8). Same ranking, just O(n); a broken turbovec deploy degrades to slow, never to down.
    ranked, used_fallback = _search(index_path, out_dir, qvec[0], int(meta.get("dim", 0)), len(docs_meta), top_n)

    hits: list[QueryHit] = []
    for doc_id, score in ranked:
        doc = by_id.get(int(doc_id))
        if doc is None:
            continue
        doc_path = str(doc["docPath"])
        # Final belt: every returned path must sit inside the queried zone.
        if not (doc_path == zone or doc_path.startswith(f"{zone}/")):
            continue
        hits.append(QueryHit(doc_path=doc_path, score=float(score), snippet=str(doc.get("snippet", ""))))

    return QueryResult(
        hits=hits,
        embedding_tokens=embedding_tokens,
        cpu_seconds=round(time.monotonic() - start, 4),
        fallback=used_fallback,
    )


def _search(
    index_path: str,
    out_dir: str,
    query_vec: list[float],
    dim: int,
    doc_count: int,
    top_n: int,
) -> tuple[list[tuple[int, float]], bool]:
    """Returns (ranked [(doc_id, score)], used_fallback). Tries turbovec first; on any turbovec error
    scores the recovery vector store with exact cosine. doc_id is the 1-based id the build assigned
    (row index + 1), matching meta.json's docs and the recovery store's row order."""
    try:
        index = IdMapIndex.load(index_path)
        scores, result_ids = index.search(_to_matrix([query_vec])[0], k=max(1, top_n))
        return (
            [(int(i), float(s)) for s, i in zip(np.asarray(scores).tolist(), np.asarray(result_ids).tolist())],
            False,
        )
    except Exception:  # noqa: BLE001 — any turbovec failure degrades to the exact fallback, by design.
        vectors = rag_fallback.load_fallback_vectors(out_dir, dim)
        if not vectors:
            # No recovery store (an index built before PA-RAG-8) and turbovec is broken — re-raise so
            # the endpoint reports a real error rather than silently returning nothing.
            raise
        ranked = rag_fallback.exact_cosine_search(vectors[:doc_count], query_vec, top_n)
        # Recovery row index → the build's 1-based doc id.
        return ([(row + 1, score) for row, score in ranked], True)
