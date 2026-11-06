import { Node } from 'ts-morph';

/**
 * Extract "resource key" signals from a handler body: the DB models / repositories / services it
 * touches. These let us group handlers that act on the same resource so we can compare their guards.
 */
export function extractResourceKeys(body: Node | undefined): string[] {
  const keys = new Set<string>();
  if (!body) return [];

  body.forEachDescendant((node) => {
    if (!Node.isPropertyAccessExpression(node)) return;
    const objText = node.getExpression().getText();
    const prop = node.getName();

    // prisma.<model>.<method>  or  this.prisma.<model>...  ($transaction/$queryRaw etc. are not models)
    if ((/(^|\.)prisma$/.test(objText) || objText === 'db' || objText === 'tx') && !prop.startsWith('$')) {
      keys.add(norm(prop));
    }
    // this.xxxService / this.xxxRepository / this.xxxModel  -> resource "xxx"
    if (/^this$/.test(objText) && /(Service|Repository|Repo|Model|Store)$/.test(prop)) {
      keys.add(norm(prop.replace(/(Service|Repository|Repo|Model|Store)$/, '')));
    }
    // SomethingModel.find / SomethingRepository.find (static-ish)
    if (/^[A-Z]\w*(Model|Repository|Repo)$/.test(objText)) {
      keys.add(norm(objText.replace(/(Model|Repository|Repo)$/, '')));
    }
  });

  return [...keys].filter((k) => k.length > 1);
}

/** Normalize a model/resource token: lowercase, strip trailing plural 's', drop separators. */
export function norm(s: string): string {
  return s.replace(/[_-]/g, '').replace(/s$/i, '').toLowerCase();
}
