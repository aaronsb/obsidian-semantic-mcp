import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MockObsidianAPI } from './test-utils';
import { SemanticRouter } from '../src/semantic/router';
import { StateTokenManager } from '../src/semantic/state-tokens';

describe('Semantic Tools Integration Tests', () => {
  let api: MockObsidianAPI;
  let router: SemanticRouter;
  
  beforeAll(() => {
    // Use mock API for testing
    api = new MockObsidianAPI();
    router = new SemanticRouter(api);
  });
  
  describe('Token State Management', () => {
    it('should track file loading tokens', async () => {
      const tokenManager = new StateTokenManager();
      
      // Simulate file read
      tokenManager.updateTokens('vault', 'read', 
        { path: 'test.md' }, 
        { content: '# Test\n[[linked.md]] #tag1' }, 
        true
      );
      
      const tokens = tokenManager.getTokens();
      expect(tokens.file_loaded).toBe('test.md');
      expect(tokens.file_has_links).toContain('linked.md');
      expect(tokens.file_has_tags).toContain('#tag1');
      expect(tokenManager.hasTokensFor('can_follow_links')).toBe(true);
    });
    
    it('should track buffer tokens on edit failure', async () => {
      const tokenManager = new StateTokenManager();
      
      // Simulate failed edit
      tokenManager.updateTokens('edit', 'window',
        { path: 'test.md', oldText: 'foo', newText: 'bar' },
        null,
        false
      );
      
      const tokens = tokenManager.getTokens();
      expect(tokens.buffer_available).toBe(true);
      expect(tokens.buffer_file).toBe('test.md');
      expect(tokenManager.hasTokensFor('can_use_buffer')).toBe(true);
    });
  });
  
  describe('Workflow Suggestions', () => {
    it('should provide contextual suggestions after file read', async () => {
      const response = await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'test.md' }
      });
      
      expect(response.workflow).toBeDefined();
      expect(response.workflow?.suggested_next).toContainEqual(
        expect.objectContaining({
          description: expect.stringContaining('Edit this file')
        })
      );
    });
    
    it('should filter suggestions based on available tokens', async () => {
      // First, clear any file context
      const response1 = await router.route({
        operation: 'vault',
        action: 'list',
        params: { directory: '/' }
      });
      
      // Should not suggest editing without a loaded file
      const suggestions = response1.workflow?.suggested_next || [];
      const editSuggestions = suggestions.filter(s => 
        s.command.includes('edit(')
      );
      
      expect(editSuggestions.length).toBe(0);
    });
  });
  
  describe('Semantic Operations', () => {
    describe('vault operations', () => {
      it('should handle list action', async () => {
        const response = await router.route({
          operation: 'vault',
          action: 'list',
          params: { directory: '/' }
        });
        
        expect(response.result).toBeDefined();
        expect(response.context?.current_directory).toBe('/');
      });
      
      it('should handle search action', async () => {
        const response = await router.route({
          operation: 'vault',
          action: 'search',
          params: { query: 'test', page: 1, pageSize: 10 }
        });
        
        expect(response.result.query).toBe('test');
        expect(response.result.page).toBe(1);
      });
    });
    
    describe('edit operations', () => {
      it('should buffer content on failed edit', async () => {
        const response = await router.route({
          operation: 'edit',
          action: 'window',
          params: {
            path: 'nonexistent.md',
            oldText: 'foo',
            newText: 'bar'
          }
        });
        
        expect(response.error).toBeDefined();
        expect(response.error?.recovery_hints).toBeDefined();
        expect(response.error?.recovery_hints).toContainEqual(
          expect.objectContaining({
            description: expect.stringContaining('buffered')
          })
        );
      });
    });
    
    describe('workflow operations', () => {
      it('should generate contextual suggestions', async () => {
        const response = await router.route({
          operation: 'workflow',
          action: 'suggest',
          params: {}
        });
        
        expect(response.result).toHaveProperty('suggestions');
      });
    });
  });
  
  describe('Efficiency Hints', () => {
    it('should detect multiple edits to same file', async () => {
      // First edit
      await router.route({
        operation: 'edit',
        action: 'append',
        params: { path: 'test.md', content: 'Line 1' }
      });
      
      // Second edit to same file
      const response = await router.route({
        operation: 'edit',
        action: 'append',
        params: { path: 'test.md', content: 'Line 2' }
      });
      
      expect(response.efficiency_hints).toBeDefined();
      expect(response.efficiency_hints?.message).toContain('incremental edits');
    });
  });
});