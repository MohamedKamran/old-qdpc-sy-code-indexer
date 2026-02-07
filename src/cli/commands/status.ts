import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { VectorStore } from '../../storage/VectorStore.js';
import { ConfigManager } from '../../core/ConfigManager.js';

export const statusCommand = new Command('status')
  .description('Show index status')
  .option('-p, --path <path>', 'Workspace path', process.cwd())
  .action(async (options) => {
    try {
      const workspacePath = path.resolve(options.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      const indexPath = configManager.getIndexPath();
      const store = new VectorStore(indexPath, {
        space: 'cosine',
        numDimensions: configManager.get('embedder').dimensions,
        maxElements: 1000000,
        M: 16,
        efConstruction: 200
      });

      await store.initialize();
      const stats = store.getStats();

      console.log(chalk.bold('\n📊 Index Status\n'));

      console.log(chalk.bold('Files:'));
      console.log(`  Total files indexed: ${chalk.cyan(stats.totalFiles.toString())}`);

      console.log(chalk.bold('\nCode Blocks:'));
      console.log(`  Total blocks: ${chalk.cyan(stats.totalBlocks.toString())}`);

      console.log(chalk.bold('\nLanguages:'));
      const sortedLanguages = Object.entries(stats.languages)
        .sort(([, a], [, b]) => b - a);

      for (const [lang, count] of sortedLanguages) {
        const percentage = ((count / stats.totalBlocks) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(parseFloat(percentage) / 2));
        console.log(`  ${chalk.cyan(lang.padEnd(15))} ${chalk.gray(bar.padEnd(20))} ${chalk.white(count.toString().padStart(6))} (${chalk.dim(percentage + '%')})`);
      }

      console.log(chalk.bold('\nSearch:'));
      console.log(`  Total searches performed: ${chalk.cyan(stats.totalSearches.toString())}`);

      console.log(chalk.bold('\nConfiguration:'));
      console.log(`  Embedder: ${chalk.cyan(configManager.get('embedder').provider)}`);
      console.log(`  Model: ${chalk.cyan(configManager.get('embedder').model)}`);
      console.log(`  Dimensions: ${chalk.cyan(configManager.get('embedder').dimensions.toString())}`);

      store.close();
    } catch (error) {
      console.error(chalk.red(`Failed to get status: ${error}`));
      process.exit(1);
    }
  });
