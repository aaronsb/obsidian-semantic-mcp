import { ObsidianAPI } from '../utils/obsidian-api.js';
import { SemanticRouter } from '../semantic/router.js';
import { SemanticRequest } from '../types/semantic.js';
import { isImageFile } from '../types/obsidian.js';

/**
 * Unified semantic tools that consolidate all operations into 5 main verbs
 */

const createSemanticTool = (operation: string) => ({
  name: operation,
  description: getOperationDescription(operation),
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The specific action to perform',
        enum: getActionsForOperation(operation)
      },
      ...getParametersForOperation(operation)
    },
    required: ['action']
  },
  handler: async (api: ObsidianAPI, args: any) => {
    const router = new SemanticRouter(api);
    
    const request: SemanticRequest = {
      operation,
      action: args.action,
      params: args
    };
    
    const response = await router.route(request);
    
    // Format for MCP
    if (response.error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: response.error,
            workflow: response.workflow,
            context: response.context
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Check if the result is an image file for vault read operations
    if (operation === 'vault' && args.action === 'read' && response.result && isImageFile(response.result)) {
      // Return image content for MCP
      return {
        content: [{
          type: 'image',
          data: response.result.base64Data,
          mimeType: response.result.mimeType
        }]
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          result: response.result,
          workflow: response.workflow,
          context: response.context,
          efficiency_hints: response.efficiency_hints
        }, null, 2)
      }]
    };
  }
});

function getOperationDescription(operation: string): string {
  const descriptions: Record<string, string> = {
    vault: 'File and folder operations - list, read, create, update, delete, search',
    edit: 'Smart editing operations - window, append, patch, at_line, from_buffer',
    view: 'Content viewing and navigation - file, window, active, open_in_obsidian',
    workflow: 'Workflow guidance and suggestions based on current context',
    system: 'System operations - info, commands, fetch_web'
  };
  return descriptions[operation] || 'Unknown operation';
}

function getActionsForOperation(operation: string): string[] {
  const actions: Record<string, string[]> = {
    vault: ['list', 'read', 'create', 'update', 'delete', 'search', 'fragments'],
    edit: ['window', 'append', 'patch', 'at_line', 'from_buffer'],
    view: ['file', 'window', 'active', 'open_in_obsidian'],
    workflow: ['suggest', 'analyze'],
    system: ['info', 'commands', 'fetch_web']
  };
  return actions[operation] || [];
}

function getParametersForOperation(operation: string): Record<string, any> {
  // Common parameters across operations
  const pathParam = {
    path: {
      type: 'string',
      description: 'Path to the file or directory'
    }
  };
  
  const contentParam = {
    content: {
      type: 'string',
      description: 'Content to write or append'
    }
  };
  
  // Operation-specific parameters
  const operationParams: Record<string, Record<string, any>> = {
    vault: {
      ...pathParam,
      directory: {
        type: 'string',
        description: 'Directory path for list operations'
      },
      query: {
        type: 'string',
        description: 'Search query'
      },
      page: {
        type: 'number',
        description: 'Page number for paginated results'
      },
      pageSize: {
        type: 'number',
        description: 'Number of results per page'
      },
      strategy: {
        type: 'string',
        enum: ['auto', 'adaptive', 'proximity', 'semantic'],
        description: 'Fragment retrieval strategy (default: auto)'
      },
      maxFragments: {
        type: 'number',
        description: 'Maximum number of fragments to return (default: 5)'
      },
      returnFullFile: {
        type: 'boolean',
        description: 'Return full file instead of fragments (WARNING: large files can consume significant context)'
      },
      ...contentParam
    },
    edit: {
      ...pathParam,
      ...contentParam,
      oldText: {
        type: 'string',
        description: 'Text to search for (supports fuzzy matching)'
      },
      newText: {
        type: 'string',
        description: 'Text to replace with'
      },
      fuzzyThreshold: {
        type: 'number',
        description: 'Similarity threshold for fuzzy matching (0-1)',
        default: 0.7
      },
      lineNumber: {
        type: 'number',
        description: 'Line number for at_line action'
      },
      mode: {
        type: 'string',
        enum: ['before', 'after', 'replace'],
        description: 'Insert mode for at_line action'
      },
      operation: {
        type: 'string',
        description: 'Patch operation type'
      },
      targetType: {
        type: 'string',
        description: 'Target type for patch operations'
      },
      target: {
        type: 'string',
        description: 'Target identifier for patch operations'
      }
    },
    view: {
      ...pathParam,
      searchText: {
        type: 'string',
        description: 'Text to search for and highlight'
      },
      lineNumber: {
        type: 'number',
        description: 'Line number to center view around'
      },
      windowSize: {
        type: 'number',
        description: 'Number of lines to show',
        default: 20
      }
    },
    workflow: {
      type: {
        type: 'string',
        description: 'Type of analysis or workflow'
      }
    },
    system: {
      url: {
        type: 'string',
        description: 'URL for web fetch operations'
      },
      prompt: {
        type: 'string',
        description: 'Prompt for web content analysis'
      }
    }
  };
  
  return operationParams[operation] || {};
}

// Export the 5 semantic tools
export const semanticTools = [
  createSemanticTool('vault'),
  createSemanticTool('edit'),
  createSemanticTool('view'),
  createSemanticTool('workflow'),
  createSemanticTool('system')
];