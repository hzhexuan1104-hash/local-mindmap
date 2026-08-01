import { assertVersionState, parseArgs, PROJECT_ROOT } from './release-utils.mjs';

function releaseRefTag(value) {
  if (!value) return undefined;
  const ref = String(value).replace(/^refs\/tags\//, '');
  return /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(ref)
    ? ref
    : undefined;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const tag = args.tag ?? releaseRefTag(args['release-ref']) ?? process.env.RELEASE_TAG;
  const result = assertVersionState(args.root ?? PROJECT_ROOT, tag);
  if (args.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Release version check passed: ${result.version}`);
    for (const [source, version] of Object.entries(result.versions)) {
      console.log(`  ${source}: ${version}`);
    }
  }
} catch (error) {
  console.error(`Release version check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
