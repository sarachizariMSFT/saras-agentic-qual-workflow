// fsx.mjs — safe filesystem helpers shared across the engine. Zero deps.
// Fixes the parallel-producer race (lost updates) and the "one bad JSON crashes the
// whole build" class of bugs by giving every writer an exclusive lock + atomic write,
// and every reader a fault-tolerant parse.

import fs from 'node:fs';
import path from 'node:path';

// Parse JSON without ever throwing. Returns `fallback` (default null) on a missing
// file OR a corrupt/half-written one, so a single bad artifact degrades one card
// instead of aborting the entire dashboard/compare/risk build.
export function readJSONSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Atomic write: write to a temp file then rename over the target. rename is atomic
// on the same volume, so a reader never observes a half-written file.
export function writeJSONAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
  return file;
}

// Exclusive advisory lock via an O_CREAT|O_EXCL lock file. Multiple independent
// Node processes (the 6 parallel producers) contend for the same lock, so the
// read-modify-write of a shared manifest is serialized. Stale locks (older than
// staleMs) are reclaimed so a crashed writer can't wedge the pipeline forever.
export function withLock(targetFile, fn, { retries = 200, waitMs = 25, staleMs = 30000 } = {}) {
  const lockPath = `${targetFile}.lock`;
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  let fd = null;
  for (let i = 0; i < retries; i++) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // reclaim a stale lock left by a crashed writer
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > staleMs) { fs.rmSync(lockPath, { force: true }); continue; }
      } catch { /* lock vanished; retry */ }
      sleepSync(waitMs);
    }
  }
  if (fd == null) throw new Error(`Could not acquire lock for ${targetFile} after ${retries} tries`);
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch { /* already closed */ }
    fs.rmSync(lockPath, { force: true });
  }
}

// Read-modify-write a JSON file under an exclusive lock, atomically.
// `mutate(current)` receives the freshly-read object (or `init` if absent) and
// returns the object to persist. This is the safe primitive for shared manifests.
export function updateJSON(file, mutate, init = {}) {
  return withLock(file, () => {
    const current = readJSONSafe(file, init);
    const next = mutate(current);
    writeJSONAtomic(file, next);
    return next;
  });
}

// Tiny synchronous sleep (no deps). Blocks the event loop briefly during lock retry.
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin */ }
}
