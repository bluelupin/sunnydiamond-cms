import type { Core } from '@strapi/strapi';

export type SmsNotificationType = 'careerApplicationReceived' | 'appointmentRequestReceived' | 'enquiryReceived' | 'serviceEnquiryReceived';
export interface SmsConfig {
  enabled: boolean; authKey: string; senderId: string; requestTimeoutMs?: number;
  batchSize?: number; maxAttempts?: number; retryDelaySeconds?: number;
  templates: Partial<Record<SmsNotificationType, string>>;
}
export const smsConfig = (strapi: Core.Strapi) => strapi.config.get<SmsConfig>('sms');

/** Bare Indian mobile numbers use +91; other countries require an explicit + prefix. */
export function normalizeSmsPhone(value: string): string | undefined {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value.trim())) return undefined;
  const raw = value.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    if (digits.startsWith('91')) return /^91[6-9]\d{9}$/.test(digits) ? digits : undefined;
    return /^[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
  }
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : undefined;
}

export function smsReadiness(config: SmsConfig, type: SmsNotificationType) {
  if (!config?.enabled) return 'disabled' as const;
  if (!config.authKey?.trim() || !config.senderId?.trim() || !config.templates?.[type]?.trim()) {
    return 'not-configured' as const;
  }
  return undefined;
}

export type SmsSendResult =
  | { status: 'skipped'; reason: 'disabled' | 'not-configured' }
  | { status: 'rejected'; reason: 'invalid-recipient' | 'invalid-variables' | 'provider-rejected'; httpStatus?: number }
  | { status: 'unknown'; reason: 'transport-error' | 'unexpected-response'; httpStatus?: number }
  | { status: 'accepted'; providerMessageId: string };

/** One attempt only. Never infer delivery or automatically retry an ambiguous result. */
export async function sendSms(strapi: Core.Strapi, input: {
  notificationType: SmsNotificationType; recipient: string; variables?: Record<string, string>; templateId?: string;
}, request: typeof fetch = fetch): Promise<SmsSendResult> {
  const config = smsConfig(strapi);
  const templateId = input.templateId?.trim() || config?.templates?.[input.notificationType]?.trim();
  const reason = smsReadiness({ ...config, templates: { [input.notificationType]: templateId } }, input.notificationType);
  if (reason) return { status: 'skipped', reason };
  const mobile = normalizeSmsPhone(input.recipient);
  if (!mobile) return { status: 'rejected', reason: 'invalid-recipient' };
  if (Object.entries(input.variables ?? {}).some(([key, value]) =>
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || key === 'mobiles' || typeof value !== 'string')) {
    return { status: 'rejected', reason: 'invalid-variables' };
  }
  const timeout = config.requestTimeoutMs;
  try {
    const response = await request('https://api.msg91.com/api/v5/flow/', {
      method: 'POST', redirect: 'error',
      headers: { authkey: config.authKey.trim(), 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ flow_id: templateId,
        sender: config.senderId.trim(), recipients: [{ ...input.variables, mobiles: mobile }] }),
      signal: AbortSignal.timeout(Number.isSafeInteger(timeout) && timeout > 0 ? timeout : 10000),
    });
    let result: any;
    try { result = await response.json(); } catch {
      return { status: 'unknown', reason: 'unexpected-response', httpStatus: response.status };
    }
    if (response.ok && result?.type === 'success' && typeof result.message === 'string' && result.message.trim()) {
      return { status: 'accepted', providerMessageId: result.message.trim() };
    }
    if (result?.type === 'error') return { status: 'rejected', reason: 'provider-rejected', httpStatus: response.status };
    return { status: 'unknown', reason: 'unexpected-response', httpStatus: response.status };
  } catch {
    // Do not expose credentials, phone numbers, or raw provider errors.
    return { status: 'unknown', reason: 'transport-error' };
  }
}
