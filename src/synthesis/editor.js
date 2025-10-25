/**
 * Editor-in-Chief
 * 
 * Synthesizes multiple agent reports into a cohesive, engaging podcast script.
 * This is the final step that creates a unified narrative from specialized reports.
 * 
 * The "editor-in-chief" pattern ensures:
 * - Coherent narrative flow
 * - Smooth transitions between topics
 * - Consistent tone and style
 * - Appropriate length and pacing
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getSetting } from './prompts.js';

const log = logger.child('Editor');

export class EditorInChief {
  constructor() {
    this.llm = null;
  }

  /**
   * Initialize the LLM
   */
  async initialize() {
    if (this.llm) {
      return;
    }

    log.info('Initializing Editor-in-Chief LLM');

    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiSynthesisModel,
      temperature: 0.7, // Higher temperature for creative synthesis
      timeout: 60000, // 60 second timeout
    });

    log.success('Editor-in-Chief initialized');
  }

  /**
   * Synthesize agent reports into final script
   * 
   * @param {Object} params - Synthesis parameters
   * @param {Object} params.channelReports - Channel agent reports
   * @param {Object} params.customReport - Custom request report
   * @param {string} params.setting - Podcast setting
   * @param {number} params.duration - Target duration in minutes
   * @returns {Promise<string>} Final podcast script
   */
  async synthesize({ channelReports, customReport, setting, duration }) {
    const startTime = Date.now();
    log.start('Synthesizing final podcast script', {
      setting,
      duration: `${duration} minutes`,
      channels: Object.keys(channelReports).length,
      hasCustomReport: !!customReport?.report,
    });

    await this.initialize();

    try {
      // Get setting configuration
      const settingConfig = getSetting(setting);

      // Organize channel reports by priority/order
      const channelContent = this.organizeChannelContent(channelReports);

      // Build synthesis prompt
      const prompt = this.buildSynthesisPrompt({
        channelContent,
        customContent: customReport?.report || '',
        settingConfig,
        duration,
      });

      // Generate initial script
      let script = await this.generateScript(prompt, duration);

      // Ensure minimum length (90% of target)
      script = await this.ensureMinimumLength(script, duration);

      const elapsed = Date.now() - startTime;
      const wordCount = script.split(/\s+/).filter(Boolean).length;

      log.success('Script synthesis complete', {
        duration: `${elapsed}ms`,
        wordCount,
        characterCount: script.length,
        targetWords: duration * 160,
      });

      return script;
    } catch (error) {
      log.error('Script synthesis failed', error);
      throw error;
    }
  }

  /**
   * Organize channel content for synthesis
   * 
   * @param {Object} channelReports - Channel reports
   * @returns {string} Organized content string
   */
  organizeChannelContent(channelReports) {
    const reports = Object.values(channelReports);

    // Sort by status (successful first) then by channel name
    reports.sort((a, b) => {
      if (a.status === 'success' && b.status !== 'success') return -1;
      if (a.status !== 'success' && b.status === 'success') return 1;
      return a.channelName.localeCompare(b.channelName);
    });

    return reports
      .map(report => `${report.channelName}:\n${report.report}`)
      .join('\n\n---\n\n');
  }

  /**
   * Build synthesis prompt
   * 
   * @param {Object} params - Prompt parameters
   * @returns {string} Formatted prompt
   */
  buildSynthesisPrompt({ channelContent, customContent, settingConfig, duration }) {
    const wordCount = duration * 160; // ~160 words per minute for natural speech

    return `You are an expert podcast script editor-in-chief.

Synthesize the following specialist reports and custom content into a cohesive, engaging ${duration}-minute podcast script.

CHANNEL REPORTS:
${channelContent}

${customContent ? `CUSTOM REQUEST CONTENT:\n${customContent}\n` : ''}

PODCAST SPECIFICATIONS:
- Duration: ${duration} minutes (~${wordCount} words)
- Setting: ${settingConfig.name}
- Tone & Style: ${settingConfig.tone}
- Delivery Style: ${settingConfig.style}
- Voice Direction: ${settingConfig.voice}
- Pacing: ${settingConfig.pacing}

SCRIPT REQUIREMENTS:
- Write as a complete script ready for text-to-speech
- Use ElevenLabs v3 audio tags: [excited], [whispers], [laughs], [sarcastic], [curious], [sighs], [calm]
- Natural speech patterns and conversational flow
- Smooth transitions between topics
- Engaging opening hook and strong conclusion
- Include ellipses (...) for natural pauses
- Target ${wordCount} words for ${duration} minutes of natural speech
- Weave all reports into a cohesive narrative
- Prioritize the most interesting and relevant information

Create a script that feels like a professional, personalized podcast that seamlessly integrates all the specialist reports.`;
  }

  /**
   * Generate script from prompt
   * 
   * @param {string} prompt - Synthesis prompt
   * @param {number} duration - Target duration
   * @returns {Promise<string>} Generated script
   */
  async generateScript(prompt, duration) {
    const targetTokens = Math.min(duration * 220, 4000); // Conservative token estimate

    log.debug('Generating initial script', { targetTokens });

    const response = await this.llm.invoke(prompt, {
      maxTokens: targetTokens,
    });

    return response.content;
  }

  /**
   * Ensure script meets minimum length requirement
   * 
   * @param {string} script - Initial script
   * @param {number} duration - Target duration
   * @returns {Promise<string>} Expanded script (if needed)
   */
  async ensureMinimumLength(script, duration) {
    const targetWords = duration * 160;
    const minWords = Math.floor(targetWords * 0.9); // 90% of target
    let currentWords = script.split(/\s+/).filter(Boolean).length;

    log.debug('Checking script length', {
      current: currentWords,
      target: targetWords,
      minimum: minWords,
    });

    if (currentWords >= minWords) {
      log.info('Script meets length requirement');
      return script;
    }

    // Need to expand
    log.warn('Script too short, generating continuation', {
      shortfall: minWords - currentWords,
    });

    let expandedScript = script;
    let attempts = 0;
    const maxAttempts = 2;

    while (currentWords < minWords && attempts < maxAttempts) {
      attempts++;
      const remaining = Math.max(minWords - currentWords, Math.floor(targetWords * 0.15));

      const continuationPrompt = `The podcast script below is shorter than the target of ${targetWords} words for a ${duration}-minute show.

Write a CONTINUATION ONLY that seamlessly follows the current script. Match the same tone, style, and setting. Do not repeat any sentences; add new, relevant content that flows naturally with smooth transitions and a strong wrap-up if needed.

Aim for about ${remaining} additional words in this continuation. Return ONLY the continuation text (no preface, no restatement of the existing content).

CURRENT SCRIPT (for context):
${expandedScript}`;

      const continuation = await this.llm.invoke(continuationPrompt);
      const addedText = continuation.content.trim();

      if (addedText) {
        expandedScript = `${expandedScript}\n\n${addedText}`;
        currentWords = expandedScript.split(/\s+/).filter(Boolean).length;
        log.info(`Added continuation (attempt ${attempts})`, {
          newTotal: currentWords,
          target: targetWords,
        });
      } else {
        break;
      }
    }

    return expandedScript;
  }
}

/**
 * Synthesize reports into podcast script
 * 
 * @param {Object} reports - Agent reports and metadata
 * @param {Object} userContext - User context (setting, duration)
 * @returns {Promise<string>} Final podcast script
 */
export async function synthesizeScript(reports, userContext) {
  const editor = new EditorInChief();
  
  return await editor.synthesize({
    channelReports: reports.channelReports,
    customReport: reports.customReport,
    setting: userContext.setting,
    duration: userContext.duration,
  });
}

export default {
  EditorInChief,
  synthesizeScript,
};

