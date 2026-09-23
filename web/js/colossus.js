import { missedQuestionIds } from "./gamification.js";

// The colossus is not a level in data/levels/*.json -- it is assembled at the
// moment the player walks into it, from the questions that domain has actually
// caught them out on. Two attempts are never guaranteed to be the same fight.
export const COLOSSUS_TARGET_QUESTIONS = 12;
export const COLOSSUS_MIN_QUESTIONS = 10;
export const COLOSSUS_MISSED_RATIO = 0.5;

const DIFFICULTY_ORDER = ["Challenging", "Moderate", "Easy"];

function shuffle(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every question id the domain puts in play, cities and fortresses alike. */
export function domainQuestionIds(levels) {
  const ids = [];
  for (const city of levels.cities) ids.push(...city.questionIds);
  for (const phase of levels.boss.phases) ids.push(...phase.questionIds);
  return ids;
}

// Filler is drawn hardest-first so the colossus never degrades into an easy
// round when the player has little miss history to hold against them.
function byDifficulty(ids, questionsById) {
  const buckets = new Map(DIFFICULTY_ORDER.map((d) => [d, []]));
  const rest = [];
  for (const id of ids) {
    const q = questionsById.get(id);
    if (!q) continue;
    (buckets.get(q.difficulty) || rest).push(id);
  }
  return [...DIFFICULTY_ORDER.flatMap((d) => shuffle(buckets.get(d))), ...shuffle(rest)];
}

/**
 * Builds one colossus encounter.
 *
 * Aims for 12 questions (never fewer than 10 unless the domain itself is
 * smaller), of which at least half are ones this save has previously answered
 * incorrectly. A player with a thin miss log simply gets fewer of them -- the
 * fight is still the full length, topped up with the hardest questions
 * available -- and `missedCount` reports what the split actually came out as,
 * so the UI can tell the truth rather than claim a ratio it did not hit.
 */
export function buildColossusRun(save, domainCode, levels, questionsById) {
  const poolIds = domainQuestionIds(levels).filter((id) => questionsById.has(id));
  const pool = new Set(poolIds);
  const target = Math.min(COLOSSUS_TARGET_QUESTIONS, poolIds.length);
  const wantMissed = Math.ceil(target * COLOSSUS_MISSED_RATIO);

  // missedQuestionIds is already ordered worst-first (still wrong before since
  // corrected); keep that priority but shuffle within it so repeat attempts on
  // the same miss log are not identical.
  const missedRanked = missedQuestionIds(save, domainCode).filter((id) => pool.has(id));
  const stillWrong = shuffle(missedRanked.filter((id) => !isRedeemed(save, domainCode, id)));
  const redeemed = shuffle(missedRanked.filter((id) => isRedeemed(save, domainCode, id)));
  const chosen = [...stillWrong, ...redeemed].slice(0, wantMissed);

  const missedCount = chosen.length;
  const taken = new Set(chosen);
  for (const id of byDifficulty(poolIds.filter((id) => !taken.has(id)), questionsById)) {
    if (chosen.length >= target) break;
    chosen.push(id);
    taken.add(id);
  }

  return {
    questions: shuffle(chosen).map((id) => questionsById.get(id)),
    missedCount,
  };
}

function isRedeemed(save, domainCode, questionId) {
  return Boolean(save.domains[domainCode].missed?.[questionId]?.redeemed);
}

/** Lore entry for a domain's colossus, from data/lore.json. */
export function colossusFor(lore, domainCode) {
  return (lore?.adversaries || []).find((a) => a.domain === domainCode) || null;
}
