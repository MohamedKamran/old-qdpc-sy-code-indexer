import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export const clearCommand = new Command('clear')
  .description('Clear the code index')
  .option('-p, --path <path>', 'Workspace path', process.cwd())
  .option('-y, --yes', 'Skip confirmation')
  .action(async (options) => {
    try {
      const workspacePath = path.resolve(options.path);
      const indexPath = path.join(workspacePath, '.syntheo', 'semantics');

      const indexPathExists = await fs.access(indexPath).then(() => true).catch(() => false);

      if (!indexPathExists) {
        console.log(chalk.yellow('No index found to clear'));
        return;
      }

      if (!options.yes) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<boolean>((resolve) => {
          rl.question(
            chalk.yellow('Are you sure you want to clear the code index? This cannot be undone. (y/N): '),
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

      const spinner = ora('Clearing index...').start();

      await fs.rm(indexPath, { recursive: true, force: true });

      spinner.succeed(chalk.green('Index cleared successfully'));
    } catch (error) {
      console.error(chalk.red(`Failed to clear index: ${error}`));
      process.exit(1);
    }
  });
