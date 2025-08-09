import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PersonaServer } from '../../src/servers/PersonaServer.js';
import { TestUtils } from '../utils/testUtils.js';
import type { PersonaStorage } from '../../src/types/index.js';

describe('PersonaServer Integration Tests', () => {
  let server: PersonaServer;
  let testFilePath: string;

  beforeEach(() => {
    // Create a temporary file for testing
    testFilePath = TestUtils.createTempFilePath('personas.json');
    process.env.MCP_PERSONA_STORAGE_FILE = testFilePath;
    
    // Create test storage file
    const testStorage: PersonaStorage = {
      personas: [
        {
          id: 'integration-dev',
          name: 'Integration Developer',
          description: 'A developer for integration testing',
          systemPrompt: 'You are an integration test developer.',
          traits: ['systematic', 'thorough'],
          communicationStyle: 'methodical',
          expertise: ['integration testing', 'end-to-end testing'],
        },
        {
          id: 'integration-qa',
          name: 'Integration QA',
          description: 'QA specialist for integration testing',
          systemPrompt: 'You are a QA specialist focused on integration testing.',
          traits: ['detail-oriented', 'analytical'],
          communicationStyle: 'precise',
          expertise: ['quality assurance', 'test planning'],
        },
      ],
      activePersonaId: 'integration-dev',
      defaultPersonaId: 'integration-dev',
    };
    TestUtils.createMockPersonaStorage(testFilePath, testStorage);

    // Create server instance
    server = new PersonaServer(TestUtils.createMockServerConfig());
  });

  afterEach(() => {
    // Clean up test file and env var
    TestUtils.cleanupFile(testFilePath);
    delete process.env.MCP_PERSONA_STORAGE_FILE;
  });

  describe('End-to-End Persona Management', () => {
    it('should complete full persona lifecycle', async () => {
      // 1. List initial personas
      let response = await (server as any).handleListPersonas();
      let personas = TestUtils.parseJsonResponse(response);
      expect(personas).toHaveLength(2);
      expect(personas.find((p: any) => p.isActive)?.id).toBe('integration-dev');

      // 2. Create a new custom persona
      const createArgs = {
        id: 'lifecycle-persona',
        name: 'Lifecycle Persona',
        description: 'A persona for lifecycle testing',
        system_prompt: 'You are a lifecycle test persona.',
        traits: ['lifecycle', 'testing'],
        communication_style: 'lifecycle style',
        expertise: ['lifecycle management'],
      };
      response = await (server as any).handleCreateCustomPersona(createArgs);
      expect(TestUtils.getTextResponse(response)).toContain('created successfully');

      // 3. Verify persona was created
      response = await (server as any).handleListPersonas();
      personas = TestUtils.parseJsonResponse(response);
      expect(personas).toHaveLength(3);
      expect(personas.find((p: any) => p.id === 'lifecycle-persona')).toBeDefined();

      // 4. Switch to the new persona
      response = await (server as any).handleSwitchPersona({ persona_id: 'lifecycle-persona' });
      expect(TestUtils.getTextResponse(response)).toContain('Switched');

      // 5. Verify active persona changed
      response = await (server as any).handleGetActivePersona();
      const activePersona = TestUtils.parseJsonResponse(response);
      expect(activePersona.id).toBe('lifecycle-persona');

      // 6. Get system prompt for active persona
      response = await (server as any).handleGetPersonaPrompt();
      const prompt = TestUtils.getTextResponse(response);
      expect(prompt).toContain('[Active Persona: Lifecycle Persona]');
      expect(prompt).toContain('You are a lifecycle test persona.');

      // 7. Update the persona
      response = await (server as any).handleUpdatePersona({
        persona_id: 'lifecycle-persona',
        modifications: 'make it more formal and add React expertise',
      });
      expect(TestUtils.getTextResponse(response)).toContain('Updated persona');

      // 8. Set as default persona
      response = await (server as any).handleSetDefaultPersona({ persona_id: 'lifecycle-persona' });
      expect(TestUtils.getTextResponse(response)).toContain('Default persona changed');

      // 9. Verify it's now default
      response = await (server as any).handleListPersonas();
      personas = TestUtils.parseJsonResponse(response);
      const defaultPersona = personas.find((p: any) => p.isDefault);
      expect(defaultPersona?.id).toBe('lifecycle-persona');

      // 10. Delete the persona
      response = await (server as any).handleDeletePersona({ persona_id: 'lifecycle-persona' });
      expect(TestUtils.getTextResponse(response)).toContain('deleted successfully');

      // 11. Verify persona was deleted and default was reset
      response = await (server as any).handleListPersonas();
      personas = TestUtils.parseJsonResponse(response);
      expect(personas).toHaveLength(2);
      expect(personas.find((p: any) => p.id === 'lifecycle-persona')).toBeUndefined();
    });

    it('should handle persona generation workflow', async () => {
      // 1. Generate a pirate persona
      let response = await (server as any).handleGeneratePersona({
        description: 'a coding pirate who loves JavaScript',
      });
      expect(TestUtils.getTextResponse(response)).toContain('Generated persona');

      // 2. List personas to find the generated one
      response = await (server as any).handleListPersonas();
      const personas = TestUtils.parseJsonResponse(response);
      const piratePersona = personas.find((p: any) => p.name.includes('Pirate') || p.id.includes('coding'));
      expect(piratePersona).toBeDefined();

      // 3. Get details of generated persona
      response = await (server as any).handleGetPersonaDetails({ persona_id: piratePersona.id });
      const details = TestUtils.parseJsonResponse(response);
      expect(details.systemPrompt).toContain('pirate');
      expect(details.traits).toContain('adventurous');

      // 4. Modify the generated persona
      response = await (server as any).handleUpdatePersona({
        persona_id: piratePersona.id,
        modifications: 'make it more professional but keep the nautical theme',
      });
      expect(TestUtils.getTextResponse(response)).toContain('Updated persona');
    });

    it('should persist changes across server restarts', async () => {
      // 1. Create a persona
      const createArgs = {
        id: 'persistence-test',
        name: 'Persistence Test',
        description: 'Testing persistence',
        system_prompt: 'You test persistence.',
      };
      await (server as any).handleCreateCustomPersona(createArgs);

      // 2. Switch to it
      await (server as any).handleSwitchPersona({ persona_id: 'persistence-test' });

      // 3. Set as default
      await (server as any).handleSetDefaultPersona({ persona_id: 'persistence-test' });

      // 4. Create new server instance (simulating restart)
      const newServer = new PersonaServer(TestUtils.createMockServerConfig());

      // 5. Verify persona persisted
      let response = await (newServer as any).handleListPersonas();
      const personas = TestUtils.parseJsonResponse(response);
      const persistedPersona = personas.find((p: any) => p.id === 'persistence-test');
      expect(persistedPersona).toBeDefined();
      expect(persistedPersona.isDefault).toBe(true);

      // 6. Verify active persona is set correctly
      response = await (newServer as any).handleGetActivePersona();
      const activePersona = TestUtils.parseJsonResponse(response);
      expect(activePersona.id).toBe('persistence-test');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to switch to non-existent persona
      await expect(
        (server as any).handleSwitchPersona({ persona_id: 'non-existent' })
      ).rejects.toThrow('Persona not found');

      // Try to delete non-existent persona
      await expect(
        (server as any).handleDeletePersona({ persona_id: 'non-existent' })
      ).rejects.toThrow('Persona not found');

      // Try to get details of non-existent persona
      await expect(
        (server as any).handleGetPersonaDetails({ persona_id: 'non-existent' })
      ).rejects.toThrow('Persona not found');

      // Try to update non-existent persona
      await expect(
        (server as any).handleUpdatePersona({ 
          persona_id: 'non-existent', 
          modifications: 'test' 
        })
      ).rejects.toThrow('Persona not found');

      // Try to set non-existent persona as default
      await expect(
        (server as any).handleSetDefaultPersona({ persona_id: 'non-existent' })
      ).rejects.toThrow('Persona not found');

      // Try to create persona with duplicate ID
      await expect(
        (server as any).handleCreateCustomPersona({
          id: 'integration-dev',
          name: 'Duplicate',
          description: 'Should fail',
          system_prompt: 'Should not be created',
        })
      ).rejects.toThrow('already exists');
    });

    it('should maintain consistency when operations fail', async () => {
      // Get initial state
      let response = await (server as any).handleListPersonas();
      const initialPersonas = TestUtils.parseJsonResponse(response);
      const initialCount = initialPersonas.length;

      // Try to create duplicate persona (should fail)
      try {
        await (server as any).handleCreateCustomPersona({
          id: 'integration-dev',
          name: 'Duplicate',
          description: 'Should fail',
          system_prompt: 'Should not be created',
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify state is unchanged
      response = await (server as any).handleListPersonas();
      const afterFailPersonas = TestUtils.parseJsonResponse(response);
      expect(afterFailPersonas).toHaveLength(initialCount);

      // Verify active persona is still the same
      response = await (server as any).handleGetActivePersona();
      const activePersona = TestUtils.parseJsonResponse(response);
      expect(activePersona.id).toBe('integration-dev');
    });
  });

  describe('Data Validation', () => {
    it('should validate persona data structure', async () => {
      // Create persona with all fields
      const createArgs = {
        id: 'validation-test',
        name: 'Validation Test',
        description: 'Testing validation',
        system_prompt: 'You validate data.',
        traits: ['validating', 'careful'],
        communication_style: 'precise and clear',
        expertise: ['data validation', 'testing'],
      };

      await (server as any).handleCreateCustomPersona(createArgs);

      // Get the created persona
      const response = await (server as any).handleGetPersonaDetails({ 
        persona_id: 'validation-test' 
      });
      const persona = TestUtils.parseJsonResponse(response);

      // Verify all fields are present and correct
      expect(persona).toEqual({
        id: 'validation-test',
        name: 'Validation Test',
        description: 'Testing validation',
        systemPrompt: 'You validate data.',
        traits: ['validating', 'careful'],
        communicationStyle: 'precise and clear',
        expertise: ['data validation', 'testing'],
      });
    });
  });
});