#!/usr/bin/env node

/**
 * CLI Entry Point
 * 
 * Main command-line interface for the Agentic Podcast System.
 * Provides commands for generating podcasts, testing agents, and more.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { generateCommand } from './commands/generate.js';
import { testAgentCommand } from './commands/test-agent.js';
import { testSearchCommand } from './commands/test-search.js';
import { listChannelsCommand } from './commands/list-channels.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('agentic-podcast')
  .description('Multi-agent podcast generation system with web research capabilities')
  .version('1.0.0');

// Generate command - main podcast generation
program
  .command('generate')
  .description('Generate a complete podcast with multi-agent research')
  .option('-c, --channels <channels>', 'Comma-separated channel IDs (e.g., tech,finance,f1)')
  .option('-r, --requests <requests>', 'Comma-separated custom requests')
  .option('-s, --setting <setting>', 'Podcast setting type', 'morning_routine')
  .option('-d, --duration <minutes>', 'Target duration in minutes', '5')
  .option('-a, --audio', 'Generate audio file (requires ElevenLabs API key)', false)
  .option('--deterministic', 'Use deterministic fixed search→scrape→write pipeline', false)
  .action(async (options) => {
    options.duration = parseInt(options.duration, 10);
    await generateCommand(options);
  });

// Test agent command - test individual agents
program
  .command('test-agent')
  .description('Test a single channel agent')
  .requiredOption('-c, --channel <channel>', 'Channel ID to test (e.g., tech, finance, f1)')
  .option('-r, --requests <requests>', 'Comma-separated custom requests')
  .option('--trace', 'Show tool queries, results, and scrape previews', false)
  .option('--force-tools', 'Force agent to use web_search (and scrape) before answering', false)
  .option('--deterministic', 'Bypass ReAct. Run a fixed search→scrape→synthesize pipeline', false)
  .action(async (options) => {
    await testAgentCommand(options);
  });

// Test search command - test web search
program
  .command('test-search')
  .description('Test the web search functionality')
  .requiredOption('-q, --query <query>', 'Search query to test')
  .option('-m, --max-results <number>', 'Maximum number of results', '5')
  .action(async (options) => {
    options.maxResults = parseInt(options.maxResults, 10);
    await testSearchCommand(options);
  });

// List channels command - show available options
program
  .command('list')
  .description('List available channels and settings')
  .action(() => {
    listChannelsCommand();
  });

// Interactive init wizard
program
  .command('init')
  .description('Interactive wizard to configure and generate a podcast')
  .action(async () => {
    await initCommand();
  });

// Error handling
program.configureOutput({
  outputError: (str, write) => {
    write(chalk.red(str));
  },
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

