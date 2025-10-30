import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { getAllChannels } from '../../src/agents/channel-registry.js';
import { getAllSettings } from '../../src/synthesis/prompts.js';
import { generateCommand } from './generate.js';

function prompt(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

export async function initCommand() {
  const spinner = ora();
  console.log(chalk.bold.cyan('\n🧰 Podcast Generator Wizard (ReAct agents by default)\n'));

  // 1) Listening context (setting)
  const settings = getAllSettings();
  console.log('\nSelect listening context (setting):');
  settings.forEach((s, idx) => {
    console.log(`  [${idx + 1}] ${s.id} - ${s.name} (${s.description})`);
  });
  const setAns = (await prompt(chalk.gray('> '))).trim();
  const setIdx = parseInt(setAns, 10);
  const setting = (Number.isInteger(setIdx) && setIdx >= 1 && setIdx <= settings.length)
    ? settings[setIdx - 1].id
    : 'morning_routine';

  // 2) Channels selection
  const channels = getAllChannels();
  console.log(chalk.bold('\nSelect channels (comma-separated indices):'));
  channels.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ${c.id} - ${c.name}`);
  });
  const sel = (await prompt(chalk.gray('> '))).trim();
  const selected = sel
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= channels.length)
    .map(n => channels[n - 1].id);
  if (selected.length === 0) {
    console.log(chalk.yellow('No valid channels selected. Exiting.'));
    return;
  }

  // 3) Custom requests (optional)
  console.log('\nAdd custom requests (comma-separated). Leave empty for none.');
  const reqAns = (await prompt(chalk.gray('> '))).trim();
  const customRequests = reqAns ? reqAns.split(',').map(r => r.trim()).filter(Boolean) : [];

  // 4) Duration in minutes
  console.log('\nTarget duration in minutes (default 5):');
  const durAns = (await prompt(chalk.gray('> '))).trim();
  const duration = durAns ? Math.max(1, Math.min(30, parseInt(durAns, 10) || 5)) : 5;

  // 5) Generate audio (y/N)
  console.log('\nGenerate audio (y/N)? (requires ELEVENLABS_API_KEY)');
  const audioAns = (await prompt(chalk.gray('> '))).trim().toLowerCase();
  const audio = audioAns === 'y' || audioAns === 'yes';

  // 6) Use ReAct agents (default)
  const deterministic = false;

  console.log('\n');
  spinner.start('Generating podcast...');
  try {
    await generateCommand({
      channels: selected.join(','),
      requests: customRequests.join(','),
      setting,
      duration,
      audio,
      deterministic,
    });
  } catch (e) {
    spinner.fail('Generation failed');
    console.error(e?.message || e);
    return;
  }
}

export default initCommand;


