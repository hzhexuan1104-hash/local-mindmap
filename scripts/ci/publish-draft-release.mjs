import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, requireArg } from './release-utils.mjs';

const WORKFLOW_MARKER = '<!-- local-mindmap-workflow-managed: true -->';

function sourceCommitMarker(commit) {
  return `<!-- local-mindmap-release-source-commit: ${commit} -->`;
}

function runGh(args, { allowFailure = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.error) throw new Error(`Unable to run gh: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result;
}

export function assertSafeDraftUpdate(release, { tag, releaseSourceCommit }) {
  if (!release?.isDraft) {
    throw new Error(`Release ${tag} is already published and will not be overwritten automatically.`);
  }
  if (release.targetCommitish !== releaseSourceCommit) {
    throw new Error(`Draft Release ${tag} targets ${release.targetCommitish}, not ${releaseSourceCommit}.`);
  }
  if (!release.body?.includes(WORKFLOW_MARKER) || !release.body.includes(sourceCommitMarker(releaseSourceCommit))) {
    throw new Error(`Draft Release ${tag} has unknown asset provenance; refusing to overwrite any same-name asset.`);
  }
}

function releaseAssets(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name !== 'release-notes.md')
    .map((entry) => join(directory, entry.name))
    .sort();
}

export function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const tag = requireArg(args, 'tag');
    const releaseSourceCommit = requireArg(args, 'release-source-commit');
    const assetsDirectory = resolve(requireArg(args, 'assets-dir'));
    const notesFile = resolve(requireArg(args, 'notes-file'));
    if (!existsSync(notesFile)) throw new Error(`Release notes file does not exist: ${notesFile}`);
    const files = releaseAssets(assetsDirectory);
    if (files.length === 0) throw new Error('No release assets were found.');

    const current = runGh(['release', 'view', tag, '--json', 'targetCommitish,isDraft,body,assets'], { allowFailure: true });
    if (current.status === 0) {
      assertSafeDraftUpdate(JSON.parse(current.stdout), { tag, releaseSourceCommit });
      runGh(['release', 'edit', tag, '--notes-file', notesFile]);
      runGh(['release', 'upload', tag, ...files, '--clobber']);
      console.log(`Safely updated Draft Release ${tag}.`);
      return;
    }

    runGh([
      'release', 'create', tag, ...files,
      '--target', releaseSourceCommit,
      '--draft',
      '--title', `Local Mindmap ${tag}`,
      '--notes-file', notesFile,
    ]);
    console.log(`Created Draft Release ${tag}.`);
  } catch (error) {
    console.error(`Draft Release publication failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
