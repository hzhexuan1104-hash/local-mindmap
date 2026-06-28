import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEYS,
  USER_DATA_COMMANDS,
  USER_DATA_PATHS,
  migrateLegacyLocalStorageToUserData,
  setUserDataStorageInvokerForTests,
} from '../../storage/userDataStorage';
import {
  loadAllUserNodeTypes,
  loadStoredNodeTypePacks,
} from '../nodeTypes';
import { createNodeTypePack } from '../nodeTypePacks';
import {
  loadAllUserTemplates,
  loadStoredTemplatePacks,
  type MindmapTemplate,
} from '../templates';
import { createTemplatePack } from '../templatePacks';
import type { MindmapNodeType } from '../types';

const nodeType: MindmapNodeType = {
  id: 'direct-node-type',
  name: 'Direct node type',
  icon: 'T',
  shape: 'rounded',
  backgroundColor: '#ffffff',
  borderColor: '#000000',
  textColor: '#111111',
  fontSize: 16,
  bold: false,
  defaultText: 'Task',
  defaultRemark: '',
};

const template: MindmapTemplate = {
  id: 'direct-template',
  name: 'Direct template',
  category: 'Test',
  description: '',
  createTime: '2026-06-28T00:00:00.000Z',
  rootNode: { id: 'root', text: 'Root', remark: '', children: [] },
  nodeTypes: [],
  themeId: 'default-blue',
  thumbnail: 'Root',
};

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installDesktopWindow(storage: Storage = new MemoryStorage()) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
      __TAURI_INTERNALS__: {},
    },
  });
}

function installWebWindow(storage: Storage = new MemoryStorage()) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
    },
  });
}

describe('desktop user asset scanning', () => {
  beforeEach(() => installDesktopWindow());

  afterEach(() => {
    setUserDataStorageInvokerForTests(null);
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('loads custom-node-types.json and merges direct node type packs', async () => {
    const sourceTruthNodeType = {
      ...nodeType,
      id: 'source-truth-node-type',
      name: 'source_truth_node_type',
    };
    const packNodeType = {
      ...nodeType,
      id: 'pack-node-type',
      name: 'Pack node type',
    };
    const packPath = `${USER_DATA_PATHS.nodeTypePacks}/shared.json`;
    const pack = createNodeTypePack([packNodeType]);
    const readPaths: string[] = [];

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        readPaths.push(path);
        if (path === USER_DATA_PATHS.nodeTypes) {
          return [sourceTruthNodeType] as never;
        }
        if (path === packPath) {
          return pack as never;
        }
        return args?.defaultValue as never;
      }
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        return [packPath] as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadAllUserNodeTypes()).resolves.toEqual([
      sourceTruthNodeType,
      packNodeType,
    ]);
    expect(readPaths).toEqual([USER_DATA_PATHS.nodeTypes, packPath]);
  });

  it('loads custom node types after migration-state marks migration complete', async () => {
    const sourceTruthNodeType = {
      ...nodeType,
      id: 'source-truth-node-type',
      name: 'source_truth_node_type',
    };
    const files = new Map<string, unknown>([
      [
        USER_DATA_PATHS.migrationFlag,
        {
          completed: true,
          nodeTypesMigrated: true,
          templatesMigrated: true,
          pluginsMigrated: true,
          appSettingsMigrated: true,
          recentFilesMigrated: true,
          userPreferencesMigrated: true,
          migratedAt: '2026-06-28T00:00:00.000Z',
          migratedKeys: [],
        },
      ],
      [USER_DATA_PATHS.nodeTypes, [sourceTruthNodeType]],
    ]);

    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([{ ...nodeType, name: 'legacy-node-type' }]),
    );
    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Roaming/com.localmindmap.desktop' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        return [] as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toMatchObject({
      attempted: false,
    });
    await expect(loadAllUserNodeTypes()).resolves.toEqual([
      sourceTruthNodeType,
    ]);
  });

  it('loads custom-templates.json and merges direct template packs', async () => {
    const sourceTruthTemplate = {
      ...template,
      id: 'source-truth-template',
      name: 'source_truth_template',
    };
    const packTemplate = {
      ...template,
      id: 'pack-template',
      name: 'Pack template',
    };
    const packPath = `${USER_DATA_PATHS.templatePacks}/shared.json`;
    const pack = createTemplatePack([packTemplate]);
    const readPaths: string[] = [];

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        readPaths.push(path);
        if (path === USER_DATA_PATHS.templates) {
          return [sourceTruthTemplate] as never;
        }
        if (path === packPath) {
          return pack as never;
        }
        return args?.defaultValue as never;
      }
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        return [packPath] as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadAllUserTemplates()).resolves.toMatchObject([
      {
        id: sourceTruthTemplate.id,
        name: sourceTruthTemplate.name,
      },
      {
        id: packTemplate.id,
        name: packTemplate.name,
      },
    ]);
    expect(readPaths).toEqual([USER_DATA_PATHS.templates, packPath]);
  });

  it('loads custom templates after migration-state marks migration complete', async () => {
    const sourceTruthTemplate = {
      ...template,
      id: 'source-truth-template',
      name: 'source_truth_template',
    };
    const files = new Map<string, unknown>([
      [
        USER_DATA_PATHS.migrationFlag,
        {
          completed: true,
          nodeTypesMigrated: true,
          templatesMigrated: true,
          pluginsMigrated: true,
          appSettingsMigrated: true,
          recentFilesMigrated: true,
          userPreferencesMigrated: true,
          migratedAt: '2026-06-28T00:00:00.000Z',
          migratedKeys: [],
        },
      ],
      [USER_DATA_PATHS.templates, [sourceTruthTemplate]],
    ]);

    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([{ ...template, name: 'legacy-template' }]),
    );
    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Roaming/com.localmindmap.desktop' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        return [] as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toMatchObject({
      attempted: false,
    });
    await expect(loadAllUserTemplates()).resolves.toMatchObject([
      {
        id: sourceTruthTemplate.id,
        name: sourceTruthTemplate.name,
      },
    ]);
  });

  it('keeps empty desktop custom files authoritative over legacy localStorage', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([{ ...nodeType, name: 'legacy-node-type' }]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([{ ...template, name: 'legacy-template' }]),
    );

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        if (
          path === USER_DATA_PATHS.nodeTypes ||
          path === USER_DATA_PATHS.templates
        ) {
          return [] as never;
        }
        return args?.defaultValue as never;
      }
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        return [] as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadAllUserNodeTypes()).resolves.toEqual([]);
    await expect(loadAllUserTemplates()).resolves.toEqual([]);
  });

  it('keeps Web runtime node type and template localStorage fallback', async () => {
    const storage = new MemoryStorage();
    installWebWindow(storage);
    storage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    storage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([template]),
    );

    await expect(loadAllUserNodeTypes()).resolves.toEqual([nodeType]);
    await expect(loadAllUserTemplates()).resolves.toMatchObject([
      {
        id: template.id,
        name: template.name,
      },
    ]);
  });

  it('loads only direct node-types/packs/*.json files', async () => {
    const directPath = `${USER_DATA_PATHS.nodeTypePacks}/direct.json`;
    const listedPaths = [
      directPath,
      'node-types/backup-manual-clean-2026/legacy.json',
      `${USER_DATA_PATHS.nodeTypePacks}/nested/legacy.json`,
      `${USER_DATA_PATHS.nodeTypePacks}/notes.txt`,
      'node-types/arbitrary.json',
    ];
    const readPaths: string[] = [];
    const directPack = createNodeTypePack([nodeType]);

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        expect(args?.relativeDir).toBe(USER_DATA_PATHS.nodeTypePacks);
        return listedPaths as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        readPaths.push(String(args?.relativePath));
        return directPack as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadStoredNodeTypePacks()).resolves.toEqual([directPack]);
    expect(readPaths).toEqual([directPath]);
  });

  it('loads only direct templates/packs/*.json files', async () => {
    const directPath = `${USER_DATA_PATHS.templatePacks}/direct.json`;
    const listedPaths = [
      directPath,
      'templates/backup-manual-clean-2026/legacy.json',
      `${USER_DATA_PATHS.templatePacks}/nested/legacy.json`,
      `${USER_DATA_PATHS.templatePacks}/notes.txt`,
      'templates/arbitrary.json',
    ];
    const readPaths: string[] = [];
    const directPack = createTemplatePack([template]);

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.listUserFiles) {
        expect(args?.relativeDir).toBe(USER_DATA_PATHS.templatePacks);
        return listedPaths as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        readPaths.push(String(args?.relativePath));
        return directPack as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadStoredTemplatePacks()).resolves.toEqual([directPack]);
    expect(readPaths).toEqual([directPath]);
  });
});
