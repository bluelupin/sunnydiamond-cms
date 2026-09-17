import { errors } from '@strapi/utils';
import {
  bearerToken,
  MagentoCustomerUnauthorizedError,
  resolveMagentoCustomer,
} from '../utils/magento-customer';

const { UnauthorizedError } = errors;

export default async (policyContext: any, config: { tokenHeader?: string }, { strapi }: any) => {
  const customerToken = config?.tokenHeader
    ? policyContext.request.headers[config.tokenHeader.toLowerCase()]
    : undefined;
  const token = config?.tokenHeader
    ? (typeof customerToken === 'string' ? customerToken.trim() : undefined)
    : bearerToken(policyContext.request.headers.authorization);
  if (!token) {
    throw new UnauthorizedError('Magento customer token is required.');
  }

  try {
    policyContext.state.magentoCustomer = await resolveMagentoCustomer(token);
    return true;
  } catch (error) {
    if (error instanceof MagentoCustomerUnauthorizedError) {
      throw new UnauthorizedError(error.message);
    }

    strapi.log.error(
      `Magento customer authentication failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );

    if (error instanceof Error) {
      throw error;
    }

    const unavailableError = new Error('Customer authentication is temporarily unavailable.');
    (unavailableError as Error & { status: number }).status = 503;
    throw unavailableError;
  }
};
