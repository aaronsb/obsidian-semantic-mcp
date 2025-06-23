import { ObsidianAPI } from '../utils/obsidian-api.js';

interface SearchResult {
  path: string;
  title: string;
  context?: string;
  score?: number;
}

interface PaginatedSearchResponse {
  query: string;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  results: SearchResult[];
  method: 'api' | 'fallback';
}

export const searchPaginatedTool = {
  name: 'search_vault_paginated',
  description: 'Paginated search across the vault with size limits',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      page: {
        type: 'number',
        description: 'Page number (1-based)',
        default: 1
      },
      pageSize: {
        type: 'number',
        description: 'Results per page',
        default: 10
      },
      includeContent: {
        type: 'boolean',
        description: 'Include file content in results',
        default: false
      }
    },
    required: ['query']
  },
  handler: async (api: ObsidianAPI, args: any) => {
    try {
      const page = args.page || 1;
      const pageSize = args.pageSize || 10;
      const includeContent = args.includeContent || false;
      
      // Try API search first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const apiResults = await api.searchSimple(args.query);
        clearTimeout(timeoutId);
        
        if (apiResults && Array.isArray(apiResults)) {
          // Process API results with pagination
          const totalResults = apiResults.length;
          const totalPages = Math.ceil(totalResults / pageSize);
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          
          const paginatedResults = apiResults.slice(startIndex, endIndex).map((result: any) => {
            // Extract just the essential information
            const processed: SearchResult = {
              path: result.path || result.filename || '',
              title: result.title || result.basename || result.path?.split('/').pop()?.replace('.md', '') || '',
            };
            
            // Add context if available but limit its size
            if (result.context || result.content) {
              const context = result.context || result.content;
              processed.context = typeof context === 'string' 
                ? context.substring(0, 200) + (context.length > 200 ? '...' : '')
                : '';
            }
            
            if (result.score) {
              processed.score = result.score;
            }
            
            return processed;
          });
          
          const response: PaginatedSearchResponse = {
            query: args.query,
            page,
            pageSize,
            totalResults,
            totalPages,
            results: paginatedResults,
            method: 'api'
          };
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        }
      } catch (apiError) {
        console.error('API search failed, using fallback');
      }
      
      // Fallback: manual search with better pagination
      const query = args.query.toLowerCase();
      const allResults: SearchResult[] = [];
      
      const searchDirectory = async (directory?: string) => {
        try {
          const files = await api.listFiles(directory);
          
          for (const file of files) {
            const filePath = directory ? `${directory}/${file}` : file;
            
            if (file.endsWith('/')) {
              await searchDirectory(filePath.slice(0, -1));
            } else if (file.endsWith('.md')) {
              try {
                // For large vaults, just check the filename first
                if (file.toLowerCase().includes(query)) {
                  allResults.push({
                    path: filePath,
                    title: file.replace('.md', ''),
                    score: 2 // Higher score for filename matches
                  });
                } else if (includeContent) {
                  // Only read file content if specifically requested
                  const content = await api.getFile(filePath);
                  const textContent = typeof content === 'string' ? content : JSON.stringify(content);
                  
                  if (textContent.toLowerCase().includes(query)) {
                    const matches = (textContent.toLowerCase().split(query).length - 1);
                    allResults.push({
                      path: filePath,
                      title: file.replace('.md', ''),
                      context: extractContext(textContent, query, 150),
                      score: matches
                    });
                  }
                }
              } catch (e) {
                // Skip unreadable files
              }
            }
          }
        } catch (e) {
          // Skip unreadable directories
        }
      };
      
      await searchDirectory();
      
      // Sort by score
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Apply pagination
      const totalResults = allResults.length;
      const totalPages = Math.ceil(totalResults / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      const response: PaginatedSearchResponse = {
        query: args.query,
        page,
        pageSize,
        totalResults,
        totalPages,
        results: allResults.slice(startIndex, endIndex),
        method: 'fallback'
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
      
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
};

// Helper function to extract context
function extractContext(content: string, query: string, maxLength: number = 150): string {
  const lowerContent = content.toLowerCase();
  const index = lowerContent.indexOf(query.toLowerCase());
  
  if (index === -1) return '';
  
  const start = Math.max(0, index - maxLength / 2);
  const end = Math.min(content.length, index + query.length + maxLength / 2);
  
  let context = content.substring(start, end);
  if (start > 0) context = '...' + context;
  if (end < content.length) context = context + '...';
  
  return context.trim();
}