import { h } from "../dom.js";

function resultsHeading(level) {
  if (level.kind === "colossus") {
    // level.name is "GOVERNAX — The Unwritten Policy"; the epithet is flavour
    // the banner does not need.
    return `${level.name.split("—")[0].trim()} Defeated!`;
  }
  return level.kind === "boss" ? "Fortress Remediated!" : "City Liberated!";
}

export function renderResults(ctx) {
  const { state, goto, save, game } = ctx;
  const slot = state.currentSlot;
  const code = state.currentDomain;
  const level = state.currentLevel;
  const levels = state.levelsByDomain[code];

  game.recordLevelResult(slot, code, level.kind, level.id, level.pointsEarned, level.answers);
  game.finalizeDomainConquered(slot, code, levels);
  save.saveSlot(slot);

  const domainConquered = slot.domains[code].conquered;
  const gameConquered = domainConquered && game.isGameConquered(slot, state.levelsByDomain);
  const manifestEntry = state.manifest.find((m) => m.domain === code);

  const container = h(`
    <div class="screen results-screen">
      <h1>${resultsHeading(level)}</h1>
      <p class="results-summary"></p>
      <p class="results-xp"></p>
      <p class="results-note"></p>
      <div id="banners"></div>
      <div class="results-actions">
        <button class="btn btn-primary continue-btn">Back to Level Select</button>
      </div>
    </div>
  `);
  container.querySelector(".results-summary").textContent = `${level.correctCount} / ${level.questions.length} correct`;
  container.querySelector(".results-xp").textContent = `+${level.pointsEarned} XP earned (Total: ${slot.totalXP} XP)`;

  // Be straight about the mix: a save with little miss history gets fewer than
  // half, and claiming otherwise would be a lie the player can count.
  const note = container.querySelector(".results-note");
  if (level.kind === "colossus" && typeof level.missedCount === "number") {
    note.textContent = level.missedCount
      ? `${level.missedCount} of ${level.questions.length} were questions you had answered incorrectly before.`
      : "No previous mistakes to hold against you — this one was drawn from the hardest questions in the domain.";
  } else {
    note.remove();
  }

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
