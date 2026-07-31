import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs, PROJECT_ROOT, runChecked } from './release-utils.mjs';

export const V120_RELEASE_COMMIT = '6b857829fb6b9fa4b98a481c06f9ac7aabf6b78b';

function git(root, args) {
  return runChecked('git', args, { cwd: root });
}

function isTagName(value) {
  return /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function tagNameFromRef(value) {
  return value.startsWith('refs/tags/') ? value.slice('refs/tags/'.length) : value;
}

export function selectReleaseRef({ eventName, releaseRef = '', githubRef = '', githubRefName = '' }) {
  if (eventName === 'push' && githubRef.startsWith('refs/tags/')) {
    return githubRef;
  }
  return releaseRef.trim() || githubRef || githubRefName || 'HEAD';
}

export function resolveReleaseRef({
  root = PROJECT_ROOT,
  eventName,
  releaseRef = '',
  githubRef = '',
  githubRefName = '',
  workflowCommit,
  gitRunner = git,
}) {
  const selectedRef = selectReleaseRef({ eventName, releaseRef, githubRef, githubRefName });
  const releaseCommit = gitRunner(root, ['rev-parse', '--verify', `${selectedRef}^{commit}`]);
  const resolvedWorkflowCommit = workflowCommit || gitRunner(root, ['rev-parse', 'HEAD']);
  const possibleTag = tagNameFromRef(selectedRef);
  const releaseTag = isTagName(possibleTag) ? possibleTag : '';

  if (releaseTag) {
    const tagCommit = gitRunner(root, ['rev-list', '-n', '1', releaseTag]);
    if (tagCommit !== releaseCommit) {
      throw new Error(`Release tag ${releaseTag} does not resolve to the selected release commit.`);
    }
    if (releaseTag === 'v1.20.0' && releaseCommit !== V120_RELEASE_COMMIT) {
      throw new Error(`v1.20.0 must resolve to ${V120_RELEASE_COMMIT}, received ${releaseCommit}.`);
    }
  }

  return {
    release_ref: selectedRef,
    release_tag: releaseTag,
    release_commit: releaseCommit,
    workflow_commit: resolvedWorkflowCommit,
    is_tag_release: Boolean(releaseTag),
  };
}

function writeGithubOutput(result, path) {
  for (const [key, value] of Object.entries(result)) {
    appendFileSync(path, `${key}=${value}\n`, 'utf8');
  }
}

export function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const root = resolve(args.root ?? PROJECT_ROOT);
    const result = resolveReleaseRef({
      root,
      eventName: String(args['event-name'] ?? process.env.GITHUB_EVENT_NAME ?? 'workflow_dispatch'),
      releaseRef: String(args['release-ref'] ?? ''),
      githubRef: String(args['github-ref'] ?? process.env.GITHUB_REF ?? ''),
      githubRefName: String(args['github-ref-name'] ?? process.env.GITHUB_REF_NAME ?? ''),
      workflowCommit: args['workflow-commit'] ? String(args['workflow-commit']) : undefined,
    });
    if (args['github-output'] || process.env.GITHUB_OUTPUT) {
      writeGithubOutput(result, String(args['github-output'] ?? process.env.GITHUB_OUTPUT));
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Release reference resolution failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
