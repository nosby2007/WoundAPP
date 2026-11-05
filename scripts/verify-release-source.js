const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`[release-source-guard] ${message}`);
  process.exit(1);
}

const expectedBranch = process.env.RELEASE_BRANCH || 'master';
const expectedSha = (process.env.RELEASE_COMMIT_SHA || '').trim();
const allowNonProduction = process.env.ALLOW_NON_PRODUCTION_RELEASE === '1';

const dirty = git(['status', '--porcelain']);
if (dirty) {
  fail('Refusing deployment from a dirty checkout. Commit or discard all source changes first.');
}

const head = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']);

if (expectedSha) {
  if (head !== expectedSha) {
    fail(`Checkout SHA ${head} does not match RELEASE_COMMIT_SHA ${expectedSha}.`);
  }
} else if (!allowNonProduction) {
  if (branch !== expectedBranch) {
    fail(`Manual deployment must come from ${expectedBranch}; current branch is ${branch || 'detached'}.`);
  }
  try {
    const remoteLine = git(['ls-remote', 'origin', `refs/heads/${expectedBranch}`]);
    const remoteSha = remoteLine.split(/\s+/)[0];
    if (!remoteSha) fail(`Unable to resolve origin/${expectedBranch}.`);
    if (head !== remoteSha) {
      fail(`Local ${expectedBranch} is not the current origin/${expectedBranch}. Local=${head}, remote=${remoteSha}.`);
    }
  } catch (error) {
    fail(`Unable to verify origin/${expectedBranch}; aborting deployment rather than risking an old release.`);
  }
}

const publicDir = path.resolve('www');
if (!fs.existsSync(publicDir)) {
  fail('Hosting output directory "www" does not exist. Build the app before deployment.');
}

const manifest = {
  app: 'WoundAPP',
  commit: head,
  branch: expectedSha ? (process.env.RELEASE_BRANCH || 'ci') : branch,
  channel: process.env.RELEASE_CHANNEL || (expectedSha ? 'ci' : 'manual'),
  generatedAt: new Date().toISOString(),
  sourceClean: true,
};

fs.writeFileSync(
  path.join(publicDir, 'release-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

console.log(`[release-source-guard] OK ${head} -> www/release-manifest.json`);
