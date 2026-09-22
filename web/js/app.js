import * as data from "./data.js";
import * as save from "./save.js";
import * as game from "./gamification.js";
import { renderTitle } from "./screens/title.js";
import { renderLore } from "./screens/lore.js";
import { renderWorldMap } from "./screens/worldmap.js";
import { renderLevelSelect } from "./screens/levelselect.js";
import { renderQuestion } from "./screens/question.js";
import { renderResults } from "./screens/results.js";

const root = document.getElementById("app");

const state = {
  screen: "loading",
  manifest: null,
  levelsByDomain: null,
  currentSlot: null,
  currentDomain: null,
  currentLevel: null,
};

function goto(screen, params = {}) {
  state.screen = screen;
  Object.assign(state, params);
  render();
}

const renderers = {
  title: renderTitle,
  lore: renderLore,
  worldmap: renderWorldMap,
  levelselect: renderLevelSelect,
  question: renderQuestion,
  results: renderResults,
};

function render() {
  root.innerHTML = "";
  const renderer = renderers[state.screen];
  if (!renderer) return;
  const ctx = { state, goto, data, save, game };
  root.appendChild(renderer(ctx));
}

async function init() {
  try {
    state.manifest = await data.loadManifest();
    state.levelsByDomain = await data.loadAllLevels(game.DOMAINS);
    goto("title");
  } catch (err) {
    root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "screen error-screen";
    const heading = document.createElement("h1");
    heading.textContent = "Failed to load game data";
    const detail = document.createElement("p");
    detail.textContent = err instanceof Error ? err.message : String(err);
    const hint = document.createElement("p");
    hint.textContent = "Make sure you launched this page via run.bat, not by double-clicking index.html.";
    box.append(heading, detail, hint);
    root.appendChild(box);
  }
}

init();
