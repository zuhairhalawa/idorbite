import { Node, SyntaxKind } from 'ts-morph';
import type { GuardSignal } from './types.js';

/** Authorization decorators (NestJS and common libs). Matched on the decorator's name. */
const GUARD_DECORATORS =
  /^(Permissions?|RequirePermissions?|HasPermissions?|RequiresPermissions?|UseGuards|Roles?|HasRoles?|CheckPolicies|CheckAbilities|HasAbilit(y|ies)|Auth|Authorize|RequireAuth|Scopes?|RequiresScopes?|HasScopes?|RequireScopes?|Can|Ability)$/i;

/**
 * Parameter decorators that inject the current actor (user/session/account). A handler that pulls
 * the authenticated principal and uses it is scoping to that actor — a strong authorization signal.
 */
const ACTOR_PARAM =
  /^(Impersonation|GetUser|CurrentUser|AuthUser|AuthedUser|LoggedInUser|ReqUser|RequestUser|User|UserId|GetUserId|Session|Principal|Account|CurrentAccount|Actor|Me)$/i;

/** Call-expression names that strongly imply an authorization/ownership check. */
const GUARD_CALL =
  /(verif(y|ies).*access|assert[A-Z_]|assertcan|^can[A-Z]|can[A-Z]\w*access|check.*perm|check.*access|ensure.*(owner|access|member|permission)|authoriz|requireaccess|requireperm|hasperm|haspermission|hasaccess|canaccess|checkowner|validatepermission|guard)/i;

/** Property keys that imply a query is scoped to the current actor/tenant. */
const SCOPE_KEYS =
  /^(userId|ownerId|createdById|authorId|teamId|workspaceId|projectId|accountId|organizationId|orgId|tenantId|memberId|customerId|companyId)$/;

/** Query-builder/ORM call names near which a scope key counts as a scoped query. */
const QUERY_CALL = /^(find|findOne|findFirst|findUnique|findMany|findUniqueOrThrow|findOneOrThrow|count|aggregate|update|updateMany|delete|deleteMany|get|where|createQueryBuilder|andWhere)/i;

/** Detect guard signals inside a handler function node, given its decorator names/text. */
export function detectGuards(
  body: Node | undefined,
  decoratorTexts: string[],
  paramDecoratorNames: string[] = [],
): GuardSignal[] {
  const out: GuardSignal[] = [];
  const seen = new Set<string>();
  const add = (s: GuardSignal) => {
    const k = s.kind + ':' + s.detail;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  };

  for (const d of decoratorTexts) {
    const name = d.replace(/^@/, '').match(/^[A-Za-z_]\w*/)?.[0] ?? '';
    if (GUARD_DECORATORS.test(name)) add({ kind: 'decorator', detail: d.length > 60 ? d.slice(0, 57) + '...' : d });
  }

  for (const p of paramDecoratorNames) {
    if (ACTOR_PARAM.test(p)) add({ kind: 'scoped-query', detail: `@${p} (actor-scoped)` });
  }

  if (!body) return out;

  body.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const callName = calleeName(node);
      if (callName && GUARD_CALL.test(callName)) {
        add({ kind: 'call', detail: callName });
      }
    }
    // scoped query: a property assignment whose key is a scope key, sitting inside a query call
    if (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) {
      const key = node.getName();
      if (SCOPE_KEYS.test(key) && insideQueryCall(node)) {
        add({ kind: 'scoped-query', detail: key });
      }
    }
  });

  return out;
}

/** Get the called function's simple name: foo(), a.b.foo(), this.svc.foo() -> "foo". */
export function calleeName(call: Node): string | undefined {
  const expr = call.asKind(SyntaxKind.CallExpression)?.getExpression();
  if (!expr) return undefined;
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return undefined;
}

/** Is this node nested inside a call whose name looks like an ORM/query method? */
function insideQueryCall(node: Node): boolean {
  let cur: Node | undefined = node.getParent();
  let hops = 0;
  while (cur && hops < 8) {
    if (Node.isCallExpression(cur)) {
      const n = calleeName(cur);
      if (n && QUERY_CALL.test(n)) return true;
    }
    cur = cur.getParent();
    hops++;
  }
  return false;
}
