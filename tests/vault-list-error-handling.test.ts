import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockObsidianAPI } from './test-utils.js';
import { SemanticRouter } from '../src/semantic/router.js';

class ErrorMockObsidianAPI extends MockObsidianAPI {
  private errorType: 'not-found' | 'connection' | null = null;
  
  setErrorType(type: 'not-found' | 'connection' | null) {
    this.errorType = type;
  }
  
  async listFiles(directory?: string): Promise<string[]> {
    if (this.errorType === 'not-found') {
      const error: any = new Error('Request failed with status code 404');
      error.response = { status: 404, data: 'Not Found' };
      throw error;
    }
    
    if (this.errorType === 'connection') {
      const error: any = new Error('connect ECONNREFUSED 127.0.0.1:27124');
      error.code = 'ECONNREFUSED';
      throw error;
    }
    
    return super.listFiles(directory);
  }
}

describe('Vault List Error Handling', () => {
  let api: ErrorMockObsidianAPI;
  let router: SemanticRouter;

  beforeEach(() => {
    api = new ErrorMockObsidianAPI();
    router = new SemanticRouter(api);
  });

  describe('404 Error Handling', () => {
    it('should provide helpful suggestions in semantic router error response', async () => {
      api.setErrorType('not-found');

      const response = await router.route({
        operation: 'vault',
        action: 'list',
        params: { directory: 'path/to/non-existent' }
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Request failed with status code 404');
      expect(response.error?.recovery_hints).toBeDefined();
      expect(response.error?.recovery_hints?.length).toBeGreaterThan(0);
      
      // Check that suggestions are available
      const suggestions = response.error?.recovery_hints || [];
      
      const listRootSuggestion = suggestions.find((s: any) => 
        s.command.includes('vault(action=\'list\')')
      );
      expect(listRootSuggestion).toBeDefined();
      
      // Check parent directory suggestion - the command template uses {parent_directory}
      const parentDirSuggestion = suggestions.find((s: any) => 
        s.command.includes('directory=\'{parent_directory}\'') || 
        s.command.includes('directory=\'path/to\'')
      );
      expect(parentDirSuggestion).toBeDefined();
    });
  });

  describe('Success Path', () => {
    it('should return file list on success', async () => {
      const result = await api.listFiles();
      expect(result).toContain('test.md');
      expect(result).toContain('linked.md');
    });

    it('should handle empty directory gracefully', async () => {
      const result = await api.listFiles('empty');
      expect(result).toEqual([]);
    });
  });
});