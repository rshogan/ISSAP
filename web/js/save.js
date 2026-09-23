const STORAGE_KEY = "issap.saves.v1";
const SCHEMA_VERSION = 2;

function emptyStore() {
  return { version: SCHEMA_VERSION, lastActiveSlot: null, slots: {} };
}

// v1 -> v2 added the per-domain miss log and colossus record. Migrate in place
// rather than letting the version check fall through to emptyStore(), which
// would silently delete every existing save.
function migrate(store) {
  if (store.version === SCHEMA_VERSION) return store;
  if (store.version !== 1) return null;
  for (const slot of Object.values(store.slots)) {
    for (const domain of Object.values(slot.domains || {})) {
      if (!domain.missed) domain.missed = {};
      if (domain.colossus === undefined) domain.colossus = null;
      // A v1 save could be flagged conquered on cities + fortresses alone; the
      // colossus is now part of that, so let it be re-derived from the levels.
      domain.conquered = false;
    }
  }
  store.version = SCHEMA_VERSION;
  return store;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.slots !== "object") return emptyStore();
    const migrated = migrate(parsed);
    if (!migrated) return emptyStore();
    return migrated;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function genId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyDomainState() {
  return {
    cities: {},
    boss: { phases: {} },
    // The colossus is built fresh each attempt rather than stored as a level,
    // so only its outcome lives here. `missed` is the raw material it draws on:
    // questionId -> { misses, redeemed }, where redeemed means the player has
    // since answered it correctly somewhere.
    colossus: null,
    missed: {},
    conquered: false,
  };
}

export function listSlots() {
  const store = readStore();
  return Object.values(store.slots).sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

export function getLastActiveSlotId() {
  return readStore().lastActiveSlot;
}

export function createSlot(name, domainCodes) {
  const store = readStore();
  const id = genId();
  const now = new Date().toISOString();
  const domains = {};
  for (const code of domainCodes) domains[code] = emptyDomainState();
  const slot = { id, name, createdAt: now, lastPlayedAt: now, totalXP: 0, domains };
  store.slots[id] = slot;
  store.lastActiveSlot = id;
  writeStore(store);
  return slot;
}

export function loadSlot(id) {
  const store = readStore();
  return store.slots[id] || null;
}

export function saveSlot(slot) {
  const store = readStore();
  slot.lastPlayedAt = new Date().toISOString();
  store.slots[slot.id] = slot;
  store.lastActiveSlot = slot.id;
  writeStore(store);
}

export function deleteSlot(id) {
  const store = readStore();
  delete store.slots[id];
  if (store.lastActiveSlot === id) store.lastActiveSlot = null;
  writeStore(store);
}

export function setLastActiveSlot(id) {
  const store = readStore();
  store.lastActiveSlot = id;
  writeStore(store);
}
