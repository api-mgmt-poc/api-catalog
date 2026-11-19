// Report a status for one request to ServiceNow.
// Usage: node scripts/report-status.mjs <RITMnnnnnnn> <provisioning|pr_open|done|failed> [message]
import { loadConfig, reportStatus } from './lib/servicenow.mjs';

const [number = '', status = '', message = ''] = process.argv.slice(2);
if (!/^[^\u0000-\u001f\u007f]{0,500}$/.test(message)) {
  console.error('message must be at most 500 printable characters');
  process.exit(1);
}
const result = await reportStatus(loadConfig(), number, status, message);
console.log(`${result.number}: ${result.status}`);
