/**
 * Generate Command
 * 
 * Main command for generating complete podcasts.
 * Coordinates the entire pipeline from agent research to final script/audio.
 */

import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import config from '../../src/config/config.js';
import logger from '../../src/utils/logger.js';
import { createUserContext } from '../../src/orchestrator/user-context.js';
import { executeWorkflow } from '../../src/orchestrator/workflow.js';
import { synthesizeScript } from '../../src/synthesis/editor.js';
import { generateAudio } from '../../src/audio/generator.js';
import { getAllChannels } from '../../src/agents/channel-registry.js';
import { calculateWorkflowCost, formatCost } from '../../src/utils/token-cost.js';

const log = logger.child('CLI:Generate');

export async function generateCommand(options) {
  const spinner = ora();

  try {
    console.log(chalk.bold.cyan('\n🎙️  Agentic Podcast Generation System\n'));

    // Validate options
    validateOptions(options);

    // Parse channels
    const channels = options.channels ? options.channels.split(',').map(c => c.trim()) : [];
    
    // Parse custom requests
    const customRequests = options.requests ? options.requests.split(',').map(r => r.trim()) : [];

    // Display configuration
    displayConfiguration({
      channels,
      customRequests,
      setting: options.setting,
      duration: options.duration,
      generateAudio: options.audio,
      deterministic: options.deterministic || false,
    });

    // Create user context
    const userContext = createUserContext({
      channels,
      customRequests,
      setting: options.setting,
      duration: options.duration,
      deterministic: options.deterministic || false,
    });

    // Create output directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(config.outputDir, timestamp);
    await fs.mkdir(outputDir, { recursive: true });

    log.info('Output directory created', { outputDir });

    // Stage 1: Run agent workflow
    spinner.start('Running agent workflow...');
    
    const workflowResults = await executeWorkflow(userContext, (event, data) => {
      switch (event) {
        case 'stage_start':
          spinner.text = `Stage: ${data.stage}`;
          break;
        case 'stage_complete':
          spinner.succeed(`Stage: ${data.stage} complete`);
          spinner.start();
          break;
        case 'progress':
          spinner.text = data.message;
          break;
      }
    });

    spinner.succeed('Agent workflow complete');

    // Save agent reports (include planner outputs if present)
    const reportsPath = path.join(outputDir, 'agent-reports.json');
    await fs.writeFile(reportsPath, JSON.stringify(workflowResults, null, 2));
    console.log(chalk.gray(`  Reports saved: ${reportsPath}`));

    // Display agent summary
    displayAgentSummary(workflowResults);

    // Stage 2: If new iterative writer produced a script, use it; otherwise fall back to old synthesizer
    let script;
    if (workflowResults.finalScript) {
      spinner.succeed('Iterative writer produced final script');
      script = workflowResults.finalScript;
    } else {
      spinner.start('Synthesizing final script...');
      script = await synthesizeScript(workflowResults, userContext.getContext());
      spinner.succeed('Script synthesis complete');
    }

    // Save script
    const scriptPath = path.join(outputDir, 'script.txt');
    await fs.writeFile(scriptPath, script);
    console.log(chalk.gray(`  Script saved: ${scriptPath}`));

    // Display script stats
    displayScriptStats(script, options.duration);

    // Stage 3: Generate audio (if requested)
    if (options.audio) {
      if (!config.hasElevenLabsKey) {
        console.log(chalk.yellow('\n⚠️  ElevenLabs API key not configured. Skipping audio generation.'));
        console.log(chalk.gray('   Set ELEVENLABS_API_KEY in .env to enable audio generation.\n'));
      } else {
        spinner.start('Generating audio...');
        
        const audioPath = path.join(outputDir, 'podcast.mp3');
        const audioResult = await generateAudio(script, options.setting, audioPath);
        
        spinner.succeed('Audio generation complete');
        console.log(chalk.gray(`  Audio saved: ${audioPath}`));
        console.log(chalk.gray(`  File size: ${audioResult.fileSizeMB} MB`));
      }
    }

    // Success summary
    console.log(chalk.bold.green('\n✅ Podcast generation complete!\n'));
    console.log(chalk.cyan('Output directory:'), outputDir);
    console.log(chalk.cyan('Script:'), path.join(outputDir, 'script.txt'));
    if (options.audio && config.hasElevenLabsKey) {
      console.log(chalk.cyan('Audio:'), path.join(outputDir, 'podcast.mp3'));
    }
    console.log();

    // Ensure clean shutdown in case of lingering timers/sockets
    try { spinner.stop(); } catch {}
    process.exit(0);

  } catch (error) {
    spinner.fail('Generation failed');
    console.error(chalk.red('\n❌ Error:'), error.message);
    
    if (config.logLevel === 'debug') {
      console.error(chalk.gray(error.stack));
    }
    
    try { spinner.stop(); } catch {}
    process.exit(1);
  }
}

function validateOptions(options) {
  if (!options.channels && !options.requests) {
    throw new Error('At least one channel or custom request is required. Use --channels or --requests');
  }

  if (options.channels) {
    const availableChannels = getAllChannels().map(c => c.id);
    const requestedChannels = options.channels.split(',').map(c => c.trim());
    
    for (const channel of requestedChannels) {
      if (!availableChannels.includes(channel)) {
        throw new Error(`Unknown channel: ${channel}. Available: ${availableChannels.join(', ')}`);
      }
    }
  }
}

function displayConfiguration(config) {
  console.log(chalk.bold('Configuration:'));
  console.log(chalk.gray('  Channels:'), config.channels.join(', ') || 'none');
  console.log(chalk.gray('  Custom Requests:'), config.customRequests.join(', ') || 'none');
  console.log(chalk.gray('  Setting:'), config.setting);
  console.log(chalk.gray('  Duration:'), `${config.duration} minutes`);
  console.log(chalk.gray('  Generate Audio:'), config.generateAudio ? 'yes' : 'no');
  console.log();
}

function displayAgentSummary(results) {
  const summary = results.summary;
  
  console.log(chalk.bold('\nAgent Summary:'));
  console.log(chalk.gray('  Total channels:'), summary.totalChannels);
  console.log(chalk.gray('  Successful:'), chalk.green(summary.successfulChannels));
  
  if (summary.failedChannels > 0) {
    console.log(chalk.gray('  Failed:'), chalk.yellow(summary.failedChannels));
  }
  
  console.log(chalk.gray('  Custom requests:'), summary.customRequestStatus);
  
  // Display token usage and cost
  if (results.metadata?.tokenUsage) {
    try {
      const costs = calculateWorkflowCost(results, config.openaiModel, config.openaiSynthesisModel);
      const totalTokens = results.metadata.tokenUsage.total;
      
      console.log(chalk.bold('\nToken Usage & Cost:'));
      console.log(chalk.gray('  Total tokens:'), totalTokens.totalTokens.toLocaleString());
      console.log(chalk.gray('    Prompt:'), totalTokens.promptTokens.toLocaleString());
      console.log(chalk.gray('    Completion:'), totalTokens.completionTokens.toLocaleString());
      console.log(chalk.gray('  Estimated cost:'), chalk.cyan(formatCost(costs.total.totalCost)));
      
      // Show breakdown
      const agentTotal = Object.values(costs.agents).reduce((sum, c) => sum + c.totalCost, 0);
      const synthesisTotal = (costs.synthesis.planner?.totalCost || 0) + (costs.synthesis.writer?.totalCost || 0);
      
      console.log(chalk.gray('    Agents:'), formatCost(agentTotal));
      console.log(chalk.gray('    Synthesis:'), formatCost(synthesisTotal));
    } catch (error) {
      // Silently fail if cost calculation fails
      console.log(chalk.gray('  Token tracking enabled'));
    }
  }
  
  console.log();
}

function displayScriptStats(script, targetDuration) {
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
  const estimatedMinutes = Math.ceil(wordCount / 160);
  
  console.log(chalk.bold('\nScript Statistics:'));
  console.log(chalk.gray('  Word count:'), wordCount);
  console.log(chalk.gray('  Character count:'), charCount);
  console.log(chalk.gray('  Target duration:'), `${targetDuration} minutes`);
  console.log(chalk.gray('  Estimated duration:'), `${estimatedMinutes} minutes`);
  console.log();
}

export default generateCommand;

