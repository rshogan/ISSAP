const STORAGE_KEY = "issap.saves.v1";
const SCHEMA_VERSION = 1;

function emptyStore() {
  return { version: SCHEMA_VERSION, lastActiveSlot: null, slots: {} };
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION || typeof parsed.slots !== "object") {
      return emptyStore();
    }
    return parsed;
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
  return { cities: {}, boss: { phases: {} }, conquered: false };
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
