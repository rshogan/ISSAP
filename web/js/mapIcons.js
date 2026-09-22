// Map feature symbology (mountains, trees, reeds, waves, boss robots) built
// programmatically with SVG.js rather than hand-written markup, per project
// guidance. Each function draws into a detached SVG.js canvas and returns the
// serialized markup, suitable for a Leaflet divIcon or direct innerHTML use.
function svgIcon(w, h, build) {
  const draw = SVG().size(w, h).viewbox(0, 0, w, h);
  build(draw);
  return draw.node.outerHTML;
}

// Terrain symbols are neon wireframe rather than inked cartography, to sit on
// the region map's retrowave grid.
export function mountainIconHTML() {
  return svgIcon(34, 24, (draw) => {
    draw.polygon("2,22 11,6 16,14 21,4 32,22").fill("#1b1636").opacity(0.9);
    draw.polygon("2,22 11,6 16,14 21,4 32,22").fill("none").stroke({ color: "#b06bff", width: 1.3 });
    draw.polyline("11,6 14,11 8,11 11,6").fill("none").stroke({ color: "#e6c2ff", width: 0.9 });
    draw.polyline("21,4 23.5,8.5 18.5,8.5 21,4").fill("none").stroke({ color: "#e6c2ff", width: 0.9 });
  });
}

export function treeIconHTML() {
  return svgIcon(16, 20, (draw) => {
    draw.rect(2, 5).move(7, 15).fill("#2a1f3d");
    draw.polygon("8,7 14,17 2,17").fill("#14281c").stroke({ color: "#5fd67a", width: 1 });
    draw.polygon("8,1 13,10 3,10").fill("#14281c").stroke({ color: "#8dffae", width: 1 });
  });
}

export function reedIconHTML() {
  return svgIcon(18, 22, (draw) => {
    draw.line(3, 20, 2, 4).stroke({ color: "#7de89a", width: 1.3, linecap: "round" });
    draw.line(9, 21, 10, 3).stroke({ color: "#7de89a", width: 1.3, linecap: "round" });
    draw.line(15, 20, 16, 6).stroke({ color: "#7de89a", width: 1.3, linecap: "round" });
    draw.ellipse(3, 7).move(0.5, 1).rotate(20).fill("#c4e04a");
    draw.ellipse(3, 7).move(8.5, 0).rotate(-15).fill("#c4e04a");
  });
}

export function waveIconHTML() {
  return svgIcon(26, 14, (draw) => {
    draw.path("M2,8 Q7,2 12,8 T22,8").fill("none").stroke({ color: "#4dd8ff", width: 1.6, linecap: "round" });
    draw
      .path("M4,12 Q9,7 14,12 T24,12")
      .fill("none")
      .stroke({ color: "#4dd8ff", width: 1.2, opacity: 0.65, linecap: "round" });
  });
}

// Window/glow lighting per biome -- a swamp town burns a murky green-gold, a
// forest town a warmer green, a lakeside town a cold cyan. Cities in the same
// biome share lighting; the domain's accent on the rooflines keeps regions apart.
const BIOME_LIGHT = {
  swamp: { lit: "#c4e04a", body: "#1d2417" },
  forest: { lit: "#5fd67a", body: "#15251a" },
  lake: { lit: "#6fd0f5", body: "#13202c" },
};

// Three silhouettes, cycled by city index so a region's skyline markers aren't
// all identical. Baseline is y=28 in a 40x30 box.
const SKYLINES = [
  [{ x: 3, w: 8, h: 13 }, { x: 12, w: 9, h: 20 }, { x: 22, w: 7, h: 16 }, { x: 30, w: 7, h: 11 }],
  [{ x: 2, w: 9, h: 18 }, { x: 12, w: 7, h: 12 }, { x: 20, w: 9, h: 22 }, { x: 30, w: 8, h: 15 }],
  [{ x: 3, w: 7, h: 11 }, { x: 11, w: 8, h: 17 }, { x: 20, w: 8, h: 13 }, { x: 29, w: 9, h: 20 }],
];

/**
 * A city marker drawn as a small 3-4 building skyline. Window lighting comes
 * from the region's biome; a cleared city is fully lit, an unexplored one is
 * mostly dark, so "lighting the city up" reads as progress at a glance.
 */
export function cityIconHTML({ index = 0, cleared = false, biome = "forest", accent = "#22d3ee" }) {
  const light = BIOME_LIGHT[biome] || BIOME_LIGHT.forest;
  const buildings = SKYLINES[index % SKYLINES.length];
  const baseline = 28;
  return svgIcon(40, 30, (draw) => {
    draw.addClass("city-skyline");
    for (let b = 0; b < buildings.length; b++) {
      const { x, w, h } = buildings[b];
      const topY = baseline - h;
      draw.rect(w, h).move(x, topY).fill(light.body).stroke({ color: "#1d2318", width: 0.5 });
      draw.rect(w, 1.4).move(x, topY).fill(accent).opacity(0.85);

      const cols = w >= 8 ? 2 : 1;
      const rows = Math.max(1, Math.floor((h - 4) / 4));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          // Stable per-(city, building, cell) pattern -- no RNG, so a marker
          // redraws identically every time the map is rebuilt.
          const litSeed = (index * 31 + b * 17 + c * 7 + r * 13) % 10;
          const isLit = cleared ? litSeed < 9 : litSeed < 3;
          if (!isLit) continue;
          const winX = cols === 1 ? x + w / 2 - 0.8 : x + 1.4 + c * (w - 2.8);
          draw
            .rect(1.6, 1.8)
            .move(winX, topY + 2.6 + r * 4)
            .fill(light.lit)
            .opacity(cleared ? 0.95 : 0.7);
        }
      }
    }
    // Ground shadow so the skyline sits on something.
    draw.rect(38, 1.6).move(1, baseline).fill("#1d2318").opacity(0.75);
    if (cleared) draw.rect(38, 2.4).move(1, baseline).fill(light.lit).opacity(0.3);
  });
}

/** A colossal-robot boss marker; `state` is "locked" | "active" | "cleared". */
export function robotIconHTML(state) {
  const eyeColor = state === "locked" ? "#6a7078" : state === "cleared" ? "#3ddc61" : "#ff3b30";
  const metal = state === "locked" ? "#5a5f66" : "#8a929c";
  const dark = "#20242a";
  return svgIcon(46, 46, (draw) => {
    draw.addClass("boss-robot");
    // legs
    draw.rect(8, 10).move(10, 34).fill(dark).stroke({ color: "#0f1114", width: 1 });
    draw.rect(8, 10).move(28, 34).fill(dark).stroke({ color: "#0f1114", width: 1 });
    // shoulder blocks
    draw.rect(7, 9).move(1, 17).fill(dark).stroke({ color: "#0f1114", width: 1 });
    draw.rect(7, 9).move(38, 17).fill(dark).stroke({ color: "#0f1114", width: 1 });
    // torso
    draw.rect(28, 20).move(9, 16).fill(metal).stroke({ color: dark, width: 1.2 });
    draw.rect(22, 4).move(12, 24).fill(dark).opacity(0.5);
    draw.circle(5).center(23, 27).fill(eyeColor).opacity(0.9);
    // head
    draw.rect(16, 12).move(15, 4).fill(metal).stroke({ color: dark, width: 1.2 });
    draw.circle(4).center(20, 10).fill(eyeColor);
    draw.circle(4).center(26, 10).fill(eyeColor);
    // antenna
    draw.line(23, 4, 23, 0).stroke({ color: dark, width: 1.2 });
    draw.circle(2.4).center(23, 0).fill(eyeColor);
    if (state === "locked") {
      draw.rect(11, 8).move(17.5, 30).radius(1.5).fill("#c9954a").stroke({ color: dark, width: 0.8 });
      draw
        .path("M 20 30 V 26 A 3 3 0 0 1 26 26 V 30")
        .fill("none")
        .stroke({ color: "#c9954a", width: 1.6 });
    }
  });
}

