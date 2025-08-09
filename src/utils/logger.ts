type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

class LoggerClass {
  private formatTime(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, -1);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const time = this.formatTime();
    let dataString = '';
    if (data !== undefined) {
      try {
        dataString = ' ' + JSON.stringify(data, null, 2);
      } catch (error) {
        // Handle circular references or other JSON.stringify errors
        dataString = ' [Object with circular references or non-serializable data]';
      }
    }
    const logMessage = `[${time}] ${level}: ${message}${dataString}`;
    
    // Single formatted log output
    console.error(logMessage);
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  error(message: string, error?: any): void {
    const formatted = error ? (error.stack || error.toString()) : undefined;
    this.log('ERROR', message, formatted);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }
}

export const Logger = new LoggerClass();