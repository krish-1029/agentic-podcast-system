/**
 * Token Cost Calculator
 * 
 * Calculates costs for OpenAI API usage based on token counts
 */

// OpenAI pricing (as of 2024, per 1M tokens)
// Source: https://openai.com/api/pricing/
const PRICING = {
  'gpt-4o': {
    prompt: 2.50,      // $2.50 per 1M input tokens
    completion: 10.00, // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    prompt: 0.150,     // $0.15 per 1M input tokens
    completion: 0.600, // $0.60 per 1M output tokens
  },
  'gpt-4-turbo': {
    prompt: 10.00,     // $10.00 per 1M input tokens
    completion: 30.00, // $30.00 per 1M output tokens
  },
  'gpt-4': {
    prompt: 30.00,     // $30.00 per 1M input tokens
    completion: 60.00, // $60.00 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    prompt: 0.50,      // $0.50 per 1M input tokens
    completion: 1.50,  // $1.50 per 1M output tokens
  },
};

/**
 * Calculate cost for token usage
 * 
 * @param {Object} tokenUsage - Token usage object
 * @param {number} tokenUsage.promptTokens - Number of prompt tokens
 * @param {number} tokenUsage.completionTokens - Number of completion tokens
 * @param {number} tokenUsage.totalTokens - Total tokens (optional, for validation)
 * @param {string} model - Model name (e.g., 'gpt-4o-mini')
 * @returns {Object} Cost breakdown
 */
export function calculateCost(tokenUsage, model = 'gpt-4o-mini') {
  // Normalize model name - check exact match first, then longest matching prefix
  let modelKey = PRICING[model] ? model : null;
  
  if (!modelKey) {
    // Find the longest matching key (to handle gpt-4o-mini before gpt-4o)
    const matches = Object.keys(PRICING).filter(key => model.includes(key));
    modelKey = matches.sort((a, b) => b.length - a.length)[0] || 'gpt-4o-mini';
  }
  
  const pricing = PRICING[modelKey];

  if (!pricing) {
    throw new Error(`Unknown model: ${model}. Cannot calculate cost.`);
  }

  const promptCost = (tokenUsage.promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (tokenUsage.completionTokens / 1_000_000) * pricing.completion;
  const totalCost = promptCost + completionCost;

  return {
    model: modelKey,
    promptCost: Number(promptCost.toFixed(6)),
    completionCost: Number(completionCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    pricing: {
      promptPer1M: pricing.prompt,
      completionPer1M: pricing.completion,
    },
  };
}

/**
 * Calculate total cost for workflow results
 * 
 * @param {Object} workflowResults - Workflow results with tokenUsage metadata
 * @param {string} agentModel - Model used for agents (default: gpt-4o-mini)
 * @param {string} synthesisModel - Model used for synthesis (default: gpt-4o-mini)
 * @returns {Object} Complete cost breakdown
 */
export function calculateWorkflowCost(
  workflowResults,
  agentModel = 'gpt-4o-mini',
  synthesisModel = 'gpt-4o-mini'
) {
  const tokenUsage = workflowResults.metadata?.tokenUsage;
  
  if (!tokenUsage) {
    throw new Error('No token usage data found in workflow results');
  }

  const costs = {
    agents: {},
    synthesis: {},
    total: {},
  };

  // Calculate per-agent costs
  for (const channelId in tokenUsage.agents) {
    costs.agents[channelId] = calculateCost(tokenUsage.agents[channelId], agentModel);
  }

  // Calculate synthesis costs
  if (tokenUsage.synthesis.planner.totalTokens > 0) {
    costs.synthesis.planner = calculateCost(tokenUsage.synthesis.planner, synthesisModel);
  }
  if (tokenUsage.synthesis.writer.totalTokens > 0) {
    costs.synthesis.writer = calculateCost(tokenUsage.synthesis.writer, synthesisModel);
  }

  // Calculate total cost
  costs.total = calculateCost(tokenUsage.total, agentModel);

  return costs;
}

/**
 * Format cost as USD string
 * 
 * @param {number} cost - Cost in dollars
 * @returns {string} Formatted cost string (e.g., "$0.0025")
 */
export function formatCost(cost) {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get cost summary string
 * 
 * @param {Object} costs - Cost breakdown from calculateWorkflowCost
 * @returns {string} Human-readable summary
 */
export function getCostSummary(costs) {
  const lines = [];
  
  lines.push('Token Usage & Cost Summary:');
  lines.push('─'.repeat(50));
  
  // Agent costs
  if (Object.keys(costs.agents).length > 0) {
    lines.push('\nAgents:');
    for (const channelId in costs.agents) {
      const cost = costs.agents[channelId];
      lines.push(`  ${channelId}: ${formatCost(cost.totalCost)}`);
    }
  }
  
  // Synthesis costs
  if (costs.synthesis.planner || costs.synthesis.writer) {
    lines.push('\nSynthesis:');
    if (costs.synthesis.planner) {
      lines.push(`  Planner: ${formatCost(costs.synthesis.planner.totalCost)}`);
    }
    if (costs.synthesis.writer) {
      lines.push(`  Writer: ${formatCost(costs.synthesis.writer.totalCost)}`);
    }
  }
  
  // Total
  lines.push('\n' + '─'.repeat(50));
  lines.push(`Total Cost: ${formatCost(costs.total.totalCost)}`);
  lines.push(`  (${costs.total.promptCost.toFixed(6)} prompt + ${costs.total.completionCost.toFixed(6)} completion)`);
  
  return lines.join('\n');
}

export default {
  calculateCost,
  calculateWorkflowCost,
  formatCost,
  getCostSummary,
  PRICING,
};

