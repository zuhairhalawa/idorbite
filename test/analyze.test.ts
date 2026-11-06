import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadProject, extractNestHandlers } from '../src/extract/nest.js';
import { analyze } from '../src/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'nest');

function run(file: string) {
  const project = loadProject([join(fixtures, file)]);
  const handlers = extractNestHandlers(project);
  return { handlers, findings: analyze(handlers) };
}

describe('nestjs sibling-gap detection', () => {
  it('extracts all handlers from the dataroom controller', () => {
    const { handlers } = run('dataroom.controller.ts');
    expect(handlers.map((h) => h.name).sort()).toEqual(['addDocument', 'getDocuments', 'getStats', 'updateBranding']);
    expect(handlers.find((h) => h.name === 'getDocuments')!.resourceKeys).toContain('dataroomdocument');
  });

  it('flags the unguarded getDocuments as the sibling gap', () => {
    const { findings } = run('dataroom.controller.ts');
    const names = findings.map((f) => f.handler.name);
    expect(names).toContain('getDocuments');
    const f = findings.find((x) => x.handler.name === 'getDocuments')!;
    expect(f.guardedSiblings.length).toBeGreaterThanOrEqual(2);
    expect(['high', 'medium']).toContain(f.confidence);
  });

  it('does NOT flag the guarded siblings', () => {
    const { findings } = run('dataroom.controller.ts');
    const names = findings.map((f) => f.handler.name);
    expect(names).not.toContain('getStats');
    expect(names).not.toContain('updateBranding');
    expect(names).not.toContain('addDocument');
  });

  it('produces no findings when every sibling guards (control)', () => {
    const { findings } = run('safe.controller.ts');
    expect(findings).toHaveLength(0);
  });
});
