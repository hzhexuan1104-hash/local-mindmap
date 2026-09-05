import {
  readUserJson,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';
import {
  DEFAULT_LAYOUT_DENSITY,
  normalizeLayoutDensity,
  type LayoutDensity,
} from './layout';

export const DEFAULT_INSPECTOR_WIDTH = 320;
export const MIN_INSPECTOR_WIDTH = 280;

export type UiLayoutSettings = {
  layoutDensity: LayoutDensity;
  inspectorWidth: number;
};

export const DEFAULT_UI_LAYOUT_SETTINGS: UiLayoutSettings = {
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  inspectorWidth: DEFAULT_INSPECTOR_WIDTH,
};

export function clampInspectorWidth(width: number, viewportWidth: number): number {
  const maxWidth = Math.max(MIN_INSPECTOR_WIDTH, Math.floor(viewportWidth * 0.5));
  return Math.min(maxWidth, Math.max(MIN_INSPECTOR_WIDTH, Math.round(width)));
}

export function normalizeUiLayoutSettings(value: unknown, viewportWidth = 1280): UiLayoutSettings {
  const source = value && typeof value === 'object' ? value as Partial<UiLayoutSettings> : {};
  return {
    layoutDensity: normalizeLayoutDensity(source.layoutDensity),
    inspectorWidth: clampInspectorWidth(
      typeof source.inspectorWidth === 'number' ? source.inspectorWidth : DEFAULT_INSPECTOR_WIDTH,
      viewportWidth,
    ),
  };
}

export async function loadUiLayoutSettings(viewportWidth = window.innerWidth): Promise<UiLayoutSettings> {
  const value = await readUserJson<unknown>(USER_DATA_PATHS.uiLayoutSettings, DEFAULT_UI_LAYOUT_SETTINGS);
  return normalizeUiLayoutSettings(value, viewportWidth);
}

export async function saveUiLayoutSettings(settings: UiLayoutSettings) {
  await writeUserJson(USER_DATA_PATHS.uiLayoutSettings, settings);
}
