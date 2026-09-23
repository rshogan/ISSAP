import { h } from "../dom.js";
import { colossusIconHTML } from "../mapIcons.js";

export function renderWorldMap(ctx) {
  const { state, goto, game } = ctx;
  const slot = state.currentSlot;

  const container = h(`
    <div class="screen worldmap-screen">
      <div class="map-frame">
        <div class="crt-grid"></div>
        <div class="frame-corner corner-tl"></div>
        <div class="frame-corner corner-tr"></div>
        <div class="frame-corner corner-bl"></div>
        <div class="frame-corner corner-br"></div>
        <div class="map-topbar">
          <button class="btn btn-parchment back-btn">&larr; Disconnect</button>
          <span class="xp-badge"></span>
        </div>
        <div class="cartouche">
          <h1></h1>
          <p class="cartouche-sub">Four Sectors Online // Select Target</p>
        </div>
        <div class="countries-grid" id="countries-grid"></div>
      </div>
    </div>
  `);
  container.querySelector(".cartouche h1").textContent = slot.name;
  container.querySelector(".xp-badge").textContent = `${slot.totalXP} XP`;
  container.querySelector(".back-btn").addEventListener("click", () => goto("title"));

  const grid = container.querySelector("#countries-grid");
  for (const code of game.DOMAINS) {
    const manifestEntry = state.manifest.find((m) => m.domain === code);
    const levels = state.levelsByDomain[code];
    const pct = game.domainProgress(slot, code, levels);
    const conquered = game.isDomainConquered(slot, code, levels);
    const card = h(`
      <button class="country-card domain-${code.toLowerCase()}">
        <span class="conquered-badge">Liberated</span>
        <div class="country-flag">${colossusIconHTML(code)}</div>
        <h2 class="country-name"></h2>
        <div class="progress-bar"><div class="progress-fill"></div></div>
        <span class="country-pct"></span>
      </button>
    `);
    card.querySelector(".country-name").textContent = manifestEntry.name;
    card.querySelector(".progress-fill").style.width = `${pct}%`;
    card.querySelector(".country-pct").textContent = `${pct}% remediated`;
    if (conquered) card.classList.add("liberated");
    else card.querySelector(".conquered-badge").remove();
    card.addEventListener("click", () => goto("levelselect", { currentDomain: code }));
    grid.appendChild(card);
  }

  // Label each portrait with the colossus it depicts. Async because the lore is
  // JSON like everything else; the cards are already usable without it.
  ctx.data
    .loadLore()
    .then((lore) => {
      for (const foe of lore.adversaries) {
        const flag = grid.querySelector(`.domain-${foe.domain.toLowerCase()} .country-flag`);
        if (flag) flag.title = `${foe.name} — ${foe.epithet}`;
      }
    })
    .catch(() => {});

  if (game.isGameConquered(slot, state.levelsByDomain)) {
    grid.after(h(`<div class="banner game-conquered-banner">All Sectors Liberated // System Restored</div>`));
  }

  return container;
}
