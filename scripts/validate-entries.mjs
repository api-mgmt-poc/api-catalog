// Validate all catalog entries: content rules, file name equals api_name, unique request numbers.
import { readdirSync, readFileSync } from 'node:fs';
import { validateEntry } from './lib/entry.mjs';

/** Parse and validate one file in apis/; returns the entry (or null) and its errors. */
function checkFile(name) {
  let entry;
  try {
    entry = JSON.parse(readFileSync(`apis/${name}`, 'utf8'));
  } catch (error) {
    return { entry: null, errors: [`invalid JSON: ${error.message}`] };
  }
  const errors = validateEntry(entry);
  if (!errors.length && name !== `${entry.api_name}.json`) errors.push('file name must be <api_name>.json');
  return { entry, errors };
}

/** Validate every apis/*.json file and exit non-zero if any entry is invalid. */
function main() {
  const files = readdirSync('apis').filter((name) => name.endsWith('.json'));
  const seen = new Map();
  let failed = false;
  for (const name of files) {
    const { entry, errors } = checkFile(name);
    const ritm = entry?.servicenow_ritm;
    if (ritm && seen.has(ritm)) errors.push(`request ${ritm} is also used by ${seen.get(ritm)}`);
    if (ritm) seen.set(ritm, name);
    for (const error of errors) console.error(`apis/${name}: ${error}`);
    failed ||= errors.length > 0;
  }
  console.log(`checked ${files.length} catalog entr${files.length === 1 ? 'y' : 'ies'}`);
  if (failed) process.exit(1);
}

main();
