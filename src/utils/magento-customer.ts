const DEFAULT_TIMEOUT_MS = 5000;

export type MagentoCustomer = {
  id: number;
  email?: string;
  firstname?: string;
  lastname?: string;
};

export class MagentoCustomerUnauthorizedError extends Error {}

export class MagentoCustomerUnavailableError extends Error {
  status = 503;

  constructor(message: string) {
    super(message);
    this.name = 'MagentoCustomerUnavailableError';
  }
}

export const bearerToken = (authorization: unknown) => {
  if (typeof authorization !== 'string') return undefined;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  return token || undefined;
};

const requestTimeout = () => {
  const configured = Number(process.env.MAGENTO_CUSTOMER_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
};

export const resolveMagentoCustomer = async (token: string): Promise<MagentoCustomer> => {
  const configuredBaseUrl = process.env.MAGENTO_BASE_URL?.trim();
  if (!configuredBaseUrl) {
    throw new MagentoCustomerUnavailableError('MAGENTO_BASE_URL is not configured.');
  }

  const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
  const storeCode = encodeURIComponent(process.env.MAGENTO_STORE_CODE?.trim() || 'default');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/${storeCode}/V1/customers/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(requestTimeout()),
    });
  } catch {
    throw new MagentoCustomerUnavailableError('Magento customer service is unavailable.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new MagentoCustomerUnauthorizedError('Invalid or expired Magento customer token.');
  }

  if (!response.ok) {
    throw new MagentoCustomerUnavailableError(
      `Magento customer lookup failed with status ${response.status}.`
    );
  }

  let customer: unknown;
  try {
    customer = await response.json();
  } catch {
    throw new MagentoCustomerUnavailableError('Magento returned an invalid customer response.');
  }

  const id = (customer as MagentoCustomer | null)?.id;
  if (!Number.isInteger(id) || id <= 0) {
    throw new MagentoCustomerUnavailableError('Magento returned an invalid customer ID.');
  }

  return customer as MagentoCustomer;
};
