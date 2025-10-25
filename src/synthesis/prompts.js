/**
 * Setting-Specific Prompts
 * 
 * Defines tone, style, and voice characteristics for different podcast settings.
 * Each setting creates a distinct listening experience.
 */

export const SETTINGS = {
  morning_routine: {
    id: 'morning_routine',
    name: 'Morning Routine',
    tone: 'energetic and uplifting',
    style: 'Start with motivation, include actionable insights',
    voice: '[confident, upbeat]',
    pacing: 'brisk',
    description: 'Perfect for starting your day with energy and inspiration',
  },

  workout: {
    id: 'workout',
    name: 'Workout',
    tone: 'high-energy and motivational',
    style: 'Use powerful language, include pump-up moments',
    voice: '[energetic, motivational]',
    pacing: 'fast',
    description: 'High-energy content to fuel your exercise routine',
  },

  commute: {
    id: 'commute',
    name: 'Commute',
    tone: 'informative and engaging',
    style: 'Clear structure, easy to follow while multitasking',
    voice: '[professional, engaging]',
    pacing: 'moderate',
    description: 'Informative content perfect for your commute',
  },

  wind_down: {
    id: 'wind_down',
    name: 'Wind Down',
    tone: 'calm and soothing',
    style: 'Relaxed pace, thoughtful insights',
    voice: '[calm, soothing]',
    pacing: 'slow',
    description: 'Relaxing content to help you unwind',
  },

  focus_work: {
    id: 'focus_work',
    name: 'Focus Work',
    tone: 'informative but background-friendly',
    style: 'Steady pace, no jarring content',
    voice: '[steady, professional]',
    pacing: 'moderate',
    description: 'Background-friendly content for productive work sessions',
  },

  learning: {
    id: 'learning',
    name: 'Learning',
    tone: 'educational and detailed',
    style: 'Deep dives, explanations, examples',
    voice: '[educational, clear]',
    pacing: 'thoughtful',
    description: 'In-depth educational content for active learning',
  },
};

/**
 * Get setting configuration
 * 
 * @param {string} settingId - Setting identifier
 * @returns {Object} Setting configuration
 */
export function getSetting(settingId) {
  return SETTINGS[settingId] || SETTINGS.morning_routine;
}

/**
 * Get all available settings
 * 
 * @returns {Array} Array of setting configurations
 */
export function getAllSettings() {
  return Object.values(SETTINGS);
}

/**
 * Check if a setting exists
 * 
 * @param {string} settingId - Setting identifier
 * @returns {boolean} True if setting exists
 */
export function hasSetting(settingId) {
  return settingId in SETTINGS;
}

export default {
  SETTINGS,
  getSetting,
  getAllSettings,
  hasSetting,
};

