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

FULL PLAN OVERVIEW:
${plan.overview}

YOUR CURRENT SECTION (${section.id}):
${JSON.stringify(section, null, 2)}

ALREADY WRITTEN SCRIPT:
${currentScript || '(none yet)'}

CRITICAL RULES:
- DO NOT repeat facts or topics already covered in the script above
- DO NOT re-explain things you already mentioned
- If your section's topic was already covered, skip to a NEW angle or detail not yet mentioned
- Provide smooth transitions from the previous section's ending
- Stay focused on YOUR section's goal

AVAILABLE FACTUAL MATERIAL (verbatim from agent reports; do not invent beyond these):
${reportsStr}

ELEVENLABS V3 AUDIO TAGS (use varied tags naturally throughout your section):
Emotional states: [excited], [nervous], [frustrated], [sorrowful], [calm]
Reactions: [sigh], [laughs], [gulps], [gasps], [whispers]
Cognitive beats: [pauses], [hesitates], [stammers], [resigned tone]
Tone cues: [cheerfully], [flatly], [deadpan], [playfully]

AUDIO TAG GUIDELINES:
- Use 3-5 DIFFERENT tags per section for variety
- Place tags at natural points (before sentences or phrases they modify)
- Do NOT reuse the same 2 tags repeatedly - mix emotional states, reactions, cognitive beats, and tone cues
- Examples: "[excited] This breakthrough changes everything!" or "The results [pauses] weren't what anyone expected [nervous]"

TASK: Write ONLY the text for this section (no prefaces). Use ElevenLabs v3 audio tags naturally and with variety. Target ~${section.approx_words} words. Create natural transitions from what came before. Ensure clear, unambiguous facts that cannot be misinterpreted downstream.`;

    const response = await this.llm.invoke(prompt);
    const text = typeof response === 'string' ? response : (response?.content || '');
    
    // Extract token usage from response metadata
    const tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const usage = response.usage_metadata || response.response_metadata?.tokenUsage;
    if (usage) {
      tokenUsage.promptTokens = usage.input_tokens || usage.promptTokens || 0;
      tokenUsage.completionTokens = usage.output_tokens || usage.completionTokens || 0;
      tokenUsage.totalTokens = usage.total_tokens || usage.totalTokens || 0;
    }
    
    return {
      text: text.trim(),
      tokenUsage,
    };
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


