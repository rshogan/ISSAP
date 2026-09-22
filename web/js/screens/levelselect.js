import { h } from "../dom.js";
import { REGION_LAYOUTS } from "../regionLayouts.js";
import { mountainIconHTML, treeIconHTML, reedIconHTML, waveIconHTML, robotIconHTML, cityIconHTML } from "../mapIcons.js";
import { motifIconHTML, domainAccentColor } from "../pixelArt.js";

// Dark landmass slabs; the domain's neon does the identifying work on the
// coastline, roads and grid rather than the fill color.
const TERRAIN_COLORS = {
  D1: { land: "#141a2e" },
  D2: { land: "#1b1430" },
  D3: { land: "#241a2a" },
  D4: { land: "#131f27" },
};

const EXTRA_FEATURE_STYLE = {
  swamp: { fill: "#1c2a1e", ink: "#5fd67a" },
  lake: { fill: "#13293a", ink: "#4dd8ff" },
};

// Roads must not read as part of the grid, so each domain's road takes a hot
// contrasting neon against its own grid color.
const ROAD_COLORS = { D1: "#ff2d95", D2: "#ffb703", D3: "#ff2d95", D4: "#ff2d95" };

let currentMap = null;

function toLatLng(pt) {
  return L.latLng(-pt[1], pt[0]);
}

async function startLevel(ctx, domainCode, kind, level) {
  const { goto } = ctx;
  const questionsById = await ctx.data.loadQuestions(domainCode);
  const questions = level.questionIds.map((id) => questionsById.get(id));
  goto("question", {
    currentDomain: domainCode,
    currentLevel: {
      kind,
      id: level.id,
      name: level.name,
      motif: kind === "city" ? level.motif : null,
      levelIndex: level.index,
      questions,
      index: 0,
      correctCount: 0,
      pointsEarned: 0,
      answers: [],
    },
  });
}

function addIconMarker(map, pt, html, size, anchor, interactive) {
  return L.marker(toLatLng(pt), {
    icon: L.divIcon({ html, className: "map-icon", iconSize: size, iconAnchor: anchor }),
    interactive: Boolean(interactive),
    keyboard: false,
  }).addTo(map);
}

function buildMap(ctx, mapEl, code) {
  if (currentMap) {
    try {
      currentMap.remove();
    } catch {
      /* already gone */
    }
    currentMap = null;
  }

  const { state } = ctx;
  const slot = state.currentSlot;
  const levels = state.levelsByDomain[code];
  const layout = REGION_LAYOUTS[code];
  const colors = TERRAIN_COLORS[code];

  const map = L.map(mapEl, {
    crs: L.CRS.Simple,
    zoomControl: false,
    attributionControl: false,
    minZoom: -2,
    maxZoom: 3,
  });
  currentMap = map;
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const b = layout.bounds;
  const margin = 90;
  const neon = domainAccentColor(code);
  const oceanBounds = L.latLngBounds(
    toLatLng([b.minX - margin, b.maxY + margin]),
    toLatLng([b.maxX + margin, b.minY - margin])
  );
  L.rectangle(oceanBounds.pad(2), { stroke: false, fillColor: "#0a0720", fillOpacity: 1 }).addTo(map);

  // Retrowave grid floor in place of open ocean -- every 4th line burns brighter
  // so the grid reads as major/minor rather than a flat mesh.
  // Drawn well past the pannable bounds so the grid still fills the viewport
  // at fit-zoom rather than ending in dead space.
  const gridStep = 34;
  const gridMargin = margin * 3;
  const gx0 = Math.floor((b.minX - gridMargin) / gridStep) * gridStep;
  const gy0 = Math.floor((b.minY - gridMargin) / gridStep) * gridStep;
  const gx1 = b.maxX + gridMargin;
  const gy1 = b.maxY + gridMargin;
  let gi = 0;
  for (let x = gx0; x <= gx1; x += gridStep, gi++) {
    const major = gi % 4 === 0;
    L.polyline([toLatLng([x, gy0]), toLatLng([x, gy1])], {
      color: neon,
      weight: major ? 1 : 0.55,
      opacity: major ? 0.34 : 0.17,
      interactive: false,
    }).addTo(map);
  }
  gi = 0;
  for (let y = gy0; y <= gy1; y += gridStep, gi++) {
    const major = gi % 4 === 0;
    L.polyline([toLatLng([gx0, y]), toLatLng([gx1, y])], {
      color: neon,
      weight: major ? 1 : 0.55,
      opacity: major ? 0.34 : 0.17,
      interactive: false,
    }).addTo(map);
  }

  // Landmass: dark slab with a glowing neon coastline.
  const landLatLngs = layout.landmassPoints.map(toLatLng);
  L.polygon(landLatLngs, { stroke: false, fillColor: colors.land, fillOpacity: 0.92 }).addTo(map);
  L.polygon(landLatLngs, { color: neon, weight: 6, opacity: 0.16, fill: false }).addTo(map);
  L.polygon(landLatLngs, { color: neon, weight: 1.6, opacity: 0.95, fill: false }).addTo(map);

  L.polyline(layout.riverPoints.map(toLatLng), {
    color: "#4dd8ff",
    weight: 5,
    opacity: 0.16,
  }).addTo(map);
  L.polyline(layout.riverPoints.map(toLatLng), {
    color: "#7defff",
    weight: 1.6,
    opacity: 0.9,
  }).addTo(map);

  // --- Neon roads wiring the cities together -------------------------------
  // A minimum spanning tree keeps the network looking deliberate (no crossings,
  // no long stray hops), then each boss stronghold spurs off its nearest city.
  const cityPts = levels.cities.map((_, i) => layout.cityPoints[i % layout.cityPoints.length]);
  const roadEdges = [];
  if (cityPts.length > 1) {
    const inTree = new Set([0]);
    while (inTree.size < cityPts.length) {
      let best = null;
      for (const a of inTree) {
        for (let bi = 0; bi < cityPts.length; bi++) {
          if (inTree.has(bi)) continue;
          const d = Math.hypot(cityPts[a][0] - cityPts[bi][0], cityPts[a][1] - cityPts[bi][1]);
          if (!best || d < best.d) best = { a, b: bi, d };
        }
      }
      inTree.add(best.b);
      roadEdges.push([cityPts[best.a], cityPts[best.b]]);
    }
  }
  levels.boss.phases.forEach((_, i) => {
    const bp = layout.bossPoints[i % layout.bossPoints.length];
    let nearest = null;
    for (const cp of cityPts) {
      const d = Math.hypot(cp[0] - bp[0], cp[1] - bp[1]);
      if (!nearest || d < nearest.d) nearest = { cp, d };
    }
    if (nearest) roadEdges.push([bp, nearest.cp]);
  });
  const roadColor = ROAD_COLORS[code] || "#ff2d95";
  for (const [p1, p2] of roadEdges) {
    const pair = [toLatLng(p1), toLatLng(p2)];
    L.polyline(pair, { color: roadColor, weight: 9, opacity: 0.18, interactive: false }).addTo(map);
    L.polyline(pair, { color: roadColor, weight: 3, opacity: 0.95, interactive: false }).addTo(map);
    L.polyline(pair, {
      color: "#ffffff",
      weight: 1,
      opacity: 0.85,
      dashArray: "3 7",
      interactive: false,
    }).addTo(map);
  }

  const mountainHtml = mountainIconHTML();
  for (const pt of layout.mountains) {
    addIconMarker(map, pt, mountainHtml, [34, 24], [17, 20], false);
  }

  // Themed biome feature: swamp / forest / lake, varies per domain.
  const extra = layout.extraFeature;
  if (extra.kind !== "forest" && extra.blobPoints) {
    const style = EXTRA_FEATURE_STYLE[extra.kind];
    L.polygon(extra.blobPoints.map(toLatLng), {
      color: style.ink,
      weight: 1.5,
      fillColor: style.fill,
      fillOpacity: 0.9,
    }).addTo(map);
  }
  const extraIconHtml = extra.kind === "forest" ? treeIconHTML() : extra.kind === "swamp" ? reedIconHTML() : waveIconHTML();
  const extraIconSize = extra.kind === "forest" ? [16, 20] : extra.kind === "swamp" ? [18, 22] : [26, 14];
  for (const pt of extra.iconSpots) {
    addIconMarker(map, pt, extraIconHtml, extraIconSize, [extraIconSize[0] / 2, extraIconSize[1] - 2], false);
  }

  // Comical cartography labels.
  for (const key of ["mountains", "river", "ocean", "extra"]) {
    const label = layout.labels[key];
    addIconMarker(map, label.at, `<span class="map-label">${label.text}</span>`, null, null, false);
  }

  levels.cities.forEach((city, i) => {
    const pt = layout.cityPoints[i % layout.cityPoints.length];
    const cleared = Boolean(slot.domains[code].cities[city.id]?.cleared);
    const best = slot.domains[code].cities[city.id]?.bestScore ?? 0;
    const marker = L.marker(toLatLng(pt), {
      icon: L.divIcon({
        html: `<div class="city-marker ${cleared ? "cleared" : ""}">
          ${cityIconHTML({ index: i, cleared, biome: layout.extraFeature.kind, accent: domainAccentColor(code) })}
          <span class="city-motif-badge">${motifIconHTML(city.motif)}</span>
          <span class="city-marker-number">${cleared ? "✓" : i + 1}</span>
        </div>`,
        className: "map-icon-interactive",
        iconSize: [38, 28],
        iconAnchor: [19, 14],
      }),
    }).addTo(map);
    marker.bindTooltip(
      `${city.name} — ${city.questionCount} questions${cleared ? ` · best ${best} pts` : ""}`,
      { direction: "top", offset: [0, -14] }
    );
    marker.on("click", () => startLevel(ctx, code, "city", city));
  });

  const bossUnlocked = ctx.game.isBossUnlocked(slot, code, levels);
  levels.boss.phases.forEach((phase, i) => {
    const pt = layout.bossPoints[i % layout.bossPoints.length];
    const cleared = Boolean(slot.domains[code].boss.phases[phase.id]?.cleared);
    const best = slot.domains[code].boss.phases[phase.id]?.bestScore ?? 0;
    const locked = !bossUnlocked;
    const robotState = locked ? "locked" : cleared ? "cleared" : "active";
    const marker = L.marker(toLatLng(pt), {
      icon: L.divIcon({
        html: `<div class="boss-marker ${cleared ? "cleared" : ""} ${locked ? "locked" : ""}">${robotIconHTML(robotState)}</div>`,
        className: "map-icon-interactive",
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      }),
    }).addTo(map);
    marker.bindTooltip(
      locked
        ? `${phase.name} — Locked · clear all cities to unlock`
        : cleared
          ? `${phase.name} — Defeated · best ${best} pts`
          : `${phase.name} — ${phase.questionCount} questions`,
      { direction: "top", offset: [0, -20] }
    );
    if (!locked) marker.on("click", () => startLevel(ctx, code, "boss", phase));
  });

  map.fitBounds(
    L.latLngBounds(toLatLng([b.minX, b.maxY]), toLatLng([b.maxX, b.minY])),
    { padding: [24, 24] }
  );
  const fittedZoom = map.getZoom();
  map.setMinZoom(fittedZoom - 1);
  map.setMaxZoom(fittedZoom + 3);
  map.setMaxBounds(oceanBounds.pad(0.15));
  setTimeout(() => map.invalidateSize(), 60);
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
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

export function renderLevelSelect(ctx) {
  const { state, goto } = ctx;
  const code = state.currentDomain;
  const manifestEntry = state.manifest.find((m) => m.domain === code);

  const container = h(`
    <div class="screen levelselect-screen">
      <div class="region-topbar">
        <button class="btn btn-secondary region-back-btn">&larr; Leave Region</button>
        <h1></h1>
        <span style="width:1px"></span>
      </div>
      <p class="region-legend">Click a city to test that ground; the stronghold guards the region's hardest questions. <span class="locked-note">Clear every city to unlock it.</span></p>
      <div class="region-map-frame">
        <div class="frame-corner corner-tl"></div>
        <div class="frame-corner corner-tr"></div>
        <div class="frame-corner corner-bl"></div>
        <div class="frame-corner corner-br"></div>
        <div id="region-map"></div>
      </div>
    </div>
  `);
  container.querySelector("h1").textContent = manifestEntry.name;
  container.querySelector(".region-back-btn").addEventListener("click", () => goto("worldmap"));

  const mapEl = container.querySelector("#region-map");
  setTimeout(() => buildMap(ctx, mapEl, code), 0);

  return container;
}
