// page-scripts.ts — the in-page extraction scripts the worker evaluates against the live page.
// Everything here runs inside the browser via page.evaluate() and returns JSON-serializable data.
//
// The computed-style whitelist, the depth-4 element walker, and the asset-discovery sweep are
// adapted from JCodesMore/ai-website-cloner-template (.claude/skills/clone-website/SKILL.md):
//
//   MIT License — Copyright (c) 2025 JCodesMore
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software
//   and associated documentation files (the "Software"), to deal in the Software without
//   restriction. The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
//   WARRANTY OF ANY KIND.
//
// The extraction discipline rides the recon's standing rule: extract STYLE, never assets or
// third-party copy. Asset discovery records EXISTENCE and structure (counts, dimensions, layering)
// — never content, never URLs into the record. Text is measured for its COMPUTED VISUAL ROLE
// (size, weight, density), never captured verbatim.

/**
 * The cloner's computed-style whitelist (~50 properties) — exact values straight off the engine,
 * noise values dropped. Kept verbatim as the curated artifact the recon called worth keeping.
 */
export const STYLE_WHITELIST = [
  "fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing", "color",
  "textTransform", "textDecoration", "backgroundColor", "background",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "width", "height", "maxWidth", "minWidth", "maxHeight", "minHeight",
  "display", "flexDirection", "justifyContent", "alignItems", "gap",
  "gridTemplateColumns", "gridTemplateRows",
  "borderRadius", "border", "borderTop", "borderBottom", "borderLeft", "borderRight",
  "boxShadow", "overflow", "overflowX", "overflowY",
  "position", "top", "right", "bottom", "left", "zIndex",
  "opacity", "transform", "transition", "cursor",
  "objectFit", "objectPosition", "mixBlendMode", "filter", "backdropFilter",
  "whiteSpace", "textOverflow",
] as const;

/** Styles for one element by selector — the state-diff primitive (run in state A, then state B). */
export function elementStylesScript(selector: string): string {
  return `(function(selector, props) {
  const el = document.querySelector(selector);
  if (!el) return { error: "not-found" };
  const cs = getComputedStyle(el);
  const styles = {};
  props.forEach(function(p) {
    const v = cs[p];
    if (v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" && v !== "rgba(0, 0, 0, 0)") styles[p] = v;
  });
  return { styles: styles };
})(${JSON.stringify(selector)}, ${JSON.stringify(STYLE_WHITELIST)})`;
}

/**
 * Asset discovery (identification only — adapted from the cloner's discovery script). Counts,
 * dimensions, and layering signals; no URLs, no content. The layered-composition detection
 * (parent/sibling/z-index) is the part the recon flagged as worth keeping.
 */
export const ASSET_DISCOVERY_SCRIPT = `(function() {
  const imgs = Array.from(document.querySelectorAll("img"));
  let layered = 0;
  const seenParents = new Set();
  imgs.forEach(function(img) {
    const parent = img.parentElement;
    if (!parent || seenParents.has(parent)) return;
    const siblings = parent.querySelectorAll("img").length;
    if (siblings > 1) { layered++; seenParents.add(parent); }
  });
  let backgroundImageCount = 0;
  const all = Array.from(document.querySelectorAll("*"));
  for (let i = 0; i < all.length; i++) {
    const bg = getComputedStyle(all[i]).backgroundImage;
    if (bg && bg !== "none" && bg.indexOf("url(") !== -1) backgroundImageCount++;
  }
  return {
    imageCount: imgs.length,
    largeImageCount: imgs.filter(function(i) { return i.naturalWidth >= 600; }).length,
    layeredCompositions: layered,
    videoCount: document.querySelectorAll("video").length,
    canvasCount: document.querySelectorAll("canvas").length,
    inlineSvgCount: document.querySelectorAll("svg").length,
    backgroundImageCount: backgroundImageCount,
    faviconCount: document.querySelectorAll('link[rel*="icon"]').length
  };
})()`;

/**
 * The page audit — one pass that gathers everything the DNA builder infers from: body + heading
 * + button computed styles, area-weighted background colors, distinct radii/shadows/spacings,
 * font families/weights, section topology with stable selectors, and behavior hints (sticky nav,
 * scroll-snap, smooth-scroll libs, animation candidates). Text is never captured — only its
 * computed visual role (sizes, weights, densities).
 */
export const PAGE_AUDIT_SCRIPT = `(function() {
  // Stable handles: tag each audited element with a data attribute and select by it later —
  // nth-of-type paths don't survive deep or shifting DOMs (the linear.app lesson).
  let selCounter = 0;
  function sel(el) {
    let mark = el.getAttribute("data-pa-extract");
    if (!mark) {
      mark = String(++selCounter);
      el.setAttribute("data-pa-extract", mark);
    }
    return '[data-pa-extract="' + mark + '"]';
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function pickType(el) {
    const cs = getComputedStyle(el);
    return {
      fontSize: parseFloat(cs.fontSize),
      lineHeight: cs.lineHeight === "normal" ? null : parseFloat(cs.lineHeight),
      fontWeight: Number(cs.fontWeight) || 400,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform
    };
  }

  const bodyCs = getComputedStyle(document.body);

  // Font families across the first 200 elements (the cloner's dedup sweep) + computed weights.
  const familySet = new Set();
  const weightSet = new Set();
  const els = Array.from(document.querySelectorAll("*")).slice(0, 600);
  els.slice(0, 200).forEach(function(el) { familySet.add(getComputedStyle(el).fontFamily); });
  els.forEach(function(el) {
    const w = Number(getComputedStyle(el).fontWeight);
    if (w) weightSet.add(w);
  });

  // Headings by level + a body-copy sample (visual role only — no text travels).
  const headings = [];
  ["h1", "h2", "h3", "h4"].forEach(function(tag) {
    const el = Array.from(document.querySelectorAll(tag)).find(visible);
    if (el) headings.push(Object.assign({ level: tag }, pickType(el)));
  });
  let bodySample = null;
  const paragraphs = Array.from(document.querySelectorAll("p")).filter(function(p) {
    return visible(p) && (p.textContent || "").trim().length > 80;
  });
  if (paragraphs.length) bodySample = pickType(paragraphs[0]);
  let navSample = null;
  const navLink = document.querySelector("header a, nav a");
  if (navLink) navSample = pickType(navLink);

  // Buttons + prominent links styled as buttons — the primary-color signal.
  const buttonEls = Array.from(document.querySelectorAll("button, a")).filter(function(el) {
    if (!visible(el)) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.backgroundColor !== "rgba(0, 0, 0, 0)" && r.height >= 28 && r.height <= 80 && r.width >= 48 && r.width <= 420;
  }).slice(0, 12);
  const buttons = buttonEls.map(function(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selector: sel(el),
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderRadius: cs.borderRadius,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow,
      fontSize: parseFloat(cs.fontSize),
      area: Math.round(r.width * r.height),
      top: Math.round(r.top + window.scrollY)
    };
  });

  // Area-weighted background colors — the role-inference raw material.
  const bgAreas = {};
  const borderColors = {};
  const radii = {};
  const shadows = {};
  const spacingSamples = [];
  const letterSpacings = {};
  Array.from(document.querySelectorAll("*")).slice(0, 1500).forEach(function(el) {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > 12000 && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
      bgAreas[cs.backgroundColor] = (bgAreas[cs.backgroundColor] || 0) + area;
    }
    if (cs.borderTopWidth !== "0px" && cs.borderTopColor !== "rgba(0, 0, 0, 0)") {
      borderColors[cs.borderTopColor] = (borderColors[cs.borderTopColor] || 0) + 1;
    }
    const rad = parseFloat(cs.borderTopLeftRadius);
    if (rad > 0 && rad < 200 && area > 600) {
      const kind = (el.tagName === "BUTTON" || (el.tagName === "A" && area < 24000)) ? "button"
        : (el.tagName === "IMG" || el.tagName === "VIDEO") ? "media"
        : area > 60000 ? "card" : "other";
      const key = Math.round(rad) + ":" + kind;
      radii[key] = (radii[key] || 0) + 1;
    }
    if (cs.boxShadow && cs.boxShadow !== "none") {
      shadows[cs.boxShadow] = (shadows[cs.boxShadow] || 0) + 1;
    }
    if (cs.letterSpacing !== "normal" && parseFloat(cs.fontSize) >= 11) {
      const ctx = parseFloat(cs.fontSize) >= 28 ? "headings" : (cs.textTransform === "uppercase" ? "uppercase labels" : "body-size text");
      letterSpacings[cs.letterSpacing + "|" + ctx] = (letterSpacings[cs.letterSpacing + "|" + ctx] || 0) + 1;
    }
  });

  // Section topology: find the real section container — descend through single-child wrappers
  // (main > div > div nesting) to the node with the most tall direct children.
  function tallChildren(node) {
    return Array.from(node.children).filter(function(c) {
      return c.getBoundingClientRect().height >= 120 && ["SCRIPT", "STYLE", "HEADER", "NAV", "FOOTER"].indexOf(c.tagName) === -1;
    });
  }
  let rootEl = document.querySelector("main") || document.body;
  for (let depth = 0; depth < 4; depth++) {
    const tall = tallChildren(rootEl);
    if (tall.length >= 3) break;
    if (tall.length === 0) break;
    // Descend into the tallest wrapper and see if it exposes more sections.
    const tallest = tall.reduce(function(a, b) {
      return a.getBoundingClientRect().height >= b.getBoundingClientRect().height ? a : b;
    });
    if (tallChildren(tallest).length > tall.length) rootEl = tallest;
    else if (tall.length === 1) rootEl = tallest;
    else break;
  }
  const sectionEls = [];
  const headerEl = document.querySelector("header") || document.querySelector("nav");
  if (headerEl) sectionEls.push({ el: headerEl, label: "nav" });
  Array.from(rootEl.children).forEach(function(child, i) {
    const r = child.getBoundingClientRect();
    if (r.height < 120) return;
    if (child.tagName === "HEADER" || child.tagName === "NAV" || child.tagName === "FOOTER" || child.tagName === "SCRIPT" || child.tagName === "STYLE") return;
    sectionEls.push({ el: child, label: "section-" + (sectionEls.length) });
  });
  const footerEl = document.querySelector("footer");
  if (footerEl) sectionEls.push({ el: footerEl, label: "footer" });

  const sections = sectionEls.slice(0, 14).map(function(entry) {
    const el = entry.el;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const grid = cs.display.indexOf("grid") !== -1 ? cs.gridTemplateColumns.split(" ").length : 0;
    const imgs = el.querySelectorAll("img").length;
    const links = el.querySelectorAll("a").length;
    const headingEl = el.querySelector("h1, h2, h3");
    const textLen = (el.textContent || "").trim().length;
    const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();
    const pt = parseFloat(cs.paddingTop);
    const pb = parseFloat(cs.paddingBottom);
    if (pt > 0) spacingSamples.push(Math.round(pt));
    if (pb > 0) spacingSamples.push(Math.round(pb));
    const gapVal = parseFloat(cs.gap);
    if (gapVal > 0) spacingSamples.push(Math.round(gapVal));
    let descendantGrid = 0;
    const inner = el.querySelectorAll("div, ul");
    for (let i = 0; i < Math.min(inner.length, 40); i++) {
      const ics = getComputedStyle(inner[i]);
      if (ics.display.indexOf("grid") !== -1) {
        descendantGrid = Math.max(descendantGrid, ics.gridTemplateColumns.split(" ").length);
      }
    }
    return {
      label: entry.label,
      selector: sel(el),
      tag: el.tagName.toLowerCase(),
      top: Math.round(r.top + window.scrollY),
      height: Math.round(r.height),
      childCount: el.children.length,
      display: cs.display,
      gridCols: grid,
      descendantGridCols: descendantGrid,
      position: cs.position,
      hasVideo: el.querySelectorAll("video").length > 0,
      hasCanvas: el.querySelectorAll("canvas").length > 0,
      imageCount: imgs,
      linkCount: links,
      buttonCount: el.querySelectorAll("button").length,
      headingLevel: headingEl ? headingEl.tagName.toLowerCase() : null,
      textDensity: r.height > 0 ? Math.round(textLen / (r.height / 100)) : 0,
      classHint: cls.slice(0, 120),
      hasMarqueeHint: cls.indexOf("marquee") !== -1 || cls.indexOf("ticker") !== -1 || cls.indexOf("logo") !== -1 && imgs >= 4,
      hasPricingHint: cls.indexOf("pricing") !== -1 || cls.indexOf("plans") !== -1,
      hasAccordionHint: el.querySelectorAll("details, [aria-expanded]").length >= 3,
      centeredText: cs.textAlign === "center"
    };
  });

  // Behavior hints.
  const htmlCs = getComputedStyle(document.documentElement);
  const navEl = document.querySelector("header") || document.querySelector("nav");
  const navCs = navEl ? getComputedStyle(navEl) : null;
  const hiddenCandidates = [];
  Array.from(document.querySelectorAll("section *, main *")).slice(0, 1200).forEach(function(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const op = parseFloat(cs.opacity);
    const hasTranslate = cs.transform !== "none" && cs.transform.indexOf("matrix") !== -1;
    if ((op < 0.05 || (op < 0.9 && hasTranslate)) && r.top + window.scrollY > window.innerHeight && hiddenCandidates.length < 8) {
      hiddenCandidates.push({ selector: sel(el), opacity: op, transform: cs.transform });
    }
  });
  const tabEls = Array.from(document.querySelectorAll('[role="tab"], button[aria-selected]')).filter(visible).slice(0, 6);

  return {
    title: document.title,
    docHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    body: {
      backgroundColor: bodyCs.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.documentElement).backgroundColor : bodyCs.backgroundColor,
      color: bodyCs.color,
      fontFamily: bodyCs.fontFamily,
      fontSize: parseFloat(bodyCs.fontSize)
    },
    fonts: Array.from(familySet),
    weights: Array.from(weightSet).sort(function(a, b) { return a - b; }),
    headings: headings,
    bodySample: bodySample,
    navSample: navSample,
    buttons: buttons,
    bgAreas: Object.keys(bgAreas).map(function(k) { return { color: k, area: Math.round(bgAreas[k]) }; }).sort(function(a, b) { return b.area - a.area; }).slice(0, 12),
    borderColors: Object.keys(borderColors).map(function(k) { return { color: k, count: borderColors[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 6),
    radii: Object.keys(radii).map(function(k) { var p = k.split(":"); return { px: Number(p[0]), kind: p[1], count: radii[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10),
    shadows: Object.keys(shadows).map(function(k) { return { value: k, count: shadows[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 6),
    letterSpacings: Object.keys(letterSpacings).map(function(k) { var p = k.split("|"); return { value: p[0], context: p[1], count: letterSpacings[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5),
    spacingSamples: spacingSamples,
    sections: sections,
    navSelector: navEl ? sel(navEl) : null,
    navPosition: navCs ? navCs.position : null,
    scrollSnap: htmlCs.scrollSnapType !== "none" || bodyCs.scrollSnapType !== "none",
    smoothScrollLib: document.querySelector(".lenis, [data-lenis-prevent]") ? "lenis" : (document.querySelector("[data-scroll-container], .locomotive-scroll") ? "locomotive" : null),
    hiddenCandidates: hiddenCandidates,
    tabSelectors: tabEls.map(sel),
    hoverTargets: buttons.slice(0, 4).map(function(b) { return b.selector; })
  };
})()`;

/** Per-viewport responsive scan — section rects + effective column counts at the current width. */
export const RESPONSIVE_SCAN_SCRIPT = `(function() {
  function tallChildren(node) {
    return Array.from(node.children).filter(function(c) {
      return c.getBoundingClientRect().height >= 120 && ["SCRIPT", "STYLE", "HEADER", "NAV", "FOOTER"].indexOf(c.tagName) === -1;
    });
  }
  let rootEl = document.querySelector("main") || document.body;
  for (let depth = 0; depth < 4; depth++) {
    const tall = tallChildren(rootEl);
    if (tall.length >= 3) break;
    if (tall.length === 0) break;
    const tallest = tall.reduce(function(a, b) {
      return a.getBoundingClientRect().height >= b.getBoundingClientRect().height ? a : b;
    });
    if (tallChildren(tallest).length > tall.length) rootEl = tallest;
    else if (tall.length === 1) rootEl = tallest;
    else break;
  }
  const out = [];
  Array.from(rootEl.children).forEach(function(child) {
    const r = child.getBoundingClientRect();
    if (r.height < 120) return;
    const cs = getComputedStyle(child);
    let cols = cs.display.indexOf("grid") !== -1 ? cs.gridTemplateColumns.split(" ").length : 1;
    const inner = child.querySelectorAll("div, ul");
    for (let i = 0; i < Math.min(inner.length, 40); i++) {
      const ics = getComputedStyle(inner[i]);
      if (ics.display.indexOf("grid") !== -1) cols = Math.max(cols, ics.gridTemplateColumns.split(" ").length);
    }
    out.push({ height: Math.round(r.height), cols: cols });
  });
  return out;
})()`;
