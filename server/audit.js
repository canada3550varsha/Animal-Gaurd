// Tamper-evident audit log using a SHA-256 hash chain.
// Each entry stores hash = SHA256(prevHash || canonical(entryData)).
// Editing any past entry breaks every subsequent hash -> tampering is detectable.

import { createHash } from "node:crypto";

const GENESIS = "0".repeat(64);

function sha256(str) {
  return createHash("sha256").update(str).digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map((x) => canonicalize(x)).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${k}:${canonicalize(obj[k])}`).join(",")}}`;
}

// Recompute the expected hash for a given index + data.
export function entryHash(prevHash, data) {
  return sha256(`${prevHash}${canonicalize(data)}`);
}

// Append a new entry to the log. Returns the new log.
export function appendAudit(log, actor, action, data) {
  const prev = log.length ? log[log.length - 1].hash : GENESIS;
  const entry = {
    seq: (log.length ? log[log.length - 1].seq : 0) + 1,
    ts: new Date().toISOString(),
    actor,
    action,
    data,
    prevHash: prev,
  };
  entry.hash = entryHash(prev, { actor, action, data, seq: entry.seq, ts: entry.ts, prevHash: prev });
  return [...log, entry];
}

// Verify the whole hash chain. Returns { valid, brokenIndex }.
export function verifyAudit(log) {
  let prevHash = GENESIS;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    const expected = entryHash(prevHash, { actor: e.actor, action: e.action, data: e.data, seq: e.seq, ts: e.ts, prevHash: e.prevHash });
    if (e.hash !== expected || e.prevHash !== prevHash) {
      return { valid: false, brokenIndex: i };
    }
    prevHash = e.hash;
  }
  return { valid: true, brokenIndex: -1 };
}
