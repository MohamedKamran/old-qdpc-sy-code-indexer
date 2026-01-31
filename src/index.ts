#!/usr/bin/env node

import { Command } from 'commander';
import { indexCommand } from './cli/commands/index';
import { searchCommand } from './cli/commands/search';
import { statusCommand } from './cli/commands/status';
import { clearCommand } from './cli/commands/clear';
import { configCommand } from './cli/commands/config';

const program = new Command();

program
  .name('codeindex')
  .description('Production-grade semantic code search with local-first architecture')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize code index in current directory')
  .action(() => {
    console.log('Initializing code index...');
  });

program.addCommand(indexCommand);
program.addCommand(searchCommand);
program.addCommand(statusCommand);
program.addCommand(clearCommand);
program.addCommand(configCommand);

program.parse();
