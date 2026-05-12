#!/usr/bin/env bash
# Build a kit PDF from the canonical Typst template.
#
# Usage:
#   bun run pdf:build <kit-slug>
#
# Reads:  pdf-templates/kits/<kit-slug>.typ
# Writes: public/<kit-slug>.pdf
#
# Per APA/Products/Digital_Product_Pipeline_Playbook.md §PDF generation,
# every kit shares this one template + this one build command. No bespoke
# per-kit styling. Inter + JetBrains Mono fonts are resolved from the OS.
#
# Prerequisite: `typst` on PATH (`brew install typst`).
set -euo pipefail

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
  echo "usage: bun run pdf:build <kit-slug>" >&2
  echo "  example: bun run pdf:build dev-team-document-set" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${REPO_ROOT}/pdf-templates/kits/${SLUG}.typ"
DST="${REPO_ROOT}/public/${SLUG}.pdf"

if [ ! -f "$SRC" ]; then
  echo "error: kit source not found at ${SRC}" >&2
  echo "  create the Typst source first, then re-run." >&2
  exit 1
fi

if ! command -v typst >/dev/null 2>&1; then
  echo "error: typst not on PATH (brew install typst)" >&2
  exit 1
fi

# --root / lets the template import the shared kit.typ via its absolute path.
typst compile --root / "$SRC" "$DST"
echo "built: ${DST}"
ls -lh "$DST" | awk '{print "  size:", $5}'
