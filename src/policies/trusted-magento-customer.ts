import { errors } from '@strapi/utils';
import { normalizeAppointmentPhone } from '../utils/normalize-appointment-phone';

/** Customer identity asserted by the authenticated website server. */
export default async (ctx: any, config: { allowGuestFormTags?: string[]; acceptVerifiedEmail?: boolean; acceptVerifiedPhone?: boolean } = {}) => {
  if (ctx.state.auth?.strategy?.name !== 'content-api-token') {
    throw new errors.UnauthorizedError('A CMS API token is required.');
  }
  let input = ctx.request.body ?? {};
  if (typeof input.data === 'string') {
    try { input = JSON.parse(input.data); }
    catch { throw new errors.ValidationError('data must contain valid JSON.'); }
  } else if (input.data && typeof input.data === 'object') {
    input = input.data;
  }
  const value = ctx.request.method === 'GET'
    ? ctx.request.query?.magentoCustomerId
    : input?.magentoCustomerId;
  if (ctx.request.method === 'POST' && typeof input?.formTag === 'string' &&
    config.allowGuestFormTags?.includes(input.formTag.trim()) &&
    (value === undefined || value === null || value === '')) {
    ctx.state.magentoCustomer = undefined;
    return true;
  }
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new errors.ValidationError('magentoCustomerId must be a positive integer verified by the website server.');
  }
  const rawEmail = config.acceptVerifiedEmail ? ctx.request.query?.magentoCustomerEmail : undefined;
  let email: string | undefined;
  if (rawEmail !== undefined) {
    if (typeof rawEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())) {
      throw new errors.ValidationError('magentoCustomerEmail must be a verified email supplied by the website server.');
    }
    email = rawEmail.trim().toLowerCase();
  }
  // Only configured routes may trust phone ownership asserted by the website server.
  const rawPhone = config.acceptVerifiedPhone
    ? (ctx.request.method === 'GET' ? ctx.request.query?.magentoCustomerPhone : input?.magentoCustomerPhone)
    : undefined;
  let phone: string | undefined;
  if (rawPhone !== undefined) {
    phone = normalizeAppointmentPhone(rawPhone);
    if (!phone) {
      throw new errors.ValidationError('magentoCustomerPhone must be a valid verified phone supplied by the website server.');
    }
  }
  ctx.state.magentoCustomer = { id: Number(value), ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
  return true;
};
