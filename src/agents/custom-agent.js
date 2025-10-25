/**
 * Custom Request Agent
 * 
 * Handles user-specific requests that don't fit into predefined channels.
 * This agent is more flexible and can research any topic the user specifies.
 */

import BaseAgent from './base-agent.js';
import { getAllTools } from '../tools/index.js';

export class CustomAgent extends BaseAgent {
  constructor() {
    super(
      'Custom Request Specialist',
      'Researches user-specific topics and requests',
      getAllTools(),
      {
        temperature: 0.4, // Slightly higher temperature for more creative responses
      }
    );
  }

  /**
   * Research custom user requests
   * 
   * @param {Array<string>} requests - Array of user requests
   * @returns {Promise<Object>} Research report with metadata
   */
  async research(requests) {
    if (!requests || requests.length === 0) {
      this.log.info('No custom requests provided, skipping');
      return {
        report: '',
        duration: 0,
        status: 'skipped',
        method: 'none',
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    this.log.start(`Researching custom requests: ${requests.join(', ')}`);

    try {
      const prompt = this.buildPrompt(requests);
      const report = await this.execute(prompt);

      const duration = Date.now() - startTime;

      this.log.success('Custom research complete', {
        duration: `${duration}ms`,
        reportLength: `${report.length} chars`,
        requests: requests.length,
      });

      return {
        report,
        requests,
        duration,
        status: 'success',
        method: 'agent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.log.error(`Custom research failed after ${duration}ms`, error);

      throw error;
    }
  }

  /**
   * Build prompt for custom requests
   * 
   * @param {Array<string>} requests - User requests
   * @returns {string} Formatted prompt
   */
  buildPrompt(requests) {
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `You are a Custom Request specialist for a podcast generation system.

CRITICAL DATE CONTEXT: Today is ${dateStr}.

The user has made specific requests for their podcast. Research these topics and provide a comprehensive 200-word report.

User's Custom Requests: ${requests.join(', ')}

Instructions:
- Research each specific request thoroughly
- Provide current, factual information about these topics
- Focus on what the user specifically asked for
- Use web search to find the latest information on these topics
- Make the content engaging and informative
- If search fails for some topics, provide informed general knowledge
- Prioritize the most recent and relevant information

IMPORTANT: You have a budget of 3 web searches maximum. Make them count by using specific, date-aware search terms.

Return only your final report - no tool usage explanations or meta-commentary.`;
  }
}

export default CustomAgent;

