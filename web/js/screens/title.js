import { h } from "../dom.js";

export function renderTitle(ctx) {
  const { state, goto, save, game } = ctx;
  const slots = save.listSlots();

  const container = h(`
    <div class="screen title-screen">
      <button class="btn btn-secondary exit-btn">Exit</button>
      <h1 class="game-title">ISSAP Cyber Conquest</h1>
      <p class="tagline">Conquer all four domains of the ISSAP CBK.</p>
      <div class="new-game-box">
        <input type="text" id="new-game-name" placeholder="Name your save..." maxlength="40" />
        <button id="new-game-btn" class="btn btn-primary">New Game</button>
      </div>
      <div class="saves-list">
        <h2>Continue</h2>
        <div id="saves-container"></div>
      </div>
    </div>
  `);

  const savesContainer = container.querySelector("#saves-container");
  if (slots.length === 0) {
    savesContainer.appendChild(h(`<p class="empty-state">No saved games yet.</p>`));
  } else {
    for (const slot of slots) {
      const pct = game.overallProgress(slot, state.levelsByDomain);
      const row = h(`
        <div class="save-row">
          <div class="save-info">
            <span class="save-name"></span>
            <span class="save-meta"></span>
          </div>
          <div class="save-actions">
            <button class="btn btn-secondary continue-btn">Continue</button>
            <button class="btn btn-danger delete-btn">Delete</button>
          </div>
        </div>
      `);
      row.querySelector(".save-name").textContent = slot.name;
      row.querySelector(".save-meta").textContent =
        `${pct}% complete · ${slot.totalXP} XP · last played ${new Date(slot.lastPlayedAt).toLocaleString()}`;
      row.querySelector(".continue-btn").addEventListener("click", () => {
        goto("worldmap", { currentSlot: slot });
      });
      row.querySelector(".delete-btn").addEventListener("click", () => {
        if (confirm(`Delete save "${slot.name}"? This cannot be undone.`)) {
          save.deleteSlot(slot.id);
          goto("title");
        }
      });
      savesContainer.appendChild(row);
    }
  }

  container.querySelector("#new-game-btn").addEventListener("click", () => {
    const input = container.querySelector("#new-game-name");
    const name = input.value.trim() || `Run ${new Date().toLocaleDateString()}`;
    const slot = save.createSlot(name, game.DOMAINS);
    goto("worldmap", { currentSlot: slot });
  });

  container.querySelector(".exit-btn").addEventListener("click", () => {
    if (!confirm("Exit ISSAP Cyber Conquest?")) return;
    window.close();
    // Most browsers block window.close() on a tab the script didn't open itself;
    // if we're still here shortly after, show a graceful goodbye instead.
    setTimeout(() => {
      const app = document.getElementById("app");
      app.innerHTML = "";
      app.appendChild(
        h(`
          <div class="screen title-screen">
            <h1 class="game-title">Farewell, Explorer</h1>
            <p class="tagline">Thanks for playing ISSAP Cyber Conquest. You may now close this browser tab.</p>
          </div>
        `)
      );
    }, 150);
  });

  return container;
}
