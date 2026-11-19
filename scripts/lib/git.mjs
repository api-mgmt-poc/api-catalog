// Thin wrappers around git and gh. Commands run without a shell, so arguments cannot inject commands.
import { execFileSync } from 'node:child_process';

/** Run a command with arguments (no shell) and return trimmed stdout. */
export function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Return true if the branch already exists on the remote "origin". */
export function remoteBranchExists(branch) {
  return run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]) !== '';
}
