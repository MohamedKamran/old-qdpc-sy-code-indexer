import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { ConfigManager } from '../../core/ConfigManager';

export const configCommand = new Command('config')
  .description('Manage configuration')
  .option('-p, --path <path>', 'Workspace path', process.cwd());

configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key, options) => {
    try {
      const workspacePath = path.resolve(options.parent.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      const value = configManager.get(key as any);
      console.log(chalk.cyan(`${key}:`), chalk.white(JSON.stringify(value, null, 2)));
    } catch (error) {
      console.error(chalk.red(`Failed to get config: ${error}`));
      process.exit(1);
    }
  });

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key, value, options) => {
    try {
      const workspacePath = path.resolve(options.parent.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      let parsedValue: any = value;
      
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      configManager.set(key as any, parsedValue);
      await configManager.save();

      console.log(chalk.green(`✓ Set ${key} to:`));
      console.log(chalk.white(JSON.stringify(parsedValue, null, 2)));
    } catch (error) {
      console.error(chalk.red(`Failed to set config: ${error}`));
      process.exit(1);
    }
  });

configCommand
  .command('list')
  .description('List all configuration values')
  .action(async (options) => {
    try {
      const workspacePath = path.resolve(options.parent.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      const config = configManager.getAll();

      console.log(chalk.bold('\n📋 Configuration\n'));

      const categories = ['embedder', 'indexing', 'search', 'watch', 'performance'];
      
      for (const category of categories) {
        console.log(chalk.bold(`\n${category.toUpperCase()}:`));
        const value = config[category as keyof typeof config];
        
        for (const [key, val] of Object.entries(value)) {
          console.log(`  ${chalk.cyan(key.padEnd(20))} ${chalk.white(JSON.stringify(val))}`);
        }
      }

      console.log();
    } catch (error) {
      console.error(chalk.red(`Failed to list config: ${error}`));
      process.exit(1);
    }
  });

configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (options) => {
    if (!options.yes) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<boolean>((resolve) => {
        rl.question(
          chalk.yellow('Are you sure you want to reset configuration to defaults? (y/N): '),
          (input: string) => {
            rl.close();
            resolve(input.toLowerCase() === 'y' || input.toLowerCase() === 'yes');
          }
        );
      });

      if (!answer) {
        console.log(chalk.dim('Operation cancelled'));
        return;
      }
    }

    try {
      const workspacePath = path.resolve(options.parent.path);
      const configManager = new ConfigManager(workspacePath);
      await configManager.load();

      await configManager.save();

      console.log(chalk.green('✓ Configuration reset to defaults'));
    } catch (error) {
      console.error(chalk.red(`Failed to reset config: ${error}`));
      process.exit(1);
    }
  });
