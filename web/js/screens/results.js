import { h } from "../dom.js";

export function renderResults(ctx) {
  const { state, goto, save, game } = ctx;
  const slot = state.currentSlot;
  const code = state.currentDomain;
  const level = state.currentLevel;
  const levels = state.levelsByDomain[code];

  game.recordLevelResult(slot, code, level.kind, level.id, level.pointsEarned);
  game.finalizeDomainConquered(slot, code, levels);
  save.saveSlot(slot);

  const domainConquered = slot.domains[code].conquered;
  const gameConquered = domainConquered && game.isGameConquered(slot, state.levelsByDomain);
  const manifestEntry = state.manifest.find((m) => m.domain === code);

  const container = h(`
    <div class="screen results-screen">
      <h1>${level.kind === "boss" ? "Boss Phase Remediated!" : "City Liberated!"}</h1>
      <p class="results-summary"></p>
      <p class="results-xp"></p>
      <div id="banners"></div>
      <div class="results-actions">
        <button class="btn btn-primary continue-btn">Back to Level Select</button>
      </div>
    </div>
  `);
  container.querySelector(".results-summary").textContent = `${level.correctCount} / ${level.questions.length} correct`;
  container.querySelector(".results-xp").textContent = `+${level.pointsEarned} XP earned (Total: ${slot.totalXP} XP)`;

  const banners = container.querySelector("#banners");
  if (domainConquered) {
    const b = h(`<div class="banner conquered-banner"></div>`);
    b.textContent = `🏰 ${manifestEntry.name} Liberated!`;
    banners.appendChild(b);
  }
  if (gameConquered) {
    const b = h(`<div class="banner game-conquered-banner"></div>`);
    b.textContent = "👑 All Domains Liberated! You are ISSAP-ready.";
    banners.appendChild(b);
  }

  container.querySelector(".continue-btn").addEventListener("click", () => goto("levelselect", { currentDomain: code }));

  return container;
}
