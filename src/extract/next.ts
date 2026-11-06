import { Project, SourceFile, Node } from 'ts-morph';
import type { Handler, HttpMethod } from '../types.js';
import { detectGuards } from '../guards.js';
import { extractResourceKeys } from '../resource.js';

const METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
// Routes that aren't user-facing object access: internal jobs (authed by a shared secret),
// webhooks (signature-authed), and well-known public endpoints.
const PUBLIC_ROUTE =
  /(\/(cron|internal|_internal|tasks?|jobs?|webhooks?)\/|\.?well[-_]?known|manifest|sitemap|robots|favicon|healthz?|\/ping\b|callback)/i;

/**
 * Next.js App Router: files named `route.ts` export async functions GET/POST/PUT/PATCH/DELETE.
 * Path + params come from the folder structure (.../app/api/teams/[teamId]/x/[id]/route.ts).
 */
export function extractNextHandlers(project: Project): Handler[] {
  const out: Handler[] = [];
  for (const sf of project.getSourceFiles()) {
    if (!/[\\/]route\.(t|j)sx?$/.test(sf.getFilePath())) continue;
    const { routePath, params } = routeFromPath(sf.getFilePath());
    const publicRoute = PUBLIC_ROUTE.test(routePath);

    for (const [name, body] of exportedMethodFns(sf)) {
      out.push({
        framework: 'nextjs',
        file: sf.getFilePath(),
        line: body?.getStartLineNumber() ?? 1,
        name,
        method: name as HttpMethod,
        routePath,
        pathParams: params,
        resourceKeys: extractResourceKeys(body),
        guards: detectGuards(body, [], []),
        isMutation: name !== 'GET',
        isPublic: publicRoute,
      });
    }
  }
  return out;
}

/** Collect exported method functions (declarations and `export const GET = ...`). */
function exportedMethodFns(sf: SourceFile): Array<[string, Node | undefined]> {
  const res: Array<[string, Node | undefined]> = [];
  for (const fn of sf.getFunctions()) {
    const n = fn.getName();
    if (fn.isExported() && n && METHODS.has(n as HttpMethod)) res.push([n, fn.getBody()]);
  }
  for (const v of sf.getVariableDeclarations()) {
    const n = v.getName();
    if (!v.isExported() || !METHODS.has(n as HttpMethod)) continue;
    const fn = unwrapHandler(v.getInitializer());
    if (fn) res.push([n, fn]);
  }
  return res;
}

/**
 * Resolve the handler function from an initializer, unwrapping auth wrappers like
 * `withTeamApi(async (req) => {...})` or `withWorkspace(handler, opts)`. The wrapper provides
 * authentication, not object-level scoping — we analyze the inner function's own guards.
 */
function unwrapHandler(node: Node | undefined, depth = 0): Node | undefined {
  if (!node || depth > 4) return undefined;
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) return node.getBody();
  if (Node.isCallExpression(node)) {
    for (const arg of node.getArguments()) {
      const body = unwrapHandler(arg, depth + 1);
      if (body) return body;
    }
  }
  return undefined;
}

/** Derive route path + params from an app-router file path. */
export function routeFromPath(filePath: string): { routePath: string; params: string[] } {
  const norm = filePath.replace(/\\/g, '/');
  const m = norm.match(/\/app\/(.+)\/route\.(?:t|j)sx?$/);
  const segs = m ? m[1].split('/') : [];
  // route groups like (admin) don't affect the URL
  const urlSegs = segs.filter((s) => !/^\(.*\)$/.test(s));
  const params: string[] = [];
  for (const s of urlSegs) {
    const pm = s.match(/^\[(?:\.\.\.)?(\w+)\]$/);
    if (pm) params.push(pm[1]);
  }
  return { routePath: '/' + urlSegs.join('/'), params };
}
