import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PluginManagerPanel } from '../PluginManagerPanel';

describe('PluginManagerPanel installation errors', () => {
  it('keeps and displays the concrete last installation error', () => {
    const html = renderToStaticMarkup(
      <PluginManagerPanel
        plugins={[]}
        lastInstallError="插件写入用户目录失败：access denied"
        userDataDir="C:/Users/test/AppData/Roaming/com.localmindmap.desktop"
        isDesktopApp
        onClose={() => undefined}
        onInstall={() => undefined}
        onToggle={() => undefined}
        onUninstall={() => undefined}
        onCopyUserDataDir={() => undefined}
        onOpenUserDataDir={() => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('最近一次安装错误');
    expect(html).toContain('插件写入用户目录失败：access denied');
  });
});
