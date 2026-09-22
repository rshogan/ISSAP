// Quiz-screen art (wizards, city street scenes) and map symbology are both
// drawn with SVG.js and kept as live inline <svg> -- crisp vector at any size,
// composited over a photo backdrop (see cityBackgroundHTML). An earlier version
// rasterized this art to a tiny PNG for a deliberately blocky "pixel art" look;
// that's been dropped in favor of clean vector overlays per CLAUDE.md.
function inlineIcon(nativeW, nativeH, build, cssClass) {
  const draw = SVG().size(nativeW, nativeH).viewbox(0, 0, nativeW, nativeH);
  draw.attr({ "shape-rendering": "geometricPrecision" });
  if (cssClass) draw.addClass(cssClass);
  build(draw);
  return draw.node.outerHTML;
}

export function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// Saturated, high-contrast palette -- muted/pastel tones read as washed-out on
// a small sprite; SNES/Genesis-era character art leaned on bold, punchy color.
export const WIZARDS = {
  abjurist: { name: "Zephyrine the Abjurist", principle: "Fail-Safe Defaults", robe: "#2f5fb8", trim: "#dce8ff", skin: "#c9a8e8", symbol: "#7fc3ff" },
  illusionist: { name: "Mirelle the Illusionist", principle: "Psychological Acceptability", robe: "#9b2fc9", trim: "#f5d6ff", skin: "#e0a8d0", symbol: "#ff6fe0" },
  diviner: { name: "Osric the Diviner", principle: "Complete Mediation", robe: "#0f9e7a", trim: "#a8f5e0", skin: "#a0d8c8", symbol: "#4dffcf" },
  conjurer: { name: "Pell the Conjurer", principle: "Least Privilege", robe: "#c9860f", trim: "#ffe8a0", skin: "#e8c8a0", symbol: "#ffcf3d" },
  enchanter: { name: "Lysbet the Enchanter", principle: "Separation of Privilege", robe: "#d1295c", trim: "#ffd1e0", skin: "#e8a8bc", symbol: "#ff7fa8" },
  transmuter: { name: "Cobb the Transmuter", principle: "Economy of Mechanism", robe: "#3f9e2f", trim: "#d1ffb0", skin: "#b0e090", symbol: "#8dff5c" },
  necromancer: { name: "Wick the Necromancer", principle: "Least Common Mechanism", robe: "#4a3f8a", trim: "#c9c0ff", skin: "#b0a8d8", symbol: "#c9ff6f" },
  evoker: { name: "Faye the Evoker", principle: "Open Design", robe: "#e8590f", trim: "#ffd08a", skin: "#f0c8a0", symbol: "#ffe83d" },
};
export const WIZARD_ORDER = ["abjurist", "illusionist", "diviner", "conjurer", "enchanter", "transmuter", "necromancer", "evoker"];

export function wizardForCityIndex(index) {
  return WIZARD_ORDER[index % WIZARD_ORDER.length];
}

function drawSymbol(draw, symbol, cx, cy, color) {
  switch (symbol) {
    case "shield":
      draw.polygon(`${cx - 3},${cy - 4} ${cx + 3},${cy - 4} ${cx + 3},${cy} ${cx},${cy + 5} ${cx - 3},${cy}`).fill(color);
      return;
    case "mask":
      draw.rect(8, 4).move(cx - 4, cy - 2).radius(2).fill(color);
      draw.circle(1.6).center(cx - 2, cy).fill("#2a1c0d");
      draw.circle(1.6).center(cx + 2, cy).fill("#2a1c0d");
      return;
    case "orb":
      draw.circle(6).center(cx, cy).fill(color).stroke({ color: "#2a1c0d", width: 0.5 });
      return;
    case "spark":
      draw.polygon(`${cx},${cy - 5} ${cx + 2},${cy - 1} ${cx},${cy + 5} ${cx - 2},${cy - 1}`).fill(color);
      return;
    case "rings":
      draw.circle(4).center(cx - 2, cy).fill("none").stroke({ color, width: 1.4 });
      draw.circle(4).center(cx + 2, cy).fill("none").stroke({ color, width: 1.4 });
      return;
    case "triangle":
      draw.polygon(`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`).fill("none").stroke({ color, width: 1.4 });
      return;
    case "lantern":
      draw.rect(5, 7).move(cx - 2.5, cy - 3).fill(color).stroke({ color: "#2a1c0d", width: 0.5 });
      draw.line(cx, cy - 5, cx, cy - 3).stroke({ color: "#2a1c0d", width: 1 });
      return;
    case "star":
      draw
        .polygon(
          `${cx},${cy - 6} ${cx + 1.6},${cy - 1.6} ${cx + 6},${cy} ${cx + 1.6},${cy + 1.6} ${cx},${cy + 6} ${cx - 1.6},${cy + 1.6} ${cx - 6},${cy} ${cx - 1.6},${cy - 1.6}`
        )
        .fill(color);
      return;
    default:
      return;
  }
}

const INK = "#2a1c0d";

// Three-tone light/mid/dark banding (light hits the left third, the middle
// third stays the base tone, shadow falls on the right third), clipped to the
// shape's own silhouette so it never bleeds onto the background. A flat
// single-tone fill reads as 8-bit; three visible tone-steps is what actually
// reads as 16-bit SNES/Genesis-era sprite work.
function shadeBody(draw, points, baseColor, x0, y0, w, h) {
  const bandW = w / 3;
  const light = draw.polygon(points).fill(shade(baseColor, 34)).opacity(0.6);
  light.clipWith(draw.rect(bandW, h).move(x0, y0));
  const dark = draw.polygon(points).fill(shade(baseColor, -28)).opacity(0.55);
  dark.clipWith(draw.rect(bandW, h).move(x0 + bandW * 2, y0));
}

// Each wizard gets a genuinely different body/pose/silhouette -- not a shared
// skeleton with swapped colors -- per CLAUDE.md. Canvas is 38x52 for all eight
// so they display at a consistent size, but proportions vary drastically.
const WIZARD_DRAWERS = {
  abjurist(draw, w) {
    // Broad, sturdy, upright -- both hands on a big shield, close-fitting hood.
    draw.polygon("9,22 29,22 33,50 5,50").fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "9,22 29,22 33,50 5,50", w.robe, 5, 22, 28, 28);
    draw.polygon("19,2 27,17 11,17").fill(w.robe).stroke({ color: INK, width: 0.6 });
    draw.circle(9.5).center(19, 14).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1.2).center(16, 14).fill(INK);
    draw.circle(1.2).center(22, 14).fill(INK);
    draw
      .polygon("19,25 27,29 27,41 19,47 11,41 11,29")
      .fill(w.symbol)
      .stroke({ color: INK, width: 0.8 });
    draw.circle(5).center(19, 35).fill("none").stroke({ color: INK, width: 0.8 });
  },

  illusionist(draw, w) {
    // Slender, asymmetric flowing cape, tilted head, one arm raised with a sparkle.
    draw.polygon("17,20 23,20 28,50 8,48 12,29").fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "17,20 23,20 28,50 8,48 12,29", w.robe, 8, 20, 20, 30);
    draw.rect(2.2, 15).move(24, 9).rotate(38).fill(w.robe).stroke({ color: INK, width: 0.5 });
    draw.rect(2.2, 8).move(11, 24).rotate(-12).fill(w.robe).stroke({ color: INK, width: 0.5 });
    draw.circle(7.5).center(21, 13).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1.1).center(19, 13).fill(INK);
    draw.circle(1.1).center(24, 13).fill(INK);
    draw.polygon("20,2 30,13 19,15 12,14").fill(w.trim).stroke({ color: INK, width: 0.6 });
    drawSymbol(draw, "spark", 30, 2, w.symbol);
    draw.rect(9, 4).move(15, 32).radius(2).fill(w.trim).opacity(0.9);
    draw.circle(1.5).center(18, 34).fill(INK);
    draw.circle(1.5).center(22, 34).fill(INK);
  },

  diviner(draw, w) {
    // Hooded, faceless, rectangular robe, both hands cradling a big orb, small
    // orbs drifting nearby.
    draw.rect(20, 30).move(9, 20).fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "9,20 29,20 29,50 9,50", w.robe, 9, 20, 20, 30);
    draw.circle(8.5).center(19, 13).fill(w.robe).stroke({ color: INK, width: 0.6 });
    draw.circle(4).center(19, 15).fill(INK).opacity(0.55);
    draw.rect(3, 8).move(11, 26).rotate(18).fill(w.robe);
    draw.rect(3, 8).move(24, 26).rotate(-18).fill(w.robe);
    draw.circle(7).center(19, 34).fill(w.symbol).stroke({ color: INK, width: 0.7 });
    draw.circle(2).center(6, 24).fill(w.symbol).opacity(0.85);
    draw.circle(2.4).center(32, 20).fill(w.symbol).opacity(0.85);
    draw.circle(1.6).center(28, 44).fill(w.symbol).opacity(0.85);
  },

  conjurer(draw, w) {
    // Short, child-like proportions -- big head, small frame -- one arm out
    // presenting a conjured spark away from the body.
    draw.polygon("13,28 25,28 28,46 10,46").fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "13,28 25,28 28,46 10,46", w.robe, 10, 28, 18, 18);
    draw.rect(2, 5).move(11, 32).rotate(-16).fill(w.robe);
    draw.rect(2, 10).move(26, 26).rotate(48).fill(w.robe).stroke({ color: INK, width: 0.5 });
    draw.circle(11).center(19, 15).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1.3).center(16, 15).fill(INK);
    draw.circle(1.3).center(22, 15).fill(INK);
    draw.polygon("19,5 24,15 14,15").fill(w.trim).stroke({ color: INK, width: 0.6 });
    drawSymbol(draw, "spark", 34, 20, w.symbol);
  },

  enchanter(draw, w) {
    // Two-tone body split down the center; arms curve down to almost, but not
    // quite, close a ring -- separation that still has to meet in the middle.
    draw.polygon("19,20 19,49 7,47").fill(w.robe).stroke({ color: INK, width: 0.6 });
    draw.polygon("19,20 19,49 31,47").fill(w.trim).stroke({ color: INK, width: 0.6 });
    draw.circle(8).center(19, 14).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1.2).center(16.5, 14).fill(INK);
    draw.circle(1.2).center(21.5, 14).fill(INK);
    draw.polygon("19,4 24,14 14,14").fill(w.robe).stroke({ color: INK, width: 0.6 });
    draw
      .path("M 10,26 C 1,34 1,45 11,46")
      .fill("none")
      .stroke({ color: w.robe, width: 3, linecap: "round" });
    draw
      .path("M 28,26 C 37,34 37,45 27,46")
      .fill("none")
      .stroke({ color: w.trim, width: 3, linecap: "round" });
    draw.circle(2.6).center(11, 46).fill(w.symbol);
    draw.circle(2.6).center(27, 46).fill(w.symbol);
  },

  transmuter(draw, w) {
    // Deliberately minimal: a plain cone, no arms, no hat -- economy of form.
    draw.polygon("19,20 33,50 5,50").fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "19,20 33,50 5,50", w.robe, 5, 20, 28, 30);
    draw.circle(6.5).center(19, 13).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1).center(17, 13).fill(INK);
    draw.circle(1).center(21, 13).fill(INK);
    draw.rect(6, 6).center(31, 30).rotate(45).fill(w.symbol).stroke({ color: INK, width: 0.7 });
    draw.rect(6, 6).center(7, 38).rotate(45).fill(w.symbol).opacity(0.6);
  },

  necromancer(draw, w) {
    // Hunched lean (whole figure rotated slightly), ragged zigzag hem, lantern
    // held low near the ground.
    const g = draw.group();
    const hemPoints = "13,20 25,20 29,44 25,48 22,43 18,49 14,43 10,48 6,43";
    g.polygon(hemPoints).fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(g, hemPoints, w.robe, 6, 20, 23, 28);
    g.polygon("19,4 26,18 12,18").fill(w.robe).stroke({ color: INK, width: 0.6 });
    g.circle(8).center(19, 13).fill(w.robe).stroke({ color: INK, width: 0.6 });
    g.circle(3.4).center(19, 14).fill(INK).opacity(0.6);
    g.rect(1.4, 20).move(3, 26).fill("#5c4326");
    g.rect(6, 8).move(0, 40).fill(w.symbol).stroke({ color: INK, width: 0.6 });
    g.line(3, 40, 3, 36).stroke({ color: INK, width: 1 });
    g.rotate(9, 19, 50);
  },

  evoker(draw, w) {
    // Dynamic, bare-headed (nothing hidden), both arms thrown up and out, cape
    // flared wide behind, starburst overhead.
    draw.polygon("19,20 34,50 4,50").fill(w.trim).stroke({ color: INK, width: 0.6 });
    draw.polygon("14,20 24,20 27,48 11,48").fill(w.robe).stroke({ color: INK, width: 0.6 });
    shadeBody(draw, "14,20 24,20 27,48 11,48", w.robe, 11, 20, 16, 28);
    draw.rect(3, 17).move(4, 4).rotate(-38).fill(w.robe).stroke({ color: INK, width: 0.5 });
    draw.rect(3, 17).move(31, 4).rotate(38).fill(w.robe).stroke({ color: INK, width: 0.5 });
    drawSymbol(draw, "star", 19, 6, w.symbol);
    draw.circle(8.5).center(19, 15).fill(w.skin).stroke({ color: INK, width: 0.6 });
    draw.circle(1.3).center(16.5, 15).fill(INK);
    draw.circle(1.3).center(21.5, 15).fill(INK);
  },
};

/** A ~38x52 wizard sprite for the quiz screen's graphics panel; each key has its own distinct pose. */
export function wizardSpriteHTML(wizardKey) {
  const w = WIZARDS[wizardKey] || WIZARDS.abjurist;
  const drawFn = WIZARD_DRAWERS[wizardKey] || WIZARD_DRAWERS.abjurist;
  return inlineIcon(38, 52, (draw) => drawFn(draw, w), "wizard-sprite");
}

const MOTIF_GROUND = {
  scroll: "#e0b24a",
  magnifier: "#4a90c9",
  scale: "#d1a13d",
  book: "#c9622f",
  tower: "#8a95a8",
  shield: "#3f6fa8",
  gear: "#9199a8",
  eye: "#3f9ec9",
  wall: "#c9854a",
  flame: "#e8481f",
  lock: "#a8783f",
  cloud: "#a8c9e0",
  crown: "#e0b23d",
  key: "#c9954a",
  clock: "#4a9e8a",
};

/** Draws a single silhouette motif centered at (cx, cy), roughly 20 units across. */
function drawMotif(draw, motif, cx, cy, color) {
  switch (motif) {
    case "scroll":
      draw.rect(16, 9).move(cx - 8, cy - 4.5).radius(3).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.circle(4).center(cx - 8, cy).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.circle(4).center(cx + 8, cy).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      return;
    case "magnifier":
      draw.circle(12).center(cx - 2, cy - 2).fill("none").stroke({ color, width: 2.4 });
      draw.line(cx + 6, cy + 6, cx + 12, cy + 12).stroke({ color, width: 3, linecap: "round" });
      return;
    case "scale":
      draw.line(cx, cy - 9, cx, cy + 7).stroke({ color, width: 1.6 });
      draw.line(cx - 10, cy - 5, cx + 10, cy - 5).stroke({ color, width: 1.6 });
      draw.polygon(`${cx - 14},${cy - 5} ${cx - 6},${cy - 5} ${cx - 10},${cy + 2}`).fill("none").stroke({ color, width: 1.2 });
      draw.polygon(`${cx + 6},${cy - 5} ${cx + 14},${cy - 5} ${cx + 10},${cy + 2}`).fill("none").stroke({ color, width: 1.2 });
      return;
    case "book":
      draw.rect(18, 13).move(cx - 9, cy - 6.5).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.line(cx, cy - 6.5, cx, cy + 6.5).stroke({ color: "#2a1c0d", width: 0.8 });
      return;
    case "tower":
      draw.rect(12, 20).move(cx - 6, cy - 10).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.polygon(`${cx - 8},${cy - 10} ${cx - 4},${cy - 10} ${cx - 4},${cy - 14} ${cx - 8},${cy - 14}`).fill(color);
      draw.polygon(`${cx},${cy - 10} ${cx + 4},${cy - 10} ${cx + 4},${cy - 14} ${cx},${cy - 14}`).fill(color);
      return;
    case "shield":
      draw
        .polygon(`${cx - 8},${cy - 9} ${cx + 8},${cy - 9} ${cx + 8},${cy + 2} ${cx},${cy + 12} ${cx - 8},${cy + 2}`)
        .fill(color)
        .stroke({ color: "#2a1c0d", width: 0.6 });
      return;
    case "gear":
      draw.circle(14).center(cx, cy).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        draw
          .rect(3, 4)
          .center(cx + 9 * Math.cos(a), cy + 9 * Math.sin(a))
          .rotate((a * 180) / Math.PI)
          .fill(color);
      }
      draw.circle(5).center(cx, cy).fill("#2a1c0d");
      return;
    case "eye":
      draw.polygon(`${cx - 12},${cy} ${cx},${cy - 7} ${cx + 12},${cy} ${cx},${cy + 7}`).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.circle(6).center(cx, cy).fill("#2a1c0d");
      return;
    case "wall":
      draw.rect(24, 10).move(cx - 12, cy - 2).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      for (let i = 0; i < 4; i++) draw.rect(4, 4).move(cx - 12 + i * 6, cy - 6).fill(color);
      return;
    case "flame":
      draw
        .path(`M ${cx} ${cy - 12} C ${cx + 8} ${cy - 4}, ${cx + 6} ${cy + 4}, ${cx} ${cy + 10} C ${cx - 6} ${cy + 4}, ${cx - 8} ${cy - 4}, ${cx} ${cy - 12} Z`)
        .fill(color);
      return;
    case "lock":
      draw.rect(14, 10).move(cx - 7, cy - 1).radius(2).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw
        .path(`M ${cx - 4} ${cy - 1} V ${cy - 6} A 4 4 0 0 1 ${cx + 4} ${cy - 6} V ${cy - 1}`)
        .fill("none")
        .stroke({ color, width: 2 });
      return;
    case "cloud":
      draw.circle(10).center(cx - 6, cy).fill(color);
      draw.circle(13).center(cx + 3, cy - 2).fill(color);
      draw.circle(9).center(cx + 10, cy + 1).fill(color);
      return;
    case "crown":
      draw
        .polygon(`${cx - 10},${cy + 6} ${cx - 10},${cy - 2} ${cx - 5},${cy + 2} ${cx},${cy - 6} ${cx + 5},${cy + 2} ${cx + 10},${cy - 2} ${cx + 10},${cy + 6}`)
        .fill(color)
        .stroke({ color: "#2a1c0d", width: 0.6 });
      return;
    case "key":
      draw.circle(7).center(cx - 7, cy).fill("none").stroke({ color, width: 2.4 });
      draw.line(cx - 1, cy, cx + 11, cy).stroke({ color, width: 2.4 });
      draw.line(cx + 7, cy, cx + 7, cy + 4).stroke({ color, width: 2.2 });
      draw.line(cx + 11, cy, cx + 11, cy + 4).stroke({ color, width: 2.2 });
      return;
    case "clock":
      draw.circle(16).center(cx, cy).fill(color).stroke({ color: "#2a1c0d", width: 0.6 });
      draw.line(cx, cy, cx, cy - 6).stroke({ color: "#2a1c0d", width: 1.4 });
      draw.line(cx, cy, cx + 4, cy + 2).stroke({ color: "#2a1c0d", width: 1.4 });
      return;
    default:
      draw.circle(10).center(cx, cy).fill(color);
      return;
  }
}

export function motifIconHTML(motif) {
  return inlineIcon(32, 32, (draw) => {
    draw.addClass("motif-icon");
    drawMotif(draw, motif, 16, 16, MOTIF_GROUND[motif] || "#8a8a72");
  });
}

// One neon accent per domain -- drives the grid, building edges, window glow and
// signage on that domain's streets, so each region reads distinctly at a glance.
const DOMAIN_NEON = {
  D1: "#22d3ee",
  D2: "#e879f9",
  D3: "#fb923c",
  D4: "#4ade80",
};

export function domainAccentColor(domainCode) {
  return DOMAIN_NEON[domainCode] || DOMAIN_NEON.D1;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (h, shift) => (h >> shift) & 0xff;
  const mix = (shift) => Math.round(lerp(ch(a, shift), ch(b, shift), t));
  const r = mix(16), g = mix(8), bl = mix(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 0xff) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// A building's footprint is defined at a "depth" t in [0,1] (0 = nearest/largest,
// toward 1 = distant/smallest, converging on the street's vanishing point).
// Drawn as an actual 3D box in the same one-point perspective as the road: the
// front face is flat-on to the viewer, and a side face + a roof/top face are
// extruded toward (vanishX, vanishY) -- the same vanishing point the road
// itself converges on -- so the building reads as a volume that belongs in the
// scene rather than a flat cutout pasted over it. `side` ("left"/"right") says
// which side of the road the building sits on, which determines which vertical
// edge is nearest the street and therefore gets the receding side wall.
function drawBuilding(draw, x, yBase, wdt, hgt, baseColor, rng, side, vanishX, vanishY, neon, s = 1) {
  // Outlines have to thin out with distance too, or far buildings turn into
  // solid blobs of stroke.
  const sw = (w) => Math.max(0.08, w * s);
  const fill = shade(baseColor, Math.round(rng() * 20 - 10));
  const topY = yBase - hgt;
  const nearX = side === "left" ? x + wdt : x;
  const dx = vanishX - nearX;
  const dy = vanishY - topY;
  const dist = Math.hypot(dx, dy) || 1;
  const depth = Math.min(wdt * 0.5, hgt * 0.5, 10);
  const ox = (dx / dist) * depth;
  const oy = (dy / dist) * depth;

  // Roof/top face: the front-top edge extruded back toward the vanishing point.
  draw
    .polygon(`${x},${topY} ${x + wdt},${topY} ${x + wdt + ox},${topY + oy} ${x + ox},${topY + oy}`)
    .fill(shade(fill, 20))
    .stroke({ color: neon, width: sw(0.4), opacity: 0.5 });

  // Side wall: only the road-facing vertical edge recedes, so it's the one drawn.
  const sidePts =
    side === "left"
      ? `${x + wdt},${topY} ${x + wdt + ox},${topY + oy} ${x + wdt + ox},${yBase + oy} ${x + wdt},${yBase}`
      : `${x},${topY} ${x + ox},${topY + oy} ${x + ox},${yBase + oy} ${x},${yBase}`;
  draw.polygon(sidePts).fill(shade(fill, -22)).stroke({ color: neon, width: sw(0.4), opacity: 0.5 });

  // Front face, flat-on to the viewer.
  draw.rect(wdt, hgt).move(x, topY).fill(fill).stroke({ color: neon, width: sw(0.6), opacity: 0.7 });

  // Neon window grid -- irregular lit/dark cells, the signature "city at night" read.
  const cols = Math.max(1, Math.round(wdt / (5 * s)));
  const rows = Math.max(1, Math.round(hgt / (5 * s)));
  const cellW = wdt / cols;
  const cellH = hgt / rows;
  for (let cxi = 0; cxi < cols; cxi++) {
    for (let cyi = 0; cyi < rows; cyi++) {
      if (rng() < 0.45) continue;
      const lit = rng() < 0.75 ? neon : "#ffe66d";
      draw
        .rect(cellW * 0.5, cellH * 0.45)
        .move(x + cxi * cellW + cellW * 0.25, topY + cyi * cellH + cellH * 0.3)
        .fill(lit)
        .opacity(0.35 + rng() * 0.5);
    }
  }
  // A neon strip along the roofline.
  draw.rect(wdt, Math.max(0.16, 0.9 * s)).move(x, topY).fill(neon).opacity(0.85);
}

/** A parked car seen from behind/side, with a neon underglow. */
function drawCar(draw, x, yBase, wdt, neon, rng, s = 1) {
  const sw = (w) => Math.max(0.08, w * s);
  const bodyH = wdt * 0.32;
  const topY = yBase - bodyH;
  draw.ellipse(wdt * 1.2, bodyH * 0.7).center(x + wdt / 2, yBase).fill(neon).opacity(0.28);
  draw.rect(wdt, bodyH).move(x, topY).radius(bodyH * 0.3).fill("#1b1436").stroke({ color: neon, width: sw(0.5), opacity: 0.8 });
  draw
    .polygon(
      `${x + wdt * 0.22},${topY} ${x + wdt * 0.72},${topY} ${x + wdt * 0.62},${topY - bodyH * 0.55} ${x + wdt * 0.32},${topY - bodyH * 0.55}`
    )
    .fill("#251a47")
    .stroke({ color: neon, width: sw(0.4), opacity: 0.7 });
  draw.rect(wdt * 0.26, bodyH * 0.3).move(x + wdt * 0.3, topY - bodyH * 0.45).fill(neon).opacity(0.5);
  draw.circle(bodyH * 0.55).center(x + wdt * 0.24, yBase).fill("#0d0a1c");
  draw.circle(bodyH * 0.55).center(x + wdt * 0.78, yBase).fill("#0d0a1c");
  draw.circle(bodyH * 0.3).center(x + wdt * (rng() < 0.5 ? 0.08 : 0.92), topY + bodyH * 0.4).fill("#ff5c7a").opacity(0.9);
}

/** A tapered skyscraper: lit floor bands, vertical neon ribs, spire + beacon. */
function drawTower(draw, x, yBase, wdt, hgt, baseColor, rng, neon, s = 1) {
  const sw = (w) => Math.max(0.08, w * s);
  const topY = yBase - hgt;
  const fill = shade(baseColor, Math.round(rng() * 14 - 18));
  const inset = wdt * 0.17;
  draw
    .polygon(`${x},${yBase} ${x + wdt},${yBase} ${x + wdt - inset},${topY} ${x + inset},${topY}`)
    .fill(fill)
    .stroke({ color: neon, width: sw(0.5), opacity: 0.6 });

  const ribs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < ribs; i++) {
    const f = ribs === 1 ? 0.5 : i / (ribs - 1);
    const rx = x + wdt * (0.22 + 0.56 * f);
    draw
      .line(rx, topY + hgt * 0.05, rx, yBase - hgt * 0.03)
      .stroke({ color: neon, width: sw(0.5), opacity: 0.35 + rng() * 0.4 });
  }

  const bands = Math.max(2, Math.round(hgt / (7 * s)));
  for (let i = 0; i < bands; i++) {
    if (rng() < 0.4) continue;
    const bandH = hgt / bands;
    draw
      .rect(wdt * 0.6, Math.max(0.18, bandH * 0.22))
      .move(x + wdt * 0.2, topY + bandH * i + bandH * 0.32)
      .fill(rng() < 0.7 ? neon : "#ffe66d")
      .opacity(0.25 + rng() * 0.5);
  }

  const spireH = hgt * 0.15;
  draw.line(x + wdt / 2, topY, x + wdt / 2, topY - spireH).stroke({ color: neon, width: sw(0.5), opacity: 0.8 });
  draw.circle(Math.max(0.28, 1.3 * s)).center(x + wdt / 2, topY - spireH).fill("#ff5c7a").opacity(0.95);
}

/** An open paved plaza set back off the street, with a lit monument. */
function drawPlaza(draw, nearX, yNear, farX, yFar, side, extent, neon, rng, s = 1) {
  const dir = side === "left" ? -1 : 1;
  const pts = [
    [nearX, yNear],
    [nearX + dir * extent, yNear],
    [farX + dir * extent * 0.72, yFar],
    [farX, yFar],
  ];
  draw
    .polygon(pts.map((p) => p.join(",")).join(" "))
    .fill("#140e2e")
    .opacity(0.92)
    .stroke({ color: neon, width: Math.max(0.09, 0.5 * s), opacity: 0.75 });
  for (let i = 1; i < 4; i++) {
    const f = i / 4;
    draw
      .line(lerp(pts[0][0], pts[1][0], f), yNear, lerp(pts[3][0], pts[2][0], f), yFar)
      .stroke({ color: neon, width: Math.max(0.05, 0.22 * s), opacity: 0.28 });
  }
  const mx = lerp(pts[0][0], pts[1][0], 0.5);
  const my = lerp(yNear, yFar, 0.4);
  const mh = 13 * s;
  draw
    .polygon(`${mx - 1.7 * s},${my} ${mx + 1.7 * s},${my} ${mx + 0.7 * s},${my - mh} ${mx - 0.7 * s},${my - mh}`)
    .fill("#241a4a")
    .stroke({ color: neon, width: Math.max(0.07, 0.4 * s), opacity: 0.9 });
  draw.circle(Math.max(0.5, 2.6 * s)).center(mx, my - mh - 1 * s).fill(neon).opacity(0.22);
  draw.circle(Math.max(0.25, 1.2 * s)).center(mx, my - mh - 1 * s).fill(neon).opacity(0.95);
}

/** Festoon lights slung across the street, sagging under their own weight. */
function drawStringLights(draw, x1, y1, x2, y2, neon, rng, s = 1) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + Math.max(2, 13 * s);
  draw
    .path(`M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`)
    .fill("none")
    .stroke({ color: "#7a68b8", width: Math.max(0.07, 0.38 * s), opacity: 0.7 });
  const bulbs = Math.max(5, Math.round(15 * Math.min(1, s * 2.2)));
  for (let i = 1; i < bulbs; i++) {
    const t = i / bulbs;
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    const r = Math.max(0.2, 1 * s);
    const c = i % 3 === 0 ? "#ffe66d" : i % 3 === 1 ? neon : "#ff4d8d";
    draw.circle(r * 2.8).center(bx, by).fill(c).opacity(0.16);
    draw.circle(r).center(bx, by).fill(c).opacity(0.92);
  }
}

/** A small street robot loitering on the sidewalk. */
function drawStreetRobot(draw, x, yBase, hgt, neon, s = 1) {
  const sw = (v) => Math.max(0.08, v * s);
  const w = hgt * 0.5;
  const bodyH = hgt * 0.45;
  const headH = hgt * 0.3;
  const bodyY = yBase - bodyH;
  draw.rect(w * 0.28, hgt * 0.22).move(x + w * 0.1, yBase - hgt * 0.22).fill("#14102a");
  draw.rect(w * 0.28, hgt * 0.22).move(x + w * 0.62, yBase - hgt * 0.22).fill("#14102a");
  draw.rect(w, bodyH).move(x, bodyY).radius(w * 0.15).fill("#2a2150").stroke({ color: neon, width: sw(0.4), opacity: 0.8 });
  draw.circle(w * 0.3).center(x + w / 2, bodyY + bodyH * 0.45).fill(neon).opacity(0.75);
  draw.rect(w * 0.8, headH).move(x + w * 0.1, bodyY - headH).radius(w * 0.12).fill("#332863").stroke({ color: neon, width: sw(0.4), opacity: 0.8 });
  draw.circle(headH * 0.3).center(x + w * 0.35, bodyY - headH * 0.5).fill(neon);
  draw.circle(headH * 0.3).center(x + w * 0.65, bodyY - headH * 0.5).fill(neon);
  draw.line(x + w / 2, bodyY - headH, x + w / 2, bodyY - headH - hgt * 0.12).stroke({ color: neon, width: sw(0.4) });
  draw.circle(hgt * 0.07).center(x + w / 2, bodyY - headH - hgt * 0.12).fill(neon);
}

// Retrowave night sky, banded from deep space down to a hot horizon glow.
const SKY_BANDS = ["#0a0720", "#161038", "#2d1155", "#5b1668", "#9c1f6b", "#d93a6a", "#ff7a4d"];
function skyColorAt(t) {
  const scaled = Math.max(0, Math.min(1, t)) * (SKY_BANDS.length - 1);
  const i = Math.min(SKY_BANDS.length - 2, Math.floor(scaled));
  return mixColor(SKY_BANDS[i], SKY_BANDS[i + 1], scaled - i);
}

/**
 * A ~160x100 first-person "looking down the street" scene, generated per city:
 * retrowave sky and banded sun, a neon perspective grid for the road, neon-lit
 * buildings receding to the vanishing point, parked cars and a street robot on
 * the sidewalks, and the city's motif hanging overhead as a neon sign. The neon
 * accent is the domain's color so each region still reads distinctly.
 */
export function cityBackgroundHTML(domainCode, motif, seed) {
  const neon = DOMAIN_NEON[domainCode] || DOMAIN_NEON.D1;
  const motifColor = MOTIF_GROUND[motif] || "#8a8a72";
  const buildingColor = mixColor("#241a4a", motifColor, 0.18);
  const rng = mulberry32(seed);
  const horizonY = 40;
  const nearL = 16, nearR = 144, farL = 74, farR = 86;
  const vanishX = (farL + farR) / 2;

  return inlineIcon(160, 100, (draw) => {
    draw.attr({ preserveAspectRatio: "xMidYMax slice" });

    // --- Sky: stacked bands standing in for a gradient ---
    const bandCount = 14;
    for (let i = 0; i < bandCount; i++) {
      const y = (horizonY / bandCount) * i;
      draw.rect(160, horizonY / bandCount + 0.5).move(0, y).fill(skyColorAt(i / (bandCount - 1)));
    }
    for (let i = 0; i < 40; i++) {
      const sy = rng() * (horizonY - 12);
      draw
        .circle(rng() < 0.2 ? 0.9 : 0.5)
        .center(rng() * 160, sy)
        .fill("#ffffff")
        .opacity(0.25 + rng() * 0.6);
    }

    // --- Retrowave sun, sliced by horizontal bands ---
    const sunR = 15;
    const sunCY = horizonY - 2;
    draw.circle(sunR * 2.9).center(vanishX, sunCY).fill(neon).opacity(0.13);
    draw.circle(sunR * 2).center(vanishX, sunCY).fill("#ffd166");
    draw.circle(sunR * 2).center(vanishX, sunCY).fill("#ff4d8d").opacity(0.45);
    for (let i = 0; i < 6; i++) {
      const by = sunCY - sunR * 0.1 + i * 2.4;
      draw.rect(sunR * 2.2, 0.5 + i * 0.28).move(vanishX - sunR * 1.1, by).fill(skyColorAt(by / horizonY));
    }

    // --- Ground plane + neon perspective grid ---
    draw.rect(160, 100 - horizonY).move(0, horizonY).fill("#120b28");
    for (let i = -7; i <= 7; i++) {
      const farX = vanishX + i * 1.6;
      const nearX = vanishX + i * 34;
      draw.line(farX, horizonY, nearX, 100).stroke({ color: neon, width: 0.35, opacity: 0.45 });
    }
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      const y = horizonY + (100 - horizonY) * t * t;
      draw.line(0, y, 160, y).stroke({ color: neon, width: 0.3, opacity: 0.35 });
    }

    // --- Road surface over the grid, edged in neon ---
    draw
      .polygon(`${nearL},100 ${nearR},100 ${farR},${horizonY} ${farL},${horizonY}`)
      .fill("#0d0920")
      .opacity(0.82);
    draw.line(nearL, 100, farL, horizonY).stroke({ color: neon, width: 0.7, opacity: 0.9 });
    draw.line(nearR, 100, farR, horizonY).stroke({ color: neon, width: 0.7, opacity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const y = lerp(98, horizonY + 2, t);
      const w = lerp(2.4, 0.4, t);
      draw.rect(w, w * 2).move(vanishX - w / 2, y).fill("#ffe66d").opacity(0.7);
    }

    // --- Street population, marching all the way to the horizon --------------
    // Depth `d` is a true perspective divisor: apparent scale is 1/d, so blocks
    // bunch up toward the vanishing point the way real perspective does rather
    // than stepping down linearly. Everything at a given depth -- buildings,
    // parked cars, robots -- shares that scale, and gets an atmospheric haze
    // fade so distance reads even where silhouettes overlap.
    const geom = [];
    for (let d = 1; d <= 18; d *= 1.24) {
      const s = 1 / d;
      const t = 1 - s;
      geom.push({
        s,
        yBase: horizonY + (100 - horizonY) * s,
        roadLeft: lerp(nearL, farL, t),
        roadRight: lerp(nearR, farR, t),
      });
    }

    for (let i = geom.length - 1; i >= 0; i--) {
      const { s, yBase, roadLeft, roadRight } = geom[i];
      const back = geom[Math.min(geom.length - 1, i + 1)];

      // Back row: the skyline standing behind the street wall. Towers only show
      // up past the near field, so they read as distant landmarks instead of
      // swallowing the frame.
      const backLayer = draw.group().opacity(0.22 + 0.5 * s);
      for (const side of ["left", "right"]) {
        const count = s < 0.62 ? 2 : 1;
        for (let b = 0; b < count; b++) {
          if (rng() > 0.85) continue;
          const isTower = s < 0.62 && rng() < 0.5;
          const w = (isTower ? lerp(10, 17, rng()) : lerp(18, 30, rng())) * s;
          const hgt = (isTower ? lerp(52, 90, rng()) : lerp(30, 48, rng())) * s;
          const off = lerp(4, 13, rng()) * s + b * 14 * s;
          const x = side === "left" ? roadLeft - w - off : roadRight + off;
          const yb = yBase - 2 * s;
          if (isTower) drawTower(backLayer, x, yb, w, hgt, buildingColor, rng, neon, s);
          else drawBuilding(backLayer, x, yb, w, hgt, buildingColor, rng, side, vanishX, horizonY, neon, s);
        }
      }

      const layer = draw.group().opacity(0.34 + 0.66 * s);

      // Front row, one side at a time -- occasionally the block opens out into a
      // plaza instead of another storefront.
      for (const side of ["left", "right"]) {
        const edgeX = side === "left" ? roadLeft : roadRight;
        const backEdgeX = side === "left" ? back.roadLeft : back.roadRight;
        if (s > 0.12 && s < 0.7 && rng() < 0.26) {
          drawPlaza(layer, edgeX, yBase, backEdgeX, back.yBase, side, lerp(26, 42, rng()) * s, neon, rng, s);
          if (rng() < 0.7) {
            const rh = lerp(11, 16, rng()) * s;
            const dir = side === "left" ? -1 : 1;
            drawStreetRobot(layer, edgeX + dir * lerp(9, 20, rng()) * s, yBase - 2 * s, rh, neon, s);
          }
          continue;
        }
        // Past the near field the odd storefront gives way to a tower, so the
        // roofline steps up and down instead of receding as a flat wall.
        const isTower = s < 0.58 && rng() < 0.32;
        const w = (isTower ? lerp(13, 20, rng()) : lerp(20, 32, rng())) * s;
        const hgt = (isTower ? lerp(46, 74, rng()) : lerp(24, 40, rng())) * s;
        const x = side === "left" ? edgeX - w - rng() * 4 * s : edgeX + rng() * 4 * s;
        if (isTower) drawTower(layer, x, yBase, w, hgt, buildingColor, rng, neon, s);
        else drawBuilding(layer, x, yBase, w, hgt, buildingColor, rng, side, vanishX, horizonY, neon, s);
      }

      // Cars park against the curb; robots loiter just behind it on the walk.
      for (const side of ["left", "right"]) {
        if (rng() < 0.45) {
          const cw = lerp(14, 21, rng()) * s;
          const cx = side === "left" ? roadLeft + 1.5 * s : roadRight - cw - 1.5 * s;
          drawCar(layer, cx, yBase, cw, side === "left" ? neon : "#ff4d8d", rng, s);
        }
        const robots = rng() < 0.35 ? 2 : rng() < 0.8 ? 1 : 0;
        for (let r = 0; r < robots; r++) {
          const rh = lerp(12, 18, rng()) * s;
          // Straddle the curb: a small signed offset either nudges the robot a
          // step into the road or a step back onto the walk, but never far
          // enough to disappear behind the storefront it is standing in front of.
          const nudge = lerp(-4, 5, rng()) * s;
          const rx = side === "left" ? roadLeft - rh * 0.7 + nudge : roadRight - rh * 0.3 - nudge;
          drawStreetRobot(layer, rx, yBase - 0.5 * s - r * 1.5 * s, rh, neon, s);
        }
      }

      // Festoon lights strung across the street every other block.
      if (i % 2 === 0 && s > 0.08 && s < 0.9) {
        const lift = lerp(20, 30, rng()) * s;
        drawStringLights(layer, roadLeft, yBase - lift, roadRight, yBase - lift, neon, rng, s);
      }
    }

    // --- The city's motif as a neon sign hung off the left-hand block, clear of the sun ---
    const signX = 34;
    draw.line(signX, 4, signX, 12).stroke({ color: neon, width: 0.5, opacity: 0.8 });
    draw.circle(26).center(signX, 22).fill(motifColor).opacity(0.18);
    drawMotif(draw, motif, signX, 22, motifColor);
  }, "city-background");
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
