// Tiny IndexedDB wrapper for offline data. Two stores:
//   kv     - cached screens (key -> any JSON)
//   outbox - changes waiting to be sent to the server
// If IndexedDB is blocked (some private modes), everything falls back to memory so the app still works online.

const mem = { kv: new Map(), outbox: [], seq: 0 };
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const r = indexedDB.open("arthatech-offline", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("kv");
        r.result.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

async function run(store, mode, make) {
  const db = await open();
  if (!db) return { memory: true };
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, mode);
      const req = make(t.objectStore(store));
      t.oncomplete = () => resolve({ result: req?.result });
      t.onerror = () => resolve({ memory: true });
      t.onabort = () => resolve({ memory: true });
    } catch {
      resolve({ memory: true });
    }
  });
}

export async function kvGet(key) {
  const r = await run("kv", "readonly", (s) => s.get(key));
  return r.memory ? mem.kv.get(key) : r.result;
}
export async function kvSet(key, value) {
  const r = await run("kv", "readwrite", (s) => s.put(value, key));
  if (r.memory) mem.kv.set(key, value);
}
export async function kvDel(key) {
  const r = await run("kv", "readwrite", (s) => s.delete(key));
  if (r.memory) mem.kv.delete(key);
}

export async function outboxAll() {
  const r = await run("outbox", "readonly", (s) => s.getAll());
  return r.memory ? [...mem.outbox] : r.result || [];
}
/** Returns the new sequence number */
export async function outboxAdd(op) {
  const r = await run("outbox", "readwrite", (s) => s.add(op));
  if (r.memory) {
    const seq = ++mem.seq;
    mem.outbox.push({ ...op, seq });
    return seq;
  }
  return r.result;
}
export async function outboxPut(op) {
  const r = await run("outbox", "readwrite", (s) => s.put(op));
  if (r.memory) mem.outbox = mem.outbox.map((o) => (o.seq === op.seq ? op : o));
}
export async function outboxDelete(seq) {
  const r = await run("outbox", "readwrite", (s) => s.delete(seq));
  if (r.memory) mem.outbox = mem.outbox.filter((o) => o.seq !== seq);
}
