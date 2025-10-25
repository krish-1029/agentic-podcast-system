/**
 * Audio Module - Central export for audio generation
 */

import { AudioGenerator, generateAudio } from './generator.js';
import { VOICE_CONFIGS, getVoiceConfig, getAllVoiceConfigs } from './voice-config.js';

export {
  // Generator
  AudioGenerator,
  generateAudio,
  
  // Voice configuration
  VOICE_CONFIGS,
  getVoiceConfig,
  getAllVoiceConfigs,
};

export default {
  AudioGenerator,
  generateAudio,
  VOICE_CONFIGS,
  getVoiceConfig,
  getAllVoiceConfigs,
};

