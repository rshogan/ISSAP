// Map feature symbology (mountains, trees, reeds, waves, boss robots, and the
// World Map's colossus portraits) built
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


/* ---------------------------------------------------------------------------
 * Colossus portraits for the World Map country cards.
 *
 * One per domain, and each is a genuinely different head rather than the same
 * skull in four colors -- the card should read as "which threat actor holds
 * this nation" at a glance. Neon lines are drawn in `currentColor`, so the
 * portrait inherits the card's own domain accent from CSS (see map.css) and
 * cannot drift out of sync with it.
 * ------------------------------------------------------------------------ */
const COLOSSUS_PLATE = "#2b3057";
const COLOSSUS_PLATE_DARK = "#191d3a";
const COLOSSUS_VOID = "#0b0a22";

function colossusPortrait(build) {
  return svgIcon(64, 64, (draw) => {
    draw.addClass("colossus-icon");
    draw.circle(62).center(32, 32).fill(COLOSSUS_VOID);
    // Everything is clipped to the disc so shoulders can run off the bottom
    // edge and the bust reads as cropped rather than floating.
    const body = draw.group();
    build(body);
    body.clipWith(draw.circle(62).center(32, 32));
    draw.circle(62).center(32, 32).fill("none").stroke({ color: "currentColor", width: 2, opacity: 0.9 });
  });
}

const neon = (width = 1.4, opacity = 0.95) => ({ color: "currentColor", width, opacity });

/** GOVERNAX, The Unwritten Policy -- a filing-cabinet colossus that redacted its own face. */
function drawGovernax(g) {
  // Shoulders.
  g.polygon("8,64 14,50 50,50 56,64").fill(COLOSSUS_PLATE_DARK).stroke(neon(1.2, 0.7));
  // Flat-topped cabinet head with short corner posts, so the silhouette reads
  // as machinery rather than a bag with a handle.
  g.line(20, 15, 20, 9).stroke(neon(1.3, 0.85));
  g.line(44, 15, 44, 9).stroke(neon(1.3, 0.85));
  g.circle(3).center(20, 8).fill("currentColor").opacity(0.85);
  g.circle(3).center(44, 8).fill("currentColor").opacity(0.85);
  g.polygon("17,15 47,15 50,48 14,48").fill(COLOSSUS_PLATE).stroke(neon(1.6));
  // Drawer pull across the brow.
  g.rect(20, 3.4).move(22, 18).fill(COLOSSUS_PLATE_DARK).stroke(neon(1, 0.6));
  // A single redacted bar instead of a face, with two lights burning behind it.
  g.rect(28, 9).move(18, 26).fill("#07060f").stroke(neon(1.1, 0.8));
  g.circle(4.4).center(25, 30.5).addClass("colossus-eye");
  g.circle(4.4).center(39, 30.5).addClass("colossus-eye");
  // Ruled-paper lines across the jaw.
  g.line(18, 40, 46, 40).stroke(neon(1, 0.5));
  g.line(19, 44, 45, 44).stroke(neon(1, 0.5));
  // The approval seal it never actually signed, stamped across the chest.
  g.circle(11).center(32, 57).fill("none").stroke(neon(1.3, 0.8));
  g.line(27, 57, 37, 57).stroke(neon(1.1, 0.65));
}

/** MODELBREAKER, The Broken Blueprint -- a head whose halves do not line up. */
function drawModelbreaker(g) {
  g.polygon("6,64 13,52 51,52 58,64").fill(COLOSSUS_PLATE_DARK).stroke(neon(1.2, 0.7));
  // Left half sits where the diagram says; right half sits where it was built.
  g.polygon("15,20 31,15 31,50 13,45").fill(COLOSSUS_PLATE).stroke(neon(1.6));
  g.polygon("33,20 49,26 51,50 33,46").fill(COLOSSUS_PLATE).stroke(neon(1.6));
  // Wireframe construction lines showing through the plating.
  g.polyline("15,20 31,32 13,45").fill("none").stroke(neon(0.9, 0.5));
  g.polyline("49,26 33,34 51,50").fill("none").stroke(neon(0.9, 0.5));
  // Eyes at mismatched heights, one on each side of the seam.
  g.circle(5).center(22, 30).addClass("colossus-eye");
  g.circle(5).center(43, 35).addClass("colossus-eye");
  // The seam itself.
  g.line(32, 12, 32, 52).stroke({ color: "currentColor", width: 1.6, opacity: 0.9, dasharray: "3 2" });
}

/** GRIDFALL, The Shattered Perimeter -- a battlement with a hole walked through. */
function drawGridfall(g) {
  g.polygon("4,64 12,52 52,52 60,64").fill(COLOSSUS_PLATE_DARK).stroke(neon(1.2, 0.7));
  // Crenellated skull: the third merlon is missing, which is how it got in.
  g.polygon("12,24 12,18 19,18 19,24 26,24 26,18 33,18 33,24 45,24 45,18 52,18 52,24 52,50 12,50")
    .fill(COLOSSUS_PLATE)
    .stroke(neon(1.6));
  // Antenna array along the wall.
  g.line(16, 18, 16, 10).stroke(neon(1.1, 0.8));
  g.line(32, 18, 32, 7).stroke(neon(1.1, 0.8));
  g.line(48, 18, 48, 11).stroke(neon(1.1, 0.8));
  g.circle(3).center(32, 6).fill("currentColor").opacity(0.9);
  // Eye band with a jagged breach torn through the middle.
  g.rect(32, 8).move(16, 29).fill("#07060f").stroke(neon(1.1, 0.75));
  g.circle(4.6).center(23, 33).addClass("colossus-eye");
  g.circle(4.6).center(41, 33).addClass("colossus-eye");
  g.polyline("30,29 34,33 29,35 33,37").fill("none").stroke(neon(1.3, 0.9));
  g.line(16, 44, 48, 44).stroke(neon(1, 0.5));
}

/** NULLCRED, The Stolen Name -- a faceless mask wearing somebody else's key. */
function drawNullcred(g) {
  g.polygon("9,64 15,51 49,51 55,64").fill(COLOSSUS_PLATE_DARK).stroke(neon(1.2, 0.7));
  // A blank oval mask: no eyes at all, because it does not have a face of its own.
  g.ellipse(34, 44).center(32, 30).fill(COLOSSUS_PLATE).stroke(neon(1.6));
  g.ellipse(24, 34).center(32, 29).fill("#12142e").stroke(neon(0.9, 0.45));
  // Keyhole where the face should be -- the credential it walked in with.
  g.circle(9).center(32, 24).addClass("colossus-eye");
  g.polygon("29,27 35,27 37,40 27,40").addClass("colossus-eye");
  // Null ring: a slashed zero hanging over the mask.
  g.circle(15).center(32, 30).fill("none").stroke(neon(1.2, 0.35));
  g.line(23, 40, 41, 19).stroke(neon(1.2, 0.5));
  // Hollow ID badge clipped to the shoulder.
  g.rect(11, 8).move(39, 53).fill("#07060f").stroke(neon(1, 0.7));
  g.line(41, 57, 48, 57).stroke(neon(0.9, 0.5));
}

const COLOSSUS_DRAWERS = { D1: drawGovernax, D2: drawModelbreaker, D3: drawGridfall, D4: drawNullcred };

/** A 64x64 bust of the colossus holding `domainCode`, for the World Map cards. */
export function colossusIconHTML(domainCode) {
  const drawFn = COLOSSUS_DRAWERS[domainCode] || COLOSSUS_DRAWERS.D1;
  return colossusPortrait(drawFn);
}
