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

export function isDomainConquered(save, domainCode, levels) {
  return (
    allCitiesCleared(save, domainCode, levels) &&
    levels.boss.phases.every((p) => isBossPhaseCleared(save, domainCode, p.id))
  );
}

export function domainProgress(save, domainCode, levels) {
  const totalLevels = levels.cities.length + levels.boss.phases.length;
  if (totalLevels === 0) return 0;
  const clearedCities = levels.cities.filter((c) => isCityCleared(save, domainCode, c.id)).length;
  const clearedPhases = levels.boss.phases.filter((p) => isBossPhaseCleared(save, domainCode, p.id)).length;
  return Math.round(((clearedCities + clearedPhases) / totalLevels) * 100);
}

export function overallProgress(save, levelsByDomain) {
  let cleared = 0;
  let total = 0;
  for (const code of DOMAINS) {
    const levels = levelsByDomain[code];
    total += levels.cities.length + levels.boss.phases.length;
    cleared +=
      levels.cities.filter((c) => isCityCleared(save, code, c.id)).length +
      levels.boss.phases.filter((p) => isBossPhaseCleared(save, code, p.id)).length;
  }
  return total === 0 ? 0 : Math.round((cleared / total) * 100);
}

export function isGameConquered(save, levelsByDomain) {
  return DOMAINS.every((code) => isDomainConquered(save, code, levelsByDomain[code]));
}

/**
 * Records the result of playing a city or boss-phase level: score is
 * points earned this run; the level is marked cleared regardless of score
 * (progress-gated, not score-gated) but bestScore only ever increases.
 */
export function recordLevelResult(save, domainCode, kind, levelId, pointsEarned) {
  const state = domainState(save, domainCode);
  const bucket = kind === "city" ? state.cities : state.boss.phases;
  const prev = bucket[levelId];
  bucket[levelId] = {
    cleared: true,
    bestScore: Math.max(prev?.bestScore ?? 0, pointsEarned),
  };
  save.totalXP += pointsEarned;
}

export function finalizeDomainConquered(save, domainCode, levels) {
  save.domains[domainCode].conquered = isDomainConquered(save, domainCode, levels);
}
