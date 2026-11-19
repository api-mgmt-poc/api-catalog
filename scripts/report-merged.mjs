// After a merge to main: report "provisioning" for every catalog entry ADDED by the push
// (changes to existing entries must not move a finished request back to "provisioning").
// Usage: node scripts/report-merged.mjs <before-sha>
import { readFileSync } from 'node:fs';
import { loadConfig, reportStatus } from './lib/servicenow.mjs';
import { validateEntry } from './lib/entry.mjs';
import { run } from './lib/git.mjs';

/** Return the catalog files added between the given commit and HEAD. */
function changedEntries(before) {
  const base = /^[0-9a-f]{40}$/.test(before) && !/^0+$/.test(before) ? before : 'HEAD~1';
  const out = run('git', ['diff', '--name-only', '--diff-filter=A', base, 'HEAD', '--', 'apis/']);
  return out.split('\n').filter((file) => /^apis\/[a-z0-9-]+\.json$/.test(file));
}

/** Report each merged entry to ServiceNow; invalid entries are skipped (the PR check blocks them anyway). */
async function main() {
  const config = loadConfig();
  for (const file of changedEntries(process.argv[2] ?? '')) {
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    if (validateEntry(entry).length) {
      console.error(`${file}: invalid entry, not reported`);
      continue;
    }
    await reportStatus(config, entry.servicenow_ritm, 'provisioning',
      `Merged into the API catalog; repository api-${entry.api_name} will be created by the platform`);
    console.log(`${entry.servicenow_ritm}: provisioning`);
  }
}

await main();
