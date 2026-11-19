// Minimal client for the ServiceNow pull API of the PoC. Credentials come from environment variables only.

const TIMEOUT_MS = 15000;
const RITM = /^RITM\d{7}$/;
const STATUSES = new Set(['provisioning', 'pr_open', 'done', 'failed']);

/** Read and validate connection settings from the environment; never logs secrets. */
export function loadConfig(env = process.env) {
  const { SN_INSTANCE, SN_API_PATH, SN_USER, SN_PASSWORD } = env;
  if (!/^https:\/\/[a-z0-9-]+\.service-now\.com$/.test(SN_INSTANCE || '')) {
    throw new Error('SN_INSTANCE must look like https://<name>.service-now.com');
  }
  if (!/^\/api\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+$/.test(SN_API_PATH || '')) throw new Error('SN_API_PATH is invalid');
  if (!SN_USER || !SN_PASSWORD) throw new Error('SN_USER and SN_PASSWORD are required');
  const token = Buffer.from(`${SN_USER}:${SN_PASSWORD}`).toString('base64');
  return { base: SN_INSTANCE + SN_API_PATH, auth: `Basic ${token}` };
}

/** Call the ServiceNow API and return its "result"; errors carry only method, path and HTTP status. */
export async function call(config, method, path, body) {
  const res = await fetch(config.base + path, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: config.auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ServiceNow ${method} ${path} failed with HTTP ${res.status}`);
  const data = await res.json();
  return data.result;
}

/** Return the approved requests that are waiting for GitHub. */
export async function getPending(config) {
  const result = await call(config, 'GET', '/pending');
  return Array.isArray(result?.items) ? result.items : [];
}

/** Claim one request so that no other run processes it. */
export async function claim(config, number) {
  if (!RITM.test(number)) throw new Error('invalid request number');
  return call(config, 'POST', `/claim/${number}`, {});
}

/** Report a status (provisioning, pr_open, done, failed) with an optional message and PR link. */
export async function reportStatus(config, number, status, message = '', prUrl = '') {
  if (!RITM.test(number)) throw new Error('invalid request number');
  if (!STATUSES.has(status)) throw new Error('invalid status');
  return call(config, 'POST', `/status/${number}`, { status, message: String(message).slice(0, 500), pr_url: prUrl });
}
