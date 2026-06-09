"""rag_fallback.py — the exact-cosine fallback for the turbovec RAG runtime (PA-RAG-8).

turbovec is the fast nearest-neighbour engine, but a version bump, an index-format change, or a
package upgrade could make a build's `.tvim` unloadable or its `.search` API incompatible. When that
happens at query time, a deploy must not break querying — so `rag.query_index` falls back to a plain
exact cosine over the *same embedded docs* (same top-N, just O(n) slower). This module is that path.

It is deliberately pure stdlib (math/struct/os) — no numpy, no turbovec, no network — so the fallback
is unit-testable on its own (the rest of rag.py imports numpy + turbovec at module load). The build
side writes the raw query-time float32 vectors to a companion file so this path has the vectors to
score against without re-embedding.
"""

from __future__ import annotations

import math
import os
import struct

# Raw float32 vectors written alongside the turbovec index at build time, row-major, one row per doc
# in the same order as meta.json's `docs` list (doc id = row index + 1). The recovery store the
# exact-cosine fallback scores against; the turbovec `.tvim` / `.tq` stay the canonical fast path.
FALLBACK_VECTORS_FILE = "vectors.f32"


def pack_vectors(vectors: list[list[float]]) -> bytes:
    """Packs row-major float32. Raises on ragged rows — every vector must share one dimension."""
    dim = len(vectors[0]) if vectors else 0
    buf = bytearray()
    for v in vectors:
        if len(v) != dim:
            raise ValueError("ragged embedding rows — all vectors must share one dimension")
        buf += struct.pack(f"<{dim}f", *v)
    return bytes(buf)


def unpack_vectors(raw: bytes, dim: int) -> list[list[float]]:
    """Inverse of pack_vectors. Empty list when dim is 0 (nothing was indexed)."""
    if dim <= 0:
        return []
    stride = dim * 4
    rows = len(raw) // stride
    return [list(struct.unpack(f"<{dim}f", raw[r * stride : (r + 1) * stride])) for r in range(rows)]


def write_fallback_vectors(out_dir: str, vectors: list[list[float]]) -> None:
    """Writes the recovery vector store next to the turbovec index."""
    with open(os.path.join(out_dir, FALLBACK_VECTORS_FILE), "wb") as fh:
        fh.write(pack_vectors(vectors))


def load_fallback_vectors(out_dir: str, dim: int) -> list[list[float]] | None:
    """Reads the recovery vector store, or None when it isn't present (an older index predating it)."""
    path = os.path.join(out_dir, FALLBACK_VECTORS_FILE)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return unpack_vectors(fh.read(), dim)


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity in [-1, 1]; 0 when either vector is all-zero (degenerate)."""
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def exact_cosine_search(
    vectors: list[list[float]],
    query_vec: list[float],
    top_n: int,
) -> list[tuple[int, float]]:
    """Top-N (row_index, score) by exact cosine — the order turbovec approximates. Stable: ties keep
    their original row order (Python's sort is stable and we negate only the score for the key)."""
    if not vectors or top_n <= 0:
        return []
    scored = [(i, cosine(v, query_vec)) for i, v in enumerate(vectors)]
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[: max(1, top_n)]
