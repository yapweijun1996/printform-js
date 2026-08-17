import { stableStringify } from "./json.js";

const MAX_ENTRIES = 300;

function safeRead(storage, key) {
  if (!storage?.getItem) return [];
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeWrite(storage, key, entries) {
  if (!storage?.setItem) return;
  try {
    storage.setItem(key, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Persistence is an audit enhancement. A quota/private-mode failure must
    // not corrupt the in-memory transaction state or turn a valid edit into a
    // partial commit.
  }
}

export class TransactionJournal {
  constructor(storage = null, key = "printform:studio-v2:transactions") {
    this.storage = storage;
    this.key = key;
    this.entries = safeRead(storage, key);
  }

  append(entry) {
    this.entries.push({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
    safeWrite(this.storage, this.key, this.entries);
    return entry;
  }

  list() {
    return structuredClone(this.entries);
  }

  lastRevision() {
    return this.entries.reduce((max, entry) => Math.max(max, Number(entry.revision) || 0), 0);
  }
}

export function journalKey(project) {
  const id = project?.manifest?.documentId || project?.manifest?.documentType || project?.manifest?.title || "untitled";
  return `printform:studio-v2:transactions:${stableStringify(String(id))}`;
}
