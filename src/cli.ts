#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { scan } from './scan.js';
import { reportPretty, reportJson } from './report.js';
import type { Confidence } from './types.js';

const program = new Command();

program
  .name('idorbite')
  .description('Flag sibling-handler authorization gaps (IDOR / broken object-level authorization) in JS/TS backends.')
  .argument('[path]', 'directory to scan', '.')
  .option('--json', 'output JSON instead of a table')
  .option('--min-confidence <level>', 'only report high|medium|low and above', 'low')
  .option('--fail-on <level>', 'exit non-zero if a finding at/above this confidence exists (high|medium|low|none)', 'high')
  .action((path: string, opts: { json?: boolean; minConfidence: string; failOn: string }) => {
    const root = resolve(path);
    const minConfidence = normalizeLevel(opts.minConfidence) ?? 'low';
    const { findings } = scan(root, { minConfidence });

    process.stdout.write((opts.json ? reportJson(findings, root) : reportPretty(findings, root)) + '\n');

    const failOn = opts.failOn === 'none' ? null : normalizeLevel(opts.failOn) ?? 'high';
    if (failOn) {
      const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
      const hit = findings.some((f) => rank[f.confidence] >= rank[failOn]);
      if (hit) process.exitCode = 1;
    }
  });

function normalizeLevel(s: string): Confidence | undefined {
  const v = s.toLowerCase();
  return v === 'high' || v === 'medium' || v === 'low' ? v : undefined;
}

program.parse();
