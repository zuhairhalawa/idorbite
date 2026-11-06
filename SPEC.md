# idorbite — spec (MVP)

A static CLI that flags **sibling-handler authorization gaps** in JS/TS web backends:
API route handlers that are missing the ownership/permission check their siblings (handlers on the
same resource) enforce. This is the OWASP API #1 class (Broken Object Level Authorization / IDOR).

Grounded in real bugs found by hand: Immich partner-sync, Rocket.Chat getDeletedMessages,
Dub analytics folder bypass, Twenty groupBy, Papermark dataroom docs, Teable field-duplicate.

## Goals
- Genuinely useful, free, offline (no API key). npm-installable CLI (`npx idorbite <path>`).
- Low enough false positives to be trusted: confidence tiers, never claims a bug ("review: siblings guard, this doesn't").
- A force-multiplier we point at repos to surface IDOR candidates fast.

## Non-goals (MVP)
- General SAST. Only the sibling-gap pattern.
- Taint/dataflow proof. It's a heuristic ranker, not a prover.

## Scope (MVP → then)
1. NestJS controllers (`@Controller`, `@Get/@Post/@Patch/@Put/@Delete`, `@Param`). [first]
2. Next.js route handlers (app-router `route.ts` exported GET/POST…; pages `api/**` handlers). [next]
3. Express/Fastify routers. [later]
Optional `--llm` re-rank pass, off by default (BYO key). [later]

## Pipeline (static, ts-morph)
1. **Extract handlers** — per framework: handler fn, HTTP method, route path + path params.
2. **Resource key** — signals that say "what this handler acts on": DB model/repo touched
   (`prisma.<model>`, `<Repo>.find…`, `this.<svc>`), path param name (`:id`), controller/file.
3. **Guard signals** — in the handler (and its decorators): authorization decorators
   (`@Permissions`, `@UseGuards`, `@Roles`), guard calls (`/verify.*Access|assert|can[A-Z]|check.*Perm|ensure.*Owner|authorize|\.assert\(/`),
   or a query scoped to the caller (`where: { … userId|teamId|ownerId|workspaceId … }`).
4. **Flag the gap** — group handlers by resource key; a handler is a candidate when ≥1 sibling in its
   group has a guard and it has none. Score: % of siblings guarded, mutation vs read, directness of id.
5. **Report** — pretty table + `--json` (+ SARIF later). file:line, the guarding sibling, confidence.

## Confidence
- high: ≥2 siblings guarded, same model, this one is a mutation or returns the object.
- medium: 1 sibling guarded / mixed signals.
- low: weak resource match.
`--min-confidence`, and `// idorbite-ignore` suppression comments.

## Layout
- `src/types.ts` — Handler, GuardSignal, Finding.
- `src/guards.ts` — guard detection over a function/decorators.
- `src/extract/nest.ts`, `src/extract/next.ts` — framework handler extractors.
- `src/resource.ts` — resource-key signals.
- `src/analyze.ts` — grouping + flagging + scoring.
- `src/report.ts` — pretty/json output.
- `src/cli.ts` — commander entry (`bin: idorbite`).
- `test/` — vitest + fixtures modeled on the real bugs.

## Success check
Run it against a fixture modeled on the Immich/Rocket.Chat/Teable shape and it flags the unguarded
sibling with high confidence, and does NOT flag a control group where every handler guards.
