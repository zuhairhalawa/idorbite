import { Project, SourceFile, ClassDeclaration, MethodDeclaration, Decorator } from 'ts-morph';
import type { Handler, HttpMethod } from '../types.js';
import { detectGuards } from '../guards.js';
import { extractResourceKeys } from '../resource.js';

const HTTP = new Map<string, HttpMethod>([
  ['Get', 'GET'], ['Post', 'POST'], ['Put', 'PUT'], ['Patch', 'PATCH'], ['Delete', 'DELETE'], ['All', 'ALL'],
]);

/** Decorators that mark a route as intentionally unauthenticated. */
const PUBLIC_DECORATOR = /^(Public|SkipAuth|NoAuth|Anonymous|AllowAnonymous|Unauthenticated|IsPublic)$/i;

/** Handler names that are public by nature or authenticated out-of-band (webhook signatures). */
const PUBLIC_NAME = /(manifest|sitemap|robots|favicon|healthz?|readiness|liveness|^ping$|callback|webhook|^oauth)/i;

/** Route paths that are intentionally unauthenticated (by design) or authed out-of-band. */
const PUBLIC_ROUTE =
  /(^|\/)(public|cron|internal|_internal|webhooks?|health|\.well-known)(\/|$)/i;

export function extractNestHandlers(project: Project): Handler[] {
  const out: Handler[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      if (!hasDecorator(cls, 'Controller')) continue;
      const base = controllerBasePath(cls);
      const classDecoratorNames = cls.getDecorators().map(decoratorName);
      const classIsPublic = classDecoratorNames.some((n) => PUBLIC_DECORATOR.test(n));
      for (const m of cls.getMethods()) {
        const http = httpDecorator(m);
        if (!http) continue;
        const decoratorTexts = m.getDecorators().map((d) => d.getText());
        const methodDecoratorNames = m.getDecorators().map(decoratorName);
        const paramDecoratorNames = m
          .getParameters()
          .flatMap((p) => p.getDecorators().map(decoratorName));
        const body = m.getBody();
        const routePath = joinPath(base, http.path);
        const pathParams = paramNames(m, routePath);
        const queryNames = queryParamNames(m);
        const isOAuthCallback = queryNames.has('state') && queryNames.has('code');
        const isPublic =
          classIsPublic ||
          methodDecoratorNames.some((n) => PUBLIC_DECORATOR.test(n)) ||
          PUBLIC_NAME.test(m.getName()) ||
          PUBLIC_ROUTE.test(routePath) ||
          isOAuthCallback;
        out.push({
          framework: 'nestjs',
          file: sf.getFilePath(),
          line: m.getStartLineNumber(),
          name: m.getName(),
          method: http.method,
          routePath,
          pathParams,
          resourceKeys: extractResourceKeys(body),
          guards: detectGuards(body, decoratorTexts, paramDecoratorNames),
          isMutation: http.method !== 'GET',
          isPublic,
        });
      }
    }
  }
  return out;
}

function hasDecorator(node: ClassDeclaration, name: string): boolean {
  return node.getDecorators().some((d) => decoratorName(d) === name);
}

function decoratorName(d: Decorator): string {
  return d.getName();
}

function controllerBasePath(cls: ClassDeclaration): string {
  const dec = cls.getDecorators().find((d) => decoratorName(d) === 'Controller');
  const arg = dec?.getArguments()[0];
  const t = arg?.getText() ?? '';
  const m = t.match(/['"`]([^'"`]*)['"`]/);
  return m ? m[1] : '';
}

function httpDecorator(m: MethodDeclaration): { method: HttpMethod; path: string } | undefined {
  for (const d of m.getDecorators()) {
    const method = HTTP.get(decoratorName(d));
    if (method) {
      const arg = d.getArguments()[0]?.getText() ?? '';
      const path = arg.match(/['"`]([^'"`]*)['"`]/)?.[1] ?? '';
      return { method, path };
    }
  }
  return undefined;
}

function paramNames(m: MethodDeclaration, routePath: string): string[] {
  const names = new Set<string>();
  for (const p of m.getParameters()) {
    for (const d of p.getDecorators()) {
      if (decoratorName(d) === 'Param') {
        const n = d.getArguments()[0]?.getText().match(/['"`]([^'"`]*)['"`]/)?.[1];
        if (n) names.add(n);
      }
    }
  }
  for (const m2 of routePath.matchAll(/:(\w+)/g)) names.add(m2[1]);
  return [...names];
}

/** Names bound via @Query('x'); used to detect OAuth callbacks (state + code). */
function queryParamNames(m: MethodDeclaration): Set<string> {
  const names = new Set<string>();
  for (const p of m.getParameters()) {
    for (const d of p.getDecorators()) {
      if (decoratorName(d) === 'Query') {
        const n = d.getArguments()[0]?.getText().match(/['"`]([^'"`]*)['"`]/)?.[1];
        if (n) names.add(n);
      }
    }
  }
  return names;
}

function joinPath(base: string, sub: string): string {
  const b = base.replace(/\/$/, '');
  const s = sub.replace(/^\//, '');
  return ('/' + [b, s].filter(Boolean).join('/')).replace(/\/+/g, '/');
}

export function loadProject(globs: string[]): Project {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });
  for (const g of globs) project.addSourceFilesAtPaths(g);
  return project;
}

export function _sourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles();
}
