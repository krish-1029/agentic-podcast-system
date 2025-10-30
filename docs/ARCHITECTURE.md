# Architecture Documentation

## System Overview

The Agentic Podcast System is a **multi-agent content generation platform** that demonstrates production-ready patterns for building reliable AI systems. It uses specialized agents that research different topics in parallel, then synthesizes their findings into cohesive podcast scripts.

## Core Architectural Principles

### 1. Multi-Agent Coordination

**Problem:** Single LLM calls are limited in scope and quality for complex tasks.

**Solution:** Specialized agents working in parallel, each focused on a specific domain.

```
User Request
    │
    ▼
┌────────────────┐
│  Orchestrator  │  ← Coordinates everything
└────────────────┘
    │
    ├─→ [Tech Agent]    ──→ "Tech Report"
    ├─→ [Finance Agent] ──→ "Finance Report"
    ├─→ [F1 Agent]      ──→ "F1 Report"
    └─→ [Custom Agent]  ──→ "Custom Report"
    │
    ▼
┌────────────────┐
│ Editor-in-Chief│  ← Synthesizes into one script
└────────────────┘
    │
    ▼
  Final Script
```

**Benefits:**
- Parallelization: Agents run concurrently (2-3x faster)
- Specialization: Each agent is expert in its domain
- Isolation: One agent failure doesn't crash entire system
- Scalability: Easy to add new channels/agents

### 2. ReAct Agents (Reasoning + Acting)

The system uses **LangChain ReAct agents** for research:

- Agent plans tool usage (search/scrape) iteratively based on what it learns
- Max iterations and timeouts prevent runaway loops
- Tools have built-in budgets (e.g., max 3 searches) for cost control
- Flexible and intelligent - adapts search strategy based on findings

**Note on Development Journey:**
Early in development, ReAct agents were getting stuck or producing inconsistent results. I built a deterministic search pipeline as a fallback (fixed sequence: date-stamped search → scrape → summarize). However, after iterating on agent prompts—adding explicit search strategies, clear budgets, and structured output formats—the ReAct agents now work reliably. The deterministic code remains in the codebase (`--deterministic` flag) but is no longer needed.

ReAct loop:

```
Agent receives task
    │
    ▼
┌─────────────────────────────┐
│ Thought: "I need to search  │
│ for latest tech news"       │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ Action: web_search          │
│ Input: "tech news today"    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ Observation: [search results]│
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ Thought: "I should read the │
│ top article for details"    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ Action: scrape_article      │
│ Input: "https://..."        │
└─────────────────────────────┘
    │
    ▼
... (iterate until done)
    │
    ▼
┌─────────────────────────────┐
│ Final Answer: [report]      │
└─────────────────────────────┘
```

**Why ReAct?**
- **Self-directed**: Agent decides what to do next based on what it learns
- **Intelligent tool usage**: Can search multiple times, scrape when needed, adapt strategy
- **Reasoning visible**: Can see agent's thought process in logs
- **Proven pattern**: Well-researched and effective for research tasks
- **Reliable with constraints**: Bounded iterations + tool budgets prevent runaway loops

### 3. Adaptive Search Strategies (Breadth vs. Depth)

**Problem:** Generic prompts produce inconsistent coverage—agents either fixate on one narrow topic or superficially mention too many stories.

**Solution:** Each agent now chooses a search strategy based on initial findings:

```
Agent performs initial search
    │
    ▼
Analyzes results
    │
    ├─→ ONE dominant story?     → STRATEGY A: Deep Dive (all 3 searches on one topic)
    ├─→ MULTIPLE stories?       → STRATEGY B: Balanced Coverage (2-3 topics)
    └─→ Breaking/crisis news?   → STRATEGY C: Specialized Focus
```

**Example (Finance Agent):**
- **Strategy A - Major Market Event**: Fed rate decision → 3 searches on Fed → 280-350 words deep dive
- **Strategy B - Market Roundup**: Mixed day → Search 1 (overview) + Search 2 (earnings) + Search 3 (crypto) → 100-120 words per topic
- **Strategy C - Sector Focus**: Tech stocks driving market → 3 searches on tech sector → deep sector analysis

**Example (F1 Agent):**
- **Strategy A - Race Weekend Deep Dive**: Race happening this weekend → qualifying + race results → detailed race coverage
- **Strategy B - Two Stories**: Off-season → driver signing + team announcement → balanced coverage of both
- **Strategy C - Upcoming Preview**: Race next week → track preview + championship standings → race buildup

**Benefits:**
- **Appropriate depth**: Major stories get full treatment; quiet days get diverse coverage
- **No repetition**: Agent knows when to go deep vs. broad
- **Better utilization**: 3 searches + 300 words optimally allocated based on content
- **Clear decision framework**: Agent explicitly chooses and follows a strategy

**Implementation:** Each channel prompt includes 3 strategy templates. After the initial search, the agent explicitly declares which strategy it will follow, then executes that search pattern.

### 4. Reliability Patterns

#### Circuit Breaker Pattern

**Purpose:** Prevent cascade failures when external services fail.

**States:**
```
CLOSED (Normal)
    │
    ├─→ Request succeeds → Stay CLOSED
    │
    └─→ Request fails (3x) → Transition to OPEN
            │
            ▼
        OPEN (Blocking)
            │
            ├─→ Block all requests
            └─→ Wait 60 seconds → Transition to HALF_OPEN
                    │
                    ▼
                HALF_OPEN (Testing)
                    │
                    ├─→ Request succeeds → Transition to CLOSED
                    └─→ Request fails → Transition back to OPEN
```

**Implementation:**
- Per-service tracking (Tavily, scraping)
- Automatic state management
- Fallback execution when circuit is open

#### Retry with Exponential Backoff

**Purpose:** Handle transient failures without overwhelming services.

```
Attempt 1 fails → Wait 1 second  → Retry
Attempt 2 fails → Wait 2 seconds → Retry
Attempt 3 fails → Wait 4 seconds → Retry
Attempt 4 fails → Give up
```

**Use cases:**
- Network hiccups
- Rate limiting
- Temporary service unavailability

#### Timeout Handling

**Purpose:** Prevent operations from hanging indefinitely.

```javascript
Promise.race([
  operation(),
  timeout(45000) // 45 seconds
])
```

Every operation has a timeout:
- Agent execution: 45s
- LLM calls: 30s
- Web search: 10s
- Web scraping: 12s

#### Fallback Content

**Purpose:** Always deliver something useful, never fail completely.

```
Try: Live web search
    │
    ├─→ Success → Use real data
    │
    └─→ Failure → Use curated fallback content
```

Fallback content is:
- Domain-specific and relevant
- Pre-curated and high-quality
- Better than generic error messages

### 4. Planner → Iterative Section Writer (replaces single-pass editor)

**Problem:** A single-pass synthesis can misinterpret or over/under-shoot length.

**Solution:** Two-step synthesis that is easier to control and audit:
1) **Planner** produces a JSON plan (overview + sections with goals and word budgets) from the agent reports and listening context.
2) **Section Writer** iteratively writes each section using the plan and already-written script for continuity.

```
Agent Reports (Raw):
├─→ Tech: "AI models released..."
├─→ Finance: "Markets up 2%..."
└─→ F1: "Hamilton wins race..."

    │
    ▼

Planner produces JSON plan → Section Writer iterates:
    │
    ▼

Result:
"Good morning! Let's start with exciting
tech news. AI models have... [smooth transition]
In financial markets today... [smooth transition]
And in Formula 1..."
```

**Benefits:**
- Structured control over outline and length
- Clear traceability from plan to script
- Easier to recover if one section fails (write next)
- JSON plan is saved (plan + planRaw) for debugging

### 5. Separation of Concerns

Clear module boundaries:

```
┌──────────────────────────────────────┐
│            CLI Layer                  │  ← User interface
├──────────────────────────────────────┤
│        Orchestration Layer            │  ← Workflow coordination
├──────────────────────────────────────┤
│          Agent Layer                  │  ← Domain specialists
├──────────────────────────────────────┤
│          Tools Layer                  │  ← Web search, scraping
├──────────────────────────────────────┤
│         Utilities Layer               │  ← Circuit breakers, retry
└──────────────────────────────────────┘
```

**Benefits:**
- Testability: Each layer can be tested independently
- Maintainability: Changes isolated to specific modules
- Reusability: Utilities used across layers
- Clarity: Clear responsibilities

## Data Flow

### Complete Request Flow

```
1. User runs CLI wizard or generate
   npm start init  (interactive)
   # or
   npm start generate -- --channels tech,finance --duration 5

2. CLI parses arguments
   channels: ['tech', 'finance']
   duration: 5
   setting: 'morning_routine'

3. Create UserContext
   context = {
     channels: ['tech', 'finance'],
     customRequests: [],
     setting: 'morning_routine',
     duration: 5
   }

4. Execute Workflow
   orchestrator.execute()

5. ReAct Agent Research per Channel (parallel with concurrency control)
   ├─→ tech agent: reasons about search strategy → searches → scrapes → synthesizes report
   └─→ finance agent: reasons about search strategy → searches → scrapes → synthesizes report

6. Collect Agent Results
   workflowResults = {
     channelReports: {
       tech: { report: "...", status: "success", tokenUsage: {...} },
       finance: { report: "...", status: "success", tokenUsage: {...} }
     },
     customReport: null
   }

7. Plan & Iterative Write
   ├─→ Planner (JSON mode): overview + sections (id, title, goal, approx_words, content_refs)
   ├─→ Writer iterates sections → appends to final script
   └─→ plan + planRaw + tokenUsage saved into agent-reports.json

8. Save Outputs
   output/
   └── 2025-01-15T10-30-00-000Z/
       ├── agent-reports.json  (includes token usage metadata)
       └── script.txt

9. Display Results to User (with token usage & cost estimates)
```

## Error Handling Strategy

### Failure Modes and Responses

| Failure | Response | User Impact |
|---------|----------|-------------|
| Single agent fails | Use fallback content | Slightly lower quality, but system works |
| Web search fails | Use curated fallback | Generic but relevant content |
| All agents fail | Use all fallbacks | System still produces output |
| LLM timeout | Retry with backoff | Slight delay, then succeeds or fails gracefully |
| Network error | Retry 3 times | Transparent to user |
| Invalid config | Fail fast with clear error | User can fix and retry |

### Graceful Degradation Hierarchy

```
Best case: All agents succeed with live data
    ↓
Good case: Most agents succeed, some use fallback
    ↓
Acceptable case: Mix of success and fallback
    ↓
Minimum viable: All agents use fallback content
    ↓
Only fail: Invalid configuration (user error)
```

## Performance & Concurrency

### Typical Timings

- **Agent research**: ~20–60s per channel (varies with ReAct iterations and network)
- **Parallel execution**: wall time ≈ max(channel durations in a batch)
- **Plan & write**: ~20–35s for typical 5-minute script
- **Total**: commonly 60–120s, varies by agent reasoning depth and network

### Optimization Strategies

1. **Concurrency Control**
   - Agents run in parallel batches (default cap: 2, configurable)
   - Prevents overwhelming external APIs
   - Recommendation: 1–3 for public sites to minimize 403/timeouts

2. **Caching**
   - LangChain prompt caching
   - Circuit breaker state persistence
   - Agent initialization reuse

3. **Early Termination**
   - Agents stop when sufficient info gathered
   - Max iterations prevents infinite loops
   - Timeouts prevent hanging

## Extension Points

### Adding New Channels

```javascript
// In channel-registry.js
export const CHANNELS = {
  // ... existing channels ...
  
  gaming: {
    id: 'gaming',
    name: 'Gaming & Esports',
    description: 'Latest gaming news and esports',
    category: 'entertainment',
    getPrompt: (customRequests) => {
      return `You are a Gaming specialist...`;
    },
  },
};
```

### Adding New Tools

```javascript
// In tools/
export function createWeatherTool() {
  return {
    name: 'get_weather',
    description: 'Get current weather for a location',
    call: async (location) => {
      // Implementation
    },
  };
}
```

### Custom Agent Types

Extend `BaseAgent` for new agent behaviors:

```javascript
class FactCheckAgent extends BaseAgent {
  async verify(claim) {
    // Custom verification logic
  }
}
```

## Testing Strategy

### Unit Tests (Planned)

- Tool functions (search, scrape)
- Utility functions (retry, timeout, circuit breaker)
- UserContext validation

### Integration Tests (Planned)

- Agent execution with mock tools
- Workflow coordination
- End-to-end pipeline with ReAct agents

### Manual Testing

Currently using CLI commands:
```bash
npm start test-agent -- --channel tech
npm start test-search -- --query "test"
npm start init                      # Interactive wizard
npm start generate -- --channels tech --duration 3
```

## Security Considerations

### API Key Management

- **Never commit** `.env` files
- Use environment variables
- Validate keys on startup

### Input Validation

- Validate channel names
- Sanitize search queries
- Limit duration ranges

### Output Safety

- No PII in logs
- Safe file paths for output
- Sanitized error messages

## Future Enhancements

1. **Agent Historical Context & Memory**
   - **Problem**: Agents currently have no memory of previous reports, leading to potential repetition and missing story continuations
   - **Solution**: Pass previous N reports to agents as context
   - **Implementation approach**:
     ```javascript
     // Pseudocode
     const previousReports = await loadRecentReports(channelId, days: 7);
     const prompt = `
       Your previous reports from the last 7 days:
       ${previousReports.map(r => `[${r.date}]: ${r.summary}`).join('\n')}
       
       Today's task: Research and report on NEW developments.
       - If a story from your previous reports has updates, lead with "UPDATE:" and explain what changed
       - Avoid repeating facts you already covered unless there are new developments
       - Prioritize entirely new stories if no major updates exist
     `;
     ```
   - **Benefits**:
     - No repetition across days
     - Natural story continuations ("UPDATE: Fed decision impact")
     - Better context for ongoing stories (wars, trials, championships)
     - Improved listener experience with coherent multi-day narrative
   - **Challenges**:
     - Token budget management (summaries vs. full reports)
     - Storage and retrieval of historical reports
     - Deciding how far back to look (recency vs. context tradeoff)
   - **Not implementing yet** because it requires persistent storage design and careful prompt engineering to avoid hallucinated "updates"

2. **Distributed Execution**
   - Run agents on different machines
   - Message queue for coordination
   - Horizontal scaling

3. **Result Caching**
   - Cache agent reports for recent queries
   - Time-based invalidation
   - Reduces API costs

4. **Quality Metrics**
   - Track agent success rates
   - Measure synthesis quality
   - A/B test different prompts

5. **User Feedback Loop**
   - Rate generated podcasts
   - Improve prompts based on feedback
   - Personalization over time

## Roadmap:

### Near-term

- **Vendor ReAct prompt locally**: Remove dependency on `hwchase17/react` from Hub; tune for our tool budgets and grounding constraints.
- **Structured I/O everywhere**: enforce JSON Schema (Zod/TypeBox) for planner and writer; validate/repair before use.
- **Complete token tracking**: Implement custom agent loop to capture ReAct token usage (currently only tracking synthesis).
- **Duration-aware agents**: Pass `duration` parameter to agents so they can adjust search depth and report length
  - Short podcasts (3 min) → fewer searches (1-2), concise reports (200-250 words)
  - Long podcasts (10+ min) → more searches (3-4), detailed reports (400-500 words)
  - Agents dynamically scale research effort based on time budget
- **Eval suite (smoke-level)**:
  - Planner JSON schema golden tests.
  - Writer length adherence and no-repeat checks.
  - Grounding checks: facts require source citations present in scraped content.
- **Container & CI**: Dockerfile; GitHub Actions for lint/tests/build; example `docker run` in README.

### Short-term

- **Replace ReAct with native function-calling** (OpenAI tool calling) to call `search`/`scrape` directly; remove `DynamicTool`/Hub dependencies.
- **TypeScript migration** for `orchestrator`, `synthesis`, and `tools` to gain compile-time safety.
- **Persistent cache/content store**: cache search/scrape by (query/url, date); enable idempotent reruns and cost savings.
- **Security posture**: robots.txt awareness, optional domain allowlist, basic rate limiting and polite crawling headers.
- **Minimal web UI**: select channels/setting, preview plan/sections, one-click audio; keeps CLI for power users.
- **Audio pipeline**: parallelize TTS chunks with a small concurrency cap; loudness normalization; silence trimming; optional SSML/ElevenLabs v3 tag validation prior to TTS.

### Medium-term

- **Deployment story**: one-click deploy (Render/Fly/Heroku) or serverless job runner for scheduled shows.
- **Content provenance**: attach per-sentence citations in the script; clickable links in UI.
- **Human-in-the-loop editing**: lock/modify plan sections and re-generate only impacted parts.
- **Cost controls**: token budgeting per stage; adaptive length planning based on budget.

## LangChain: Usage, Critique, and Migration Plan

### Current usage

- **ReAct agent** initialized via Hub prompt and `createReactAgent` in `BaseAgent`.
- **Tool wrappers** implemented as `DynamicTool` for `web_search` and `scrape_article` with budget caps.

### Friction points

- **Prompt drift**: depends on `hwchase17/react` from the Hub; behavior can change outside our control.
- **Opaque loops**: budget/timeouts needed to bound agent iterations; variable latency and outcomes.
- **Stringly-typed tools**: JSON-in-strings increases parsing brittleness and error handling overhead.
- **Overlap of concerns**: our retries/timeouts/circuit breakers duplicate parts of LangChain, risking conflicts.

### Migration plan

1. **Vendor prompt locally** if ReAct is kept; tune for our tool budgets and grounding constraints.
2. **Introduce native function-calling** for `search` and `scrape`; remove `DynamicTool` glue.
3. **Schema-first contracts**: planner and writer operate in JSON mode with schema validation.
4. **De-scope LC** to optional experimentation path; native function-calling becomes the primary approach.

Status: ReAct agents currently work well with prompt engineering; function-calling is a targeted upgrade for better reliability and observability.

## Podcast Quality Evaluation Strategy (Idea)

### Pillars of a Great Podcast (framework)

- **Accuracy & grounding**: verifiable facts with linked sources; no fabrication.
- **Structure & flow**: clear narrative arc, purposeful sections, smooth transitions.
- **Voice & tone**: matches setting (e.g., morning routine vs. wind-down); consistent persona.
- **Pacing & length**: adheres to target minutes and per-section word budgets; avoids rambling.
- **Variety & novelty**: coverage diversity (topics/sources); avoids repetition.
- **Actionability & clarity**: specific takeaways, numbers, dates; avoids vague generalities.
- **Safety & compliance**: respectful language; domain TOS considerations; no sensitive PII.
- **Audio expression**: appropriate use of ElevenLabs v3 tags for emphasis/pauses and clarity.

### Agent-based judge (automated evals)

1. Train a rubric using the Pillars by analyzing a corpus of high-quality podcasts (transcripts and audio).
2. Build an evaluator agent that:
   - Scores each pillar (0–5) with brief justifications and cited evidence (URLs/timecodes).
   - Checks grounding: every factual claim maps to a scraped excerpt or is labeled uncertain.
   - Verifies pacing: target words vs. actual words; section-level deviations flagged.
   - Reviews audio tags: flags missing or overused emphasis/pauses.
3. Output an **Eval Report** JSON with per-pillar scores, overall score, and remediation suggestions.

### Operationalizing evals

- **Regression gates**: PRs must not reduce overall score or grounding score beyond thresholds.
- **Golden sets**: a small curated set of topics with expected eval ranges to detect drift.
- **Telemetry**: store eval reports alongside artifacts; track trends over time.


