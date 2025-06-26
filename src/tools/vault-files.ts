import { ObsidianAPI } from '../utils/obsidian-api.js';
import { UniversalFragmentRetriever } from '../indexing/fragment-retriever.js';

// Shared fragment retriever instance
const fragmentRetriever = new UniversalFragmentRetriever();

export const vaultFileTools = [
  {
    name: 'list_vault_files',
    description: 'List files in the Obsidian vault or a specific directory',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to list (optional)'
        }
      },
      required: []
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        const files = await api.listFiles(args.directory);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(files, null, 2)
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
  },
  {
    name: 'get_vault_file',
    description: 'Get relevant fragments from a file (default) or full file content. Uses intelligent fragment retrieval to reduce context consumption.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        query: {
          type: 'string',
          description: 'Optional search query to find specific fragments within the file'
        },
        returnFullFile: {
          type: 'boolean',
          description: 'Return full file instead of fragments (WARNING: large files can consume significant context)',
          default: false
        },
        maxFragments: {
          type: 'number',
          description: 'Maximum number of fragments to return (default: 5)',
          default: 5
        }
      },
      required: ['path']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        const file = await api.getFile(args.path);
        
        // Handle non-text files (like images)
        if (typeof file !== 'string') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(file, null, 2)
            }]
          };
        }
        
        const fileContent = file as string;
        const wordCount = fileContent.split(/\s+/).length;
        
        // Return full file if requested
        if (args.returnFullFile) {
          let responseText = fileContent;
          
          // Add warning for large files
          if (wordCount > 2000) {
            responseText += `\n\n⚠️ WARNING: This file contains ${wordCount} words. Consider using fragment retrieval (omit returnFullFile) to reduce context consumption.`;
          }
          
          return {
            content: [{
              type: 'text',
              text: responseText
            }]
          };
        }
        
        // Use fragment retrieval by default
        const docId = `file:${args.path}`;
        await fragmentRetriever.indexDocument(docId, args.path, fileContent);
        
        // Use provided query or extract from filename
        const query = args.query || args.path.split('/').pop()?.replace('.md', '') || '';
        const fragmentResponse = await fragmentRetriever.retrieveFragments(query, {
          maxFragments: args.maxFragments || 5
        });
        
        // Format the response
        const fragments = fragmentResponse.result;
        let responseText = `📄 **File**: ${args.path}\n`;
        responseText += `📊 **Stats**: ${wordCount} words total, showing ${fragments.length} most relevant fragments\n\n`;
        
        if (fragments.length === 0) {
          responseText += `No relevant fragments found for query: "${query}"\n`;
          responseText += `💡 **Hint**: Try 'returnFullFile: true' to get the complete file content.`;
        } else {
          fragments.forEach((fragment, idx) => {
            responseText += `### Fragment ${idx + 1} (lines ${fragment.lineStart}-${fragment.lineEnd}, score: ${fragment.score.toFixed(2)})\n\n`;
            responseText += fragment.content + '\n\n';
            responseText += '---\n\n';
          });
          
          responseText += `💡 **Hints**:\n`;
          responseText += `- To see the full file (${wordCount} words), use: 'returnFullFile: true'\n`;
          responseText += `- To search for specific content, use: 'query: "your search terms"'\n`;
          responseText += `- To get more fragments, use: 'maxFragments: 10'`;
        }
        
        return {
          content: [{
            type: 'text',
            text: responseText
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
  },
  {
    name: 'create_vault_file',
    description: 'Create a new file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new file'
        },
        content: {
          type: 'string',
          description: 'Content for the new file'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.createFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `File created: ${args.path}`
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
  },
  {
    name: 'update_vault_file',
    description: 'Update the content of an existing file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        content: {
          type: 'string',
          description: 'New content for the file'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.updateFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `File updated: ${args.path}`
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
  },
  {
    name: 'delete_vault_file',
    description: 'Delete a file from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to delete'
        }
      },
      required: ['path']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.deleteFile(args.path);
        return {
          content: [{
            type: 'text',
            text: `File deleted: ${args.path}`
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
  },
  {
    name: 'append_to_vault_file',
    description: 'Append content to an existing file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        content: {
          type: 'string',
          description: 'Content to append'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.appendToFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `Content appended to: ${args.path}`
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
  },
  {
    name: 'patch_vault_file',
    description: 'Insert or modify content in a vault file relative to headings, blocks, or frontmatter',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to patch'
        },
        operation: {
          type: 'string',
          enum: ['append', 'prepend', 'replace'],
          description: 'The operation to perform'
        },
        targetType: {
          type: 'string',
          enum: ['heading', 'block', 'frontmatter'],
          description: 'The type of target to modify'
        },
        target: {
          type: 'string',
          description: 'The target identifier (heading path, block ID, or frontmatter field)'
        },
        targetDelimiter: {
          type: 'string',
          description: 'Delimiter for heading paths (default: "::")',
          default: '::'
        },
        trimTargetWhitespace: {
          type: 'boolean',
          description: 'Whether to trim whitespace from target (default: false)',
          default: false
        },
        content: {
          type: 'string',
          description: 'The content to insert or use for replacement'
        },
        contentType: {
          type: 'string',
          enum: ['text/markdown', 'application/json'],
          description: 'Content type (default: text/markdown)',
          default: 'text/markdown'
        }
      },
      required: ['path', 'operation', 'targetType', 'target', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.patchVaultFile(args.path, {
          operation: args.operation,
          targetType: args.targetType,
          target: args.target,
          targetDelimiter: args.targetDelimiter || '::',
          trimTargetWhitespace: args.trimTargetWhitespace || false,
          content: args.content,
          contentType: args.contentType || 'text/markdown'
        });
        return {
          content: [{
            type: 'text',
            text: `File patched successfully: ${args.path}`
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
  }
];