// scheduler.mjs — lightweight orchestration helpers for dependency-aware parallel execution.
// Zero deps.
//
// Used by the Conductor and pilot runs to accelerate eligible parallel steps (for now, Phase 3
// producers) without changing eval gates or checkpoint behavior.

export function withConcurrency(items, maxParallel, worker) {
  const list = Array.from(items || []);
  const limit = Math.max(1, Number(maxParallel) || 1);
  const results = new Array(list.length);
  let next = 0;

  async function runWorker() {
    while (true) {
      const i = next++;
      if (i >= list.length) return;
      results[i] = await worker(list[i], i);
    }
  }

  return Promise.all(Array.from({ length: Math.min(limit, list.length) }, runWorker)).then(() => results);
}

// True when every declared dependency appears in the completed set.
export function depsSatisfied(step, doneSet) {
  const deps = Array.isArray(step?.depends_on) ? step.depends_on : [];
  return deps.every(d => doneSet.has(d));
}

// Select steps in a parallel group that are currently runnable.
export function eligibleGroupSteps(steps, doneSet, group = 'phase3-producers') {
  return (steps || []).filter(s =>
    s &&
    s.parallel_group === group &&
    s.status === 'pending' &&
    depsSatisfied(s, doneSet)
  );
}

