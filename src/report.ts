import pc from 'picocolors';
import { relative } from 'node:path';
import type { Finding, Confidence } from './types.js';

const COLOR: Record<Confidence, (s: string) => string> = {
  high: (s) => pc.bold(pc.red(s)),
  medium: (s) => pc.yellow(s),
  low: (s) => pc.dim(s),
};

export function reportPretty(findings: Finding[], root: string): string {
  if (findings.length === 0) {
    return pc.green('✓ idorbite: no sibling-authorization gaps found.');
  }
  const lines: string[] = [];
  lines.push(pc.bold(`idorbite — ${findings.length} possible authorization gap(s)\n`));
  for (const f of findings) {
    const loc = `${relative(root, f.handler.file)}:${f.handler.line}`;
    const tag = COLOR[f.confidence](`[${f.confidence.toUpperCase()}]`);
    lines.push(`${tag} ${pc.cyan(loc)}  ${pc.dim(f.handler.method)} ${f.handler.name}`);
    lines.push(`  ${f.message}`);
    const sibs = f.guardedSiblings
      .map((g) => `${g.name} (${g.guards.map((x) => x.detail).join(', ')})`)
      .slice(0, 3)
      .join('; ');
    lines.push(pc.dim(`  guarded siblings: ${sibs}`));
    lines.push('');
  }
  const high = findings.filter((f) => f.confidence === 'high').length;
  lines.push(pc.dim(`Not proof of a vulnerability — review each. Suppress with // idorbite-ignore.`));
  if (high) lines.push(COLOR.high(`${high} high-confidence — look at these first.`));
  return lines.join('\n');
}

export function reportJson(findings: Finding[], root: string): string {
  return JSON.stringify(
    findings.map((f) => ({
      confidence: f.confidence,
      score: Number(f.score.toFixed(2)),
      file: relative(root, f.handler.file),
      line: f.handler.line,
      method: f.handler.method,
      handler: f.handler.name,
      route: f.handler.routePath,
      resource: f.resourceKey,
      message: f.message,
      guardedSiblings: f.guardedSiblings.map((g) => ({
        name: g.name,
        guards: g.guards.map((x) => x.detail),
      })),
    })),
    null,
    2,
  );
}
