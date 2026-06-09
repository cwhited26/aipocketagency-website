"""Unit tests for the exact-cosine RAG fallback (PA-RAG-8).

rag_fallback is pure stdlib (math/struct/os) — no numpy, no turbovec, no network — so these run in any
environment, unlike test_rag.py (which importorskips rag.py + its numpy/turbovec imports). This is the
coverage for the path that keeps querying working when turbovec is unusable.
"""

from __future__ import annotations

import os

import pytest

import rag_fallback


def test_pack_unpack_roundtrip() -> None:
    vectors = [[0.0, 1.0, 2.0], [3.5, -1.25, 0.0]]
    raw = rag_fallback.pack_vectors(vectors)
    out = rag_fallback.unpack_vectors(raw, dim=3)
    assert len(out) == 2
    for original, restored in zip(vectors, out):
        for a, b in zip(original, restored):
            assert a == pytest.approx(b)


def test_unpack_empty_is_empty() -> None:
    assert rag_fallback.unpack_vectors(b"", dim=0) == []
    assert rag_fallback.unpack_vectors(b"", dim=4) == []


def test_pack_rejects_ragged_rows() -> None:
    with pytest.raises(ValueError):
        rag_fallback.pack_vectors([[1.0, 2.0], [3.0]])


def test_cosine_identical_is_one_orthogonal_is_zero() -> None:
    assert rag_fallback.cosine([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    assert rag_fallback.cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
    # All-zero vector is degenerate → 0, not a divide-by-zero.
    assert rag_fallback.cosine([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_exact_cosine_search_orders_by_relevance() -> None:
    # Row 1 points exactly along the query; row 0 is orthogonal; row 2 is in between.
    vectors = [
        [0.0, 1.0],   # orthogonal to the query
        [1.0, 0.0],   # exactly the query direction
        [1.0, 1.0],   # 45° off
    ]
    ranked = rag_fallback.exact_cosine_search(vectors, query_vec=[1.0, 0.0], top_n=3)
    assert [row for row, _ in ranked] == [1, 2, 0]
    # Scores are descending.
    scores = [score for _, score in ranked]
    assert scores == sorted(scores, reverse=True)


def test_exact_cosine_search_respects_top_n() -> None:
    vectors = [[1.0, 0.0], [0.9, 0.1], [0.0, 1.0]]
    ranked = rag_fallback.exact_cosine_search(vectors, query_vec=[1.0, 0.0], top_n=2)
    assert len(ranked) == 2
    assert ranked[0][0] == 0  # best match first


def test_exact_cosine_search_empty_inputs() -> None:
    assert rag_fallback.exact_cosine_search([], [1.0], top_n=5) == []
    assert rag_fallback.exact_cosine_search([[1.0]], [1.0], top_n=0) == []


def test_write_then_load_fallback_vectors(tmp_path: object) -> None:
    out_dir = str(tmp_path)
    vectors = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    rag_fallback.write_fallback_vectors(out_dir, vectors)
    assert os.path.exists(os.path.join(out_dir, rag_fallback.FALLBACK_VECTORS_FILE))
    loaded = rag_fallback.load_fallback_vectors(out_dir, dim=3)
    assert loaded is not None
    assert len(loaded) == 2
    for original, restored in zip(vectors, loaded):
        for a, b in zip(original, restored):
            assert a == pytest.approx(b)


def test_load_fallback_vectors_absent_is_none() -> None:
    assert rag_fallback.load_fallback_vectors("/nonexistent-dir-xyz", dim=3) is None
