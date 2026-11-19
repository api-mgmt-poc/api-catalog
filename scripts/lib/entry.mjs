// Validation and construction of catalog entries (apis/<api_name>.json). No external dependencies.

const KEYS = ['servicenow_ritm', 'api_name', 'owner_group', 'data_class', 'backend_url_dev', 'backend_url_prod', 'description'];
const PATTERNS = {
  servicenow_ritm: /^RITM\d{7}$/,
  api_name: /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/,
  owner_group: /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/,
};
const DATA_CLASSES = new Set(['internal', 'confidential']);
const PRINTABLE = /^[^\u0000-\u001f\u007f]{1,500}$/;
// Names that would collide with the platform's own repositories (api-<name>) or team.
const RESERVED_API_NAMES = new Set(['catalog', 'template', 'platform']);
const RESERVED_GROUPS = new Set(['platform-team']);
// DNS host name with a public-looking TLD; rejects IP literals, single labels and *.localhost.
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Return true if value is an absolute https URL without credentials whose host is a DNS name (no IP, no localhost). */
export function isSafeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 200) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname;
  return url.protocol === 'https:' && !url.username && !url.password
    && HOSTNAME.test(host) && host !== 'localhost' && !host.endsWith('.localhost');
}

/** Validate one catalog entry and return a list of errors (empty list = valid). */
export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['entry must be a JSON object'];
  const errors = [];
  const unknown = Object.keys(entry).filter((key) => !KEYS.includes(key));
  if (unknown.length) errors.push(`unknown fields: ${unknown.join(', ')}`);
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    if (typeof entry[key] !== 'string' || !pattern.test(entry[key])) errors.push(`${key} is invalid`);
  }
  if (RESERVED_API_NAMES.has(entry.api_name)) errors.push('api_name is reserved');
  if (RESERVED_GROUPS.has(entry.owner_group)) errors.push('owner_group is reserved');
  if (!DATA_CLASSES.has(entry.data_class)) errors.push('data_class must be internal or confidential');
  for (const key of ['backend_url_dev', 'backend_url_prod']) {
    if (!isSafeHttpsUrl(entry[key])) errors.push(`${key} must be an https URL with a DNS host name and no credentials`);
  }
  if (typeof entry.description !== 'string' || !PRINTABLE.test(entry.description)) {
    errors.push('description must be 1-500 printable characters');
  }
  return errors;
}

/** Normalize a ServiceNow field value: string, whitespace collapsed, trimmed. */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Build a catalog entry from a ServiceNow pending item, keeping only known fields. */
export function toEntry(number, item) {
  return {
    servicenow_ritm: number,
    api_name: clean(item.api_name).toLowerCase(),
    owner_group: clean(item.owner_group).toLowerCase(),
    data_class: clean(item.data_class),
    backend_url_dev: clean(item.backend_url_dev),
    backend_url_prod: clean(item.backend_url_prod),
    description: clean(item.description),
  };
}
