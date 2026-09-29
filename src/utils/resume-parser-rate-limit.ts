import { createHash } from 'node:crypto';
import { createClient } from 'redis';

const DEFAULT_PREFIX = 'sunnydiamond:resume-rate-limit:v1';
const TIMEOUT_MS = 2_000;
type CounterClient = { eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown> };
const createRateLimitClient = () => createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  RESP: 2,
  disableOfflineQueue: true,
  socket: { connectTimeout: TIMEOUT_MS, reconnectStrategy: false },
});
type Client = ReturnType<typeof createRateLimitClient>;
let redis: Client | undefined;
let connecting: Promise<Client> | undefined;

// One atomic operation: initialize the fixed window, admit up to the limit,
// and return Redis's remaining TTL. Denied requests never extend the window.
export const RESUME_RATE_LIMIT_SCRIPT = `
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('SET', KEYS[1], 1, 'PX', ARGV[2])
  return {1, tonumber(ARGV[2])}
end
local count = tonumber(redis.call('GET', KEYS[1]))
if count >= tonumber(ARGV[1]) then
  return {0, ttl}
end
redis.call('INCR', KEYS[1])
return {1, ttl}
`;

const positiveInteger = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

async function bounded<T>(operation: Promise<T>, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error('Redis rate limit timed out.'));
      }, TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer!); }
}

function destroyClient(client: Client) {
  if (redis === client) redis = undefined;
  if (client.isOpen) client.destroy();
}

async function rateLimitRedis(): Promise<Client> {
  if (redis?.isReady) return redis;
  if (connecting) return connecting;
  const client = createRateLimitClient();
  redis = client;
  // node-redis requires an error listener. The admission middleware reports
  // failed requests with a stable message, without logging credentials or IPs.
  client.on('error', () => {});
  connecting = bounded(client.connect(), () => destroyClient(client))
    .then(() => client)
    .catch(error => { destroyClient(client); throw error; })
    .finally(() => { connecting = undefined; });
  return connecting;
}

export function closeResumeRateLimitRedis() {
  if (redis) destroyClient(redis);
}

export function resumeRateLimitKey(keyParts: Array<string | undefined>, prefix = process.env.RESUME_RATE_LIMIT_REDIS_PREFIX || DEFAULT_PREFIX) {
  // Keep client IPs out of readable Redis keys; JSON avoids delimiter collisions.
  const identity = JSON.stringify(keyParts.map(part => part || 'unknown'));
  return `${prefix}:${createHash('sha256').update(identity).digest('hex')}`;
}

export async function checkResumeParserRateLimit(keyParts: Array<string | undefined>, client?: CounterClient, prefix?: string) {
  const counter = client ?? await rateLimitRedis();
  const result = await bounded(counter.eval(RESUME_RATE_LIMIT_SCRIPT, {
    keys: [resumeRateLimitKey(keyParts, prefix)],
    arguments: [
      String(positiveInteger(process.env.FORM_SUBMISSION_RATE_LIMIT_MAX, 5)),
      String(positiveInteger(process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000)),
    ],
  }), () => { if (counter === redis) destroyClient(redis); });
  if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0])
    || !Number.isFinite(result[1]) || result[1] < 0) {
    throw new Error('Invalid Redis rate limit response.');
  }
  return { allowed: result[0] === 1,
    retryAfterSeconds: result[0] === 1 ? 0 : Math.max(1, Math.ceil(result[1] / 1000)) };
}
