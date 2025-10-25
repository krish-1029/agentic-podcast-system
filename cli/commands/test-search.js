/**
 * Test Search Command
 * 
 * Test the web search functionality to verify it's working correctly.
 * Useful for debugging search issues and API configuration.
 */

import chalk from 'chalk';
import ora from 'ora';
import config from '../../src/config/config.js';
import { search } from '../../src/tools/web-search.js';

export async function testSearchCommand(options) {
  const spinner = ora();

  try {
    console.log(chalk.bold.cyan('\n🔍 Search Tool Testing\n'));

    // Display configuration
    console.log(chalk.bold('Search Configuration:'));
    console.log(chalk.gray('  Query:'), options.query);
    console.log(chalk.gray('  Max Results:'), options.maxResults || 5);
    console.log(chalk.gray('  Tavily API:'), config.hasTavilyKey ? chalk.green('configured') : chalk.yellow('not configured (will use fallback)'));
    console.log();

    // Perform search
    spinner.start('Searching...');
    
    const results = await search(options.query, {
      maxResults: options.maxResults || 5,
      useFallback: true,
    });

    spinner.succeed(`Search complete - found ${results.length} results`);

    // Display results
    console.log(chalk.bold('\n📊 Search Results:\n'));

    results.forEach((result, index) => {
      console.log(chalk.bold(`${index + 1}. ${result.title}`));
      console.log(chalk.gray('   Source:'), result.source);
      if (result.url) {
        console.log(chalk.gray('   URL:'), result.url);
      }
      if (result.isFallback) {
        console.log(chalk.yellow('   [FALLBACK CONTENT]'));
      }
      console.log(chalk.gray('   Content:'), result.content.substring(0, 200) + '...');
      console.log();
    });

    console.log(chalk.green('✅ Search test complete!\n'));

  } catch (error) {
    spinner.fail('Search test failed');
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

export default testSearchCommand;

