/**
 * Synthesis Module - Central export for script synthesis
 */

import { EditorInChief, synthesizeScript } from './editor.js';
import { SETTINGS, getSetting, getAllSettings, hasSetting } from './prompts.js';

export {
  // Editor
  EditorInChief,
  synthesizeScript,
  
  // Settings
  SETTINGS,
  getSetting,
  getAllSettings,
  hasSetting,
};

export default {
  EditorInChief,
  synthesizeScript,
  SETTINGS,
  getSetting,
  getAllSettings,
  hasSetting,
};

