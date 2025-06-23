import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { ObsidianConfig, ObsidianFile } from '../types/obsidian.js';

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
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
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
    const response = await this.client.put('/active', { content });
    return response.data;
  }

  async appendToActiveFile(content: string) {
    const response = await this.client.post('/active', { content });
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
    const response = await this.client.get(path);
    return response.data.files || [];
  }

  async getFile(path: string): Promise<ObsidianFile> {
    const response = await this.client.get(`/vault/${path}`);
    return response.data;
  }

  async createFile(path: string, content: string) {
    const response = await this.client.put(`/vault/${path}`, { content });
    return response.data;
  }

  async updateFile(path: string, content: string) {
    const response = await this.client.put(`/vault/${path}`, { content });
    return response.data;
  }

  async deleteFile(path: string) {
    const response = await this.client.delete(`/vault/${path}`);
    return response.data;
  }

  async appendToFile(path: string, content: string) {
    const response = await this.client.post(`/vault/${path}`, { content });
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
      const response = await this.client.post('/search/simple', { query });
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
    const response = await this.client.post('/open', { path });
    return response.data;
  }
}