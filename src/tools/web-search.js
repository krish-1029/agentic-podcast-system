/**
 * Web Search Tool
 * 
 * Provides web search capabilities using Tavily API with automatic
 * fallback to curated content when searches fail.
 */

import fetch from 'node-fetch';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import circuitBreakerManager from '../utils/circuit-breaker.js';
import { retry } from '../utils/retry.js';
import withTimeout from '../utils/timeout.js';
import { generateFallbackContent, detectCategory } from './fallback-content.js';
import { emitToolEvent } from './observer.js';
import { DynamicTool } from '@langchain/core/tools';

const log = logger.child('WebSearch');

/**
 * Search result object
 * @typedef {Object} SearchResult
 * @property {string} title - Article title
 * @property {string} content - Article content/snippet
 * @property {string} url - Article URL
 * @property {string} source - Source domain
 * @property {boolean} isFallback - Whether this is fallback content
 */

/**
 * Search the web for information on a query
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.maxResults - Maximum results to return (default: 5)
 * @param {boolean} options.useFallback - Whether to use fallback on failure (default: true)
 * @returns {Promise<SearchResult[]>} Array of search results
 */
export async function search(query, options = {}) {
  const { maxResults = 8, useFallback = true, timeRange = 'day' } = options;
  
  log.info(`Searching for: "${query}"`, { maxResults });
  emitToolEvent({ type: 'tool:start', tool: 'web_search', query, maxResults });

  // Detect category for better fallback content
  const category = detectCategory(query);

  // If no Tavily key, use fallback immediately
  if (!config.hasTavilyKey) {
    log.warn('No Tavily API key configured, using fallback content');
    return generateFallbackContent(query, category);
  }

  // Try Tavily search with circuit breaker
  const breaker = circuitBreakerManager.getBreaker('tavily');
  
  try {
    const results = await breaker.execute(
      () => searchWithTavily(query, maxResults, timeRange),
      useFallback ? () => generateFallbackContent(query, category) : null
    );
    emitToolEvent({ type: 'tool:success', tool: 'web_search', query, resultCount: results.length });
    return results;
  } catch (error) {
    log.error('Search failed', error);
    emitToolEvent({ type: 'tool:error', tool: 'web_search', query, error: error.message });
    
    if (useFallback) {
      log.info('Using fallback content');
      return generateFallbackContent(query, category);
    }
    
    throw error;
  }
}

/**
 * Search using Tavily API
 * 
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<SearchResult[]>} Search results
 */
async function searchWithTavily(query, maxResults = 8, timeRange = 'day') {
  log.debug('Executing Tavily search', { query, maxResults, timeRange });

  return retry(
    async () => {
      return withTimeout(
        async () => {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AgenticPodcastSystem/1.0',
            },
            body: JSON.stringify({
              api_key: config.tavilyApiKey,
              query: query,
              search_depth: 'basic',
              include_answer: false,
              include_images: false,
              include_raw_content: false,
              max_results: maxResults,
              // Prefer very recent results to avoid stale articles
              time_range: timeRange, // e.g., 'day' | 'week' | 'month'
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          
          if (!data.results || data.results.length === 0) {
            log.warn('Tavily returned no results');
            throw new Error('No results found');
          }

          const results = data.results.map(result => ({
            title: result.title || 'No Title',
            content: result.content || result.snippet || 'No content available',
            url: result.url || '',
            source: result.url ? new URL(result.url).hostname : 'unknown',
            isFallback: false,
          }));

          log.success(`Tavily returned ${results.length} results`);
          emitToolEvent({ type: 'tool:data', tool: 'web_search', query, raw: data, results: results.slice(0, 3) });
          return results;
        },
        10000, // 10 second timeout
        'Tavily search'
      );
    },
    {
      maxRetries: 2,
      baseDelay: 2000,
      context: 'Tavily search',
    }
  );
}

/**
 * Create a LangChain-compatible search tool
 * 
 * This provides a standardized tool interface for use with LangChain agents.
 * 
 * @returns {Object} LangChain tool object
 */
export function createSearchTool() {
  return new DynamicTool({
    name: 'web_search',
    description:
      'Search the web for very recent news. Input is a plain text query. Returns JSON list of {title, url, content, source}. Prefer date-specific queries.',
    func: async (query) => {
      try {
        const results = await search(query, { maxResults: 5, useFallback: true, timeRange: 'day' });
        return JSON.stringify(results, null, 2);
      } catch (error) {
        log.error('Search tool execution failed', error);
        return JSON.stringify({ error: error.message, results: [] });
      }
    },
  });
}

export default {
  search,
  createSearchTool,
};

