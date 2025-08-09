import { join } from 'path';
import { homedir } from 'os';

export const CONFIG = {
  PERSONA: {
    DEFAULT_ID: 'expert-developer',
    STORAGE_FILE: join(homedir(), '.mcp-personas.json'),
    GENERATION: {
      MAX_ID_LENGTH: 30,
      DEFAULT_TRAITS: ['helpful', 'knowledgeable'],
      DEFAULT_EXPERTISE: ['programming', 'problem-solving'],
    },
  },
  SERVERS: {
    PERSONA: {
      name: 'persona-server',
      version: '0.1.0',
    },
  },
} as const;

export type Config = typeof CONFIG;