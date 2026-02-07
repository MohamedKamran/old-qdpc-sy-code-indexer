import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import { IndexManager } from '../../core/IndexManager.js';
import { ConfigManager } from '../../core/ConfigManager.js';
import { StateManager } from '../../core/StateManager.js';
import { CacheManager } from '../../core/CacheManager.js';

export const indexCommand = new Command('index')
  .description('Index the workspace')
  .option('-w, --watch', 'Watch for changes and re-index')
  .option('-f, --force', 'Force re-index all files')
  .option('-p, --path <path>', 'Path to workspace', process.cwd())
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const spinner = ora('Initializing indexer').start();

    try {
      const workspacePath = path.resolve(options.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      const indexPath = configManager.getIndexPath();
      const stateManager = new StateManager(indexPath);
      await stateManager.load();

      const cacheManager = new CacheManager(indexPath);
      await cacheManager.load();

      const indexManager = new IndexManager(
        workspacePath,
        configManager,
        stateManager,
        cacheManager
      );

      spinner.text = 'Scanning workspace...';
      await indexManager.initialize();

      spinner.text = 'Indexing files...';
      await indexManager.indexWorkspace({ force: options.force });

      if (options.watch) {
        spinner.stop();
        console.log(chalk.green('✓ Initial indexing complete'));
        console.log(chalk.blue('Watching for changes...'));
        
        await indexManager.watch();
      } else {
        spinner.succeed(chalk.green('Indexing complete!'));
        
        const state = stateManager.getState();
        console.log(chalk.dim(`\nIndexed ${state.totalFiles} files, ${state.totalBlocks} blocks`));
      }

      await stateManager.save();
      await cacheManager.save();
    } catch (error) {
      spinner.fail(chalk.red(`Indexing failed: ${error}`));
      process.exit(1);
    }
  });
