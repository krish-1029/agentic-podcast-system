/**
 * Test Agent Command
 * 
 * Test individual channel agents to see their output.
 * Useful for debugging and understanding agent behavior.
 */

import chalk from 'chalk';
import ora from 'ora';
import { createChannelAgent } from '../../src/agents/index.js';
import { getAllChannels } from '../../src/agents/channel-registry.js';
import { setToolObserver } from '../../src/tools/observer.js';
import { search, scrape } from '../../src/tools/index.js';
import { ChatOpenAI } from '@langchain/openai';
import config from '../../src/config/config.js';

export async function testAgentCommand(options) {
  const spinner = ora();

  try {
    console.log(chalk.bold.cyan('\n🤖 Agent Testing\n'));

    // Validate channel
    const availableChannels = getAllChannels();
    const channel = availableChannels.find(c => c.id === options.channel);
    
    if (!channel) {
      throw new Error(
        `Unknown channel: ${options.channel}\n\nAvailable channels:\n${
          availableChannels.map(c => `  - ${c.id}: ${c.description}`).join('\n')
        }`
      );
    }

    // Parse custom requests
    const customRequests = options.requests 
      ? options.requests.split(',').map(r => r.trim()) 
      : [];

    // Display configuration
    console.log(chalk.bold('Testing Configuration:'));
    console.log(chalk.gray('  Channel:'), channel.name);
    console.log(chalk.gray('  Channel ID:'), channel.id);
    console.log(chalk.gray('  Category:'), channel.category);
    if (customRequests.length > 0) {
      console.log(chalk.gray('  Custom Requests:'), customRequests.join(', '));
    }
    console.log();

    // Attach tool observer if tracing is enabled
    const trace = [];
    if (options.trace) {
      setToolObserver((event) => {
        trace.push(event);
        // Pretty-print incremental events
        if (event.type === 'tool:start') {
          if (event.tool === 'web_search') {
            console.log(chalk.gray(`\n🔎 Search →`), chalk.white(event.query));
          } else if (event.tool === 'scrape_article') {
            console.log(chalk.gray(`\n📰 Scrape →`), chalk.white(event.url));
          }
        } else if (event.type === 'tool:success') {
          if (event.tool === 'web_search') {
            console.log(chalk.green(`✔ Search results:`), `${event.resultCount}`);
          } else if (event.tool === 'scrape_article') {
            console.log(chalk.green(`✔ Scraped content`), `(${(event.contentPreview || '').length} chars)`);
          }
        } else if (event.type === 'tool:error') {
          console.log(chalk.yellow(`⚠ ${event.tool} error:`), event.error);
        } else if (event.type === 'tool:data' && event.tool === 'web_search') {
          const items = (event.results || []).map((r, i) => {
            return `${i + 1}. ${r.title}\n   ${r.url}`;
          }).join('\n');
          if (items) {
            console.log(chalk.gray(`Top results:`));
            console.log(items);
          }
        }
      });
    }

    // Deterministic pipeline: fixed search → scrape → synthesize
    if (options.deterministic) {
      spinner.start(`Running deterministic pipeline for ${channel.name}...`);

      const date = new Date();
      const today = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      const queriesByChannel = {
        tech: [
          `tech news today ${today}`,
          `programming language releases ${today}`,
          `framework updates ${today}`,
        ],
        finance: [
          `stock market news today ${today}`,
          `economic data ${today}`,
          `earnings results ${today}`,
        ],
        f1: [
          `F1 news today ${today}`,
          `F1 qualifying results ${today}`,
          `F1 practice results ${today}`,
        ],
        world_news: [
          `world news today ${today}`,
          `breaking news ${today}`,
          `global headlines ${today}`,
        ],
        science: [
          `science news today ${today}`,
          `research findings ${today}`,
          `scientific breakthrough ${today}`,
        ],
      };

      const queries = queriesByChannel[options.channel] || [
        `${channel.name} news today ${today}`,
      ];

      const collected = [];
      for (const q of queries.slice(0, 3)) {
        console.log(chalk.gray(`\n🔎 Search →`), chalk.white(q));
        const results = await search(q, { maxResults: 5, timeRange: 'day' });
        const first = results.find(r => r.url && r.source && !/wsj|nytimes|bloomberg/i.test(r.source)) || results[0];
        if (first && first.url) {
          console.log(chalk.gray(`📰 Scrape →`), chalk.white(first.url));
          try {
            const text = await scrape(first.url, { maxLength: 2000 });
            collected.push({ query: q, title: first.title, url: first.url, text });
          } catch {
            // ignore scrape failures
          }
        }
      }

      const contextBlocks = collected.map((c, i) => (
        `(${i + 1}) ${c.title}\nURL: ${c.url}\nEXCERPT: ${String(c.text || '').slice(0, 800)}`
      )).join('\n\n');

      const synthesisPrompt = `You are a ${channel.name} specialist. Today is ${today}.
Using ONLY the following context, write a concise 280–350 word report with dates, figures, and named sources. End with a one-sentence "What’s next".
\n\nCONTEXT:\n${contextBlocks}\n\nFinal Answer:`;

      const llm = new ChatOpenAI({
        openAIApiKey: config.openaiApiKey,
        modelName: config.openaiSynthesisModel,
        temperature: 0.2,
      });

      const completion = await llm.invoke(synthesisPrompt);
      const report = typeof completion === 'string' ? completion : (completion?.content || completion?.text || '');

      spinner.succeed(`Deterministic pipeline complete`);

      console.log(chalk.bold('\n📊 Agent Results:\n'));
      console.log(chalk.gray('Status:'), chalk.green('success'));
      console.log(chalk.gray('Method:'), 'deterministic');
      console.log(chalk.gray('Sources:'), collected.length);
      console.log();

      console.log(chalk.bold('📝 Generated Report:\n'));
      console.log(chalk.white(report));
      console.log();

      console.log(chalk.bold('🔬 Pipeline Trace:\n'));
      collected.forEach((c, i) => {
        console.log(`${i + 1}. ${c.title}`);
        console.log(`   ${c.url}`);
      });

      console.log(chalk.green('✅ Test complete!\n'));
      return;
    }

    // Create and run agent
    spinner.start(`Initializing ${channel.name} agent...`);
    const agent = createChannelAgent(options.channel);
    spinner.succeed(`Agent initialized`);

    spinner.start(`Researching ${channel.name}...`);
    // Force tool usage if requested by appending instruction to prompt
    let result;
    if (options.forceTools) {
      const originalGetPrompt = agent.channel.getPrompt;
      agent.channel.getPrompt = (reqs) => {
        const p = originalGetPrompt(reqs);
        return p + '\n\nMANDATORY: You must use web_search (and scrape_article if needed) at least once before answering. Do not answer without first searching with date-specific queries.';
      };
      result = await agent.research(customRequests);
    } else {
      result = await agent.research(customRequests);
    }
    spinner.succeed(`Research complete`);

    // Display results
    console.log(chalk.bold('\n📊 Agent Results:\n'));
    console.log(chalk.gray('Status:'), result.status === 'success' ? chalk.green(result.status) : chalk.yellow(result.status));
    console.log(chalk.gray('Duration:'), `${result.duration}ms`);
    console.log(chalk.gray('Method:'), result.method);
    console.log(chalk.gray('Report Length:'), `${result.report.length} characters`);
    console.log(chalk.gray('Word Count:'), result.report.split(/\s+/).filter(Boolean).length);
    console.log();

    // Show the exact prompt used (helpful to understand date/search guidance)
    if (result.prompt) {
      console.log(chalk.bold('🧾 Prompt Used:\n'));
      console.log(chalk.gray(result.prompt));
      console.log();
    }

    // Display trace summary
    if (options.trace && trace.length) {
      console.log(chalk.bold('\n🔬 Tool Trace (ordered):\n'));
      trace.forEach((e, idx) => {
        const ts = new Date(e.ts || Date.now()).toLocaleTimeString();
        if (e.type === 'tool:start' && e.tool === 'web_search') {
          console.log(`${idx + 1}. [${ts}] search: ${e.query}`);
        } else if (e.type === 'tool:success' && e.tool === 'web_search') {
          console.log(`${idx + 1}. [${ts}] search: success (${e.resultCount} results)`);
        } else if (e.type === 'tool:data' && e.tool === 'web_search') {
          console.log(`${idx + 1}. [${ts}] search: top results shown above`);
        } else if (e.type === 'tool:start' && e.tool === 'scrape_article') {
          console.log(`${idx + 1}. [${ts}] scrape: ${e.url}`);
        } else if (e.type === 'tool:success' && e.tool === 'scrape_article') {
          console.log(`${idx + 1}. [${ts}] scrape: success (${(e.contentPreview || '').length} chars)`);
        } else if (e.type === 'tool:error') {
          console.log(`${idx + 1}. [${ts}] ${e.tool}: error (${e.error})`);
        }
      });
      console.log();
    }

    console.log(chalk.bold('📝 Generated Report:\n'));
    console.log(chalk.white(result.report));
    console.log();

    console.log(chalk.green('✅ Agent test complete!\n'));

  } catch (error) {
    spinner.fail('Agent test failed');
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

export default testAgentCommand;

