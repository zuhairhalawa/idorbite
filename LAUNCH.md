# idorbite — launch copy (for you to post)

Repo: https://github.com/zuhairhalawa/idorbite  ·  Install: `npx idorbite ./src`

Honest framing throughout — it's a heuristic ranker, not a prover. Don't overclaim; the credibility is the selling point.

---

## Show HN (title + body)

**Title:** Show HN: idorbite – find IDOR/BOLA by spotting handlers missing the check their siblings have

**Body:**

The most common access-control bug I keep seeing in real codebases isn't exotic — it's one route handler that queries a resource *without* the ownership/tenant scope that every other handler on that same resource applies. One endpoint forgets `where: { teamId }` while its siblings all have it.

idorbite is a small static scanner (TypeScript, ts-morph, no API key, fully offline) that finds exactly that shape in NestJS and Next.js App Router backends. It groups handlers by the DB model they touch and flags the ones with no object-level guard when their siblings have one.

The key trick: authentication wrappers like `withTeamApi()` or `@UseGuards(AuthGuard)` don't clear a handler — the handler is authenticated, it just never checks the object belongs to you. idorbite keys on the *object-scope* signal (`where { teamId }`, `verifyOwnership()`, a tenant-scoped fetch), not on authentication, so it catches that gap.

I built it after finding this class of bug by hand in several well-known OSS apps, then dogfooded it on ~8 real codebases (Dub, Ghostfolio, Postiz, Cal.com, …) to beat down false positives — it now sits at 0–1 high-confidence findings on clean code.

It's a ranker, not a prover: no taint analysis, it won't catch gaps hidden in a service layer, and it never claims a vulnerability — it tells you which sibling guards and how, highest confidence first. Suppress a reviewed FP with `// idorbite-ignore`.

`npx idorbite ./src` · MIT · feedback welcome, especially on false positives.

---

## r/netsec / r/bugbounty (title + body)

**Title:** idorbite: open-source static scanner for broken object-level authorization (IDOR/BOLA) in JS/TS backends

**Body:**

BOLA/IDOR is OWASP API #1, and in practice it usually looks like one handler that forgot the tenant/owner scope its siblings apply. idorbite is a free, offline (no API key) CLI that finds that pattern in NestJS + Next.js App Router code:

- groups route handlers by the DB model they touch,
- detects the object-scope guard in each (`where {teamId}`, `verifyOwnership()`, ownership-fetch helpers, role/permission decorators),
- flags handlers that lack it while siblings have it, with confidence tiers.

It deliberately ignores authentication wrappers (`withTeamApi`, `@UseGuards`) because those are the exact reason real IDORs ship — authenticated but not object-scoped.

Tuned on ~8 real codebases to keep false positives low (0–1 high on clean apps). It's a lead generator, not a proof — pair it with manual review. Repo + examples: https://github.com/zuhairhalawa/idorbite

---

## One-line for X/LinkedIn

Built **idorbite** 🦈 — a free static scanner that finds IDOR/BOLA in NestJS & Next.js by catching handlers that forgot the authorization check their siblings have. `npx idorbite ./src` → github.com/zuhairhalawa/idorbite
