import { GENERIC_APPOINTMENT_UID, genericAppointmentView } from './generic-appointments';
import { GROUPED_APPOINTMENT_FORM_TAGS } from './home-trial-group-key';
import { countScheduleChanges, MAX_RESCHEDULES } from './appointment-schedule';
import { productVariantSnapshot, productVariantKey } from './product-variant-details';

const GROUP = 'api::appointment-group.appointment-group';
const PRODUCT = 'api::product-submission.product-submission';
const CHANGE = 'api::appointment-change.appointment-change';
const fields = ['documentId', 'appointmentReference', 'formTag', 'productName', 'productId', 'productSku', 'metalColour', 'metalPurity', 'customerName',
  'customerPhone', 'customerEmail', 'requestedDate', 'requestDetails', 'purposeOfVisit', 'selectedTimeSlot',
  'workflowStatus', 'addressLine1', 'addressLine2', 'pincode', 'city', 'createdAt', 'updatedAt'];
const populate = {
  state: { select: ['documentId', 'name', 'code'] },
  preferredShowroom: { select: ['documentId', 'slug', 'city', 'state'] },
};

export async function listCustomerAppointments(strapi: any, options: any) {
  if (!options.formTags.includes('book-an-appointment')) return listProductAppointments(strapi, options);
  const { page, pageSize, customerId, locale } = options;
  const prefix = page * pageSize;
  const where = { formTag: 'book-an-appointment', magentoCustomerId: customerId };
  const [products, genericRows, count] = await Promise.all([
    listProductAppointments(strapi, { ...options, page: 1, pageSize: prefix, formTags: options.formTags.filter((tag: string) => tag !== 'book-an-appointment') }),
    strapi.db.query(GENERIC_APPOINTMENT_UID).findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], limit: prefix,
      populate: { preferredShowroom: { select: ['documentId', 'slug', 'city', 'state'] },
        appointmentChanges: { select: ['eventType', 'changedAt', 'previousData', 'newData', 'actorType'] } } }),
    strapi.db.query(GENERIC_APPOINTMENT_UID).count({ where }),
  ]);
  const generic = await Promise.all(genericRows.map(async (row: any) => {
    const view = genericAppointmentView(row);
    if (locale && view.preferredShowroom?.documentId) view.preferredShowroom = await strapi.documents('api::showroom.showroom').findOne({
      documentId: view.preferredShowroom.documentId, status: 'published', locale, fields: ['documentId', 'slug', 'city', 'state'],
    }) ?? view.preferredShowroom;
    if (view.workflowStatus === 'Cancelled') view.cancelledAt = (row.appointmentChanges ?? [])
      .filter((change: any) => change.eventType === 'Cancelled').sort((a: any, b: any) => Date.parse(b.changedAt) - Date.parse(a.changedAt))[0]?.changedAt ?? view.cancelledAt;
    return view;
  }));
  const total = products.meta.pagination.total + count;
  const data = [...products.data, ...generic].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice((page - 1) * pageSize, prefix);
  return { data, meta: { pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } } };
}

async function listProductAppointments(strapi: any, options: any) {
  const { customerId, page, pageSize, locale, formTags } = options;
  const productScope = { magentoCustomerId: customerId, formTag: { $in: formTags } };
  const groupWhere = { magentoCustomerId: customerId, mergedInto: { $null: true },
    submissions: { magentoCustomerId: customerId, formTag: { $in: formTags.filter((tag: string) => GROUPED_APPOINTMENT_FORM_TAGS.includes(tag)) } } };
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
  const [groups, products, groupChanges, cancellations] = await Promise.all([
    selectedGroupIds.length ? strapi.db.query(GROUP).findMany({
      where: { ...groupWhere, documentId: { $in: selectedGroupIds } },
      select: ['documentId', 'appointmentReference', 'requestedDate', 'selectedTimeSlot', 'workflowStatus',
        'addressLine1', 'addressLine2', 'city', 'pincode', 'createdAt', 'updatedAt', 'priorRescheduleCount'],
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
    units.length ? strapi.db.query(CHANGE).findMany({
      where: { eventType: 'Cancelled', $or: [
        { sourceGroup: { documentId: { $in: selectedGroupIds } } },
        { affectedSubmissions: { documentId: { $in: selectedLegacyIds } } },
      ] },
      select: ['changedAt'],
      populate: { sourceGroup: { select: ['documentId'] }, affectedSubmissions: { select: ['documentId'] } },
      orderBy: { changedAt: 'desc' },
    }) : [],
  ]);
  const rescheduleDetails = (entries: unknown, priorCount = 0) => {
    const rescheduleCount = priorCount + countScheduleChanges(entries);
    return { rescheduleCount, reschedulesLeft: Math.max(0, MAX_RESCHEDULES - rescheduleCount) };
  };
  const cancellationDetails = (appointment: any, grouped: boolean, history?: unknown) => {
    if (appointment.workflowStatus !== 'Cancelled') return {};
    const change = cancellations.find((entry: any) => grouped
      ? entry.sourceGroup?.documentId === appointment.documentId
      : entry.affectedSubmissions?.some((submission: any) => submission.documentId === appointment.documentId));
    const historicalCancellation = (Array.isArray(history) ? history : [])
      .filter((entry: any) => entry?.eventType === 'Cancelled')
      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0];
    return { cancelledAt: change?.changedAt ?? historicalCancellation?.changedAt ?? null };
  };
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
        ...members[0], documentId: `${members[0].documentId}:piece:${productVariantKey(piece)}`,
        productId: piece.productId, productName: piece.productName ?? null,
        ...productVariantSnapshot(piece),
      }));
      return [{ ...members[0], appointmentId: members[0].appointmentReference ?? members[0].documentId,
        appointmentGroupId: null, products: [...members, ...added], ...rescheduleDetails(matched[0].history),
        ...cancellationDetails(members[0], false, matched[0].history) }];
    }
    const group = groups.find((row: any) => row.documentId === unit.documentId);
    if (!group) return [];
    const added = matched.flatMap(product => product.pieces.filter((piece: any) => piece?.productId).map((piece: any) => ({
      ...product.safe, documentId: `${product.safe.documentId}:piece:${productVariantKey(piece)}`,
      productId: piece.productId, productName: piece.productName ?? null,
      ...productVariantSnapshot(piece),
    })));
    const { priorRescheduleCount, ...safeGroup } = group;
    return [{ ...members[0], ...safeGroup, documentId: members[0].documentId,
      appointmentId: group.appointmentReference ?? group.documentId,
      appointmentGroupId: group.documentId, products: [...members, ...added],
      ...cancellationDetails(group, true),
      ...rescheduleDetails(groupChanges.filter((change: any) => change.sourceGroup?.documentId === group.documentId), priorRescheduleCount ?? 0) }];
  });
  const total = groupCount + legacyCount;
  return { data, meta: { pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } } };
}
