/**
 * Web Scraper Tool
 * 
 * Extracts article content from URLs with robust error handling
 * and automatic fallback for inaccessible content.
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';
import circuitBreakerManager from '../utils/circuit-breaker.js';
import { retryIf, retryPredicates } from '../utils/retry.js';
import withTimeout from '../utils/timeout.js';
import { DynamicTool } from '@langchain/core/tools';
import { emitToolEvent } from './observer.js';

const log = logger.child('WebScraper');

/**
 * Scrape article content from a URL
 * 
 * @param {string} url - URL to scrape
 * @param {Object} options - Scraping options
 * @param {number} options.maxLength - Maximum content length (default: 2000)
 * @param {boolean} options.useFallback - Use fallback message on failure (default: true)
 * @returns {Promise<string>} Extracted article content
 */
export async function scrape(url, options = {}) {
  const { maxLength = 2000, useFallback = true } = options;
  
  log.info(`Scraping URL: ${url}`);
  emitToolEvent({ type: 'tool:start', tool: 'scrape_article', url });

  // Validate URL
  if (!url || url === '' || !url.startsWith('http')) {
    log.warn('Invalid URL provided', { url });
    return useFallback 
      ? 'No valid URL provided for scraping. This may be fallback content.'
      : '';
  }

  // Get circuit breaker for scraping
  const breaker = circuitBreakerManager.getBreaker('scraping');

  try {
    const content = await breaker.execute(
      () => scrapeUrl(url, maxLength),
      useFallback 
        ? () => getFallbackMessage(url)
        : null
    );
    emitToolEvent({ type: 'tool:success', tool: 'scrape_article', url, contentPreview: (content || '').slice(0, 200) });
    return content;
  } catch (error) {
    log.error('Scraping failed', error, { url });
    emitToolEvent({ type: 'tool:error', tool: 'scrape_article', url, error: error.message });
    
    if (useFallback) {
      return getFallbackMessage(url);
    }
    
    throw error;
  }
}

/**
 * Scrape content from URL with retries and timeout
 * 
 * @param {string} url - URL to scrape
 * @param {number} maxLength - Maximum content length
 * @returns {Promise<string>} Extracted content
 */
async function scrapeUrl(url, maxLength) {
  log.debug('Executing scrape operation', { url });

  return retryIf(
    async () => {
      return withTimeout(
        async () => {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AgenticPodcastBot/1.0)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Connection': 'close',
            },
          });

          if (!response.ok) {
            const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
            err.status = response.status;
            throw err;
          }

          const html = await response.text();
          const content = extractContent(html, maxLength);

          if (!content || content.length < 50) {
            throw new Error('No meaningful content extracted');
          }

          log.success(`Scraped ${content.length} characters from ${url}`);
          return content;
        },
        15000, // 15 second timeout to reduce legit-article timeouts
        'Web scraping'
      );
    },
    async (error) => {
      // Do not retry for 401/403/404/451 (blocked/paywalled/not found)
      if (error && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 451)) {
        log.warn(`Scrape forbidden or unavailable (${error.status}), skipping further retries`);
        return false;
      }
      // Retry transient/network/timeouts and 5xx
      if (error && error.code === 'TIMEOUT') return true;
      return retryPredicates.isTransientError(error);
    },
    {
      maxRetries: 2, // at most one retry on transient errors
      baseDelay: 1000,
      maxDelay: 3000,
      context: 'Web scraping',
    }
  );
}

/**
 * Extract main content from HTML
 * 
 * @param {string} html - HTML content
 * @param {number} maxLength - Maximum content length
 * @returns {string} Extracted text content
 */
function extractContent(html, maxLength) {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share, iframe, noscript').remove();

  // Try to find main content using common selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.content',
    'main',
    '.main-content',
    '#content',
    '#main',
  ];

  let content = '';

  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      if (text.length > content.length) {
        content = text;
      }
    }
  }

  // Fallback to body if no specific content found
  if (!content || content.length < 100) {
    content = $('body').text().trim();
  }

  // Clean up the content
  content = content
    .replace(/\s+/g, ' ')         // Multiple spaces to single space
    .replace(/\n+/g, '\n')        // Multiple newlines to single newline
    .replace(/[\t\r]/g, '')       // Remove tabs and carriage returns
    .substring(0, maxLength);     // Limit length

  return content;
}

/**
 * Get fallback message for failed scraping
 * 
 * @param {string} url - URL that failed to scrape
 * @returns {string} Fallback message
 */
function getFallbackMessage(url) {
  return `Article content from ${url} could not be extracted due to technical limitations, but the URL was found through search and likely contains relevant information about the topic.`;
}

/**
 * Create a LangChain-compatible scraper tool
 * 
 * @returns {Object} LangChain tool object
 */
export function createScraperTool() {
  return new DynamicTool({
    name: 'scrape_article',
    description:
      'Extract readable text from a URL returned by search. Input is a single URL string. Returns plain text content.',
    func: async (url) => {
      try {
        const content = await scrape(url);
        return content;
      } catch (error) {
        log.error('Scraper tool execution failed', error);
        return getFallbackMessage(url);
      }
    },
  });
}

export default {
  scrape,
  createScraperTool,
};

