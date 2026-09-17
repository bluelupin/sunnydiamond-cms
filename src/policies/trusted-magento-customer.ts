import { errors } from '@strapi/utils';

/** Customer identity asserted by the authenticated website server. */
export default async (ctx: any) => {
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
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new errors.ValidationError('magentoCustomerId must be a positive integer verified by the website server.');
  }
  ctx.state.magentoCustomer = { id: Number(value) };
  return true;
};
