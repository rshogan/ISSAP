let manifestPromise = null;
const questionsCache = new Map();
const levelsCache = new Map();

export function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch("../data/questions/manifest.json").then((r) => r.json());
  }
  return manifestPromise;
}

export async function loadQuestions(domainCode) {
  if (questionsCache.has(domainCode)) return questionsCache.get(domainCode);
  const manifest = await loadManifest();
  const entry = manifest.find((m) => m.domain === domainCode);
  const questions = await fetch(`../data/questions/${entry.file}`).then((r) => r.json());
  const byId = new Map(questions.map((q) => [q.id, q]));
  questionsCache.set(domainCode, byId);
  return byId;
}

export async function loadLevels(domainCode) {
  if (levelsCache.has(domainCode)) return levelsCache.get(domainCode);
  const manifest = await loadManifest();
  const entry = manifest.find((m) => m.domain === domainCode);
  const levels = await fetch(`../data/levels/${entry.file}`).then((r) => r.json());
  levelsCache.set(domainCode, levels);
  return levels;
}

export async function loadAllLevels(domainCodes) {
  const entries = await Promise.all(domainCodes.map((code) => loadLevels(code).then((l) => [code, l])));
  return Object.fromEntries(entries);
}
