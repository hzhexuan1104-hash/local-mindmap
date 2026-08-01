import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs, requireArg } from './release-utils.mjs';

export const UNSIGNED_MACOS_WARNING = [
  '> [!WARNING]',
  '> 本 Draft Release 中的 macOS 安装包未使用 Apple Developer ID 签名，也未经过 Apple 公证。',
  '> 文件名包含 `_unsigned_preview`，仅用于测试和兼容性验证。',
  '> macOS Gatekeeper 可能阻止首次启动，不应将其视为正式可信分发包。',
].join('\n');

function assetLines(assets) {
  return assets.map((asset) => `- \`${asset.filename}\` (${asset.arch})`).join('\n');
}

export function buildReleaseNotes(manifest) {
  const windows = manifest.assets.filter((asset) => asset.platform === 'windows');
  const macos = manifest.assets.filter((asset) => asset.platform === 'macos');
  const uos = manifest.assets.filter((asset) => asset.platform === 'uos');
  const unsignedMacos = macos.some((asset) => asset.distributionStatus === 'unsigned-preview');
  return [
    '<!-- local-mindmap-workflow-managed: true -->',
    `<!-- local-mindmap-release-source-commit: ${manifest.releaseSourceCommit} -->`,
    `<!-- local-mindmap-workflow-commit: ${manifest.workflowCommit} -->`,
    '',
    ...(unsignedMacos ? [UNSIGNED_MACOS_WARNING, ''] : []),
    `# Local Mindmap ${manifest.tag}`,
    '',
    '## Windows 下载',
    assetLines(windows),
    '',
    `## macOS 下载${unsignedMacos ? ' — Unsigned Preview' : ''}`,
    assetLines(macos),
    '',
    '## 统信 UOS 下载（兼容性候选）',
    assetLines(uos),
    '',
    '请同时下载 `SHA256SUMS.txt` 校验安装包。UOS 包在完成真实设备验收前仅标记为兼容性候选。',
  ].join('\n');
}

export function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifestPath = resolve(requireArg(args, 'manifest'));
    const output = resolve(requireArg(args, 'out'));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(output, `${buildReleaseNotes(manifest)}\n`, 'utf8');
  } catch (error) {
    console.error(`Release notes generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
