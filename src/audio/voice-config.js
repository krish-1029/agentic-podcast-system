/**
 * Voice Configuration for ElevenLabs
 * 
 * Defines voice settings optimized for different podcast settings.
 * Uses ElevenLabs v3 with support for audio tags.
 * 
 * NOTE: v3 requires Instant Voice Clones (IVCs) or designed voices.
 * Professional Voice Clones (PVCs) are not yet optimized for v3.
 * Current voices used:
 * - George (JBFqnCBsd6RMkjVDRZzb): Designed voice - v3 compatible
 * - Dorothy (ThT5KcBeYPX3keUQqHPh): Designed voice - v3 compatible
 */

export const VOICE_CONFIGS = {
  morning_routine: {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - expressive voice
    settings: {
      stability: 0, // Creative - most responsive to audio tags
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'Energetic and expressive for morning motivation',
  },

  workout: {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - expressive voice
    settings: {
      stability: 0, // Creative - maximum expressiveness
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'High-energy for workout motivation',
  },

  commute: {
    voiceId: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - professional voice
    settings: {
      stability: 0.5, // Natural - balanced
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'Professional and engaging for commutes',
  },

  wind_down: {
    voiceId: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - calm voice
    settings: {
      stability: 0, // Creative - even in calm content
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'Calm and soothing for relaxation',
  },

  focus_work: {
    voiceId: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - steady voice
    settings: {
      stability: 0.5, // Natural - moderate
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'Steady and professional for background listening',
  },

  learning: {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - educational
    settings: {
      stability: 0, // Creative - expressive educational content
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: false,
    },
    description: 'Clear and expressive for learning',
  },
};

/**
 * Get voice configuration for a setting
 * 
 * @param {string} setting - Setting identifier
 * @returns {Object} Voice configuration
 */
export function getVoiceConfig(setting) {
  return VOICE_CONFIGS[setting] || VOICE_CONFIGS.morning_routine;
}

/**
 * Get all voice configurations
 * 
 * @returns {Object} All voice configurations
 */
export function getAllVoiceConfigs() {
  return VOICE_CONFIGS;
}

export default {
  VOICE_CONFIGS,
  getVoiceConfig,
  getAllVoiceConfigs,
};

