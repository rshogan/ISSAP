import { h } from "../dom.js";
import { wizardSpriteHTML, wizardForCityIndex, WIZARDS, cityBackgroundHTML, hashSeed } from "../pixelArt.js";

const LETTERS = ["A", "B", "C", "D"];

// Same city is revisited every question -- cache so navigating between
// questions in one level doesn't redraw the same overlay art each time.
const backgroundCache = new Map();
const wizardCache = new Map();

function cachedBackground(domainCode, motif, seed) {
  const key = `${domainCode}:${motif}:${seed}`;
  if (!backgroundCache.has(key)) backgroundCache.set(key, cityBackgroundHTML(domainCode, motif, seed));
  return backgroundCache.get(key);
}

function cachedWizard(wizardKey) {
  if (!wizardCache.has(wizardKey)) wizardCache.set(wizardKey, wizardSpriteHTML(wizardKey));
  return wizardCache.get(wizardKey);
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
          ${wizardInfo ? cachedWizard(wizardKey) : ""}
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
  exitBtn.textContent = level.kind === "boss" ? "← Retreat" : "← Leave City";
  exitBtn.addEventListener("click", () => {
    const label = level.kind === "boss" ? "retreat from this boss fight" : "leave this city";
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

// The bottom command panel has a fixed height (30% of the quiz frame) with no
// scrollbar, per CLAUDE.md -- so instead of truncating long answer text, shrink
// a shared font-size (via CSS custom property) until the longest option actually
// fits its grid cell.
const MIN_OPTION_FONT_REM = 0.6;
const MAX_OPTION_FONT_REM = 0.85;
function fitOptionsToPanel(optionsList, buttons) {
  let fontSize = MAX_OPTION_FONT_REM;
  optionsList.style.setProperty("--option-font-size", `${fontSize}rem`);
  while (fontSize > MIN_OPTION_FONT_REM && buttons.some((btn) => btn.scrollHeight > btn.clientHeight + 1)) {
    fontSize -= 0.03;
    optionsList.style.setProperty("--option-font-size", `${fontSize}rem`);
  }
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
      }
      level.answers.push({ questionId: q.id, letter, correct: isCorrect });

      setTimeout(() => renderExplanation(commandPanel, ctx, level, q, isCorrect), 350);
    });
    optionsList.appendChild(optBtn);
  }
  commandPanel.appendChild(optionsList);
  fitOptionsToPanel(optionsList, Object.values(optionButtons));
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
