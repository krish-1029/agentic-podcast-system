/**
 * List Channels Command
 * 
 * Display all available content channels.
 */

import chalk from 'chalk';
import { getAllChannels } from '../../src/agents/channel-registry.js';
import { getAllSettings } from '../../src/synthesis/prompts.js';

export function listChannelsCommand() {
  console.log(chalk.bold.cyan('\n📺 Available Channels\n'));

  const channels = getAllChannels();
  
  channels.forEach(channel => {
    console.log(chalk.bold(`${channel.id}`));
    console.log(chalk.gray('  Name:'), channel.name);
    console.log(chalk.gray('  Category:'), channel.category);
    console.log(chalk.gray('  Description:'), channel.description);
    console.log();
  });

  console.log(chalk.bold.cyan('🎚️  Available Settings\n'));

  const settings = getAllSettings();
  
  settings.forEach(setting => {
    console.log(chalk.bold(`${setting.id}`));
    console.log(chalk.gray('  Name:'), setting.name);
    console.log(chalk.gray('  Tone:'), setting.tone);
    console.log(chalk.gray('  Description:'), setting.description);
    console.log();
  });
}

export default listChannelsCommand;

