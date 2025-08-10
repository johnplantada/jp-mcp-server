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

  describe('expired personas functionality', () => {
    let mockBlend: any;

    beforeEach(() => {
      // Create a mock blended persona for testing
      mockBlend = {
        id: 'blend_12345',
        sourcePersonaIds: ['test-dev', 'test-tutor'],
        task: 'test blending task',
        blendMode: 'merge' as const,
        systemPrompt: 'You are a test blended persona.',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };
    });

    describe('expiredPersonas map', () => {
      it('should initialize expiredPersonas map', () => {
        expect((server as any).expiredPersonas).toBeInstanceOf(Map);
        expect((server as any).expiredPersonas.size).toBe(0);
      });

      it('should store expired personas in expiredPersonas map', () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);
        
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(true);
        expect((server as any).expiredPersonas.get('blend_12345')).toEqual(expiredBlend);
      });
    });

    describe('cleanup logic modifications', () => {
      it('should move expired temporaryPersonas to expiredPersonas instead of deleting', async () => {
        // Add a temporary persona that should expire
        (server as any).temporaryPersonas.set('blend_12345', mockBlend);
        (server as any).personas.set('blend_12345', {
          id: 'blend_12345',
          name: 'Test Blend',
          description: 'Test blend persona',
          systemPrompt: mockBlend.systemPrompt,
          traits: ['test'],
          communicationStyle: 'test',
          expertise: ['testing'],
        });

        // Call blend handler to trigger cleanup
        const args = {
          persona_ids: ['test-dev', 'test-tutor'],
          task: 'new blend task',
        };
        await (server as any).handleBlendPersonas(args);

        // Check that expired persona was moved to expiredPersonas
        expect((server as any).temporaryPersonas.has('blend_12345')).toBe(false);
        expect((server as any).personas.has('blend_12345')).toBe(false);
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(true);
        
        const expiredBlend = (server as any).expiredPersonas.get('blend_12345');
        expect(expiredBlend).toBeDefined();
        expect(expiredBlend.expiredAt).toBeInstanceOf(Date);
      });

      it('should log when moving expired persona to expired collection', async () => {
        (server as any).temporaryPersonas.set('blend_12345', mockBlend);
        (server as any).personas.set('blend_12345', {
          id: 'blend_12345',
          name: 'Test Blend',
          description: 'Test blend persona',
          systemPrompt: mockBlend.systemPrompt,
          traits: ['test'],
          communicationStyle: 'test',
          expertise: ['testing'],
        });

        const args = {
          persona_ids: ['test-dev', 'test-tutor'],
          task: 'new blend task',
        };
        await (server as any).handleBlendPersonas(args);

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Moved expired blended persona to expired collection: blend_12345')
        );
      });
    });

    describe('24-hour permanent cleanup', () => {
      it('should permanently delete expired personas after 24 hours', async () => {
        const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        const expiredBlend = { ...mockBlend, expiredAt: dayAgo };
        
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(true);

        // Trigger cleanup by calling blend handler
        const args = {
          persona_ids: ['test-dev', 'test-tutor'],
          task: 'trigger cleanup',
        };
        await (server as any).handleBlendPersonas(args);

        // Check that old expired persona was permanently deleted
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(false);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Permanently cleaned up expired persona: blend_12345')
        );
      });

      it('should not delete expired personas before 24 hours', async () => {
        const recentExpiry = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
        const expiredBlend = { ...mockBlend, expiredAt: recentExpiry };
        
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);

        const args = {
          persona_ids: ['test-dev', 'test-tutor'],
          task: 'trigger cleanup',
        };
        await (server as any).handleBlendPersonas(args);

        // Should still be in expired personas
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(true);
      });
    });

    describe('handleListExpiredPersonas', () => {
      it('should return empty message when no expired personas exist', async () => {
        const response = await (server as any).handleListExpiredPersonas();
        const text = TestUtils.getTextResponse(response);
        
        expect(text).toContain('No expired personas available for promotion');
      });

      it('should list expired personas with proper format', async () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);

        const response = await (server as any).handleListExpiredPersonas();
        const data = TestUtils.parseJsonResponse(response);
        
        expect(data.expiredPersonas).toHaveLength(1);
        expect(data.expiredPersonas[0]).toMatchObject({
          id: 'blend_12345',
          name: 'Blended: test-dev + test-tutor',
          description: 'merge blend for: test blending task',
          sourcePersonaIds: ['test-dev', 'test-tutor'],
          task: 'test blending task',
          blendMode: 'merge',
        });
        expect(data.expiredPersonas[0].timeUntilDeletion).toBeGreaterThan(0);
        expect(data.message).toContain('1 expired persona(s) available for promotion');
      });

      it('should sort expired personas by most recently expired first', async () => {
        const oldExpired = { ...mockBlend, id: 'blend_old', expiredAt: new Date(Date.now() - 60000) };
        const newExpired = { ...mockBlend, id: 'blend_new', expiredAt: new Date() };
        
        (server as any).expiredPersonas.set('blend_old', oldExpired);
        (server as any).expiredPersonas.set('blend_new', newExpired);

        const response = await (server as any).handleListExpiredPersonas();
        const data = TestUtils.parseJsonResponse(response);
        
        expect(data.expiredPersonas).toHaveLength(2);
        expect(data.expiredPersonas[0].id).toBe('blend_new');
        expect(data.expiredPersonas[1].id).toBe('blend_old');
      });
    });

    describe('handlePromoteExpiredPersona', () => {
      it('should promote expired persona to permanent persona', async () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);
        
        // Add source personas to collect expertise from
        (server as any).personas.set('test-dev', {
          id: 'test-dev',
          name: 'Test Developer',
          description: 'A test developer',
          systemPrompt: 'You are a test developer.',
          traits: ['technical'],
          communicationStyle: 'direct',
          expertise: ['programming', 'testing'],
        });
        (server as any).personas.set('test-tutor', {
          id: 'test-tutor',
          name: 'Test Tutor',
          description: 'A test tutor',
          systemPrompt: 'You are a test tutor.',
          traits: ['patient'],
          communicationStyle: 'encouraging',
          expertise: ['teaching', 'mentoring'],
        });

        const response = await (server as any).handlePromoteExpiredPersona({ persona_id: 'blend_12345' });
        const text = TestUtils.getTextResponse(response);
        
        expect(text).toContain('Successfully promoted expired persona to permanent persona');
        expect(text).toContain('Saved: test-dev + test-tutor');
        
        // Check that expired persona was removed
        expect((server as any).expiredPersonas.has('blend_12345')).toBe(false);
        
        // Check that new permanent persona was created
        const permanentPersonas = Array.from((server as any).personas.values()).filter((p: any) => 
          p.name.includes('Saved: test-dev + test-tutor')
        );
        expect(permanentPersonas).toHaveLength(1);
        
        const promoted = permanentPersonas[0] as Persona;
        expect(promoted.systemPrompt).toBe(mockBlend.systemPrompt);
        expect(promoted.traits).toEqual(['collaborative', 'multi-faceted']);
        expect(promoted.communicationStyle).toBe('adaptive');
        expect(promoted.expertise).toEqual(expect.arrayContaining(['programming', 'testing', 'teaching', 'mentoring']));
      });

      it('should throw error when expired persona not found', async () => {
        await expect(
          (server as any).handlePromoteExpiredPersona({ persona_id: 'nonexistent' })
        ).rejects.toThrow('Expired persona "nonexistent" not found');
      });

      it('should save promoted persona to storage', async () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);

        await (server as any).handlePromoteExpiredPersona({ persona_id: 'blend_12345' });
        
        expect(MockPersonaUtils.savePersonaStorage).toHaveBeenCalled();
        
        // Check that storage.personas array was updated
        const storage = (server as any).storage as PersonaStorage;
        const promotedPersona = storage.personas.find((p: any) => 
          p.name.includes('Saved: test-dev + test-tutor')
        );
        expect(promotedPersona).toBeDefined();
      });
    });

    describe('notification system in handleListPersonas', () => {
      it('should return normal persona list when no expired personas exist', async () => {
        const response = await (server as any).handleListPersonas();
        const data = TestUtils.parseJsonResponse(response);
        
        // Should be array format (not object with personas property)
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(2); // test-dev and test-tutor from mock storage
      });

      it('should include notification when expired personas exist', async () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);
        (server as any).expiredPersonas.set('blend_67890', expiredBlend);

        const response = await (server as any).handleListPersonas();
        const data = TestUtils.parseJsonResponse(response);
        
        expect(data.personas).toHaveLength(2);
        expect(data.notification).toBeDefined();
        expect(data.notification.type).toBe('expired_personas_available');
        expect(data.notification.message).toContain('⏰ 2 expired persona(s) are available for promotion');
        expect(data.notification.expiredCount).toBe(2);
        expect(data.notification.actions).toEqual(['list_expired_personas', 'promote_expired_persona']);
      });

      it('should update log message to include expired count', async () => {
        const expiredBlend = { ...mockBlend, expiredAt: new Date() };
        (server as any).expiredPersonas.set('blend_12345', expiredBlend);

        await (server as any).handleListPersonas();
        
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Listed 2 personas, active: test-dev, default: test-dev, 1 expired')
        );
      });
    });
  });
});