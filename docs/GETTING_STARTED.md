# Getting Started Guide

## Prerequisites

Before you begin, you'll need:

1. **Node.js 18+** installed ([download here](https://nodejs.org/))
2. **OpenAI API Key** (required) - [Get one here](https://platform.openai.com/api-keys)
3. **Tavily API Key** (recommended) - [Free tier available](https://tavily.com)

## Step-by-Step Setup

### 1. Navigate to Project Directory

```bash
cd agentic-podcast-system
```

### 2. Install Dependencies

```bash
npm ci
```

This will install all required packages including:
- LangChain for agent framework
- OpenAI SDK
- Commander for CLI
- And more...

### 3. Configure API Keys

**Important:** You need to create a `.env` file with your API keys.

```bash
# Copy the example file
cp .env.example .env

# Open .env in your editor
# On Mac:
open .env

# On Linux:
nano .env

# On Windows:
notepad .env
```

Add your API keys:

```env
OPENAI_API_KEY=sk-proj-your-actual-key-here
TAVILY_API_KEY=tvly-your-actual-key-here
```

**Note:** The user who created this project already has these keys configured!

### 4. Verify Installation

Test that everything is working:

```bash
# List available channels
npm start list
```

You should see a list of available channels and settings.

### 5. Quick Start (Interactive Wizard)

```bash
npm start init
```

You’ll choose:
- Listening context (setting)
- Topics (channels)
- Custom requests
- Duration
- Audio (y/N)

Runs ReAct agents by default (uses LangChain agent with tool calling).

### 6. Generate Your First Podcast (Direct)

Let's create a simple 3-minute tech podcast:

```bash
npm start generate -- --channels tech --duration 3
```

**What happens:**
1. Per-channel research: ReAct agents search → scrape → reason → synthesize report
2. Planner produces JSON plan (saved as plan + planRaw in agent-reports.json)
3. Section Writer iterates through plan to write the script
4. Saves to `output/<timestamp>/script.txt`

This should take about 30-45 seconds.

## Example Commands

### Basic Generation

```bash
# Single channel, 5 minutes
npm start generate -- --channels tech --duration 5

# Multiple channels
npm start generate -- --channels tech,finance,f1 --duration 7

# With custom requests
npm start generate -- --channels tech --requests "GPT-5,Apple Vision Pro" --duration 5
```

### Test Individual Components

```bash
# Test a single agent
npm start test-agent -- --channel tech --trace --force-tools

# Test web search
npm start test-search -- --query "latest AI news"

# List all options
npm start list
```

### Different Podcast Settings

```bash
# Morning routine (energetic)
npm start generate -- --channels tech,finance --setting morning_routine

# Workout (high-energy)
npm start generate -- --channels tech --setting workout --duration 5

# Wind down (calm)
npm start generate -- --channels science --setting wind_down --duration 5
```

### With Audio Generation (Optional)

If you have an ElevenLabs API key configured:

```bash
npm start generate -- --channels tech,f1 --duration 5 --audio
```

This generates both `script.txt` and `podcast.mp3`.

## Understanding the Output

After running a generation command, check the output directory:

```bash
ls -la output/
```

You'll see timestamped folders like:
```
output/2025-01-15T10-30-00-000Z/
├── script.txt           # Final podcast script
├── agent-reports.json   # Raw agent reports (for debugging)
└── podcast.mp3         # Audio (if --audio flag used)
```

### Reading the Script

```bash
# View the generated script
cat output/<latest-timestamp>/script.txt
```

### Inspecting Agent Reports

```bash
# See what each agent found
cat output/<latest-timestamp>/agent-reports.json | jq
```

This shows:
- Which channels ran and their research results
- Token usage and cost estimates for synthesis
- Planner outputs: `plan` (parsed JSON) and `planRaw` (original text)
- Success/failure status and timing information

## Common Issues

### "OPENAI_API_KEY is required"

**Solution:** Make sure you created `.env` file with your API key.

```bash
# Verify .env exists
ls -la .env

# Check it has your key
cat .env | grep OPENAI
```

### "Unknown channel: xyz"

**Solution:** Check available channels:

```bash
npm start list
```

Use exact channel IDs like: `tech`, `finance`, `f1`, `science`, `world_news`

### "Agent timeout"

**Solution:** This can happen with slow internet or API rate limits.

**Options:**
1. Try again (transient issue)
2. Increase timeout in `.env`:
   ```env
   AGENT_TIMEOUT_MS=60000
   ```

### "No Tavily key, using fallback"

**Solution:** This is OK! The system works fine with fallback content. But for better quality:
1. Get free Tavily key at [tavily.com](https://tavily.com)
2. Add to `.env`:
   ```env
   TAVILY_API_KEY=tvly-your-key-here
   ```

## Tips for Best Results

### 1. Channel Selection

- **1-2 channels**: More depth, focused content
- **3-4 channels**: Broader overview, still cohesive
- **5+ channels**: Might feel rushed, less depth per topic

### 2. Duration Sweet Spot

- **3-5 minutes**: Quick, focused updates
- **5-7 minutes**: Balanced depth and breadth
- **7-10 minutes**: Deep dives, multiple topics

### 3. Custom Requests

Be specific:
- Bad: "tech"
- Good: "GPT-5 release, Apple Vision Pro reviews"

### 4. Settings Match Use Case

- morning_routine: News, motivation, actionable insights
- workout: High energy, powerful language
- commute: Informative, easy to follow
- wind_down: Calm, soothing, thoughtful
- focus_work: Background-friendly, steady
- learning: Detailed, educational

## What's Next?

### Experiment

Try different combinations:

```bash
# Tech + Finance morning brief
npm start generate -- --channels tech,finance --setting morning_routine --duration 5

# F1 race weekend update
npm start generate -- --channel f1 --setting workout --duration 3

# Science deep dive
npm start generate -- --channel science --setting learning --duration 10
```

### Explore the Code

Start with:
1. `src/orchestrator/workflow.js` - See how agents are coordinated
2. `src/agents/base-agent.js` - ReAct agent implementation with LangChain
3. `src/synthesis/planner.js` & `src/synthesis/writer.js` - Plan & iterative write

### Read Architecture Docs

Check out `docs/ARCHITECTURE.md` for deep dive into:
- Multi-agent patterns
- Reliability patterns (circuit breakers, retries)
- Design decisions

## Need Help?

- Check `README.md` for full documentation
- Read `docs/ARCHITECTURE.md` for system design
- Test individual components with `test-agent` and `test-search` commands

## Ready to Demo?

Perfect commands to showcase the system:

```bash
# Show what's available
npm start list

# Quick 3-minute demo
npm start generate -- --channels tech --duration 3

# Impressive multi-agent demo
npm start generate -- --channels tech,finance,f1 --duration 5

# Test individual agent
npm start test-agent -- --channel tech
```

Have fun exploring the agentic system!

