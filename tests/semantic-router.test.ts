import { describe, it, expect, beforeEach } from '@jest/globals';
import { SemanticRouter } from '../src/semantic/router';
import { MockObsidianAPI } from './test-utils';

describe('SemanticRouter', () => {
  let router: SemanticRouter;
  let mockApi: MockObsidianAPI;
  
  beforeEach(() => {
    mockApi = new MockObsidianAPI();
    router = new SemanticRouter(mockApi);
  });
  
  describe('vault operations', () => {
    it('should list files with workflow suggestions', async () => {
      const response = await router.route({
        operation: 'vault',
        action: 'list',
        params: { directory: '/' }
      });
      
      expect(response.result).toContain('test.md');
      expect(response.workflow?.suggested_next).toBeDefined();
      expect(response.context?.current_directory).toBe('/');
    });
    
    it('should read file and extract metadata', async () => {
      const response = await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'test.md' }
      });
      
      expect(response.result.content).toContain('# Test');
      expect(response.context?.linked_files).toContain('linked.md');
      expect(response.context?.tags).toContain('#tag1');
    });
    
    it('should handle file not found gracefully', async () => {
      const response = await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'nonexistent.md' }
      });
      
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('not found');
      expect(response.error?.recovery_hints).toBeDefined();
    });
    
    it('should create new file with appropriate hints', async () => {
      const response = await router.route({
        operation: 'vault',
        action: 'create',
        params: { path: 'new-note.md', content: '# New Note' }
      });
      
      expect(response.result.success).toBe(true);
      expect(response.workflow?.suggested_next).toContainEqual(
        expect.objectContaining({
          description: expect.stringContaining('Add content')
        })
      );
    });
  });
  
  describe('edit operations', () => {
    it('should perform window edit with exact match', async () => {
      const response = await router.route({
        operation: 'edit',
        action: 'window',
        params: {
          path: 'test.md',
          oldText: '# Test',
          newText: '# Test Document'
        }
      });
      
      expect(response.result).toBeDefined();
      expect(response.workflow?.message).toContain('Replaced text');
    });
    
    it('should buffer content on failed edit', async () => {
      const response = await router.route({
        operation: 'edit',
        action: 'window',
        params: {
          path: 'test.md',
          oldText: 'nonexistent text',
          newText: 'replacement'
        }
      });
      
      // Should have buffered the content
      expect(response.error).toBeDefined();
      expect(response.error?.recovery_hints).toContainEqual(
        expect.objectContaining({
          command: expect.stringContaining('from_buffer')
        })
      );
    });
    
    it('should append content to file', async () => {
      const response = await router.route({
        operation: 'edit',
        action: 'append',
        params: {
          path: 'test.md',
          content: '\n\nAppended content'
        }
      });
      
      expect(response.result.success).toBe(true);
    });
  });
  
  describe('view operations', () => {
    it('should view file window', async () => {
      const response = await router.route({
        operation: 'view',
        action: 'window',
        params: {
          path: 'test.md',
          windowSize: 10
        }
      });
      
      expect(response.result.lines).toBeDefined();
      expect(response.result.totalLines).toBeGreaterThan(0);
    });
    
    it('should open file in Obsidian', async () => {
      const response = await router.route({
        operation: 'view',
        action: 'open_in_obsidian',
        params: { path: 'test.md' }
      });
      
      expect(response.result.success).toBe(true);
    });
  });
  
  describe('workflow operations', () => {
    it('should provide contextual suggestions', async () => {
      // First read a file to establish context
      await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'test.md' }
      });
      
      // Then ask for suggestions
      const response = await router.route({
        operation: 'workflow',
        action: 'suggest',
        params: {}
      });
      
      expect(response.result.suggestions).toBeDefined();
      expect(response.result.current_context.current_file).toBe('test.md');
    });
  });
  
  describe('system operations', () => {
    it('should get server info', async () => {
      const response = await router.route({
        operation: 'system',
        action: 'info',
        params: {}
      });
      
      expect(response.result.version).toBeDefined();
      expect(response.result.authenticated).toBe(true);
    });
    
    it('should list available commands', async () => {
      const response = await router.route({
        operation: 'system',
        action: 'commands',
        params: {}
      });
      
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.result.length).toBeGreaterThan(0);
    });
  });
  
  describe('context tracking', () => {
    it('should maintain file history', async () => {
      // Read multiple files
      await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'test.md' }
      });
      
      await router.route({
        operation: 'vault',
        action: 'read',
        params: { path: 'linked.md' }
      });
      
      const response = await router.route({
        operation: 'workflow',
        action: 'suggest',
        params: {}
      });
      
      expect(response.result.current_context.file_history).toContain('test.md');
      expect(response.result.current_context.file_history).toContain('linked.md');
    });
  });
});