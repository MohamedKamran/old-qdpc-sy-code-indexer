#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { indexCommand } from './cli/commands/index.js';
import { searchCommand } from './cli/commands/search.js';
import { statusCommand } from './cli/commands/status.js';
import { clearCommand } from './cli/commands/clear.js';
import { configCommand } from './cli/commands/config.js';
import { ConfigManager } from './core/ConfigManager.js';

const program = new Command();

program
  .name('codeindex')
  .description('Production-grade semantic code search with local-first architecture')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize code index in current directory')
  .option('-p, --path <path>', 'Workspace path', process.cwd())
  .action(async (options) => {
    try {
      const workspacePath = path.resolve(options.path);
      console.log(chalk.blue(`Initializing code index in ${workspacePath}...`));
      
      const configManager = new ConfigManager(workspacePath);
      await configManager.save();
      
      console.log(chalk.green('✓ Created .syntheo/semantics directory'));
      console.log(chalk.green('✓ Created config.json with default settings'));
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log('  1. Run', chalk.cyan('codeindex index'), 'to start indexing');
      console.log('  2. Run', chalk.cyan('codeindex search "query"'), 'to search your code');
    } catch (error) {
      console.error(chalk.red('✖ Initialization failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.addCommand(indexCommand);
program.addCommand(searchCommand);
program.addCommand(statusCommand);
program.addCommand(clearCommand);
program.addCommand(configCommand);

program.parse();
