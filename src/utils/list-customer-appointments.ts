import { HOME_TRIAL_FORM_TAGS } from './home-trial-group-key';
import { countScheduleChanges, MAX_RESCHEDULES } from './appointment-schedule';

const GROUP = 'api::appointment-group.appointment-group';
const PRODUCT = 'api::product-submission.product-submission';
const CHANGE = 'api::appointment-change.appointment-change';
const fields = ['documentId', 'appointmentReference', 'formTag', 'productName', 'productId', 'customerName',
  'customerPhone', 'customerEmail', 'requestedDate', 'requestDetails', 'selectedTimeSlot',
  'workflowStatus', 'addressLine1', 'addressLine2', 'pincode', 'city', 'createdAt', 'updatedAt'];
const populate = {
  state: { select: ['documentId', 'name', 'code'] },
  preferredShowroom: { select: ['documentId', 'slug', 'city', 'state'] },
};

export async function listCustomerAppointments(strapi: any, options: any) {
  const { customerId, page, pageSize, locale, formTags } = options;
  const productScope = { magentoCustomerId: customerId, formTag: { $in: formTags } };
  const groupWhere = { magentoCustomerId: customerId, mergedInto: { $null: true },
    submissions: { magentoCustomerId: customerId, formTag: { $in: HOME_TRIAL_FORM_TAGS } } };
  // Until the explicit migration, historical rows remain individual appointments.
  const legacyWhere = { ...productScope,
    appointmentGroup: { $null: true } };
  const prefix = page * pageSize;
  const [groupIds, legacyIds, groupCount, legacyCount] = await Promise.all([
    strapi.db.query(GROUP).findMany({ where: groupWhere, select: ['id', 'documentId', 'createdAt'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], limit: prefix }),
    strapi.db.query(PRODUCT).findMany({ where: legacyWhere, select: ['id', 'documentId', 'createdAt'],
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], limit: prefix }),
    strapi.db.query(GROUP).count({ where: groupWhere }),
    strapi.db.query(PRODUCT).count({ where: legacyWhere }),
  ]);
  // Merge two bounded ID-only prefixes, paginate appointment identities, then load products.
  const units = [...groupIds.map((row: any) => ({ ...row, grouped: true })),
    ...legacyIds.map((row: any) => ({ ...row, grouped: false }))]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      || b.id - a.id || Number(b.grouped) - Number(a.grouped))
    .slice((page - 1) * pageSize, prefix);
  const selectedGroupIds = units.filter(row => row.grouped).map(row => row.documentId);
  const selectedLegacyIds = units.filter(row => !row.grouped).map(row => row.documentId);
  const [groups, products, groupChanges] = await Promise.all([
    selectedGroupIds.length ? strapi.db.query(GROUP).findMany({
      where: { ...groupWhere, documentId: { $in: selectedGroupIds } },
      select: ['documentId', 'appointmentReference', 'requestedDate', 'selectedTimeSlot', 'workflowStatus',
        'addressLine1', 'addressLine2', 'city', 'pincode', 'createdAt', 'updatedAt'],
      populate: { state: populate.state },
    }) : [],
    units.length ? strapi.db.query(PRODUCT).findMany({
      where: { ...productScope, $or: [
        { appointmentGroup: { documentId: { $in: selectedGroupIds } } },
        { documentId: { $in: selectedLegacyIds }, appointmentGroup: { $null: true } },
      ] }, select: [...fields, 'rescheduleHistory', 'addedPieces'],
      populate: { ...populate, appointmentGroup: { select: ['documentId'] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }) : [],
    selectedGroupIds.length ? strapi.db.query(CHANGE).findMany({
      where: { sourceGroup: { documentId: { $in: selectedGroupIds } }, eventType: 'Rescheduled',
        actorType: { $in: ['Customer', 'Migration'] } },
      select: ['previousData', 'newData'], populate: { sourceGroup: { select: ['documentId'] } },
    }) : [],
  ]);
  const reschedulesLeft = (entries: unknown) => Math.max(0, MAX_RESCHEDULES - countScheduleChanges(entries));
  const localizedProducts = await Promise.all(products.map(async (product: any) => {
    const { appointmentGroup } = product;
    const safe: any = Object.fromEntries(fields.map(field => [field, product[field]]));
    safe.state = product.state;
    safe.preferredShowroom = product.preferredShowroom;
    const showroomId = safe.preferredShowroom?.documentId;
    if (showroomId && locale) {
      safe.preferredShowroom = await strapi.documents('api::showroom.showroom').findOne({
        documentId: showroomId, status: 'published', locale,
        fields: ['documentId', 'slug', 'city', 'state'],
      }) ?? safe.preferredShowroom;
    }
    return { safe, groupId: appointmentGroup?.documentId, history: product.rescheduleHistory,
      pieces: Array.isArray(product.addedPieces) ? product.addedPieces : [] };
  }));
  const data = units.flatMap(unit => {
    const matched = localizedProducts.filter(product => unit.grouped
      ? product.groupId === unit.documentId : product.safe.documentId === unit.documentId);
    const members = matched.map(product => product.safe);
    if (!members.length) return [];
    if (!unit.grouped) {
      // Pieces added after booking (R-AP-8) are listed like the booked product.
      const added = matched[0].pieces.filter((piece: any) => piece?.productId).map((piece: any) => ({
        ...members[0], documentId: `${members[0].documentId}:piece:${piece.productId}`,
        productId: piece.productId, productName: piece.productName ?? null,
      }));
      return [{ ...members[0], appointmentId: members[0].appointmentReference ?? members[0].documentId,
        appointmentGroupId: null, products: [...members, ...added], reschedulesLeft: reschedulesLeft(matched[0].history) }];
    }
    const group = groups.find((row: any) => row.documentId === unit.documentId);
    if (!group) return [];
    return [{ ...members[0], ...group, documentId: members[0].documentId,
      appointmentId: group.appointmentReference ?? group.documentId,
      appointmentGroupId: group.documentId, products: members,
      reschedulesLeft: reschedulesLeft(groupChanges.filter((change: any) => change.sourceGroup?.documentId === group.documentId)) }];
  });
  const total = groupCount + legacyCount;
  return { data, meta: { pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } } };
}
