import { assertVersionState, parseArgs, PROJECT_ROOT } from './release-utils.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const result = assertVersionState(args.root ?? PROJECT_ROOT, args.tag ?? process.env.RELEASE_TAG);
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
