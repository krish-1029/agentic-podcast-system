/**
 * Planner
 *
 * Produces a structured plan for the podcast based on agent reports,
 * listening context (setting), and target duration.
 */

import { ChatOpenAI } from '@langchain/openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getSetting } from './prompts.js';

const log = logger.child('Planner');

export class PodcastPlanner {
  constructor() {
    this.llm = null;
  }

  async initialize() {
    if (this.llm) return;
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiSynthesisModel,
      temperature: 0.2,
      timeout: 60000,
      // Enforce JSON-only responses
      response_format: { type: 'json_object' },
    });
  }

  /**
   * Create a structured plan
   * @param {Object} params
   * @param {Object} params.channelReports
   * @param {Object} params.customReport
   * @param {string} params.setting
   * @param {number} params.duration
   * @returns {Promise<Object>} plan JSON
   */
  async createPlan({ channelReports, customReport, setting, duration }) {
    await this.initialize();

    const settingConfig = getSetting(setting);
    const reports = Object.values(channelReports)
      .map(r => `# ${r.channelName}\n${r.report}`)
      .join('\n\n---\n\n');
    const custom = customReport?.report ? `\n\n# Custom\n${customReport.report}` : '';

    const wordsTarget = duration * 160;
    const sectionsApprox = Math.max(3, Math.min(6, Math.round(duration * 1.2)));

    const prompt = `You are a planning assistant for a podcast script. Today is ${new Date().toDateString()}.

SETTING:\n${settingConfig.name} | Tone: ${settingConfig.tone} | Style: ${settingConfig.style} | Pacing: ${settingConfig.pacing}
TARGET DURATION: ${duration} minutes (~${wordsTarget} words)

SOURCE REPORTS (verbatim; do not invent facts beyond these):\n${reports}${custom}

TASK: Produce a concise JSON plan specifying the structure. Use only facts present in the reports. Do not include commentary.

JSON SCHEMA:
{
  "overview": string, // 1-2 sentences theme and arc
  "sections": [
    {
      "id": string,          // e.g., "intro", "s1", "s2", ...
      "title": string,       // short section title
      "goal": string,        // what this section should achieve
      "approx_words": number,// approximate words for this section
      "content_refs": [      // titles or snippets from reports to ground content
        string
      ]
    }
  ]
}

CONSTRAINTS:
- Total approx_words across sections should be ~${wordsTarget} (+/- 15%).
- Include an "intro" section first and a "closing" section last.
- Limit to ${sectionsApprox} sections total (prefer fewer, longer sections over many short ones).
- Each content section should be AT LEAST 120 words to allow proper narrative development.
- Group related topics into single sections (e.g., all tech news together, not split across multiple sections).
- Use only information from the reports to select content_refs.
Return ONLY valid JSON per the schema above. No prose, no code fences.`;

    // First attempt - capture token usage from response metadata
    let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    const response = await this.llm.invoke(prompt);
    let text = typeof response === 'string' ? response : (response?.content || '');
    
    // Extract token usage from response
    const usage = response.usage_metadata || response.response_metadata?.tokenUsage;
    if (usage) {
      tokenUsage.promptTokens += usage.input_tokens || usage.promptTokens || 0;
      tokenUsage.completionTokens += usage.output_tokens || usage.completionTokens || 0;
      tokenUsage.totalTokens += usage.total_tokens || usage.totalTokens || 0;
    }
    
    try {
      const plan = JSON.parse(text);
      return { plan, raw: text, tokenUsage };
    } catch (e) {
      // Single retry with stricter instruction
      const retryPrompt = `${prompt}\n\nReminder: Return ONLY valid JSON matching the schema. No prose.`;
      const retryResp = await this.llm.invoke(retryPrompt);
      const retryText = typeof retryResp === 'string' ? retryResp : (retryResp?.content || '');
      
      // Add retry token usage
      const retryUsage = retryResp.usage_metadata || retryResp.response_metadata?.tokenUsage;
      if (retryUsage) {
        tokenUsage.promptTokens += retryUsage.input_tokens || retryUsage.promptTokens || 0;
        tokenUsage.completionTokens += retryUsage.output_tokens || retryUsage.completionTokens || 0;
        tokenUsage.totalTokens += retryUsage.total_tokens || retryUsage.totalTokens || 0;
      }
      
      try {
        const plan = JSON.parse(retryText);
        return { plan, raw: retryText, tokenUsage };
      } catch (e2) {
        log.warn('Planner returned non-JSON after retry, using minimal plan');
        return {
          plan: {
            overview: 'Auto plan',
            sections: [
              { id: 'intro', title: 'Introduction', goal: 'Open the show', approx_words: Math.floor(wordsTarget * 0.15), content_refs: [] },
              { id: 'main', title: 'Main Topics', goal: 'Summarize key reports', approx_words: Math.floor(wordsTarget * 0.7), content_refs: [] },
              { id: 'closing', title: 'Closing', goal: 'Wrap up and sign off', approx_words: Math.floor(wordsTarget * 0.15), content_refs: [] },
            ],
          },
          raw: `${text}\n\n--- RETRY ---\n\n${retryText}`,
          tokenUsage,
        };
      }
    }
  }
}

export async function planPodcast(inputs) {
  const planner = new PodcastPlanner();
  return await planner.createPlan(inputs);
}

export default {
  PodcastPlanner,
  planPodcast,
};


