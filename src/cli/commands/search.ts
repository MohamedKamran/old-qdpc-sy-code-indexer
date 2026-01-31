import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import { ConfigManager } from '../../core/ConfigManager';
import { HybridSearch } from '../../search/HybridSearch';
import { HybridSearchOptions } from '../../search/types';

export const searchCommand = new Command('search')
  .description('Search the codebase')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Number of results', '20')
  .option('-L, --language <language>', 'Filter by language')
  .option('-t, --type <type>', 'Filter by block type (function, class, etc.)')
  .option('-s, --semantic-only', 'Use semantic search only')
  .option('-k, --keyword-only', 'Use keyword search only')
  .option('-p, --path <path>', 'Workspace path', process.cwd())
  .option('--no-color', 'Disable colored output')
  .action(async (query, options) => {
    const spinner = ora('Searching...').start();

    try {
      const workspacePath = path.resolve(options.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      const searchOptions: HybridSearchOptions = {
        limit: parseInt(options.limit, 10),
        language: options.language,
        blockType: options.type,
        semanticOnly: options.semanticOnly,
        keywordOnly: options.keywordOnly,
        minScore: 0.3
      };

      const hybridSearch = new HybridSearch(
        configManager
      );

      const results = await hybridSearch.search(query, searchOptions);

      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow('No results found'));
        return;
      }

      console.log(chalk.bold(`\nFound ${results.length} results for "${query}":\n`));

      for (const result of results) {
        const score = (result.finalScore * 100).toFixed(1);
        const scoreColor = result.finalScore > 0.8 ? 'green' : result.finalScore > 0.6 ? 'yellow' : 'white';
        
        console.log(chalk.bold(`\n${chalk.gray('→')} ${chalk.cyan(result.symbolName || result.blockType)}`));
        console.log(chalk.dim(`   ${result.filePath}:${result.startLine}-${result.endLine}`));
        console.log(chalk.dim(`   ${chalk[scoreColor](`Score: ${score}%`)} | ${chalk.white(result.language)} | ${chalk.white(result.blockType)}`));
        console.log(chalk.gray(`   ${'─'.repeat(60)}`));
        
        const preview = result.content.split('\n').slice(0, 5).join('\n');
        console.log(chalk.white(preview));
        if (result.content.split('\n').length > 5) {
          console.log(chalk.dim('   ...'));
        }
      }

      console.log();
    } catch (error) {
      spinner.fail(chalk.red(`Search failed: ${error}`));
      process.exit(1);
    }
  });
