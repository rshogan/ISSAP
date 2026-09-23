export const DOMAINS = ["D1", "D2", "D3", "D4"];

export function domainState(save, domainCode) {
  return save.domains[domainCode];
}

export function isCityCleared(save, domainCode, cityId) {
  return Boolean(domainState(save, domainCode).cities[cityId]?.cleared);
}

export function isBossPhaseCleared(save, domainCode, phaseId) {
  return Boolean(domainState(save, domainCode).boss.phases[phaseId]?.cleared);
}

export function allCitiesCleared(save, domainCode, levels) {
  return levels.cities.every((c) => isCityCleared(save, domainCode, c.id));
}

export function isBossUnlocked(save, domainCode, levels) {
  return levels.cities.length === 0 || allCitiesCleared(save, domainCode, levels);
}

// The boss phases are the nation's fortresses. Remediating all of them is what
// draws the colossus itself out.
export function allFortressesCleared(save, domainCode, levels) {
  return levels.boss.phases.every((p) => isBossPhaseCleared(save, domainCode, p.id));
}

export function isColossusUnlocked(save, domainCode, levels) {
  return allCitiesCleared(save, domainCode, levels) && allFortressesCleared(save, domainCode, levels);
}

export function isColossusDefeated(save, domainCode) {
  return Boolean(domainState(save, domainCode).colossus?.cleared);
}

export function colossusBestScore(save, domainCode) {
  return domainState(save, domainCode).colossus?.bestScore ?? 0;
}

// A nation is only free once the colossus holding it is down -- cities and
// fortresses just get you to the fight.
export function isDomainConquered(save, domainCode, levels) {
  return isColossusUnlocked(save, domainCode, levels) && isColossusDefeated(save, domainCode);
}

// Cities + fortresses + the one colossus encounter.
function levelCount(levels) {
  return levels.cities.length + levels.boss.phases.length + 1;
}

function clearedCount(save, domainCode, levels) {
  return (
    levels.cities.filter((c) => isCityCleared(save, domainCode, c.id)).length +
    levels.boss.phases.filter((p) => isBossPhaseCleared(save, domainCode, p.id)).length +
    (isColossusDefeated(save, domainCode) ? 1 : 0)
  );
}

export function domainProgress(save, domainCode, levels) {
  const total = levelCount(levels);
  if (total === 0) return 0;
  return Math.round((clearedCount(save, domainCode, levels) / total) * 100);
}

export function overallProgress(save, levelsByDomain) {
  let cleared = 0;
  let total = 0;
  for (const code of DOMAINS) {
    const levels = levelsByDomain[code];
    total += levelCount(levels);
    cleared += clearedCount(save, code, levels);
  }
  return total === 0 ? 0 : Math.round((cleared / total) * 100);
}

export function isGameConquered(save, levelsByDomain) {
  return DOMAINS.every((code) => isDomainConquered(save, code, levelsByDomain[code]));
}

/**
 * Folds one run's answers into the domain's miss log. A wrong answer records
 * (or re-records) the question; a right one marks an existing entry redeemed
 * rather than deleting it, so a question the player once fumbled stays eligible
 * for the colossus -- just at lower priority than one they still get wrong.
 */
function recordAnswerHistory(state, answers) {
  for (const answer of answers || []) {
    if (!answer || !answer.questionId) continue;
    const prev = state.missed[answer.questionId];
    if (answer.correct) {
      if (prev) prev.redeemed = true;
    } else {
      state.missed[answer.questionId] = { misses: (prev?.misses ?? 0) + 1, redeemed: false };
    }
  }
}

/**
 * Records the result of playing a city, fortress (boss phase) or colossus
 * level: score is points earned this run; the level is marked cleared
 * regardless of score (progress-gated, not score-gated) but bestScore only ever
 * increases. `answers` feeds the miss log the colossus is built from.
 */
export function recordLevelResult(save, domainCode, kind, levelId, pointsEarned, answers) {
  const state = domainState(save, domainCode);
  if (kind === "colossus") {
    state.colossus = {
      cleared: true,
      bestScore: Math.max(state.colossus?.bestScore ?? 0, pointsEarned),
    };
  } else {
    const bucket = kind === "city" ? state.cities : state.boss.phases;
    const prev = bucket[levelId];
    bucket[levelId] = {
      cleared: true,
      bestScore: Math.max(prev?.bestScore ?? 0, pointsEarned),
    };
  }
  recordAnswerHistory(state, answers);
  save.totalXP += pointsEarned;
}

/** Question ids this domain has seen wrong, worst offenders first. */
export function missedQuestionIds(save, domainCode) {
  const missed = domainState(save, domainCode).missed || {};
  return Object.entries(missed)
    .filter(([, rec]) => rec && rec.misses > 0)
    .sort((a, b) => {
      // Still-wrong before since-corrected, then by how often it was missed.
      if (a[1].redeemed !== b[1].redeemed) return a[1].redeemed ? 1 : -1;
      return b[1].misses - a[1].misses;
    })
    .map(([id]) => id);
}

export function finalizeDomainConquered(save, domainCode, levels) {
  save.domains[domainCode].conquered = isDomainConquered(save, domainCode, levels);
}
