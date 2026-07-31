import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from './release-utils.mjs';

export const APPLE_SIGNING_SECRETS = [
  'APPLE_CERTIFICATE',
  'APPLE_CERTIFICATE_PASSWORD',
  'KEYCHAIN_PASSWORD',
  'APPLE_SIGNING_IDENTITY',
  'APPLE_ID',
  'APPLE_PASSWORD',
  'APPLE_TEAM_ID',
];

export function getAppleSigningState(environment = process.env) {
  const missing = APPLE_SIGNING_SECRETS.filter((name) => !environment[name]);
  return {
    apple_signing_ready: missing.length === 0,
    missing_apple_secrets: missing,
  };
}

export function getMacosDistributionMode({ signingReady, allowUnsigned }) {
  if (signingReady) return 'release';
  if (allowUnsigned) return 'unsigned-preview';
  return 'rejected';
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = getAppleSigningState();
  const mode = getMacosDistributionMode({
    signingReady: state.apple_signing_ready,
    allowUnsigned: args['allow-unsigned'] === 'true',
  });
  const result = {
    ...state,
    macos_distribution_mode: mode,
  };
  if (args['github-output'] || process.env.GITHUB_OUTPUT) {
    const output = String(args['github-output'] ?? process.env.GITHUB_OUTPUT);
    appendFileSync(output, `apple_signing_ready=${result.apple_signing_ready}\n`, 'utf8');
    appendFileSync(output, `missing_apple_secrets=${result.missing_apple_secrets.join(',')}\n`, 'utf8');
    appendFileSync(output, `macos_distribution_mode=${mode}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
