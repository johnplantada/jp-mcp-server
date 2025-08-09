import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PersonaUtils } from '../../src/utils/personaUtils.js';
import { TestUtils } from './testUtils.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;

describe('PersonaUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    TestUtils.restoreAllMocks();
  });

  describe('getDefaultPersonas', () => {
    it('should return 5 default personas', () => {
      const personas = PersonaUtils.getDefaultPersonas();
      
      expect(personas).toHaveLength(5);
      expect(personas.map(p => p.id)).toEqual([
        'expert-developer',
        'friendly-tutor',
        'creative-innovator',
        'efficiency-optimizer',
        'security-guardian',
      ]);
    });

    it('should return personas with all required properties', () => {
      const personas = PersonaUtils.getDefaultPersonas();
      
      personas.forEach(persona => {
        expect(persona).toHaveProperty('id');
        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('description');
        expect(persona).toHaveProperty('systemPrompt');
        expect(persona).toHaveProperty('traits');
        expect(persona).toHaveProperty('communicationStyle');
        expect(persona).toHaveProperty('expertise');
        
        expect(typeof persona.id).toBe('string');
        expect(typeof persona.name).toBe('string');
        expect(typeof persona.description).toBe('string');
        expect(typeof persona.systemPrompt).toBe('string');
        expect(Array.isArray(persona.traits)).toBe(true);
        expect(typeof persona.communicationStyle).toBe('string');
        expect(Array.isArray(persona.expertise)).toBe(true);
      });
    });
  });

  describe('loadPersonaStorage', () => {
    it('should load storage from file when it exists', () => {
      const mockStorage = TestUtils.createSamplePersonaStorage();
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockStorage));

      const result = PersonaUtils.loadPersonaStorage();

      expect(result).toEqual(mockStorage);
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return default storage when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = PersonaUtils.loadPersonaStorage();

      expect(result.personas).toHaveLength(5);
      expect(result.defaultPersonaId).toBe('expert-developer');
      expect(result.activePersonaId).toBe('expert-developer');
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should return default storage when file parsing fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const result = PersonaUtils.loadPersonaStorage();

      expect(result.personas).toHaveLength(5);
      expect(result.defaultPersonaId).toBe('expert-developer');
      expect(result.activePersonaId).toBe('expert-developer');
    });

    it('should handle partial data in stored file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ personas: [] }));

      const result = PersonaUtils.loadPersonaStorage();

      expect(result).toEqual({
        personas: [],
        activePersonaId: null,
        defaultPersonaId: 'expert-developer',
      });
    });
  });

  describe('savePersonaStorage', () => {
    it('should save storage to file', () => {
      const storage = TestUtils.createSamplePersonaStorage();

      PersonaUtils.savePersonaStorage(storage);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.mcp-personas.json'),
        JSON.stringify(storage, null, 2),
        'utf-8'
      );
    });

    it('should handle write errors gracefully', () => {
      const storage = TestUtils.createSamplePersonaStorage();
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => PersonaUtils.savePersonaStorage(storage)).not.toThrow();
    });
  });

  describe('createDefaultStorage', () => {
    it('should create storage with default personas', () => {
      const storage = PersonaUtils.createDefaultStorage();

      expect(storage.personas).toHaveLength(5);
      expect(storage.activePersonaId).toBe('expert-developer');
      expect(storage.defaultPersonaId).toBe('expert-developer');
    });
  });

  describe('generatePersonaId', () => {
    it('should generate valid persona IDs', () => {
      expect(PersonaUtils.generatePersonaId('Test Persona')).toBe('test-persona');
      expect(PersonaUtils.generatePersonaId('A Pirate Developer!')).toBe('a-pirate-developer');
      expect(PersonaUtils.generatePersonaId('Zen Master @ Coding')).toBe('zen-master-coding');
    });

    it('should limit ID length to 30 characters', () => {
      const longDescription = 'This is a very long description that should be truncated';
      const id = PersonaUtils.generatePersonaId(longDescription);
      
      expect(id.length).toBeLessThanOrEqual(30);
      expect(id).toBe('this-is-a-very-long-descriptio');
    });
  });

  describe('generatePersonaFromDescription', () => {
    it('should generate pirate persona', () => {
      const persona = PersonaUtils.generatePersonaFromDescription('a pirate who loves coding');

      expect(persona.name).toBe('A Pirate Who');
      expect(persona.systemPrompt).toContain('pirate');
      expect(persona.systemPrompt).toContain('Arr!');
      expect(persona.traits).toContain('adventurous');
      expect(persona.communicationStyle).toContain('nautical');
      expect(persona.expertise).toContain('adventure-driven development');
    });

    it('should generate zen persona', () => {
      const persona = PersonaUtils.generatePersonaFromDescription('a zen master developer');

      expect(persona.systemPrompt).toContain('zen master');
      expect(persona.traits).toContain('calm');
      expect(persona.communicationStyle).toContain('calm and mindful');
      expect(persona.expertise).toContain('mindful coding practices');
    });

    it('should generate startup persona', () => {
      const persona = PersonaUtils.generatePersonaFromDescription('a startup founder mindset');

      expect(persona.systemPrompt).toContain('startup founder');
      expect(persona.traits).toContain('energetic');
      expect(persona.communicationStyle).toContain('energetic and results-focused');
      expect(persona.expertise).toContain('MVP development');
    });

    it('should generate academic persona', () => {
      const persona = PersonaUtils.generatePersonaFromDescription('an academic professor');

      expect(persona.systemPrompt).toContain('academic');
      expect(persona.traits).toContain('scholarly');
      expect(persona.communicationStyle).toContain('scholarly');
      expect(persona.expertise).toContain('theoretical foundations');
    });

    it('should generate generic persona for unknown descriptions', () => {
      const persona = PersonaUtils.generatePersonaFromDescription('something completely different');

      expect(persona.systemPrompt).toContain('something completely different');
      expect(persona.traits).toContain('helpful');
      expect(persona.communicationStyle).toBe('engaging and approachable');
      expect(persona.expertise).toContain('programming');
    });
  });

  describe('applyPersonaModifications', () => {
    const basePersona = TestUtils.createSamplePersonas()[0];

    it('should make persona more formal', () => {
      const modified = PersonaUtils.applyPersonaModifications(basePersona, 'make it more formal');

      expect(modified.communicationStyle).toBe('formal and professional');
      expect(modified.systemPrompt).toContain('professional and formal');
    });

    it('should make persona more casual', () => {
      const formalPersona = { ...basePersona, 
        communicationStyle: 'professional and formal',
        systemPrompt: 'You are a professional and formal test developer.'
      };
      const modified = PersonaUtils.applyPersonaModifications(formalPersona, 'make it casual');

      expect(modified.communicationStyle).toBe('casual and friendly');
      expect(modified.systemPrompt).toContain('casual and approachable');
    });

    it('should make persona more concise', () => {
      const modified = PersonaUtils.applyPersonaModifications(basePersona, 'be more concise');

      expect(modified.communicationStyle).toContain('concise and to-the-point');
      expect(modified.systemPrompt).toContain('Keep your responses brief');
    });

    it('should add React expertise', () => {
      const modified = PersonaUtils.applyPersonaModifications(basePersona, 'add React expertise');

      expect(modified.expertise).toContain('React');
      expect(modified.expertise).toContain('JavaScript');
      expect(modified.expertise).toContain('frontend development');
      expect(modified.systemPrompt).toContain('React and modern frontend');
    });

    it('should not duplicate React expertise', () => {
      const reactPersona = { ...basePersona, expertise: [...basePersona.expertise, 'React'] };
      
      // Verify React is already in the expertise
      expect(reactPersona.expertise).toContain('React');
      
      const modified = PersonaUtils.applyPersonaModifications(reactPersona, 'add React expertise');

      // Should only have one React entry
      const reactCount = modified.expertise.filter(e => e === 'React').length;
      expect(reactCount).toBe(1);
      expect(modified.expertise).toContain('React');
    });

    it('should add Python expertise', () => {
      const modified = PersonaUtils.applyPersonaModifications(basePersona, 'add Python skills');

      expect(modified.expertise).toContain('Python');
      expect(modified.expertise).toContain('data science');
      expect(modified.systemPrompt).toContain('Python and its ecosystem');
    });

    it('should add security expertise', () => {
      const modified = PersonaUtils.applyPersonaModifications(basePersona, 'focus on cybersecurity');

      expect(modified.expertise).toContain('security');
      expect(modified.expertise).toContain('cybersecurity');
      expect(modified.systemPrompt).toContain('security best practices');
    });

    it('should apply multiple modifications', () => {
      const modified = PersonaUtils.applyPersonaModifications(
        basePersona, 
        'make it more formal and add React expertise'
      );

      expect(modified.communicationStyle).toBe('formal and professional');
      expect(modified.expertise).toContain('React');
    });

    it('should not modify original persona object', () => {
      const originalExpertise = [...basePersona.expertise];
      const originalStyle = basePersona.communicationStyle;
      
      PersonaUtils.applyPersonaModifications(basePersona, 'add React expertise');

      expect(basePersona.expertise).toEqual(originalExpertise);
      expect(basePersona.communicationStyle).toBe(originalStyle);
    });
  });
});