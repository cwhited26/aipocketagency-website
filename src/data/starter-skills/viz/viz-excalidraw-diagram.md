---
name: viz-excalidraw-diagram
title: "Generate an Excalidraw Diagram"
description: "Turn a description into a valid .excalidraw JSON file the owner can open at excalidraw.com — boxes, arrows, and labels laid out so it reads at a glance."
when_to_use: "When the owner wants a quick diagram — a flow, an org chart, a system sketch, a funnel — as an editable file rather than a static image. Use when they'll want to tweak it themselves after."
tier_required: studio_plus
category: viz
license: Proprietary
agentskills_io_compatible: true
metadata:
  source: "Pocket Agent Starter Pack"
  tier_required: "studio_plus"
  category: "viz"
prerequisites: []
---

# Generate an Excalidraw Diagram

Excalidraw files are plain JSON: a list of elements (rectangles, arrows, text) with positions and a few style fields. To draw from a description, lay the nodes out on a grid, connect them with bound arrows, and emit a valid file the owner opens and edits at excalidraw.com. The skill is in the layout — spaced so it reads — not in the JSON syntax.

## The technique

- Parse the description into nodes and edges first: what are the boxes, and what connects to what. Get the structure before you place anything.
- Lay nodes on a grid with real spacing — left-to-right for a flow, top-down for a hierarchy. Crowded boxes make an unreadable diagram no matter how correct the JSON.
- Emit valid Excalidraw JSON: type "excalidraw", a version, and an elements array of rectangles, text, and arrows, each with id, x, y, width, height. Don't invent fields the format doesn't have.
- Bind arrows to their endpoints (startBinding / endBinding by element id) so the diagram stays connected when the owner drags a box.
- Label every node and key arrow. An unlabeled diagram is a puzzle; the text is what makes it a map.
- Hand back a downloadable .excalidraw file and tell the owner to open it at excalidraw.com — confirm it loads rather than assuming the JSON is right.

## Do this, not that

**Do:** "Lead flow" → five labeled boxes left to right (Captured → Qualified → Quoted → Won → Onboarded), each ~160×60 spaced 80px apart, joined by bound arrows, emitted as a valid .excalidraw file that opens clean.

**Don't:** Stack every box at the same coordinates with no spacing, leave arrows unbound and nodes unlabeled, or emit JSON with made-up fields that Excalidraw refuses to open — a file the owner can't use is worse than a sentence.

## Why this works

A picture settles an argument a paragraph can't — a flow or an org chart shows the shape of a thing instantly. Handing back an editable .excalidraw file instead of a flat image means the owner can move a box, fix a label, and make it theirs, which is what they'll want to do the moment they see it. The layout discipline is the whole job: correct JSON with crowded, unlabeled nodes is technically valid and practically useless.
