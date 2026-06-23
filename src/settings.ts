import type { Settings } from './types';
import { loadJSON, saveJSON } from './storage';

const KEY = 'blitzkrieg:settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  side: 'random',
  openings: [],
  autoHint: false,
  autoHintSeconds: 5,
  assist: false,
};

export const loadSettings = (): Settings => loadJSON(KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): void => saveJSON(KEY, s);
