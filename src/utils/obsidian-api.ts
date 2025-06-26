import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { ObsidianConfig, ObsidianFile, ObsidianFileResponse } from '../types/obsidian.js';
import { limitSearchResults, DEFAULT_LIMITER_CONFIG } from './response-limiter.js';
import { isImageFile as checkIsImageFile, processImageResponse } from './image-handler.js';

export class ObsidianAPI {
  private client: AxiosInstance;
  private config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
    
    // Default to HTTPS on port 27124 if no URL specified
    const baseURL = config.apiUrl || 'https://localhost:27124';
    
    // Create axios instance with HTTPS agent that accepts self-signed certificates
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      // Accept self-signed certificates for HTTPS
      httpsAgent: baseURL.startsWith('https') ? new https.Agent({
        rejectUnauthorized: false
      }) : undefined
    });
  }

  // Server info
  async getServerInfo() {
    const response = await this.client.get('/');
    return response.data;
  }

  // Active file operations
  async getActiveFile(): Promise<ObsidianFile> {
    const response = await this.client.get('/active');
    return response.data;
  }

  async updateActiveFile(content: string) {
    const response = await this.client.put('/active', content, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  }

  async appendToActiveFile(content: string) {
    const response = await this.client.post('/active', content, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  }

  async deleteActiveFile() {
    const response = await this.client.delete('/active');
    return response.data;
  }

  async patchActiveFile(params: {
    operation: 'append' | 'prepend' | 'replace';
    targetType: 'heading' | 'block' | 'frontmatter';
    target: string;
    targetDelimiter?: string;
    trimTargetWhitespace?: boolean;
    content: string;
    contentType?: 'text/markdown' | 'application/json';
  }) {
    const headers: Record<string, string> = {
      'Operation': params.operation,
      'Target-Type': params.targetType,
      'Target': params.target,
      'Create-Target-If-Missing': 'true'
    };

    if (params.targetDelimiter) {
      headers['Target-Delimiter'] = params.targetDelimiter;
    }
    if (params.trimTargetWhitespace !== undefined) {
      headers['Trim-Target-Whitespace'] = params.trimTargetWhitespace.toString();
    }
    if (params.contentType) {
      headers['Content-Type'] = params.contentType;
    }

    const response = await this.client.patch('/active/', params.content, { headers });
    return response.data;
  }

  // Vault file operations
  async listFiles(directory?: string) {
    const path = directory ? `/vault/${directory}/` : '/vault/';
    try {
      const response = await this.client.get(path);
      return response.data.files || [];
    } catch (error: any) {
      // Check if it's a 404 error
      if (error.response?.status === 404) {
        const dirName = directory || 'root';
        throw new Error(
          `Directory not found: ${dirName}. ` +
          `Please check that the directory exists in your vault. ` +
          `Try 'vault(action="list")' to see available directories, or ` +
          `'vault(action="list", directory="<parent-directory>")' to browse the parent directory.`
        );
      }
      
      // Check for connection errors
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Obsidian. Please ensure:\n' +
          '1. Obsidian is running\n' +
          '2. The Local REST API plugin is installed and enabled\n' +
          '3. The API is accessible at the configured URL'
        );
      }
      
      // Re-throw other errors with original message
      throw error;
    }
  }

  async getFile(path: string): Promise<ObsidianFileResponse> {
    // Check if the file is an image based on extension
    if (checkIsImageFile(path)) {
      // For images, request raw binary data
      const response = await this.client.get(`/vault/${path}`, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': '*/*'
        }
      });
      return await processImageResponse(response, path);
    } else {
      // For text files, use the existing logic
      const response = await this.client.get(`/vault/${path}`, {
        headers: {
          'Accept': 'application/vnd.olrapi.note+json'
        }
      });
      return response.data;
    }
  }

  async createFile(path: string, content: string) {
    const response = await this.client.put(`/vault/${path}`, content, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  }

  async updateFile(path: string, content: string) {
    const response = await this.client.put(`/vault/${path}`, content, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  }

  async deleteFile(path: string) {
    const response = await this.client.delete(`/vault/${path}`);
    return response.data;
  }

  async appendToFile(path: string, content: string) {
    const response = await this.client.post(`/vault/${path}`, content, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  }

  async patchVaultFile(path: string, params: {
    operation: 'append' | 'prepend' | 'replace';
    targetType: 'heading' | 'block' | 'frontmatter';
    target: string;
    targetDelimiter?: string;
    trimTargetWhitespace?: boolean;
    content: string;
    contentType?: 'text/markdown' | 'application/json';
  }) {
    const headers: Record<string, string> = {
      'Operation': params.operation,
      'Target-Type': params.targetType,
      'Target': params.target,
      'Create-Target-If-Missing': 'true'
    };

    if (params.targetDelimiter) {
      headers['Target-Delimiter'] = params.targetDelimiter;
    }
    if (params.trimTargetWhitespace !== undefined) {
      headers['Trim-Target-Whitespace'] = params.trimTargetWhitespace.toString();
    }
    if (params.contentType) {
      headers['Content-Type'] = params.contentType;
    }

    const response = await this.client.patch(`/vault/${encodeURIComponent(path)}`, params.content, { headers });
    return response.data;
  }

  // Search operations
  async searchSimple(query: string) {
    try {
      const response = await this.client.post('/search/simple', null, {
        params: { query }
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Obsidian. Is the Local REST API plugin running?');
      }
      throw error;
    }
  }

  // Open file in Obsidian
  async openFile(path: string) {
    const response = await this.client.post(`/open/${encodeURIComponent(path)}`);
    return response.data;
  }
  
  // Commands
  async getCommands() {
    const response = await this.client.get('/commands/');
    return response.data;
  }
  
  async executeCommand(commandId: string) {
    const response = await this.client.post(`/commands/${encodeURIComponent(commandId)}/`);
    return response.data;
  }
  
  // Search with pagination
  async searchPaginated(query: string, page: number = 1, pageSize: number = 10) {
    // Since the API doesn't support pagination natively, we'll implement it client-side
    const allResults = await this.searchSimple(query);
    
    if (!allResults || !Array.isArray(allResults)) {
      return {
        query,
        page,
        pageSize,
        totalResults: 0,
        totalPages: 0,
        results: [],
        method: 'api'
      };
    }
    
    // First limit the results to prevent token overflow
    const { results: limitedResults, truncated, originalCount } = limitSearchResults(allResults);
    
    const totalResults = limitedResults.length;
    const totalPages = Math.ceil(totalResults / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
      query,
      page,
      pageSize,
      totalResults,
      totalPages,
      results: limitedResults.slice(startIndex, endIndex),
      method: 'api',
      // Add metadata about truncation
      ...(truncated && {
        truncated: true,
        originalResultCount: originalCount,
        message: `Results limited to prevent token overflow. Showing ${limitedResults.length} of ${originalCount} results.`
      })
    };
  }
}