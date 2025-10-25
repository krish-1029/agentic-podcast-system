/**
 * Section Writer
 *
 * Iteratively writes sections based on a plan and prior script content.
 */

import { ChatOpenAI } from '@langchain/openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getSetting } from './prompts.js';

const log = logger.child('Writer');

export class SectionWriter {
  constructor() {
    this.llm = null;
  }

  async initialize() {
    if (this.llm) return;
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiSynthesisModel,
      temperature: 0.5,
      timeout: 60000,
    });
  }

  /**
   * Write a single section
   * @param {Object} params
   * @param {Object} params.plan - Full plan JSON
   * @param {Object} params.section - Section object from plan.sections[i]
   * @param {string} params.setting - Podcast setting
   * @param {string} params.currentScript - Current accumulated script
   * @param {Object} params.channelReports - Reports map for grounding
   * @returns {Promise<string>} section text
   */
  async writeSection({ plan, section, setting, currentScript, channelReports }) {
    await this.initialize();
    const settingConfig = getSetting(setting);

    const reportsStr = Object.values(channelReports)
      .map(r => `${r.channelName}: ${r.report}`)
      .join('\n\n');

    const prompt = `You are a podcast section writer. Today is ${new Date().toDateString()}.

SETTING:\n${settingConfig.name} | Tone: ${settingConfig.tone} | Style: ${settingConfig.style} | Voice: ${settingConfig.voice}

PLAN SECTION:
${JSON.stringify(section, null, 2)}

ALREADY WRITTEN SCRIPT (do not repeat content; maintain continuity):
${currentScript || '(none yet)'}

AVAILABLE FACTUAL MATERIAL (verbatim from agent reports; do not invent beyond these):
${reportsStr}

TASK: Write ONLY the text for this section (no prefaces). Use ElevenLabs v3 audio tags where natural. Target ~${section.approx_words} words. Ensure clear, unambiguous facts that cannot be misinterpreted downstream.`;

    const response = await this.llm.invoke(prompt);
    const text = typeof response === 'string' ? response : (response?.content || '');
    return text.trim();
  }
}

export async function writeSection(inputs) {
  const writer = new SectionWriter();
  return await writer.writeSection(inputs);
}

export default {
  SectionWriter,
  writeSection,
};


