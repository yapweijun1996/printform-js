const zeroCost = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 });
const zeroUsage = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: zeroCost() });
const clone = (value) => structuredClone(value);
const keyOf = (address) => `${address.namespace}::${address.key}`;
const numeric = (value) => Number.isFinite(value) ? value : 0;

function addUsage(total, next = {}) {
  const cost = next.cost || {};
  return {
    input: total.input + numeric(next.input), output: total.output + numeric(next.output),
    cacheRead: total.cacheRead + numeric(next.cacheRead), cacheWrite: total.cacheWrite + numeric(next.cacheWrite),
    totalTokens: total.totalTokens + numeric(next.totalTokens),
    cost: {
      input: total.cost.input + numeric(cost.input), output: total.cost.output + numeric(cost.output),
      cacheRead: total.cost.cacheRead + numeric(cost.cacheRead), cacheWrite: total.cost.cacheWrite + numeric(cost.cacheWrite),
      total: total.cost.total + numeric(cost.total)
    }
  };
}

function matchesAddress(address, prefix) {
  return address.namespace === prefix.namespace && address.key.startsWith(prefix.key || "");
}

export class PiMemoryStorage {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.entries = new Map();
    this.values = new Map();
    this.lists = new Map();
    this.usage = [];
    this.nextSeq = 1;
    this.closed = false;
  }

  prepare(writes, timestamp) {
    const ids = new Set([...this.entries.keys(), ...this.usage.map((row) => row.id)]);
    const committed = [];
    const firstSeq = this.nextSeq;
    for (const [index, input] of writes.entries()) {
      const seq = firstSeq + index;
      const write = clone(input);
      if (write.kind === "entry") {
        if (!write.entry?.id || ids.has(write.entry.id)) throw new Error(`Duplicate PI session entry: ${write.entry?.id}`);
        ids.add(write.entry.id);
        committed.push({ ...write.entry, kind: "entry", seq, timestamp });
      } else if (write.kind === "usage") {
        if (!write.row?.id || ids.has(write.row.id)) throw new Error(`Duplicate PI session usage: ${write.row?.id}`);
        ids.add(write.row.id);
        committed.push({ ...write.row, kind: "usage", seq });
      } else if (write.kind === "value" || write.kind === "list") {
        committed.push({ ...write, seq });
      } else {
        throw new Error("Unsupported PI session write kind");
      }
    }
    return { writes: committed, result: { firstSeq, seqs: committed.map((write) => write.seq), timestamp } };
  }

  apply(writes) {
    for (const write of writes) {
      if (write.kind === "entry") {
        const { kind: _kind, ...entry } = write;
        this.entries.set(entry.id, clone(entry));
      } else if (write.kind === "usage") {
        const { kind: _kind, ...row } = write;
        this.usage.push(clone(row));
      } else if (write.kind === "value") {
        const address = { namespace: write.namespace, key: write.key, kind: "value" };
        if (write.op === "delete") this.values.delete(keyOf(address));
        else this.values.set(keyOf(address), { address, value: clone(write.value), seq: write.seq });
      } else if (write.kind === "list") {
        const address = { namespace: write.namespace, key: write.key, kind: "list" };
        if (write.op === "delete") this.lists.delete(keyOf(address));
        else this.lists.set(keyOf(address), [...(this.lists.get(keyOf(address)) || []), { seq: write.seq, value: clone(write.value), address }]);
      }
      this.nextSeq = Math.max(this.nextSeq, write.seq + 1);
    }
  }

  async commit(writes, _context) {
    if (this.closed) throw new Error("PI memory storage is closed");
    const prepared = this.prepare(writes, this.now());
    this.apply(prepared.writes);
    return { ...prepared.result, stats: this.getStats() };
  }

  getEntries(ids, _context) {
    return new Map(ids.map((id) => [id, clone(this.entries.get(id))]).filter(([, entry]) => entry));
  }

  getValue(address, _context) {
    const value = this.values.get(keyOf(address));
    return value ? clone(value) : undefined;
  }

  scanValues(prefix, _context) {
    return [...this.values.values()].filter((value) => matchesAddress(value.address, prefix)).map(clone);
  }

  readList(address, options = {}, _context) {
    const order = options.order === "desc" ? "desc" : "asc";
    const cursor = options.cursor?.seq;
    const rows = (this.lists.get(keyOf(address)) || []).filter((row) => cursor === undefined || (order === "asc" ? row.seq > cursor : row.seq < cursor));
    rows.sort((a, b) => order === "asc" ? a.seq - b.seq : b.seq - a.seq);
    const limit = Number.isSafeInteger(options.limit) && options.limit >= 0 ? options.limit : rows.length;
    return rows.slice(0, limit).map(({ seq, value }) => ({ seq, value: clone(value) }));
  }

  scanBranch(query, _context) {
    const result = [];
    let current = query?.start;
    while (current) {
      const entry = this.entries.get(current);
      if (!entry) break;
      if ((!query.type || query.type === entry.type) && (!query.customType || query.customType === entry.customType)) result.push(clone(entry));
      if (query.stopAtId === current || query.stopAtType === entry.type) break;
      current = entry.parentId;
    }
    if (query?.order === "oldestFirst") result.reverse();
    return Number.isSafeInteger(query?.limit) ? result.slice(0, query.limit) : result;
  }

  scanBranchStructure(query, context) {
    return this.scanBranch(query, context).map(({ id, parentId, seq, timestamp, type, customType }) => ({ id, parentId, seq, timestamp, type, customType }));
  }

  scanEntries(query = {}, _context) {
    const order = query.order === "asc" ? "asc" : "desc";
    let rows = [...this.entries.values()].filter((entry) => (!query.type || query.type === entry.type) && (!query.customType || query.customType === entry.customType));
    rows = rows.filter((entry) => query.fromSeq === undefined || entry.seq >= query.fromSeq).filter((entry) => query.toSeq === undefined || entry.seq <= query.toSeq);
    if (query.cursor?.seq !== undefined) rows = rows.filter((entry) => order === "asc" ? entry.seq > query.cursor.seq : entry.seq < query.cursor.seq);
    rows.sort((a, b) => order === "asc" ? a.seq - b.seq : b.seq - a.seq);
    return Number.isSafeInteger(query.limit) ? rows.slice(0, query.limit).map(clone) : rows.map(clone);
  }

  scanUsage(query = {}, _context) {
    const order = query.order === "asc" ? "asc" : "desc";
    let rows = this.usage.filter((row) => query.fromSeq === undefined || row.seq >= query.fromSeq).filter((row) => query.toSeq === undefined || row.seq <= query.toSeq);
    rows.sort((a, b) => order === "asc" ? a.seq - b.seq : b.seq - a.seq);
    return Number.isSafeInteger(query.limit) ? rows.slice(0, query.limit).map(clone) : rows.map(clone);
  }

  getStats() {
    return { messageCount: [...this.entries.values()].filter((entry) => entry.type === "message").length, usage: this.usage.reduce((total, row) => addUsage(total, row.usage), zeroUsage()) };
  }

  async close() { this.closed = true; }
}
