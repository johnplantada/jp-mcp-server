import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    jest.restoreAllMocks();
  });

  describe('info', () => {
    it('should log info messages', () => {
      Logger.info('Test info message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test info message')
      );
    });

    it('should log info messages with data', () => {
      const data = { key: 'value', number: 42 };
      Logger.info('Test info with data', data);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('INFO: Test info with data');
      expect(call).toContain('"key": "value"');
      expect(call).toContain('"number": 42');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      Logger.error('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Test error message')
      );
    });

    it('should log error with error object', () => {
      const error = new Error('Test error');
      Logger.error('Error occurred', error);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('ERROR: Error occurred');
      expect(call).toContain('Test error');
    });

    it('should handle error objects without stack', () => {
      const error = { message: 'Simple error', toString: () => 'Simple error' };
      Logger.error('Error occurred', error);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('ERROR: Error occurred');
      expect(call).toContain('Simple error');
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      Logger.warn('Test warning message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Test warning message')
      );
    });

    it('should log warning messages with data', () => {
      const data = { warning: 'details' };
      Logger.warn('Test warning with data', data);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('WARN: Test warning with data');
      expect(call).toContain('"warning": "details"');
    });
  });

  describe('debug', () => {
    it('should log debug messages', () => {
      Logger.debug('Test debug message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Test debug message')
      );
    });

    it('should log debug messages with data', () => {
      const data = { debug: true, level: 'detailed' };
      Logger.debug('Test debug with data', data);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('DEBUG: Test debug with data');
      expect(call).toContain('"debug": true');
      expect(call).toContain('"level": "detailed"');
    });
  });

  describe('data serialization', () => {
    it('should handle circular references', () => {
      const circular: any = { name: 'circular' };
      circular.self = circular;

      expect(() => Logger.info('Circular data', circular)).not.toThrow();
      
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('INFO: Circular data');
      expect(call).toContain('[Object with circular references or non-serializable data]');
    });

    it('should handle undefined data', () => {
      Logger.info('Message with undefined', undefined);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Message with undefined')
      );
      // Should not have additional data appended for undefined
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('INFO: Message with undefined');
    });

    it('should handle null data', () => {
      Logger.info('Message with null', null);

      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('INFO: Message with null');
      expect(call).toContain('null');
    });
  });

  describe('timestamp format', () => {
    it('should include timestamp in all log messages', () => {
      Logger.info('Test message');
      
      const call = consoleErrorSpy.mock.calls[0][0];
      // Should match pattern like [2023-01-01 12:00:00.000] 
      expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    });
  });
});