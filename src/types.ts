export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'ALL';

/** A reason we believe a handler performs an authorization/ownership check. */
export interface GuardSignal {
  kind: 'decorator' | 'call' | 'scoped-query';
  /** The concrete text that matched, e.g. "@Permissions('field|create')" or "verifyFolderAccess". */
  detail: string;
}

/** A route handler discovered in the project. */
export interface Handler {
  framework: 'nestjs' | 'nextjs' | 'express';
  file: string;
  line: number;
  /** Function/method name (or route label). */
  name: string;
  method: HttpMethod;
  /** Route path when known (e.g. "/:id/duplicate"). */
  routePath: string;
  /** Path param names present (e.g. ["id"]). */
  pathParams: string[];
  /** Signals that say what resource this handler acts on: DB models/repos/services touched. */
  resourceKeys: string[];
  /** Authorization signals found on/in the handler. */
  guards: GuardSignal[];
  /** True if the handler mutates (POST/PATCH/PUT/DELETE) or returns the fetched object. */
  isMutation: boolean;
  /** Intentionally public (e.g. @Public, manifest/sitemap/health/webhook) — never a candidate. */
  isPublic: boolean;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface Finding {
  handler: Handler;
  /** The sibling handlers (same resource group) that DO guard. */
  guardedSiblings: Handler[];
  /** How many handlers in the group total. */
  groupSize: number;
  resourceKey: string;
  confidence: Confidence;
  score: number;
  message: string;
}
