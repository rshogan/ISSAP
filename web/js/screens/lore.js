import { h } from "../dom.js";
import { wizardSpriteHTML, WIZARDS, WIZARD_ORDER } from "../pixelArt.js";
import { robotIconHTML } from "../mapIcons.js";

// School of magic per wizard, for the card badge. The principle -> school
// mapping itself lives in pixelArt.js's WIZARDS table (name/principle) and in
// CLAUDE.md; only the school label is needed here.
const SCHOOLS = {
  abjurist: "Abjuration",
  illusionist: "Illusion",
  diviner: "Divination",
  evoker: "Evocation",
  conjurer: "Conjuration",
  enchanter: "Enchantment",
  transmuter: "Transmutation",
  necromancer: "Necromancy",
};

export function renderLore(ctx) {
  const { goto } = ctx;

  const container = h(`
    <div class="screen lore-screen">
      <div class="topbar">
        <button class="btn btn-secondary back-btn">← Back to Title</button>
        <h1>Lore</h1>
        <span class="topbar-spacer"></span>
      </div>
      <div class="lore-body"><p class="empty-state">Opening the chronicle…</p></div>
    </div>
  `);

  container.querySelector(".back-btn").addEventListener("click", () => goto("title"));

  // The lore is JSON like everything else, so it arrives after the screen does.
  const body = container.querySelector(".lore-body");
  ctx.data
    .loadLore()
    .then((lore) => {
      body.innerHTML = "";
      body.appendChild(buildLore(lore));
    })
    .catch(() => {
      body.innerHTML = "";
      body.appendChild(h(`<p class="empty-state">The chronicle could not be opened.</p>`));
    });

  return container;
}

function buildLore(lore) {
  const frag = document.createDocumentFragment();

  const intro = h(`
    <section class="lore-intro">
      <h2 class="lore-title"></h2>
      <p class="lore-subtitle"></p>
      <div class="lore-prose"></div>
    </section>
  `);
  intro.querySelector(".lore-title").textContent = lore.title;
  intro.querySelector(".lore-subtitle").textContent = lore.subtitle;
  const prose = intro.querySelector(".lore-prose");
  for (const para of lore.world) {
    const p = document.createElement("p");
    p.textContent = para;
    prose.appendChild(p);
  }
  frag.appendChild(intro);

  frag.appendChild(journeySection(lore.journey));
  frag.appendChild(adversarySection(lore));
  frag.appendChild(wizardSection(lore));

  const closing = h(`<p class="lore-closing"></p>`);
  closing.textContent = lore.closing;
  frag.appendChild(closing);

  return frag;
}

function journeySection(journey) {
  const section = h(`
    <section class="lore-section">
      <h3 class="lore-heading">The Journey</h3>
      <ol class="journey-list"></ol>
    </section>
  `);
  const list = section.querySelector(".journey-list");
  for (const beat of journey) {
    const item = h(`
      <li class="journey-step">
        <span class="journey-step-name"></span>
        <p class="journey-step-text"></p>
      </li>
    `);
    item.querySelector(".journey-step-name").textContent = beat.step;
    item.querySelector(".journey-step-text").textContent = beat.text;
    list.appendChild(item);
  }
  return section;
}

function adversarySection(lore) {
  const section = h(`
    <section class="lore-section">
      <h3 class="lore-heading">The Colossi</h3>
      <p class="lore-lead"></p>
      <div class="adversary-grid"></div>
    </section>
  `);
  section.querySelector(".lore-lead").textContent = lore.adversariesIntro;
  const grid = section.querySelector(".adversary-grid");
  for (const foe of lore.adversaries) {
    const card = h(`
      <article class="adversary-card">
        <div class="adversary-art">${robotIconHTML("active")}</div>
        <div class="adversary-copy">
          <h4 class="adversary-name"></h4>
          <span class="adversary-epithet"></span>
          <span class="adversary-nation"></span>
          <p class="adversary-text"></p>
        </div>
      </article>
    `);
    card.querySelector(".adversary-name").textContent = foe.name;
    card.querySelector(".adversary-epithet").textContent = foe.epithet;
    card.querySelector(".adversary-nation").textContent = `${foe.domain} · ${foe.nation}`;
    card.querySelector(".adversary-text").textContent = foe.text;
    grid.appendChild(card);
  }
  return section;
}

function wizardSection(lore) {
  const section = h(`
    <section class="lore-section">
      <h3 class="lore-heading">The Eight Wizards</h3>
      <p class="lore-lead"></p>
      <div class="wizard-grid"></div>
    </section>
  `);
  section.querySelector(".lore-lead").textContent = lore.wizardsIntro;
  const grid = section.querySelector(".wizard-grid");

  // WIZARD_ORDER is the same order the cities cycle through, so the page reads
  // in the order a player actually meets them.
  for (const key of WIZARD_ORDER) {
    const wiz = WIZARDS[key];
    const entry = lore.wizards[key];
    if (!wiz || !entry) continue;
    const card = h(`
      <article class="wizard-card">
        <div class="wizard-art">${wizardSpriteHTML(key)}</div>
        <div class="wizard-copy">
          <h4 class="wizard-name"></h4>
          <span class="wizard-title"></span>
          <div class="wizard-tags">
            <span class="wizard-tag wizard-school"></span>
            <span class="wizard-tag wizard-principle"></span>
          </div>
          <p class="wizard-bio"></p>
          <p class="wizard-counsel"></p>
        </div>
      </article>
    `);
    // The card takes the wizard's own robe/symbol colors so the eight read as
    // eight distinct characters rather than eight identical panels.
    card.style.setProperty("--wiz-accent", wiz.symbol);
    card.style.setProperty("--wiz-robe", wiz.robe);
    card.querySelector(".wizard-name").textContent = wiz.name;
    card.querySelector(".wizard-title").textContent = entry.title;
    card.querySelector(".wizard-school").textContent = SCHOOLS[key] || "";
    card.querySelector(".wizard-principle").textContent = wiz.principle;
    card.querySelector(".wizard-bio").textContent = entry.bio;
    card.querySelector(".wizard-counsel").textContent = entry.counsel;
    grid.appendChild(card);
  }
  return section;
}
