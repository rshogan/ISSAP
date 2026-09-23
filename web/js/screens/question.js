import { h } from "../dom.js";
import {
  wizardSpriteHTML,
  wizardForCityIndex,
  WIZARDS,
  cityBackgroundHTML,
  bossLoomingHTML,
  guideChevronsHTML,
  BOSS_BASE_HEIGHT,
  SCENE_VIEWBOX,
  hashSeed,
} from "../pixelArt.js";

const LETTERS = ["A", "B", "C", "D"];

// Same city is revisited every question -- cache so navigating between
// questions in one level doesn't redraw the same overlay art each time.
const backgroundCache = new Map();
const wizardCache = new Map();
const bossCache = new Map();
const chevronCache = new Map();

function cachedBackground(domainCode, motif, seed) {
  const key = `${domainCode}:${motif}:${seed}`;
  if (!backgroundCache.has(key)) backgroundCache.set(key, cityBackgroundHTML(domainCode, motif, seed));
  return backgroundCache.get(key);
}

function cachedWizard(wizardKey) {
  if (!wizardCache.has(wizardKey)) wizardCache.set(wizardKey, wizardSpriteHTML(wizardKey));
  return wizardCache.get(wizardKey);
}

function cachedBoss(domainCode) {
  if (!bossCache.has(domainCode)) bossCache.set(domainCode, bossLoomingHTML(domainCode));
  return bossCache.get(domainCode);
}

function cachedChevrons(domainCode) {
  if (!chevronCache.has(domainCode)) chevronCache.set(domainCode, guideChevronsHTML(domainCode));
  return chevronCache.get(domainCode);
}

// The boss looms larger with every correct answer: each one is a block closer,
// so the colossus at the vanishing point goes from a speck on the skyline to a
// silhouette filling the sky above the horizon. A boss level starts part-way up
// that ramp -- you are already standing in front of the thing.
// The colossus fight starts with the thing already towering over you -- there
// is no more ground to cover, this is the last block.
const BOSS_SCALE = { city: [1.5, 6.2], boss: [2.6, 7], colossus: [4.2, 8.4] };
function bossPresence(level) {
  const total = level.questions.length || 1;
  const progress = Math.min(1, (level.correctCount || 0) / total);
  const [min, max] = BOSS_SCALE[level.kind] || BOSS_SCALE.city;
  return { scale: min + progress * (max - min), opacity: 0.45 + progress * 0.55 };
}

// The scene svg is drawn with preserveAspectRatio="xMidYMax slice", so a short,
// wide panel crops the sky off the top -- taking the horizon, and the boss
// standing on it, with it. Work out how much sky is actually on screen so the
// boss can be capped to fit it instead of being decapitated by the panel edge.
function sceneGeometry(graphicsPanel) {
  const w = graphicsPanel.clientWidth;
  const h = graphicsPanel.clientHeight;
  if (!w || !h) return null;
  const { width, height, horizon } = SCENE_VIEWBOX;
  const scale = Math.max(w / width, h / height);
  const visibleTop = height - h / scale; // bottom-anchored, so the crop is at the top
  const skyUnits = Math.max(0, horizon - visibleTop);
  return { skyUnits, horizonFraction: (skyUnits * scale) / h };
}

// Applied as custom properties so CSS owns the easing. `animate: false` parks
// the new value without a transition -- used on mount and on resize, where the
// boss should already be at its size rather than striding into it.
function applyBossPresence(graphicsPanel, level, { animate = true } = {}) {
  const { scale, opacity } = bossPresence(level);
  const geom = sceneGeometry(graphicsPanel);
  let fitted = scale;
  let shown = opacity;
  if (geom) {
    graphicsPanel.style.setProperty("--horizon-top", `${(geom.horizonFraction * 100).toFixed(2)}%`);
    fitted = Math.min(scale, (geom.skyUnits * 0.9) / BOSS_BASE_HEIGHT);
    // Less than a full-size figure's worth of sky: there is nowhere for it to
    // stand, so keep it off rather than show a blob clipped by the panel edge.
    if (fitted < 0.9) shown = 0;
  }
  if (!animate) graphicsPanel.classList.add("boss-instant");
  graphicsPanel.style.setProperty("--boss-scale", Math.max(0.9, fitted).toFixed(3));
  graphicsPanel.style.setProperty("--boss-opacity", shown.toFixed(3));
  if (!animate) requestAnimationFrame(() => graphicsPanel.classList.remove("boss-instant"));
}

// Same story as the answer grid: the panel has no size until the screen is in
// the document, and the quiz frame is sized in vh, so re-fit on resize too.
function watchBossPresence(graphicsPanel, level) {
  requestAnimationFrame(() => applyBossPresence(graphicsPanel, level, { animate: false }));
  if (typeof ResizeObserver !== "function") return;
  const observer = new ResizeObserver(() => {
    if (!graphicsPanel.isConnected) {
      observer.disconnect();
      return;
    }
    applyBossPresence(graphicsPanel, level, { animate: false });
  });
  observer.observe(graphicsPanel);
}

export function renderQuestion(ctx) {
  const { state, goto } = ctx;
  const level = state.currentLevel;
  const q = level.questions[level.index];

  const isCity = level.kind === "city";
  const wizardKey = isCity ? wizardForCityIndex((level.levelIndex || 1) - 1) : null;
  const wizardInfo = wizardKey ? WIZARDS[wizardKey] : null;
  const motif = level.motif || "tower";
  const seed = hashSeed(level.id);
  const caption = wizardInfo ? `${wizardInfo.name} — ${wizardInfo.principle}` : level.name;

  const container = h(`
    <div class="screen question-screen">
      <div class="quiz-topbar">
        <button class="btn btn-danger exit-btn"></button>
        <span class="level-title"></span>
      </div>
      <div class="quiz-frame">
        <div class="quiz-graphics-panel">
          ${cachedBackground(state.currentDomain, motif, seed)}
          ${cachedBoss(state.currentDomain)}
          ${wizardInfo ? cachedWizard(wizardKey) : ""}
          ${wizardInfo ? cachedChevrons(state.currentDomain) : ""}
          <p class="quiz-caption"></p>
        </div>
        <div class="quiz-question-panel">
          <span class="progress-indicator"></span>
          <span class="difficulty-badge"></span>
          <p class="question-stem"></p>
        </div>
        <div class="quiz-command-panel" id="command-panel"></div>
      </div>
    </div>
  `);

  const exitBtn = container.querySelector(".exit-btn");
  exitBtn.textContent = level.kind === "city" ? "← Leave City" : "← Withdraw";
  exitBtn.addEventListener("click", () => {
    const label =
      level.kind === "colossus"
        ? "withdraw from the colossus"
        : level.kind === "boss"
          ? "withdraw from this remediation"
          : "leave this city";
    if (confirm(`Are you sure you want to ${label}? Your progress on this run will not be saved.`)) {
      goto("levelselect", { currentDomain: state.currentDomain });
    }
  });

  container.querySelector(".level-title").textContent = level.name;
  container.querySelector(".quiz-caption").textContent = caption;
  container.querySelector(".progress-indicator").textContent = `Question ${level.index + 1} / ${level.questions.length}`;
  const badge = container.querySelector(".difficulty-badge");
  badge.textContent = q.difficulty;
  badge.classList.add(`difficulty-${q.difficulty.toLowerCase()}`);
  container.querySelector(".question-stem").textContent = q.stem;

  const graphicsPanel = container.querySelector(".quiz-graphics-panel");
  watchBossPresence(graphicsPanel, level);
  const commandPanel = container.querySelector("#command-panel");
  renderOptions(commandPanel, ctx, level, q, graphicsPanel);

  return container;
}

// A correct answer moves the player a block further down the street: the scene
// dollies toward the vanishing point and settles, the wizard sweeps past the
// camera, and a flash blooms out of the horizon. Purely a CSS animation -- the
// scene art itself is untouched, so it costs nothing to replay.
function playAdvance(graphicsPanel) {
  if (!graphicsPanel) return;
  graphicsPanel.classList.remove("advancing");
  // Force a reflow so re-adding the class restarts the animation rather than
  // being coalesced into a no-op.
  void graphicsPanel.offsetWidth;
  graphicsPanel.classList.add("advancing");
  graphicsPanel.addEventListener(
    "animationend",
    () => graphicsPanel.classList.remove("advancing"),
    { once: true }
  );
}

// Answer text is never allowed below 12pt. The frame flexes to fill the window,
// so there is far more room than the old fixed 72vh box had; the fitter spends
// it by stepping a shared font-size down from 14pt only as far as it must to
// keep the whole quiz on one screen, and stops dead at 12pt. Past that the
// command row grows and the page scrolls. Sizes are in pt, not rem, because the
// floor is an absolute typographic one that has to hold whatever the reader's
// root font size is.
const MIN_OPTION_FONT_PT = 12;
const MAX_OPTION_FONT_PT = 14;
const OPTION_FONT_STEP_PT = 0.5;

// How much taller the answer grid wants to be than the command row it was given.
// The grid's rows have a min-content floor, so the overflow lands on the panel
// as a whole rather than clipping inside any one button.
function panelShortfall(commandPanel) {
  return Math.max(0, commandPanel.scrollHeight - commandPanel.clientHeight);
}

function fitOptionsToPanel(frame, commandPanel, optionsList) {
  // Sizes are all zero until the screen is actually in the document; bail out
  // rather than "fitting" against a detached tree and leaving the text oversized.
  if (!optionsList.isConnected || !optionsList.clientWidth) return;
  // Drop any growth a previous pass added, so this one measures against a frame
  // that simply fills the window -- a window that got bigger hands it back.
  frame.style.minHeight = "";

  let fontSize = MAX_OPTION_FONT_PT;
  optionsList.style.setProperty("--option-font-size", `${fontSize}pt`);
  while (fontSize > MIN_OPTION_FONT_PT && panelShortfall(commandPanel) > 0.5) {
    fontSize = Math.max(MIN_OPTION_FONT_PT, fontSize - OPTION_FONT_STEP_PT);
    optionsList.style.setProperty("--option-font-size", `${fontSize}pt`);
  }

  // Out of font size to give back and the answers still do not fit on one
  // screen: grow the frame by what is missing and let the page scroll. Grid
  // track sizing shares that extra height out between the scene and the command
  // row, so a single pass can come up short -- re-measure and top it up.
  for (let pass = 0; pass < 4; pass += 1) {
    const shortfall = panelShortfall(commandPanel);
    if (shortfall <= 0.5) break;
    frame.style.minHeight = `${Math.ceil(frame.offsetHeight + shortfall)}px`;
  }
}

// The screen is built detached and appended by app.js, so the first measurement
// has to wait a frame. After that only a window resize can change the answer to
// "does this still fit on one screen" -- and watching the window rather than an
// element keeps the fit from reacting to the layout it just produced, which a
// ResizeObserver on any panel in the frame would do.
function watchOptionFit(frame, commandPanel, optionsList) {
  const refit = () => fitOptionsToPanel(frame, commandPanel, optionsList);
  requestAnimationFrame(refit);
  const onResize = () => {
    if (!optionsList.isConnected) {
      window.removeEventListener("resize", onResize);
      return;
    }
    refit();
  };
  window.addEventListener("resize", onResize);
}

function renderOptions(commandPanel, ctx, level, q, graphicsPanel) {
  const { goto } = ctx;
  commandPanel.innerHTML = "";
  const optionsList = h(`<div class="options-list"></div>`);
  const optionButtons = {};

  for (const letter of LETTERS) {
    const optBtn = h(`
      <button class="option-btn">
        <span class="option-letter">${letter}</span>
        <span class="option-text"></span>
      </button>
    `);
    optBtn.querySelector(".option-text").textContent = q.options[letter];
    optionButtons[letter] = optBtn;
    optBtn.addEventListener("click", () => {
      const isCorrect = letter === q.correct;
      for (const btn of Object.values(optionButtons)) btn.classList.add("disabled");
      optBtn.classList.add(isCorrect ? "selected-correct" : "selected-incorrect");
      optionButtons[q.correct].classList.add("reveal-correct");

      if (isCorrect) {
        level.correctCount += 1;
        level.pointsEarned += q.points;
        playAdvance(graphicsPanel);
        applyBossPresence(graphicsPanel, level);
        // The wizard only waves the player on once the block is actually won;
        // the chevrons stay up until "Next Question" re-renders the screen.
        graphicsPanel.classList.add("guiding");
      }
      level.answers.push({ questionId: q.id, letter, correct: isCorrect });

      setTimeout(() => renderExplanation(commandPanel, ctx, level, q, isCorrect), 350);
    });
    optionsList.appendChild(optBtn);
  }
  commandPanel.appendChild(optionsList);
  watchOptionFit(commandPanel.closest(".quiz-frame"), commandPanel, optionsList);
}

function renderExplanation(commandPanel, ctx, level, q, isCorrect) {
  const { goto } = ctx;
  commandPanel.innerHTML = "";
  const row = h(`
    <div class="explanation-row">
      <p class="explanation-box"></p>
      <button class="btn btn-primary next-btn"></button>
    </div>
  `);
  row.querySelector(".explanation-box").textContent = (isCorrect ? "Correct! " : "Not quite. ") + q.explanation;
  const nextBtn = row.querySelector(".next-btn");
  nextBtn.textContent = level.index + 1 < level.questions.length ? "Next Question" : "See Results";
  nextBtn.addEventListener("click", () => {
    if (level.index + 1 < level.questions.length) {
      level.index += 1;
      goto("question", { currentLevel: level });
    } else {
      goto("results", { currentLevel: level });
    }
  });
  commandPanel.appendChild(row);
}
