export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/cli/**/*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  // Ensure ESM SDK modules are mocked before imports happen
  setupFiles: ['<rootDir>/tests/setup.mocks.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    // Remap ESM SDK modules to local manual mocks to avoid ESM parsing in node_modules
    '^@modelcontextprotocol/sdk/server/index.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/index.ts',
    '^@modelcontextprotocol/sdk/server/stdio.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/stdio.ts',
    '^@modelcontextprotocol/sdk/types.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/types.ts',
    // Preserve existing .js extension stripping for local ESM imports
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!@modelcontextprotocol/.*)'
  ]
};