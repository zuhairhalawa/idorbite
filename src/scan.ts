import { Project } from 'ts-morph';
import { join } from 'node:path';
import type { Finding, Confidence, Handler } from './types.js';
import { extractNestHandlers } from './extract/nest.js';
import { extractNextHandlers } from './extract/next.js';
import { analyze } from './analyze.js';

export interface ScanOptions {
  minConfidence?: Confidence;
}

/** Scan a directory for sibling-authorization gaps. Returns findings (highest score first). */
export function scan(root: string, opts: ScanOptions = {}): { handlers: Handler[]; findings: Finding[] } {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });
  // Add TS/JS sources, excluding the usual noise.
  project.addSourceFilesAtPaths([
    join(root, '**/*.{ts,tsx,js,mjs,cts,mts}'),
    '!' + join(root, '**/node_modules/**'),
    '!' + join(root, '**/dist/**'),
    '!' + join(root, '**/build/**'),
    '!' + join(root, '**/*.d.ts'),
    '!' + join(root, '**/*.{spec,test}.{ts,js}'),
  ]);

  const handlers = [...extractNestHandlers(project), ...extractNextHandlers(project)];
  const findings = analyze(handlers, { minConfidence: opts.minConfidence });
  return { handlers, findings };
}
