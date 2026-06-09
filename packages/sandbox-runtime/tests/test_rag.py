"""Unit tests for the turbovec RAG containment + zone logic (Personas SPEC §3.5, PA-RAG-3).

Skipped when turbovec / numpy aren't installed (rag.py imports them at module load); the structural
zone-isolation and normalization checks need neither network nor an OpenAI key.
"""

from __future__ import annotations

import pytest

rag = pytest.importorskip("rag")


def test_normalize_zone_strips_slashes_and_dot_segments() -> None:
    assert rag.normalize_zone("/memory/") == "memory"
    assert rag.normalize_zone("personas/vsm/knowledge/") == "personas/vsm/knowledge"
    assert rag.normalize_zone("a/./b/../c") == "a/b/c"
    assert rag.normalize_zone("") == ""


def test_zone_dir_isolates_owners_and_zones_structurally() -> None:
    # Different zones for the same owner → different directories (cross-zone is unreachable).
    a = rag.zone_dir("/indexes", "owner-1", "memory")
    b = rag.zone_dir("/indexes", "owner-1", "personas/vsm/knowledge")
    assert a != b
    # Different owners for the same zone → different directories (cross-tenant is unreachable).
    c = rag.zone_dir("/indexes", "owner-2", "memory")
    assert a != c
    # Spelling variants of the same zone collapse to the same directory.
    assert rag.zone_dir("/indexes", "owner-1", "/memory/") == a


def test_owner_id_is_not_stored_in_clear_path() -> None:
    # The owner id is hashed into the path, never embedded in the clear.
    d = rag.zone_dir("/indexes", "secret-owner@example.com", "memory")
    assert "secret-owner@example.com" not in d


def _fake_embed(vectors_by_text: dict[str, list[float]]):
    """A deterministic stand-in for rag.embed_texts so a build/query needs no OpenAI key."""

    def embed(texts: list[str], model: str):  # noqa: ANN202 — test helper
        return [vectors_by_text[t] for t in texts], len(texts)

    return embed


def test_query_falls_back_to_exact_cosine_when_turbovec_load_fails(monkeypatch, tmp_path) -> None:
    """When IdMapIndex.load raises (a turbovec version/format break), query_index recovers via the
    exact-cosine fallback over the persisted vectors — same ranking, fallback flag set (PA-RAG-8)."""
    docs = [
        {"docPath": "memory/a.md", "text": "alpha"},
        {"docPath": "memory/b.md", "text": "beta"},
        {"docPath": "memory/c.md", "text": "gamma"},
    ]
    # turbovec needs dim to be a positive multiple of 8; pad these orthogonal-ish vectors out to 8.
    def _v(*head: float) -> list[float]:
        return list(head) + [0.0] * (8 - len(head))

    vectors = {
        "alpha": _v(1.0, 0.0),
        "beta": _v(0.0, 1.0),
        "gamma": _v(1.0, 1.0),
        "find alpha": _v(1.0, 0.0),  # the query embedding — points exactly at "alpha"
    }
    monkeypatch.setattr(rag, "embed_texts", _fake_embed(vectors))

    root = str(tmp_path)
    stats = rag.build_index(root, "owner-1", "memory", "text-embedding-3-small", docs)
    assert stats.doc_count == 3

    # Force the turbovec path to throw, so query_index must take the fallback branch.
    def _boom(_path):  # noqa: ANN001, ANN202 — test stub
        raise RuntimeError("turbovec index format changed")

    monkeypatch.setattr(rag.IdMapIndex, "load", staticmethod(_boom))

    result = rag.query_index(root, "owner-1", "memory", "text-embedding-3-small", "find alpha", 3)
    assert result.fallback is True
    assert [h.doc_path for h in result.hits][0] == "memory/a.md"  # most relevant first
    assert {h.doc_path for h in result.hits} == {"memory/a.md", "memory/b.md", "memory/c.md"}
