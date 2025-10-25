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

### 2. Research Modes: Deterministic vs. ReAct

There are two research paths:

- **Deterministic Pipeline (default)**
  - Fixed, predictable steps per channel: date-stamped search → scrape first accessible result(s) → summarize.
  - Bounded budgets (e.g., 3 searches, 1 scrape) for stability and speed.
  - Parallelized per batch with configurable concurrency.
  - Resilient: fast-fails on 401/403/404/451; retries only transient errors.

- **LangChain ReAct (Reasoning + Acting)**
  - Agent plans tools (search/scrape) iteratively (max iterations configurable).
  - More flexible, but can be slower/less predictable.

ReAct loop (when enabled):

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

**Why two modes?**
- Deterministic: stable demos, reliable timelines, minimal nondeterminism.
- ReAct: exploratory depth when needed, at the cost of more variability.
- Self-directed: Agent decides what to do next
- Tool usage: Can use multiple tools intelligently
- Reasoning visible: Can see agent's thought process
- Proven pattern: Well-researched and effective

### 3. Reliability Patterns

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
- Deterministic control over outline and length
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

## Data Flow (Deterministic Mode)

### Complete Request Flow

```
1. User runs CLI wizard or generate
   npm start init  (interactive)
   # or
   npm start generate -- --channels tech,finance --duration 5 --deterministic

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

5. Deterministic Research per Channel (parallel per batch)
   ├─→ tech: search (time_range='day') → scrape first accessible → summarize
   └─→ finance: search (time_range='day') → scrape first accessible → summarize

6. Collect Agent Results
   workflowResults = {
     channelReports: {
       tech: { report: "...", status: "success" },
       finance: { report: "...", status: "success" }
     },
     customReport: null
   }

7. Plan & Iterative Write
   ├─→ Planner (JSON mode): overview + sections (id, title, goal, approx_words, content_refs)
   ├─→ Writer iterates sections → appends to final script
   └─→ plan + planRaw saved into agent-reports.json

8. Save Outputs
   output/
   └── 2025-01-15T10-30-00-000Z/
       ├── agent-reports.json
       └── script.txt

9. Display Results to User
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

- **Deterministic research**: ~15–45s per channel (network-dependent)
- **Parallel batches**: wall time ≈ max(channel durations in a batch)
- **Plan & write**: ~20–35s for typical 5-minute script
- **Total**: commonly 50–90s, varies by network and sources

### Optimization Strategies

1. **Concurrency Control**
   - Deterministic: parallelize channels per batch (default cap 2; configurable)
   - ReAct: same batching with Promise.all
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
- End-to-end pipeline with deterministic mode

### Manual Testing

Currently using CLI commands:
```bash
npm start test-agent -- --channel tech
npm start test-search -- --query "test"
npm start init                      # Interactive
npm start generate -- --channels tech --duration 3 --deterministic
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

1. **Distributed Execution**
   - Run agents on different machines
   - Message queue for coordination
   - Horizontal scaling

2. **Result Caching**
   - Cache agent reports for recent queries
   - Time-based invalidation
   - Reduces API costs

3. **Quality Metrics**
   - Track agent success rates
   - Measure synthesis quality
   - A/B test different prompts

4. **User Feedback Loop**
   - Rate generated podcasts
   - Improve prompts based on feedback
   - Personalization over time

## Roadmap: Production-Grade Improvements

### Near-term

- **Default to deterministic mode** and keep ReAct behind a flag; vendor a local ReAct prompt if retained.
- **Structured I/O everywhere**: enforce JSON Schema (Zod/TypeBox) for planner and writer; validate/repair before use.
- **Metrics & observability**: capture per-stage latency, token usage, tool counts, cache hits; persist next to `agent-reports.json`.
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
4. **De-scope LC** to optional experimentation path; deterministic + function-calling path becomes the default.

Status: deterministic path already implemented; function-calling agent is a targeted near-term replacement for ReAct.

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

## Conclusion

This architecture demonstrates:
- Clean separation of concerns
- Production-ready reliability patterns
- Extensible design
- Clear data flow
- Graceful error handling

Perfect for showcasing in technical interviews or portfolio reviews.

