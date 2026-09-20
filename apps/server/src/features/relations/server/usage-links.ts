import {
  type UsageLink,
  type UsageLinksAccess,
  usageLinkPayloadSchema,
  usageLinkSchema,
} from "@cantiara/api/relations";

function copyUsageLink(link: UsageLink): UsageLink {
  return structuredClone(link);
}

/**
 * Relations seam test double. It stores only source identity, surface
 * identity, kind, and optional positional metadata; it cannot write source
 * lifecycle state because that state is not part of the interface.
 */
export function createInMemoryUsageLinks(): UsageLinksAccess {
  const links = new Map<string, { accountId: string; link: UsageLink }>();

  return {
    create(accountId, input) {
      const parsed = usageLinkPayloadSchema.parse(input);
      const link = usageLinkSchema.parse({
        ...parsed,
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        revision: 1,
      });
      links.set(link.id, { accountId, link });
      return Promise.resolve(copyUsageLink(link));
    },

    find(accountId, usageLinkId) {
      const record = links.get(usageLinkId);
      return Promise.resolve(
        record?.accountId === accountId ? copyUsageLink(record.link) : null,
      );
    },

    listBySource(accountId, source) {
      const matchingLinks = [...links.values()]
        .filter(
          (record) =>
            record.accountId === accountId &&
            record.link.source.recordId === source.recordId &&
            record.link.source.recordType === source.recordType,
        )
        .map(({ link }) => copyUsageLink(link));
      return Promise.resolve(matchingLinks);
    },

    unlink(accountId, usageLinkId) {
      const record = links.get(usageLinkId);
      if (record?.accountId !== accountId) {
        return Promise.resolve(false);
      }
      links.delete(usageLinkId);
      return Promise.resolve(true);
    },
  };
}
