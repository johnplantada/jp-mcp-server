import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PersonaServer } from '../../src/servers/PersonaServer.js';
import { PersonaUtils } from '../../src/utils/personaUtils.js';
import { TestUtils } from '../utils/testUtils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { PersonaStorage, Persona } from '../../src/types/index.js';

// Mock PersonaUtils
jest.mock('../../src/utils/personaUtils.js');
const MockPersonaUtils = PersonaUtils as jest.Mocked<typeof PersonaUtils>;

describe('PersonaServer', () => {
  let server: PersonaServer;
  let mockStorage: PersonaStorage;
  let loggerSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock storage
    mockStorage = TestUtils.createSamplePersonaStorage();
    
    // Mock PersonaUtils methods
    MockPersonaUtils.loadPersonaStorage.mockReturnValue(mockStorage);
    MockPersonaUtils.savePersonaStorage.mockImplementation(() => {});
    MockPersonaUtils.generatePersonaId.mockImplementation((desc) => 
      desc.toLowerCase().replace(/\s+/g, '-').substring(0, 10)
    );
    MockPersonaUtils.generatePersonaFromDescription.mockReturnValue({
      name: 'Generated Persona',
      description: 'A generated persona',
      systemPrompt: 'You are a generated persona.',
      traits: ['generated', 'test'],
      communicationStyle: 'test style',
      expertise: ['testing', 'generation'],
    });
    MockPersonaUtils.applyPersonaModifications.mockImplementation((persona, _) => ({
      ...persona,
      name: 'Modified ' + persona.name,
    }));

    // Create server instance
    server = new PersonaServer(TestUtils.createMockServerConfig());
    
    // Spy on logger
    loggerSpy = TestUtils.spyOnLogger();
  });

  afterEach(() => {
    TestUtils.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize server and load personas', () => {
      expect(MockPersonaUtils.loadPersonaStorage).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Loaded 2 personas')
      );
    });

    it('should set active persona to default when not set', () => {
      const storageWithoutActive = { ...mockStorage, activePersonaId: null };
      MockPersonaUtils.loadPersonaStorage.mockReturnValue(storageWithoutActive);

      new PersonaServer(TestUtils.createMockServerConfig());

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Active persona set to default')
      );
    });
  });

  describe('handleListPersonas', () => {
    it('should list all personas with status indicators', async () => {
      const response = await (server as any).handleListPersonas();
      const personas = TestUtils.parseJsonResponse(response);

      expect(personas).toHaveLength(2);
      expect(personas[0]).toEqual({
        id: 'test-dev',
        name: 'Test Developer',
        description: 'A developer for testing',
        isActive: true,
        isDefault: true,
      });
      expect(personas[1]).toEqual({
        id: 'test-tutor',
        name: 'Test Tutor',
        description: 'A tutor for testing',
        isActive: false,
        isDefault: false,
      });
    });

    it('should set active persona to default when none is active', async () => {
      // Modify server's internal storage to have no active persona
      (server as any).storage.activePersonaId = null;

      const response = await (server as any).handleListPersonas();
      const personas = TestUtils.parseJsonResponse(response);

      expect((server as any).storage.activePersonaId).toBe('test-dev');
      expect(personas.find((p: any) => p.id === 'test-dev')?.isActive).toBe(true);
    });
  });

  describe('handleGetActivePersona', () => {
    it('should return active persona details', async () => {
      const response = await (server as any).handleGetActivePersona();
      const persona = TestUtils.parseJsonResponse(response);

      expect(persona).toEqual({
        id: 'test-dev',
        name: 'Test Developer',
        description: 'A developer for testing',
        communicationStyle: 'direct',
      });
    });

    it('should return error message when no active persona', async () => {
      (server as any).storage.activePersonaId = null;
      (server as any).personas.clear();

      const response = await (server as any).handleGetActivePersona();
      const text = TestUtils.getTextResponse(response);

      expect(text).toBe('No active persona selected');
    });

    it('should throw error when active persona not found in registry', async () => {
      (server as any).storage.activePersonaId = 'non-existent';

      await expect((server as any).handleGetActivePersona()).rejects.toThrow(McpError);
    });
  });

  describe('handleSwitchPersona', () => {
    it('should switch to existing persona', async () => {
      const args = { persona_id: 'test-tutor' };
      const response = await (server as any).handleSwitchPersona(args);
      const text = TestUtils.getTextResponse(response);

      expect((server as any).storage.activePersonaId).toBe('test-tutor');
      expect(text).toContain('Switched from "Test Developer" to "Test Tutor"');
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent persona', async () => {
      const args = { persona_id: 'non-existent' };

      await expect((server as any).handleSwitchPersona(args)).rejects.toThrow(McpError);
      await expect((server as any).handleSwitchPersona(args)).rejects.toThrow('Persona not found');
    });

    it('should handle switching when no previous persona', async () => {
      (server as any).storage.activePersonaId = null;
      const args = { persona_id: 'test-dev' };

      const response = await (server as any).handleSwitchPersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Switched from "None" to "Test Developer"');
    });
  });

  describe('handleGetPersonaDetails', () => {
    it('should return full persona details', async () => {
      const args = { persona_id: 'test-dev' };
      const response = await (server as any).handleGetPersonaDetails(args);
      const persona = TestUtils.parseJsonResponse(response);

      expect(persona).toEqual(mockStorage.personas[0]);
    });

    it('should throw error for non-existent persona', async () => {
      const args = { persona_id: 'non-existent' };

      await expect((server as any).handleGetPersonaDetails(args)).rejects.toThrow(McpError);
    });
  });

  describe('handleCreateCustomPersona', () => {
    it('should create new custom persona', async () => {
      const args = {
        id: 'custom-persona',
        name: 'Custom Persona',
        description: 'A custom test persona',
        system_prompt: 'You are a custom persona.',
        traits: ['custom', 'unique'],
        communication_style: 'custom style',
        expertise: ['customization'],
      };

      const response = await (server as any).handleCreateCustomPersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Custom persona "Custom Persona" created successfully');
      expect((server as any).personas.has('custom-persona')).toBe(true);
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should throw error for duplicate persona ID', async () => {
      const args = {
        id: 'test-dev',
        name: 'Duplicate Persona',
        description: 'This should fail',
        system_prompt: 'This should not be created.',
      };

      await expect((server as any).handleCreateCustomPersona(args)).rejects.toThrow(McpError);
      await expect((server as any).handleCreateCustomPersona(args)).rejects.toThrow('already exists');
    });

    it('should handle optional parameters', async () => {
      const args = {
        id: 'minimal-persona',
        name: 'Minimal Persona',
        description: 'Minimal test persona',
        system_prompt: 'You are minimal.',
      };

      const response = await (server as any).handleCreateCustomPersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('created successfully');
      
      const createdPersona = (server as any).personas.get('minimal-persona');
      expect(createdPersona.traits).toEqual([]);
      expect(createdPersona.communicationStyle).toBe('');
      expect(createdPersona.expertise).toEqual([]);
    });
  });

  describe('handleDeletePersona', () => {
    it('should delete existing persona', async () => {
      const args = { persona_id: 'test-tutor' };
      const response = await (server as any).handleDeletePersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Persona "Test Tutor" deleted successfully');
      expect((server as any).personas.has('test-tutor')).toBe(false);
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should reset active persona when deleting active one', async () => {
      const args = { persona_id: 'test-dev' };
      await (server as any).handleDeletePersona(args);

      expect((server as any).storage.activePersonaId).toBe('expert-developer');
    });

    it('should throw error for non-existent persona', async () => {
      const args = { persona_id: 'non-existent' };

      await expect((server as any).handleDeletePersona(args)).rejects.toThrow(McpError);
    });
  });

  describe('handleGetPersonaPrompt', () => {
    it('should return system prompt for active persona', async () => {
      const response = await (server as any).handleGetPersonaPrompt();
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('[Active Persona: Test Developer]');
      expect(text).toContain('You are a test developer.');
    });

    it('should set active persona to default when none is active', async () => {
      (server as any).storage.activePersonaId = null;

      const response = await (server as any).handleGetPersonaPrompt();
      
      expect((server as any).storage.activePersonaId).toBe('test-dev');
    });

    it('should throw error when active persona not found', async () => {
      (server as any).storage.activePersonaId = 'non-existent';

      await expect((server as any).handleGetPersonaPrompt()).rejects.toThrow(McpError);
    });
  });

  describe('handleGeneratePersona', () => {
    it('should generate persona from description', async () => {
      const args = { description: 'a helpful assistant' };
      const response = await (server as any).handleGeneratePersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Generated persona "Generated Persona" successfully!');
      expect(MockPersonaUtils.generatePersonaId).toHaveBeenCalledWith('a helpful assistant');
      expect(MockPersonaUtils.generatePersonaFromDescription).toHaveBeenCalledWith('a helpful assistant');
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should use custom ID when provided', async () => {
      const args = { description: 'a helpful assistant', id: 'custom-id' };
      await (server as any).handleGeneratePersona(args);

      expect((server as any).personas.has('custom-id')).toBe(true);
      expect(MockPersonaUtils.generatePersonaId).not.toHaveBeenCalled();
    });

    it('should throw error for duplicate persona ID', async () => {
      MockPersonaUtils.generatePersonaId.mockReturnValue('test-dev');
      const args = { description: 'duplicate persona' };

      await expect((server as any).handleGeneratePersona(args)).rejects.toThrow(McpError);
    });
  });

  describe('handleUpdatePersona', () => {
    it('should update existing persona', async () => {
      const args = { persona_id: 'test-dev', modifications: 'make it more formal' };
      const response = await (server as any).handleUpdatePersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Updated persona "Modified Test Developer" successfully!');
      expect(MockPersonaUtils.applyPersonaModifications).toHaveBeenCalledWith(
        mockStorage.personas[0],
        'make it more formal'
      );
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent persona', async () => {
      const args = { persona_id: 'non-existent', modifications: 'test' };

      await expect((server as any).handleUpdatePersona(args)).rejects.toThrow(McpError);
    });
  });

  describe('handleSetDefaultPersona', () => {
    it('should set default persona', async () => {
      const args = { persona_id: 'test-tutor' };
      const response = await (server as any).handleSetDefaultPersona(args);
      const text = TestUtils.getTextResponse(response);

      expect(text).toContain('Default persona changed from "test-dev" to "Test Tutor"');
      expect((server as any).storage.defaultPersonaId).toBe('test-tutor');
      expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent persona', async () => {
      const args = { persona_id: 'non-existent' };

      await expect((server as any).handleSetDefaultPersona(args)).rejects.toThrow(McpError);
    });
  });

  describe('error handling', () => {
    it('should wrap errors with McpErrorHandler', async () => {
      // Force an error by removing a persona that's being accessed
      (server as any).personas.clear();
      (server as any).storage.activePersonaId = 'non-existent';

      await expect((server as any).handleGetActivePersona()).rejects.toThrow(McpError);
    });

    it('should log errors appropriately', async () => {
      const args = { persona_id: 'non-existent' };

      try {
        await (server as any).handleGetPersonaDetails(args);
      } catch (error) {
        // Error should be thrown
      }

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Persona not found')
      );
    });
  });

  describe('savePersonas', () => {
    it('should update storage with current personas', () => {
      // Add a persona to the internal map
      const newPersona: Persona = {
        id: 'new-persona',
        name: 'New Persona',
        description: 'A new test persona',
        systemPrompt: 'You are new.',
        traits: ['new'],
        communicationStyle: 'new style',
        expertise: ['newness'],
      };
      (server as any).personas.set('new-persona', newPersona);

      // Call savePersonas
      (server as any).savePersonas();

      // Verify that the storage was updated with personas from the map
      const savedStorage = MockPersonaUtils.savePersonaStorage.mock.calls[0][0];
      expect(savedStorage.personas).toContain(newPersona);
    });
  });

  describe('load validation', () => {
    it('corrects invalid defaultPersonaId on load', () => {
      const invalidStorage = { ...mockStorage, defaultPersonaId: 'non-existent' };
      MockPersonaUtils.loadPersonaStorage.mockReturnValue(invalidStorage);

      const s = new PersonaServer(TestUtils.createMockServerConfig());
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid default persona')
      );
      // After correction, default should be one of available IDs
      const personas = (s as any).personas as Map<string, Persona>;
      const storage = (s as any).storage as PersonaStorage;
      expect(personas.has(storage.defaultPersonaId)).toBe(true);
    });

    it('falls back activePersonaId to corrected default when invalid', () => {
      const invalidStorage = { ...mockStorage, activePersonaId: 'nope', defaultPersonaId: 'test-dev' };
      MockPersonaUtils.loadPersonaStorage.mockReturnValue(invalidStorage);

      const s = new PersonaServer(TestUtils.createMockServerConfig());
      const storage = (s as any).storage as PersonaStorage;
      expect(storage.activePersonaId).toBe(storage.defaultPersonaId);
    });
  });

  describe('delete handling', () => {
    it('reassigns default when deleting current default', async () => {
      (server as any).storage.defaultPersonaId = 'test-tutor';
      const res = await (server as any).handleDeletePersona({ persona_id: 'test-tutor' });
      const storage = (server as any).storage as PersonaStorage;

      // default should now be some existing persona (e.g., test-dev)
      expect((server as any).personas.has(storage.defaultPersonaId)).toBe(true);
    });

    it('reassigns active when deleting current active', async () => {
      (server as any).storage.activePersonaId = 'test-dev';
      await (server as any).handleDeletePersona({ persona_id: 'test-dev' });
      const storage = (server as any).storage as PersonaStorage;

      // Behavior: reset to configured default ID
      expect(storage.activePersonaId).toBe('expert-developer');
    });
  });
});