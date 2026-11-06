import type { Handler, Finding, Confidence } from './types.js';

/** A readable identifier: for Next.js the fn name is just the method, so prefer the route. */
export function handlerLabel(h: Handler): string {
  if (h.name === h.method && h.routePath) return `${h.method} ${h.routePath}`;
  return `${h.method} ${h.name}`;
}

export interface AnalyzeOptions {
  minConfidence?: Confidence;
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Group handlers by the resource (DB model) they touch, then flag any handler that lacks an
 * authorization guard while one or more siblings in the same group have one.
 */
export function analyze(handlers: Handler[], opts: AnalyzeOptions = {}): Finding[] {
  // resourceKey -> handlers that touch it
  const groups = new Map<string, Handler[]>();
  for (const h of handlers) {
    for (const key of h.resourceKeys) {
      const arr = groups.get(key) ?? [];
      arr.push(h);
      groups.set(key, arr);
    }
  }

  // best finding per handler (a handler may be flagged via several groups)
  const best = new Map<Handler, Finding>();

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const guarded = group.filter((h) => h.guards.length > 0);
    if (guarded.length === 0) continue;
    // Only non-public, unguarded handlers are candidates.
    const unguarded = group.filter((h) => h.guards.length === 0 && !h.isPublic);
    if (unguarded.length === 0) continue;

    for (const h of unguarded) {
      const f = score(h, guarded, group.length, key);
      const prev = best.get(h);
      if (!prev || f.score > prev.score) best.set(h, f);
    }
  }

  let findings = [...best.values()];
  if (opts.minConfidence) {
    const min = RANK[opts.minConfidence];
    findings = findings.filter((f) => RANK[f.confidence] >= min);
  }
  return findings.sort((a, b) => b.score - a.score);
}

function score(h: Handler, guarded: Handler[], groupSize: number, key: string): Finding {
  const guardedRatio = guarded.length / groupSize;
  // An object-level-auth bug needs an attacker-controlled object identifier. Without a path-param id
  // (or a body/query id), an unguarded handler is usually a list/global read — not a high-confidence IDOR.
  const hasObjectId = h.pathParams.length > 0;
  let s = guardedRatio;
  if (h.isMutation) s += 0.15;
  if (guarded.length >= 2) s += 0.15;
  if (hasObjectId) s += 0.1;
  s = Math.min(1, s);

  let confidence: Confidence = 'low';
  if (guarded.length >= 2 && guardedRatio >= 0.6 && hasObjectId) confidence = 'high';
  else if (guarded.length >= 1 && guardedRatio >= 0.4) confidence = 'medium';

  const label = handlerLabel(h);
  const sib = guarded.map((g) => handlerLabel(g)).slice(0, 3).join(', ');
  const message =
    `${label} has no object-level authorization check, but ${guarded.length} sibling(s) on "${key}" do ` +
    `(${sib}${guarded.length > 3 ? ', …' : ''}). Review for broken object-level authorization.`;

  return { handler: h, guardedSiblings: guarded, groupSize, resourceKey: key, confidence, score: s, message };
}
