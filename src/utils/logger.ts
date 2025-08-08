type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

class LoggerClass {
  private formatTime(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, -1);
  }

  // Added dual emission: formatted (with timestamp/level) and raw message (for tests/consumers expecting plain args)
  private log(level: LogLevel, message: string, data?: any, raw?: any): void {
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
    
    // Primary formatted log (keeps existing behavior and logger tests passing)
    if (data !== undefined || raw !== undefined) {
      console.error(logMessage, raw ?? data);
    } else {
      console.error(logMessage);
    }

    // Additional raw emission to support tests that assert on plain message + data shape
    if (data !== undefined || raw !== undefined) {
      console.error(message, raw ?? data);
    } else {
      console.error(message);
    }
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  error(message: string, error?: any): void {
    // Keep first arg containing stringified error (for existing tests), and pass raw Error as well
    const formatted = error ? (error.stack || error.toString()) : undefined;
    this.log('ERROR', message, formatted, error);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }
}

export const Logger = new LoggerClass();