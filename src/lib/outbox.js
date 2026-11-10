// The outbox: every change made on the shoot-day screens goes in here first, then is sent to the server
// in order. If there is no network the changes wait (and survive a page reload) until it comes back.

import { ApiError, api } from "../api/client";
import * as idb from "./idb";

let userId = null;
let ops = []; // all waiting changes (every user), in order
let tmpMap = {}; // temporary id -> real id, for rows created while offline
let loaded = false;
let loadPromise = null;
let flushing = false;
let inflightSeq = null;
let timer = null;
let online = typeof navigator === "undefined" ? true : navigator.onLine;

const statusSubs = new Set();
const eventSubs = new Set();
let snapshot = { online, pending: 0, syncing: false };

const mine = () => ops.filter((o) => o.userId === userId);
function emitStatus() {
  snapshot = { online, pending: mine().length, syncing: flushing };
  statusSubs.forEach((f) => f());
}
const fire = (e) => eventSubs.forEach((f) => f(e));

export const subscribe = (f) => {
  statusSubs.add(f);
  return () => statusSubs.delete(f);
};
export const getSnapshot = () => snapshot;
/** Events: created {tmp, real, res, op} | done | rejected {op, error} | drained */
export const onSyncEvent = (f) => {
  eventSubs.add(f);
  return () => eventSubs.delete(f);
};

export const newTmpId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;
export const isTmp = (v) => typeof v === "string" && v.startsWith("tmp-");
export const getSyncUserId = () => userId;
export const pendingCount = (dayId) => mine().filter((o) => String(o.dayId) === String(dayId)).length;

async function ensureLoaded() {
  if (loaded) return;
  loadPromise ||= (async () => {
    ops = (await idb.outboxAll()).sort((a, b) => a.seq - b.seq);
    tmpMap = (await idb.kvGet("tmpmap")) || {};
    loaded = true;
  })();
  await loadPromise;
}

export function setSyncUser(id) {
  userId = id ?? null;
  ensureLoaded().then(() => {
    emitStatus();
    if (userId) flush();
  });
}

function resolveOp(op) {
  let path = op.path;
  for (const [t, r] of Object.entries(tmpMap)) path = path.split(t).join(String(r));
  let body = op.body;
  if (body && typeof body === "object") {
    body = { ...body };
    for (const k of Object.keys(body)) if (typeof body[k] === "string" && tmpMap[body[k]] !== undefined) body[k] = tmpMap[body[k]];
  }
  const unresolved = /tmp-[a-z0-9]+/.test(path) || (body && Object.values(body).some(isTmp));
  return { path, body, unresolved };
}

async function drop(op) {
  ops = ops.filter((o) => o.seq !== op.seq);
  await idb.outboxDelete(op.seq);
}

/** op: { method, path, body, label, dayId, tmp? } */
export async function enqueue(op) {
  await ensureLoaded();
  const mineOps = mine();
  const sameLast = [...mineOps].reverse().find((o) => o.path === op.path);
  // Two edits to the same row in a row: keep one request with both changes
  if (op.method === "PATCH" && sameLast && sameLast.method === "PATCH" && sameLast.seq !== inflightSeq) {
    sameLast.body = { ...sameLast.body, ...op.body };
    await idb.outboxPut(sameLast);
  } else {
    const full = { ...op, userId, ts: Date.now() };
    full.seq = await idb.outboxAdd(full);
    ops.push(full);
  }
  emitStatus();
  flush();
}

/** A row that was created offline and deleted before it was sent: forget it. Returns true if nothing needs to be sent. */
export function cancelFor(tmp) {
  const create = ops.find((o) => o.tmp === tmp);
  if (!create || create.seq === inflightSeq) return false;
  const related = ops.filter((o) => o.tmp === tmp || o.path.includes(tmp) || (o.body && Object.values(o.body).includes(tmp)));
  related.forEach((o) => {
    ops = ops.filter((x) => x.seq !== o.seq);
    idb.outboxDelete(o.seq);
  });
  emitStatus();
  return true;
}

function scheduleRetry() {
  clearTimeout(timer);
  timer = setTimeout(flush, 8000);
}

export async function flush() {
  await ensureLoaded();
  if (flushing || !userId) return;
  flushing = true;
  emitStatus();
  let stopped = false;
  let changed = false;
  try {
    for (;;) {
      const op = mine()[0];
      if (!op) break;
      const r = resolveOp(op);
      if (r.unresolved) {
        await drop(op);
        changed = true;
        fire({ type: "rejected", op, error: new ApiError(400, "skipped", "An earlier change it depends on was not saved.") });
        continue;
      }
      inflightSeq = op.seq;
      try {
        const res = await api(r.path, { method: op.method, body: r.body });
        online = true;
        if (op.tmp && res && res.id !== undefined) {
          tmpMap[op.tmp] = res.id;
          await idb.kvSet("tmpmap", tmpMap);
        }
        await drop(op);
        changed = true;
        if (op.tmp) fire({ type: "created", tmp: op.tmp, real: res?.id, res, op });
        fire({ type: "done", op, res });
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) {
          online = false;
          stopped = true;
        } else if (e instanceof ApiError && (e.status === 401 || e.status === 429 || e.status >= 500)) {
          stopped = e.status !== 401 ? "retry" : "auth";
        } else {
          await drop(op);
          changed = true;
          fire({ type: "rejected", op, error: e });
        }
        if (stopped) break;
      } finally {
        inflightSeq = null;
      }
    }
  } finally {
    flushing = false;
    emitStatus();
  }
  if (stopped && stopped !== "auth") scheduleRetry();
  if (!stopped && changed && mine().length === 0) fire({ type: "drained" });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    online = true;
    emitStatus();
    flush();
  });
  window.addEventListener("offline", () => {
    online = false;
    emitStatus();
  });
}
