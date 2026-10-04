import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class LoggerService {
  private static logsDir: string | null = null;
  private static mainLogFile: string | null = null;
  private static rendererLogFile: string | null = null;

  public static initialize(): void {
    try {
      const userData = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
      this.logsDir = path.join(userData, 'logs');

      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      this.mainLogFile = path.join(this.logsDir, 'main.log');
      this.rendererLogFile = path.join(this.logsDir, 'renderer.log');

      this.info('Logger', 'Logger initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize LoggerService:', err);
    }
  }

  public static getLogsDir(): string {
    if (!this.logsDir) {
      const userData = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
      this.logsDir = path.join(userData, 'logs');
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    }
    return this.logsDir;
  }

  private static formatMessage(level: string, tag: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}\n`;
  }

  private static writeToFile(file: string | null, text: string): void {
    if (!file) return;
    try {
      fs.appendFileSync(file, text, 'utf-8');
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  public static info(tag: string, message: string): void {
    const formatted = this.formatMessage('INFO', tag, message);
    console.log(`[${tag}] ${message}`);
    this.writeToFile(this.mainLogFile, formatted);
  }

  public static warn(tag: string, message: string): void {
    const formatted = this.formatMessage('WARN', tag, message);
    console.warn(`[${tag}] ${message}`);
    this.writeToFile(this.mainLogFile, formatted);
  }

  public static error(tag: string, message: string, error?: any): void {
    let errorDetails = '';
    if (error) {
      if (error instanceof Error) {
        errorDetails = ` - Error: ${error.message}\nStack: ${error.stack}`;
      } else {
        errorDetails = ` - Details: ${JSON.stringify(error)}`;
      }
    }
    const formatted = this.formatMessage('ERROR', tag, `${message}${errorDetails}`);
    console.error(`[${tag}] ${message}`, error || '');
    this.writeToFile(this.mainLogFile, formatted);
  }

  public static logRenderer(level: string, message: string, details?: string): void {
    const text = details ? `${message} | Details: ${details}` : message;
    const formatted = this.formatMessage(level, 'Renderer', text);
    console.log(`[Renderer-${level}] ${text}`);
    if (!this.rendererLogFile) {
      this.getLogsDir();
      this.rendererLogFile = path.join(this.logsDir!, 'renderer.log');
    }
    this.writeToFile(this.rendererLogFile, formatted);
  }
}
