# Token Usage & Cost Tracking

This document describes the token tracking and cost calculation features added to the podcast generation system.

## Overview

Token usage is now tracked across all LLM interactions (agents, planner, and writer) and reported in:
- Agent reports JSON file
- CLI output with cost estimates
- Detailed breakdown by component

## Implementation

### 1. Token Tracking from Response Metadata

**Location:** `src/synthesis/planner.js`, `src/synthesis/writer.js`

Token usage is extracted directly from LangChain response objects using the `usage_metadata` field:

```javascript
const response = await this.llm.invoke(prompt);
const text = response.content;

// Extract token usage from response metadata
const tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
const usage = response.usage_metadata || response.response_metadata?.tokenUsage;
if (usage) {
  tokenUsage.promptTokens = usage.input_tokens || usage.promptTokens || 0;
  tokenUsage.completionTokens = usage.output_tokens || usage.completionTokens || 0;
  tokenUsage.totalTokens = usage.total_tokens || usage.totalTokens || 0;
}
```

**Note on Agents:** Token usage for ReAct agents (research phase) cannot be reliably captured because `AgentExecutor` does not expose individual LLM call metadata in its response. This is a known limitation of LangChain's agent system. Agent token counts will show as 0 in reports.

### 2. Agent Token Tracking

**Modified Files:**
- `src/agents/base-agent.js` - Added callback handler, returns token usage in execute()
- `src/agents/channel-agent.js` - Captures and includes token usage in research results

**Example Output:**
```javascript
{
  channelId: "tech",
  report: "...",
  tokenUsage: {
    promptTokens: 2500,
    completionTokens: 800,
    totalTokens: 3300
  }
}
```

### 3. Synthesis Token Tracking

**Modified Files:**
- `src/synthesis/planner.js` - Tracks tokens during plan creation
- `src/synthesis/writer.js` - Tracks tokens during section writing

Both components return token usage alongside their outputs.

### 4. Workflow Aggregation

**Location:** `src/orchestrator/workflow.js`

The workflow now:
1. Initializes a `metadata.tokenUsage` structure
2. Collects agent token usage per channel
3. Collects synthesis token usage (planner + writer)
4. Calculates grand totals in `calculateTotalTokenUsage()`

**Metadata Structure:**
```javascript
{
  metadata: {
    tokenUsage: {
      agents: {
        tech: { promptTokens: 2500, completionTokens: 800, totalTokens: 3300 },
        finance: { promptTokens: 2200, completionTokens: 750, totalTokens: 2950 }
      },
      synthesis: {
        planner: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500 },
        writer: { promptTokens: 3500, completionTokens: 1200, totalTokens: 4700 }
      },
      total: { promptTokens: 9400, completionTokens: 3050, totalTokens: 12450 }
    }
  }
}
```

### 5. Cost Calculation

**Location:** `src/utils/token-cost.js`

Utility module with OpenAI pricing (per 1M tokens):
- **gpt-4o-mini**: $0.15 prompt / $0.60 completion
- **gpt-4o**: $2.50 prompt / $10.00 completion
- **gpt-4-turbo**: $10.00 prompt / $30.00 completion
- **gpt-4**: $30.00 prompt / $60.00 completion
- **gpt-3.5-turbo**: $0.50 prompt / $1.50 completion

**Key Functions:**
- `calculateCost(tokenUsage, model)` - Cost for a single component
- `calculateWorkflowCost(results, agentModel, synthesisModel)` - Full workflow cost
- `formatCost(cost)` - Format as USD string
- `getCostSummary(costs)` - Human-readable summary

### 6. CLI Display

**Location:** `cli/commands/generate.js`

The `displayAgentSummary()` function now shows:
```
Agent Summary:
  Total channels: 2
  Successful: 2
  Custom requests: none

Token Usage & Cost:
  Total tokens: 12,450
    Prompt: 9,400
    Completion: 3,050
  Estimated cost: $0.0032
    Agents: $0.0017
    Synthesis: $0.0016
```

## Usage

Token tracking is automatic - no configuration needed. Just run:

```bash
npm start generate -- --channels tech,finance --duration 5
```

Token usage and costs will appear in:
1. **CLI output** - Summary after agent workflow
2. **agent-reports.json** - Full breakdown in `metadata.tokenUsage`

## Example Cost Scenarios

### Scenario 1: Single Tech Channel, 3 minutes
- **Agent Research**: Not tracked (see limitations)
- **Planning**: ~1,000-1,500 tokens (~$0.0003)
- **Writing**: ~2,500-4,000 tokens (~$0.0008)
- **Total**: ~$0.001-0.002 (synthesis only)

### Scenario 2: Two Channels, 5 minutes
- **Agent Research**: Not tracked (see limitations)
- **Planning**: ~1,500-2,000 tokens (~$0.0005)
- **Writing**: ~4,000-6,000 tokens (~$0.0012)
- **Total**: ~$0.002-0.003 (synthesis only)

### Scenario 3: Three Channels, 10 minutes
- **Agent Research**: Not tracked (see limitations)
- **Planning**: ~2,000-3,000 tokens (~$0.0008)
- **Writing**: ~8,000-12,000 tokens (~$0.0025)
- **Total**: ~$0.003-0.005 (synthesis only)

## Benefits

1. **Cost Transparency** - Know exactly how much each podcast costs
2. **Optimization** - Identify which components use the most tokens
3. **Budgeting** - Plan API costs for production deployments
4. **Debugging** - Track token usage to detect inefficient prompts
5. **Reporting** - Show employers you understand production concerns

## Known Limitations

**Agent Token Tracking:**
LangChain's `AgentExecutor` does not expose individual LLM call metadata in its response. This means we cannot reliably track token usage during the ReAct agent research phase. The agent `tokenUsage` fields will show 0 in reports.

**Why This Happens:**
- `AgentExecutor.invoke()` returns only the final output, not intermediate LLM calls
- Callbacks like `handleLLMEnd` are not reliably triggered in newer LangChain versions
- Each agent iteration involves multiple LLM calls (reasoning + tool selection), but these are hidden

**Workaround Options (Not Implemented):**
1. Use LangSmith tracing (requires separate service/API key)
2. Manually wrap LLM calls and track them outside AgentExecutor
3. Switch to deterministic search (which we can track, but loses ReAct flexibility)
4. Estimate based on prompt/response lengths (inaccurate)

For now, we accurately track **synthesis tokens** (planner + writer), which represent a significant portion of total usage.

## Future Enhancements

Potential improvements (not yet implemented):

**Token Tracking:**
- Implement custom agent loop to capture token usage
- Token usage alerts/warnings when exceeding thresholds
- Budget limits to prevent runaway costs
- Historical cost tracking and analytics
- Support for other LLM providers (Anthropic, etc.)
- LangSmith integration for full trace analysis

**Agent Intelligence:**
- Pass `duration` parameter to agents so they can adjust search depth and report length
  - Short podcasts (3 min) → fewer searches, concise reports (200-250 words)
  - Long podcasts (10+ min) → more searches, detailed reports (400-500 words)
  - Agents could dynamically scale their research effort based on time budget
- Per-channel cost comparison over time
- Agent self-reflection on search effectiveness

