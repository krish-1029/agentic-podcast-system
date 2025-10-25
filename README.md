# Agentic Podcast System

A production-ready **multi-agent podcast generation system** that uses specialized AI agents to research different topics and synthesize them into cohesive, personalized podcast scripts.

## Key Features

- **Multi-Agent Architecture**: Specialized agents for different content domains (tech, finance, F1, science, etc.)
- **Web Research**: Real-time web search and article scraping for current information
- **Graceful Degradation**: Circuit breakers and fallback content ensure system never fails completely
- **Editor-in-Chief Pattern**: Synthesizes multiple agent reports into cohesive narrative
- **Production Patterns**: Retry logic, exponential backoff, timeout handling, structured logging
- **Optional Audio Generation**: Text-to-speech via ElevenLabs (optional)

## Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Interface                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator                                │
│  • User Context Management                                   │
│  • Workflow Coordination                                     │
│  • Progress Tracking                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Tech Agent   │ │Finance Agent │ │ Custom Agent │
│              │ │              │ │              │
│ LangChain    │ │ LangChain    │ │ LangChain    │
│ ReAct Agent  │ │ ReAct Agent  │ │ ReAct Agent  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │     Tools     │
                │               │
                │ • Web Search  │
                │ • Web Scraper │
                │ • Fallback    │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │   Planner     │  → JSON plan (overview + sections)
                │     +         │
                │   Writer      │  → Iteratively writes sections
                └───────────────┘
```

## Prerequisites

- **Node.js** 18.0.0 or higher
- **OpenAI API Key** (required) - Get one at [platform.openai.com](https://platform.openai.com)
- **Tavily API Key** (recommended) - Get free tier at [tavily.com](https://tavily.com)
- **ElevenLabs API Key** (optional) - Only needed for audio generation

## Quick Start

### 1. Installation

```bash
cd agentic-podcast-system
npm install
```

### 2. Configuration

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-your-key-here
TAVILY_API_KEY=tvly-your-key-here     # Optional but recommended
ELEVENLABS_API_KEY=your-key-here      # Optional, for audio only
```

### 3. Quick Start (Interactive)

```bash
npm start init
```

### 4. Generate Your First Podcast (Direct)

```bash
# Generate a 5-minute tech and finance podcast
npm start generate -- --channels tech,finance --duration 5 --deterministic

# With custom requests
npm start generate -- --channels tech --requests "latest AI models" --duration 7

# Generate with audio (requires ElevenLabs key)
npm start generate -- --channels tech,f1 --duration 5 --audio
```

## Usage Examples

### List Available Channels

```bash
npm start list
```

**Available Channels:**
- `tech` - Tech & Software Development
- `finance` - Finance & Markets
- `f1` - Formula 1 Racing
- `world_news` - World News
- `science` - Science Discoveries

### Test Individual Agent

```bash
# Test the tech agent
npm start test-agent -- --channel tech

# Test with custom requests
npm start test-agent -- --channel finance --requests "Tesla stock,crypto markets"
```

### Test Web Search

```bash
npm start test-search -- --query "latest technology news"
```

### Generate with Different Settings

```bash
# Morning routine (energetic and uplifting)
npm start generate -- --channels tech,finance --setting morning_routine --deterministic

# Workout (high-energy and motivational)
npm start generate -- --channels tech,f1 --setting workout

# Wind down (calm and soothing)
npm start generate -- --channels science --setting wind_down

# Available settings: morning_routine, workout, commute, wind_down, focus_work, learning
```

## Testing

### Test Web Search
```bash
npm start test-search -- --query "AI developments 2025"
```

### Test Individual Agent
```bash
npm start test-agent -- --channel tech
```

### Full Pipeline Test
```bash
npm start generate -- --channels tech --duration 3 --deterministic
```

## Architecture Details

### Research Modes

**Deterministic (default):** date-stamped search → scrape first accessible → summarize (bounded budgets).

**ReAct (optional):** LangChain ReAct agent that plans tool usage iteratively.

The **orchestrator** coordinates:
- Parallel agent execution with concurrency control
- Error handling and fallback content
- Progress tracking and logging

Planner + Writer synthesizes:
- Planner produces JSON plan (saved as plan + planRaw in agent-reports.json)
- Section writer iterates to build the script with continuity and length control

### Reliability Patterns

**Circuit Breakers**
- Prevent cascade failures when APIs go down
- Automatic state transitions: CLOSED → OPEN → HALF_OPEN
- Per-service tracking (Tavily, scraping, etc.)

**Retry with Exponential Backoff**
- Automatic retry of transient failures
- Configurable max attempts and delays
- Smart backoff to avoid overwhelming services

**Timeout Handling**
- All operations have time limits
- Prevents hanging on slow/stuck operations
- Graceful degradation on timeout

**Fallback Content**
- Curated content when live search fails
- Agents never fail completely
- System always produces output

### Technology Stack

- **LangChain**: Agent framework and tool orchestration
- **OpenAI GPT-4o/GPT-4o-mini**: LLM for agents and synthesis
- **Tavily API**: Web search optimized for AI
- **Cheerio**: HTML parsing for web scraping
- **ElevenLabs v3**: Text-to-speech (optional)
- **Commander.js**: CLI framework
- **Ora**: CLI spinners and progress
- **Chalk**: Terminal styling

## Project Structure

```
agentic-podcast-system/
├── src/
│   ├── agents/           # Agent implementations
│   │   ├── base-agent.js       # Base agent class
│   │   ├── channel-agent.js    # Channel-specific agents
│   │   ├── custom-agent.js     # Custom request agent
│   │   ├── channel-registry.js # Channel definitions
│   │   └── agent-factory.js    # Agent creation
│   ├── orchestrator/     # Workflow coordination
│   │   ├── workflow.js         # Main orchestrator
│   │   ├── user-context.js     # User preferences
│   │   └── progress-tracker.js # Progress tracking
│   ├── tools/            # Agent tools
│   │   ├── web-search.js       # Web search tool
│   │   ├── web-scraper.js      # Article scraping
│   │   └── fallback-content.js # Fallback content
│   ├── synthesis/        # Script synthesis
│   │   ├── editor.js           # Editor-in-chief
│   │   └── prompts.js          # Setting configurations
│   ├── audio/            # Audio generation (optional)
│   │   ├── generator.js        # ElevenLabs integration
│   │   └── voice-config.js     # Voice settings
│   ├── config/           # Configuration
│   │   └── config.js           # Centralized config
│   └── utils/            # Shared utilities
│       ├── logger.js           # Structured logging
│       ├── circuit-breaker.js  # Circuit breaker
│       ├── retry.js            # Retry logic
│       └── timeout.js          # Timeout wrapper
├── cli/                  # CLI commands
│   ├── index.js               # CLI entry point
│   └── commands/              # Command implementations
├── output/               # Generated podcasts
├── docs/                 # Documentation
└── tests/                # Tests (future)
```

## Configuration

All configuration via environment variables in `.env`:

```env
# OpenAI (Required)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini            # Agent/aux
OPENAI_SYNTHESIS_MODEL=gpt-4o       # Planner/Writer

# Tavily (Optional - recommended for better search)
TAVILY_API_KEY=tvly-...

# ElevenLabs (Optional - only for audio)
ELEVENLABS_API_KEY=sk_...

# Logging
LOG_LEVEL=info                     # debug, info, warn, error

# Agent Settings
AGENT_TIMEOUT_MS=45000             # 45 seconds
AGENT_MAX_ITERATIONS=6             # Max tool calls
CONCURRENCY_LIMIT=2                 # Parallel channels per batch (deterministic honors this)

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=3        # Failures before opening
CIRCUIT_BREAKER_TIMEOUT_MS=60000   # 60 seconds cooldown
```

## Output

Generated podcasts are saved to `output/<timestamp>/`:
- `script.txt` - Final podcast script
- `agent-reports.json` - Raw agent reports (for debugging)
- `podcast.mp3` - Audio file (if --audio flag used)

## Learning Resources

This project demonstrates:
- **Multi-agent systems**: Coordination of specialized AI agents
- **LangChain**: Agent frameworks and tool usage
- **Reliability engineering**: Circuit breakers, retries, timeouts
- **Clean architecture**: Separation of concerns, dependency injection
- **Production patterns**: Logging, error handling, graceful degradation

See `docs/ARCHITECTURE.md` for detailed architecture documentation.

## Contributing

This is a portfolio/demo project, but suggestions and improvements are welcome!

## License

MIT

## Questions?

Built as a demonstration of production-ready agentic systems with proper software engineering practices.

