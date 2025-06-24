import { ObsidianAPI } from '../src/utils/obsidian-api';
import { ObsidianFile } from '../src/types/obsidian';

/**
 * Mock implementation of ObsidianAPI for testing
 */
export class MockObsidianAPI extends ObsidianAPI {
  private mockFiles: Map<string, string> = new Map();
  private mockDirectories: Map<string, string[]> = new Map();
  
  constructor() {
    super({
      apiKey: 'test-key',
      apiUrl: 'http://localhost:27123',
      vaultName: 'Test Vault'
    });
    
    // Initialize with some test data
    this.mockFiles.set('test.md', '# Test\n[[linked.md]] #tag1');
    this.mockFiles.set('linked.md', '# Linked Document');
    this.mockDirectories.set('/', ['test.md', 'linked.md', 'notes/']);
    this.mockDirectories.set('notes', ['daily.md', 'meeting.md']);
  }
  
  async getFile(path: string): Promise<ObsidianFile> {
    const content = this.mockFiles.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    
    return {
      content,
      path,
      tags: this.extractTags(content),
      frontmatter: {}
    };
  }
  
  async listFiles(directory?: string): Promise<string[]> {
    const dir = directory || '/';
    return this.mockDirectories.get(dir) || [];
  }
  
  async createFile(path: string, content: string) {
    this.mockFiles.set(path, content);
    return { success: true };
  }
  
  async updateFile(path: string, content: string) {
    if (!this.mockFiles.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.mockFiles.set(path, content);
    return { success: true };
  }
  
  async deleteFile(path: string) {
    if (!this.mockFiles.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.mockFiles.delete(path);
    return { success: true };
  }
  
  async searchSimple(query: string) {
    const results = [];
    for (const [path, content] of this.mockFiles.entries()) {
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          path,
          score: 1,
          matches: [{ start: 0, end: query.length }]
        });
      }
    }
    return results;
  }
  
  async appendToFile(path: string, content: string) {
    const existing = this.mockFiles.get(path);
    if (!existing) {
      throw new Error(`File not found: ${path}`);
    }
    this.mockFiles.set(path, existing + content);
    return { success: true };
  }
  
  async getServerInfo() {
    return {
      version: '1.0.0',
      authenticated: true,
      vaultName: 'Test Vault'
    };
  }
  
  async openFile(path: string) {
    return { success: true, message: `Opened ${path}` };
  }
  
  async getCommands() {
    return [
      { id: 'daily-note', name: 'Open daily note' },
      { id: 'graph-view', name: 'Open graph view' }
    ];
  }
  
  async executeCommand(commandId: string) {
    return { success: true, executed: commandId };
  }
  
  async searchPaginated(query: string, page: number = 1, pageSize: number = 10) {
    const allResults = await this.searchSimple(query);
    
    const totalResults = allResults.length;
    const totalPages = Math.ceil(totalResults / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
      query,
      page,
      pageSize,
      totalResults,
      totalPages,
      results: allResults.slice(startIndex, endIndex),
      method: 'api' as const
    };
  }
  
  private extractTags(content: string): string[] {
    const tagRegex = /#[\w-]+/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[0]);
    }
    
    return [...new Set(tags)];
  }
}