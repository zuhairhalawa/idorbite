import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Project } from 'ts-morph';
import { extractNextHandlers, routeFromPath } from '../src/extract/next.js';
import { analyze } from '../src/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
const nextRoot = join(here, 'fixtures', 'next');

function load() {
  const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(join(nextRoot, '**/route.ts'));
  const handlers = extractNextHandlers(project);
  return { handlers, findings: analyze(handlers) };
}

describe('next.js app-router sibling-gap detection', () => {
  it('derives route path and params from the folder structure', () => {
    const r = routeFromPath('/x/app/api/teams/[teamId]/datarooms/[id]/documents/route.ts');
    expect(r.routePath).toBe('/api/teams/[teamId]/datarooms/[id]/documents');
    expect(r.params).toEqual(['teamId', 'id']);
  });

  it('unwraps withTeamApi and extracts GET + POST as separate handlers', () => {
    const { handlers } = load();
    const docHandlers = handlers.filter((h) => h.routePath.endsWith('/documents'));
    expect(docHandlers.map((h) => h.method).sort()).toEqual(['GET', 'POST']);
    // the wrapped GET still reads its body: resource is dataroomDocument, and it is NOT scoped
    const get = docHandlers.find((h) => h.method === 'GET')!;
    expect(get.resourceKeys).toContain('dataroomdocument');
    expect(get.guards).toHaveLength(0);
  });

  it('flags the unscoped GET /documents as the gap, high confidence', () => {
    const { findings } = load();
    const docGet = findings.find((f) => f.handler.routePath.endsWith('/documents') && f.handler.method === 'GET');
    expect(docGet).toBeDefined();
    expect(docGet!.confidence).toBe('high');
  });

  it('does not flag the teamId-scoped siblings', () => {
    const { findings } = load();
    const flagged = findings.map((f) => `${f.handler.routePath} ${f.handler.method}`);
    expect(flagged).not.toContain('/api/teams/[teamId]/datarooms/[id]/documents POST');
    expect(flagged).not.toContain('/api/teams/[teamId]/datarooms/[id]/stats GET');
  });
});
