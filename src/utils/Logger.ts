import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log(chalk.gray('DEBUG'), message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log(chalk.blue('INFO'), message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log(chalk.yellow('WARN'), message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log(chalk.red('ERROR'), message, ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    this.log(chalk.green('SUCCESS'), message, ...args);
  }

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `${chalk.dim(timestamp)} ${level} ${chalk.cyan(`[${this.context}]`)}`;
    console.log(prefix, message, ...args);
  }

  static create(context: string, level: LogLevel = LogLevel.INFO): Logger {
    return new Logger(context, level);
  }
}
