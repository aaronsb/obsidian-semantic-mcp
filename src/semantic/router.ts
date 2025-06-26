import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ObsidianAPI } from '../utils/obsidian-api.js';
import { 
  SemanticResponse, 
  WorkflowConfig, 
  SemanticContext,
  SemanticRequest,
  SuggestedAction
} from '../types/semantic.js';
import { ContentBufferManager } from '../utils/content-buffer.js';
import { StateTokenManager } from './state-tokens.js';
import { limitResponse } from '../utils/response-limiter.js';
import { isImageFile } from '../types/obsidian.js';
import { UniversalFragmentRetriever } from '../indexing/fragment-retriever.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SemanticRouter {
  private config!: WorkflowConfig;
  private context: SemanticContext = {};
  private api: ObsidianAPI;
  private tokenManager: StateTokenManager;
  private fragmentRetriever: UniversalFragmentRetriever;
  
  constructor(api: ObsidianAPI) {
    this.api = api;
    this.tokenManager = new StateTokenManager();
    this.fragmentRetriever = new UniversalFragmentRetriever();
    this.loadConfig();
  }
  
  private loadConfig() {
    try {
      const configPath = join(__dirname, '../config/workflows.json');
      const configContent = readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configContent);
    } catch (error) {
      // Try from current working directory for tests
      try {
        const configPath = join(process.cwd(), 'src/config/workflows.json');
        const configContent = readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(configContent);
      } catch {
        console.warn('Failed to load config, using default');
        this.config = this.getDefaultConfig();
      }
    }
  }
  
  private getDefaultConfig(): WorkflowConfig {
    return {
      version: '1.0.0',
      description: 'Default workflow configuration',
      operations: {
        vault: {
          description: 'File operations',
          actions: {}
        },
        edit: {
          description: 'Edit operations', 
          actions: {}
        }
      }
    };
  }
  
  /**
   * Route a semantic request to the appropriate handler and enrich the response
   */
  async route(request: SemanticRequest): Promise<SemanticResponse> {
    const { operation, action, params } = request;
    
    // Update context
    this.updateContext(operation, action, params);
    
    try {
      // Execute the actual operation
      const result = await this.executeOperation(operation, action, params);
      
      // Update tokens based on success
      this.tokenManager.updateTokens(operation, action, params, result, true);
      
      // Enrich with semantic hints
      const response = this.enrichResponse(result, operation, action, params, false);
      
      // Update context with successful result
      this.updateContextAfterSuccess(response, params);
      
      return response;
      
    } catch (error: any) {
      // Update tokens for failure
      this.tokenManager.updateTokens(operation, action, params, null, false);
      
      // Handle errors with semantic recovery hints
      return this.handleError(error, operation, action, params);
    }
  }
  
  private async executeOperation(operation: string, action: string, params: any): Promise<any> {
    // Map semantic operations to actual tool calls
    switch (operation) {
      case 'vault':
        return this.executeVaultOperation(action, params);
      case 'edit':
        return this.executeEditOperation(action, params);
      case 'view':
        return this.executeViewOperation(action, params);
      case 'workflow':
        return this.executeWorkflowOperation(action, params);
      case 'system':
        return this.executeSystemOperation(action, params);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  private async executeVaultOperation(action: string, params: any): Promise<any> {
    switch (action) {
      case 'list':
        return await this.api.listFiles(params.directory);
      case 'read':
        // Default to fragment retrieval unless full file is explicitly requested
        if (params.returnFullFile) {
          const fileResponse = await this.api.getFile(params.path);
          const content = typeof fileResponse === 'string' ? fileResponse : JSON.stringify(fileResponse);
          const wordCount = content.split(/\s+/).length;
          
          // Add warning about file size
          return {
            content: fileResponse,
            metadata: {
              wordCount,
              warning: wordCount > 2000 ? 
                `This file contains ${wordCount} words. Consider using fragment retrieval (remove returnFullFile parameter) to reduce context consumption.` : 
                null
            }
          };
        } else {
          // Use fragment retrieval by default
          const fileResponse = await this.api.getFile(params.path);
          
          // Extract content from the response
          let fileContent: string;
          let metadata: any = {};
          
          if (typeof fileResponse === 'string') {
            fileContent = fileResponse;
          } else if (fileResponse && typeof fileResponse === 'object' && 'content' in fileResponse) {
            // Handle structured response from Obsidian API
            fileContent = fileResponse.content;
            metadata = fileResponse;
            
            // If it's still not a string (might be an image or binary file)
            if (typeof fileContent !== 'string') {
              return fileResponse;
            }
          } else {
            // Handle other non-text files
            return fileResponse;
          }
          
          // Index the file if not already indexed
          const docId = `file:${params.path}`;
          await this.fragmentRetriever.indexDocument(docId, params.path, fileContent);
          
          // Retrieve relevant fragments based on query or path
          const query = params.query || params.path.split('/').pop()?.replace('.md', '') || '';
          const fragmentResponse = await this.fragmentRetriever.retrieveFragments(query, {
            strategy: params.strategy || 'auto',
            maxFragments: params.maxFragments || 5
          });
          
          // Return structured response with fragments
          return {
            ...metadata,
            content: fragmentResponse.result,
            originalContentLength: fileContent.length,
            fragmentMetadata: {
              totalFragments: fragmentResponse.result.length,
              strategy: params.strategy || 'auto',
              query: query
            },
            workflow: fragmentResponse.workflow,
            efficiency_hints: fragmentResponse.efficiency_hints
          };
        }
      case 'fragments':
        // Dedicated fragment search across multiple files
        // First, index all markdown files if not done
        if (this.fragmentRetriever.getIndexedDocumentCount() === 0) {
          await this.indexVaultFiles();
        }
        
        // Default query to path if no query provided
        const fragmentQuery = params.query || params.path || '';
        
        // Search for fragments
        const fragmentResponse = await this.fragmentRetriever.retrieveFragments(fragmentQuery, {
          strategy: params.strategy || 'auto',
          maxFragments: params.maxFragments || 5
        });
        
        return fragmentResponse;
      case 'create':
        return await this.api.createFile(params.path, params.content || '');
      case 'update':
        return await this.api.updateFile(params.path, params.content);
      case 'delete':
        return await this.api.deleteFile(params.path);
      case 'search':
        return await this.api.searchPaginated(params.query, params.page, params.pageSize);
      default:
        throw new Error(`Unknown vault action: ${action}`);
    }
  }
  
  private async indexVaultFiles(): Promise<void> {
    // Index all markdown files in the vault
    const indexDirectory = async (directory?: string) => {
      try {
        const files = await this.api.listFiles(directory);
        
        for (const file of files) {
          const filePath = directory ? `${directory}/${file}` : file;
          
          if (file.endsWith('/')) {
            // Recursively index subdirectories
            await indexDirectory(filePath.slice(0, -1));
          } else if (file.endsWith('.md')) {
            try {
              const fileResponse = await this.api.getFile(filePath);
              let content: string;
              
              // Handle both string and structured responses
              if (typeof fileResponse === 'string') {
                content = fileResponse;
              } else if (fileResponse && typeof fileResponse === 'object' && 'content' in fileResponse) {
                content = fileResponse.content;
              } else {
                continue; // Skip if we can't extract content
              }
              
              const docId = `file:${filePath}`;
              await this.fragmentRetriever.indexDocument(docId, filePath, content);
            } catch (e) {
              // Skip unreadable files
              console.warn(`Failed to index ${filePath}:`, e);
            }
          }
        }
      } catch (e) {
        // Skip unreadable directories
        console.warn(`Failed to index directory ${directory}:`, e);
      }
    };
    
    await indexDirectory();
  }
  
  private async executeEditOperation(action: string, params: any): Promise<any> {
    // Import window edit tools dynamically to avoid circular dependencies
    const { performWindowEdit } = await import('../tools/window-edit.js');
    const buffer = ContentBufferManager.getInstance();
    
    switch (action) {
      case 'window':
        const result = await performWindowEdit(
          this.api,
          params.path,
          params.oldText,
          params.newText,
          params.fuzzyThreshold
        );
        if (result.isError) {
          throw new Error(result.content[0].text);
        }
        return result;
      case 'append':
        return await this.api.appendToFile(params.path, params.content);
      case 'patch':
        return await this.api.patchVaultFile(params.path, {
          operation: params.operation,
          targetType: params.targetType,
          target: params.target,
          content: params.content
        });
      case 'at_line':
        // Get content to insert
        let insertContent = params.content;
        if (!insertContent) {
          const buffered = buffer.retrieve();
          if (!buffered) {
            throw new Error('No content provided and no buffered content found');
          }
          insertContent = buffered.content;
        }
        
        // Get file and perform line-based edit
        const file = await this.api.getFile(params.path);
        if (isImageFile(file)) {
          throw new Error('Cannot perform line-based edits on image files');
        }
        const content = typeof file === 'string' ? file : file.content;
        const lines = content.split('\n');
        
        if (params.lineNumber < 1 || params.lineNumber > lines.length + 1) {
          throw new Error(`Invalid line number ${params.lineNumber}. File has ${lines.length} lines.`);
        }
        
        const lineIndex = params.lineNumber - 1;
        const mode = params.mode || 'replace';
        
        switch (mode) {
          case 'before':
            lines.splice(lineIndex, 0, insertContent);
            break;
          case 'after':
            lines.splice(lineIndex + 1, 0, insertContent);
            break;
          case 'replace':
            lines[lineIndex] = insertContent;
            break;
        }
        
        await this.api.updateFile(params.path, lines.join('\n'));
        return { success: true, line: params.lineNumber, mode };
      case 'from_buffer':
        const buffered = buffer.retrieve();
        if (!buffered) {
          throw new Error('No buffered content available');
        }
        return await performWindowEdit(
          this.api,
          params.path,
          params.oldText || buffered.searchText || '',
          buffered.content,
          params.fuzzyThreshold
        );
      default:
        throw new Error(`Unknown edit action: ${action}`);
    }
  }
  
  private async executeViewOperation(action: string, params: any): Promise<any> {
    switch (action) {
      case 'file':
        return await this.api.getFile(params.path);
      case 'window':
        // View a portion of a file
        const file = await this.api.getFile(params.path);
        if (isImageFile(file)) {
          throw new Error('Cannot view window of image files');
        }
        const content = typeof file === 'string' ? file : file.content;
        const lines = content.split('\n');
        
        let centerLine = params.lineNumber || 1;
        
        // If search text provided, find it
        if (params.searchText && !params.lineNumber) {
          const { findFuzzyMatches } = await import('../utils/fuzzy-match.js');
          const matches = findFuzzyMatches(content, params.searchText, 0.6);
          if (matches.length > 0) {
            centerLine = matches[0].lineNumber;
          }
        }
        
        // Calculate window
        const windowSize = params.windowSize || 20;
        const halfWindow = Math.floor(windowSize / 2);
        const startLine = Math.max(1, centerLine - halfWindow);
        const endLine = Math.min(lines.length, centerLine + halfWindow);
        
        return {
          path: params.path,
          lines: lines.slice(startLine - 1, endLine),
          startLine,
          endLine,
          totalLines: lines.length,
          centerLine,
          searchText: params.searchText
        };
        
      case 'active':
        return await this.api.getActiveFile();
        
      case 'open_in_obsidian':
        return await this.api.openFile(params.path);
        
      default:
        throw new Error(`Unknown view action: ${action}`);
    }
  }
  
  private async executeWorkflowOperation(action: string, params: any): Promise<any> {
    switch (action) {
      case 'suggest':
        return this.generateWorkflowSuggestions();
      default:
        throw new Error(`Unknown workflow action: ${action}`);
    }
  }
  
  private async executeSystemOperation(action: string, params: any): Promise<any> {
    switch (action) {
      case 'info':
        return await this.api.getServerInfo();
      case 'commands':
        return await this.api.getCommands();
      case 'fetch_web':
        // Import fetch tool dynamically
        const { fetchTool } = await import('../tools/fetch.js');
        return await fetchTool.handler(this.api, params);
      default:
        throw new Error(`Unknown system action: ${action}`);
    }
  }
  
  private enrichResponse(result: any, operation: string, action: string, params: any, isError: boolean): SemanticResponse {
    const operationConfig = this.config?.operations?.[operation];
    const actionConfig = operationConfig?.actions?.[action];
    
    // Skip limiting for vault read operations - we want the full document
    const shouldLimit = !(operation === 'vault' && action === 'read');
    
    // Limit the result size to prevent token overflow (except for vault reads)
    const limitedResult = shouldLimit ? limitResponse(result) : result;
    
    const response: SemanticResponse = {
      result: limitedResult,
      context: this.getCurrentContext()
    };
    
    // Add workflow hints
    if (actionConfig) {
      const hints = isError ? actionConfig.failure_hints : actionConfig.success_hints;
      if (hints && hints.suggested_next) {
        response.workflow = {
          message: this.interpolateMessage(hints.message || '', params, result),
          suggested_next: this.generateSuggestions(hints.suggested_next, params, result)
        };
      }
    }
    
    // Add efficiency hints
    const efficiencyHints = this.checkEfficiencyRules(operation, action, params);
    if (efficiencyHints.length > 0) {
      response.efficiency_hints = {
        message: efficiencyHints[0].hint,
        alternatives: efficiencyHints.slice(1).map(h => h.hint)
      };
    }
    
    return response;
  }
  
  private interpolateMessage(template: string, params: any, result: any): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return params?.[key] || result?.[key] || match;
    });
  }
  
  private generateSuggestions(conditionalSuggestions: any[], params: any, result: any): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];
    
    if (!Array.isArray(conditionalSuggestions)) {
      return suggestions;
    }
    
    for (const conditional of conditionalSuggestions) {
      if (this.evaluateCondition(conditional.condition, params, result)) {
        for (const suggestion of conditional.suggestions || []) {
          // Check if required tokens are available
          if (suggestion.requires_tokens && !this.tokenManager.hasTokensFor(suggestion.requires_tokens)) {
            continue; // Skip this suggestion - required tokens not available
          }
          
          suggestions.push({
            description: suggestion.description,
            command: this.interpolateMessage(suggestion.command, params, result),
            reason: suggestion.reason
          });
        }
      }
    }
    
    return suggestions;
  }
  
  private evaluateCondition(condition: string, params: any, result: any): boolean {
    switch (condition) {
      case 'always':
        return true;
      case 'has_results':
        return result && (result.results?.length > 0 || result.totalResults > 0);
      case 'no_results':
        return !result || (result.results?.length === 0 && result.totalResults === 0);
      case 'has_links':
        return result?.links?.length > 0;
      case 'has_tags':
        return result?.tags?.length > 0;
      case 'has_markdown_files':
        return Array.isArray(result) && result.some(f => f.endsWith('.md'));
      case 'is_daily_note':
        return this.matchesPattern(params.path, this.config.context_triggers?.daily_note_pattern);
      default:
        return false;
    }
  }
  
  private matchesPattern(value: string, pattern?: string): boolean {
    if (!pattern) return false;
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(value);
    } catch {
      return false;
    }
  }
  
  private checkEfficiencyRules(operation: string, action: string, params: any): any[] {
    if (!this.config.efficiency_rules) return [];
    
    const matches = [];
    for (const rule of this.config.efficiency_rules) {
      // Simple pattern matching for now
      if (rule.pattern === 'multiple_edits_same_file' && 
          this.context.last_file === params.path &&
          operation === 'edit') {
        matches.push(rule);
      }
    }
    
    return matches;
  }
  
  private updateContext(operation: string, action: string, params: any) {
    this.context.operation = operation;
    this.context.action = action;
    
    if (params.path) {
      this.context.last_file = params.path;
      
      // Track file history
      if (!this.context.file_history) {
        this.context.file_history = [];
      }
      if (!this.context.file_history.includes(params.path)) {
        this.context.file_history.push(params.path);
        // Keep only last 10 files
        if (this.context.file_history.length > 10) {
          this.context.file_history.shift();
        }
      }
    }
    
    if (params.directory) {
      this.context.last_directory = params.directory;
    }
    
    if (params.query) {
      if (!this.context.search_history) {
        this.context.search_history = [];
      }
      this.context.search_history.push(params.query);
      // Keep only last 5 searches
      if (this.context.search_history.length > 5) {
        this.context.search_history.shift();
      }
    }
  }
  
  private updateContextAfterSuccess(response: SemanticResponse, params: any) {
    // Update buffer status
    const buffer = ContentBufferManager.getInstance();
    this.context.buffer_content = buffer.retrieve()?.content;
    
    // Update context based on the operation
    const tokens = this.tokenManager.getTokens();
    
    if (tokens.file_loaded) {
      this.context.last_file = tokens.file_loaded;
      this.context.file_history = tokens.file_history;
    }
    
    if (tokens.directory_listed) {
      this.context.last_directory = tokens.directory_listed;
    }
    
    if (tokens.search_query) {
      if (!this.context.search_history) {
        this.context.search_history = [];
      }
      if (!this.context.search_history.includes(tokens.search_query)) {
        this.context.search_history.push(tokens.search_query);
      }
    }
  }
  
  private getCurrentContext() {
    const tokens = this.tokenManager.getTokens();
    
    return {
      current_file: this.context.last_file,
      current_directory: this.context.last_directory,
      buffer_available: !!this.context.buffer_content,
      file_history: this.context.file_history,
      search_history: this.context.search_history,
      // Include relevant token states
      has_file_content: tokens.file_content,
      has_links: (tokens.file_has_links?.length ?? 0) > 0,
      has_tags: (tokens.file_has_tags?.length ?? 0) > 0,
      search_results_available: tokens.search_has_results,
      linked_files: tokens.file_has_links,
      tags: tokens.file_has_tags
    };
  }
  
  private handleError(error: any, operation: string, action: string, params: any): SemanticResponse {
    const errorResponse = this.enrichResponse(
      null,
      operation,
      action,
      params,
      true // isError
    );
    
    errorResponse.error = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      recovery_hints: errorResponse.workflow?.suggested_next
    };
    
    delete errorResponse.workflow; // Move suggestions to recovery_hints
    
    return errorResponse;
  }
  
  private generateWorkflowSuggestions(): any {
    // Generate contextual workflow suggestions based on current state
    const suggestions: SuggestedAction[] = [];
    
    if (this.context.last_file) {
      suggestions.push({
        description: 'Continue working with last file',
        command: `vault(action='read', path='${this.context.last_file}')`,
        reason: 'Return to previous work'
      });
    }
    
    if (this.context.search_history?.length) {
      const lastSearch = this.context.search_history[this.context.search_history.length - 1];
      suggestions.push({
        description: 'Refine last search',
        command: `vault(action='search', query='${lastSearch} AND ...')`,
        reason: 'Narrow down results'
      });
    }
    
    return {
      current_context: this.getCurrentContext(),
      suggestions
    };
  }
}