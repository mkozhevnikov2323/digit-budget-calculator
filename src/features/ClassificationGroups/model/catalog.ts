import { readCatalogPage, type Catalog } from './contract';
/** All pages or failure; never a first-page-only catalog. */
export const loadCatalog = async (
  read: (path: string) => Promise<unknown>,
  current: () => boolean,
): Promise<Catalog> => {
  const groups: Catalog['groups'] = [],
    seen = new Set<string>();
  let after: string | null = null,
    first: Catalog | null = null,
    pages = 0;
  do {
    if (!current()) throw Error('GROUP_READ_RETIRED');
    const raw = await read(
      `/classification-groups?limit=100${after ? '&after=' + after : ''}`,
    );
    if (!current()) throw Error('GROUP_READ_RETIRED');
    const p = readCatalogPage(raw);
    if (
      !p ||
      (first &&
        (p.initialized !== first.initialized ||
          JSON.stringify(p.systemDefinitions) !==
            JSON.stringify(first.systemDefinitions)))
    )
      throw Error('GROUP_CATALOG_INVALID');
    first ??= p;
    for (const g of p.groups) {
      if (seen.has(g.groupId)) throw Error('GROUP_CATALOG_INVALID');
      seen.add(g.groupId);
      groups.push(g);
    }
    if (
      (p.nextCursor &&
        (p.groups.length !== 100 ||
          (after !== null && p.nextCursor <= after))) ||
      ++pages > 1000
    )
      throw Error('GROUP_CATALOG_INVALID');
    after = p.nextCursor;
  } while (after);
  return {
    groups,
    initialized: first!.initialized,
    systemDefinitions: first!.systemDefinitions,
  };
};
