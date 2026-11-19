// Pull approved onboarding requests from ServiceNow and open one catalog pull request per request.
import { existsSync, writeFileSync } from 'node:fs';
import { claim, getPending, loadConfig, reportStatus } from './lib/servicenow.mjs';
import { toEntry, validateEntry } from './lib/entry.mjs';
import { remoteBranchExists, run } from './lib/git.mjs';

/** Return the set of catalog files touched by open pull requests (requests that are already in flight). */
function filesInOpenPullRequests() {
  const out = run('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'files', '--jq', '.[].files[].path']);
  return new Set(out.split('\n').filter(Boolean));
}

/** Create a branch from origin/main, commit the entry file, push it and open a PR; returns the PR URL. */
function openPullRequest(entry, branch) {
  const file = `apis/${entry.api_name}.json`;
  run('git', ['checkout', '-B', branch, 'origin/main']);
  writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
  run('git', ['add', file]);
  run('git', ['commit', '-m', `feat(catalog): onboard API ${entry.api_name} (${entry.servicenow_ritm})`]);
  run('git', ['push', 'origin', branch]);
  const body = `Automated onboarding request ${entry.servicenow_ritm} from ServiceNow.\n\n`
    + `Owner team: ${entry.owner_group} · Data class: ${entry.data_class}`;
  return run('gh', ['pr', 'create', '--base', 'main', '--head', branch,
    '--title', `Onboard API ${entry.api_name} (${entry.servicenow_ritm})`, '--body', body]);
}

/** Validate a claimed request against the catalog; returns an error message or null. */
function rejectReason(entry, inFlight) {
  const errors = validateEntry(entry);
  if (errors.length) return `Validation failed: ${errors.join('; ')}`;
  run('git', ['checkout', '--quiet', '--detach', 'origin/main']);
  const file = `apis/${entry.api_name}.json`;
  if (existsSync(file) || inFlight.has(file)) return `API name ${entry.api_name} already exists or is already requested`;
  return null;
}

/** Open the PR; on failure remove the branch and report "failed" so the request can be retried. */
async function openPullRequestOrReport(config, number, entry, branch) {
  try {
    return openPullRequest(entry, branch);
  } catch (error) {
    try { run('git', ['push', '--quiet', 'origin', '--delete', branch]); } catch { /* branch may not exist */ }
    await reportStatus(config, number, 'failed', 'Opening the catalog pull request failed; see the sync-servicenow run').catch(() => {});
    throw error;
  }
}

/** Process one pending request: claim, validate, open a PR and report the result back to ServiceNow. */
async function processItem(config, item, inFlight) {
  const number = String(item?.number ?? '');
  if (!/^RITM\d{7}$/.test(number)) return console.log('skipping item with invalid request number');
  const branch = `onboarding/${number.toLowerCase()}`;
  if (remoteBranchExists(branch)) throw new Error(`branch ${branch} already exists; delete it to retry`);
  await claim(config, number);
  const entry = toEntry(number, item);
  const reason = rejectReason(entry, inFlight);
  if (reason) return reportStatus(config, number, 'failed', reason);
  const prUrl = await openPullRequestOrReport(config, number, entry, branch);
  inFlight.add(`apis/${entry.api_name}.json`);
  await reportStatus(config, number, 'pr_open', 'Pull request opened in the API catalog', prUrl);
  return console.log(`${number}: ${prUrl}`);
}

/** Fetch all pending requests and process them one by one; a failure is logged and marks the run as failed. */
async function main() {
  const config = loadConfig();
  run('git', ['fetch', '--quiet', 'origin', 'main']);
  const items = await getPending(config);
  console.log(`pending requests: ${items.length}`);
  const inFlight = filesInOpenPullRequests();
  for (const item of items) {
    try {
      await processItem(config, item, inFlight);
    } catch (error) {
      console.error(`${item?.number ?? 'unknown'}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

await main();
