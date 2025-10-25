/**
 * Tools Module - Central export for all agent tools
 * 
 * This module provides a unified interface to all tools that
 * agents can use for web research and content gathering.
 */

import { search, createSearchTool } from './web-search.js';
import { scrape, createScraperTool } from './web-scraper.js';
import { DynamicTool } from '@langchain/core/tools';
import { generateFallbackContent, detectCategory } from './fallback-content.js';

/**
 * Get all available tools for LangChain agents
 * 
 * @returns {Array} Array of LangChain-compatible tool objects
 */
export function getAllTools() {
  return [
    createSearchTool(),
    createScraperTool(),
  ];
}

/**
 * Get tools with enforced per-run budgets to prevent infinite loops
 * 
 * @param {Object} budget
 * @param {number} budget.searchMax - Max number of web searches
 * @param {number} budget.scrapeMax - Max number of scrapes
 * @returns {Array} LangChain tool objects with budget enforcement
 */
export function getAllToolsWithBudget({ searchMax = 3, scrapeMax = 1 } = {}) {
  let searchCount = 0;
  let scrapeCount = 0;

  const budgetedSearch = new DynamicTool({
    name: 'web_search',
    description: `Search the web for recent news. Budget: up to ${searchMax} searches per run.`,
    func: async (query) => {
      if (searchCount >= searchMax) {
        return JSON.stringify({
          error: 'SEARCH_BUDGET_EXHAUSTED',
          message: `Search budget exhausted (${searchMax}). Synthesize your final report now.`,
          results: [],
        });
      }
      searchCount += 1;
      const results = await search(query, { maxResults: 8, useFallback: true, timeRange: 'day' });
      return JSON.stringify(results, null, 2);
    },
  });

  const budgetedScrape = new DynamicTool({
    name: 'scrape_article',
    description: `Extract readable text from a URL. Budget: up to ${scrapeMax} scrapes per run.`,
    func: async (url) => {
      if (scrapeCount >= scrapeMax) {
        return 'SCRAPE_BUDGET_EXHAUSTED: Synthesize your final report now.';
      }
      scrapeCount += 1;
      return await scrape(url);
    },
  });

  return [budgetedSearch, budgetedScrape];
}

export {
  // Web search
  search,
  createSearchTool,
  
  // Web scraping
  scrape,
  createScraperTool,
  
  // Fallback content
  generateFallbackContent,
  detectCategory,
};

export default {
  search,
  scrape,
  getAllTools,
  getAllToolsWithBudget,
  generateFallbackContent,
  detectCategory,
};

