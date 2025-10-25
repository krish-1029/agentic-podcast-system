/**
 * Fallback Content Generator
 * 
 * Provides curated fallback content when web searches fail.
 * This ensures the system always has something meaningful to work with,
 * demonstrating graceful degradation.
 */

export const FALLBACK_CONTENT = {
  tech: {
    title: "Current Technology Trends",
    content: `The technology landscape continues to evolve rapidly with several key trends. 
AI and machine learning integration is becoming ubiquitous across development tools and platforms. 
Cloud-native architectures continue to gain prominence with increased focus on Kubernetes and serverless computing. 
Cybersecurity and privacy considerations are more critical than ever, with zero-trust architectures becoming standard. 
Low-code and no-code platforms are democratizing software development while edge computing and IoT solutions are expanding. 
Developer productivity tools are becoming more sophisticated with AI-powered code completion and automated testing. 
The industry continues to emphasize collaborative development practices and DevOps automation.`,
    category: "technology",
  },

  finance: {
    title: "Financial Market Overview",
    content: `Financial markets continue to show mixed signals with ongoing attention to central bank policy decisions and inflation data. 
Technology stocks remain volatile as investors reassess valuations in a higher interest rate environment. 
Traditional sectors show resilience with focus on dividend-paying companies and value stocks. 
Cryptocurrency markets are experiencing increased regulatory clarity across major economies. 
Interest rate expectations continue to influence investment strategies with many investors focusing on quality growth stocks. 
Emerging markets are showing selective opportunities amid global economic uncertainty. 
ESG investing and sustainable finance continue to grow in importance across institutional portfolios.`,
    category: "finance",
  },

  f1: {
    title: "Formula 1 Season Update",
    content: `The Formula 1 season continues with intense competition across the grid. 
Championship battles remain tight with strategic decisions playing crucial roles in race outcomes. 
Technical regulations continue to shape car development with teams focusing on aerodynamic efficiency and power unit optimization. 
Driver performance and team strategies are proving decisive with pit stop timing and tire management being key factors. 
Track conditions and weather continue to add unpredictability to race weekends creating opportunities for different teams. 
The engineering battle is as intense as ever with teams constantly developing and upgrading their cars throughout the season.`,
    category: "sports",
  },

  world_news: {
    title: "Global Developments Overview",
    content: `Recent developments across various sectors continue to shape global trends. 
Diplomatic efforts and international cooperation remain key themes as nations work together on shared challenges. 
Economic indicators show mixed signals with varying growth rates across different regions. 
Technology advancement continues to drive change in how people work, communicate, and solve problems. 
Climate and environmental considerations are increasingly influencing policy decisions worldwide. 
Innovation in multiple fields is creating new opportunities while digital transformation remains a priority across industries and governments.`,
    category: "general",
  },

  science: {
    title: "Scientific Research Updates",
    content: `Scientific research continues advancing across multiple disciplines with exciting developments. 
Medical research is making progress in understanding disease mechanisms and developing new treatments. 
Environmental science research is providing crucial insights into climate patterns and ecosystem dynamics. 
Space exploration continues with new missions and discoveries expanding our understanding of the universe. 
Technological innovation in AI and machine learning is accelerating scientific discovery across fields. 
Biotechnology and genomics research are opening new possibilities in medicine and agriculture.`,
    category: "science",
  },

  general: {
    title: "Current Events Overview",
    content: `Recent developments across various sectors continue to shape trends and create new opportunities. 
Innovation and technological advancement remain central themes driving change across industries. 
Social and economic developments are creating both challenges and opportunities globally. 
Sustainable practices and digital transformation continue to be priorities for organizations worldwide. 
Communities and institutions are adapting to evolving circumstances with resilience and creativity.`,
    category: "general",
  },
};

/**
 * Generate fallback content for a query
 * 
 * @param {string} query - The search query that failed
 * @param {string} category - Content category (tech, finance, f1, etc.)
 * @returns {Array} Array of search result objects with fallback content
 */
export function generateFallbackContent(query, category = 'general') {
  const fallback = FALLBACK_CONTENT[category] || FALLBACK_CONTENT.general;
  
  return [{
    title: fallback.title,
    content: `${fallback.content}\n\nNote: This content was generated as a fallback when real-time search for "${query}" was unavailable. While not current, it provides relevant context for the topic.`,
    url: '',
    source: 'Fallback Content',
    isFallback: true,
  }];
}

/**
 * Determine category from query keywords
 * 
 * @param {string} query - Search query
 * @returns {string} Detected category
 */
export function detectCategory(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('tech') || lowerQuery.includes('programming') || 
      lowerQuery.includes('software') || lowerQuery.includes('developer')) {
    return 'tech';
  }
  
  if (lowerQuery.includes('finance') || lowerQuery.includes('market') || 
      lowerQuery.includes('stock') || lowerQuery.includes('crypto')) {
    return 'finance';
  }
  
  if (lowerQuery.includes('f1') || lowerQuery.includes('formula') || 
      lowerQuery.includes('racing')) {
    return 'f1';
  }
  
  if (lowerQuery.includes('science') || lowerQuery.includes('research') || 
      lowerQuery.includes('discovery')) {
    return 'science';
  }
  
  if (lowerQuery.includes('world') || lowerQuery.includes('global') || 
      lowerQuery.includes('international')) {
    return 'world_news';
  }
  
  return 'general';
}

export default {
  FALLBACK_CONTENT,
  generateFallbackContent,
  detectCategory,
};

