import type { Core } from '@strapi/strapi';

type AdminPermission = {
  id: number;
  action?: string | null;
  subject?: string | null;
};

/**
 * Removes Content Manager permissions whose content type no longer exists.
 *
 * Strapi's admin homepage assumes every permitted subject resolves to a
 * registered content type. A permission left behind after deleting/renaming a
 * content type otherwise crashes the "recent documents" request.
 */
export async function cleanStaleAdminPermissions(strapi: Core.Strapi) {
  const permissionQuery = strapi.db.query('admin::permission');
  const permissions = (await permissionQuery.findMany({
    select: ['id', 'action', 'subject'],
    where: {
      action: {
        $startsWith: 'plugin::content-manager.',
      },
      subject: {
        $notNull: true,
      },
    },
  })) as AdminPermission[];

  const stalePermissions = permissions.filter(
    ({ subject }) =>
      subject && !Object.prototype.hasOwnProperty.call(strapi.contentTypes, subject),
  );

  if (stalePermissions.length === 0) {
    return;
  }

  for (const { id } of stalePermissions) {
    await permissionQuery.delete({ where: { id } });
  }

  const subjects = [...new Set(stalePermissions.map(({ subject }) => subject))];
  strapi.log.warn(
    `Removed ${stalePermissions.length} stale admin permission(s): ${subjects.join(', ')}`,
  );
}
