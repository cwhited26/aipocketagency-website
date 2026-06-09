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
