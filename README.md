# Obsidian Semantic MCP Server

[![npm version](https://badge.fury.io/js/obsidian-semantic-mcp.svg)](https://www.npmjs.com/package/obsidian-semantic-mcp)

A semantic, AI-optimized MCP server for Obsidian that consolidates 21+ tools into 5 intelligent operations with contextual workflow hints.

## Prerequisites

- [Obsidian](https://obsidian.md/) installed on your computer
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed in your Obsidian vault
- [Claude Desktop](https://claude.ai/download) app

## Installation

```bash
npm install -g obsidian-semantic-mcp
```

Or use directly with npx (recommended):
```bash
npx obsidian-semantic-mcp
```

View on npm: https://www.npmjs.com/package/obsidian-semantic-mcp

## Quick Start

1. **Install the Obsidian Plugin:**
   - Open Obsidian Settings → Community Plugins
   - Browse and search for "Local REST API"
   - Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin by Adam Coddington
   - Enable the plugin
   - In the plugin settings, copy your API key (you'll need this for configuration)

2. **Configure Claude Desktop:**
   
   The npx command is automatically used in the Claude Desktop configuration. Add this to your Claude Desktop config (usually found at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "npx",
         "args": ["-y", "obsidian-semantic-mcp"],
         "env": {
           "OBSIDIAN_API_KEY": "your-api-key-here",
           "OBSIDIAN_API_URL": "https://127.0.0.1:27124",
           "OBSIDIAN_VAULT_NAME": "your-vault-name"
         }
       }
     }
   }
   ```

## Features

This server consolidates traditional MCP tools into an AI-optimized semantic interface that makes it easier for AI agents to understand and use Obsidian operations effectively.

### Key Benefits

- **Simplified Interface**: 5 semantic operations instead of 21+ individual tools
- **Contextual Workflows**: Intelligent hints guide AI agents to the next logical action
- **State Tracking**: Token-based system prevents invalid operations
- **Error Recovery**: Smart recovery hints when operations fail
- **Fuzzy Matching**: Resilient text editing that handles minor variations

### Why Semantic Operations?

Traditional MCP servers expose many granular tools (20+), which can overwhelm AI agents and lead to inefficient tool selection. Our semantic approach:

- **Consolidates 21 tools into 5 semantic operations** based on intent
- **Provides contextual workflow hints** to guide next actions
- **Tracks state with tokens** (inspired by Petri nets) to prevent nonsensical suggestions
- **Offers recovery hints** when operations fail

### The 5 Semantic Operations

1. **`vault`** - File and folder operations
   - Actions: `list`, `read`, `create`, `update`, `delete`, `search`
   
2. **`edit`** - Smart content editing
   - Actions: `window` (fuzzy match), `append`, `patch`, `at_line`, `from_buffer`
   
3. **`view`** - Content viewing and navigation
   - Actions: `window` (with context), `open_in_obsidian`
   
4. **`workflow`** - Get guided suggestions
   - Actions: `suggest`
   
5. **`system`** - System operations
   - Actions: `info`, `commands`, `fetch_web`

### Example Usage

Instead of choosing between `get_vault_file`, `get_active_file`, `read_file_content`, etc., you simply use:

```json
{
  "operation": "vault",
  "action": "read",
  "params": {
    "path": "daily-notes/2024-01-15.md"
  }
}
```

The response includes intelligent workflow hints:

```json
{
  "result": { /* file content */ },
  "workflow": {
    "message": "Read file: daily-notes/2024-01-15.md",
    "suggested_next": [
      {
        "description": "Edit this file",
        "command": "edit(action='window', path='daily-notes/2024-01-15.md', ...)",
        "reason": "Make changes to content"
      },
      {
        "description": "Follow linked notes",
        "command": "vault(action='read', path='{linked_file}')",
        "reason": "Explore connected knowledge"
      }
    ]
  }
}
```

### State-Aware Suggestions

The system tracks context tokens to provide relevant suggestions:

- After reading a file with `[[links]]`, it suggests following them
- After a failed edit, it offers buffer recovery options
- After searching, it suggests refining or reading results

### Advanced Features

#### Content Buffering
When edits fail (e.g., text not found), content is automatically buffered and can be recovered:

```json
{
  "operation": "edit",
  "action": "from_buffer",
  "params": {
    "path": "notes/meeting.md"
  }
}
```

#### Fuzzy Window Editing
The semantic editor uses fuzzy matching to find and replace content:

```json
{
  "operation": "edit",
  "action": "window",
  "params": {
    "path": "daily/2024-01-15.md",
    "oldText": "meting notes",  // typo will be fuzzy matched
    "newText": "meeting notes",
    "fuzzyThreshold": 0.8
  }
}
```

#### Smart PATCH Operations
Target specific document structures:

```json
{
  "operation": "edit",
  "action": "patch",
  "params": {
    "path": "projects/todo.md",
    "operation": "append",
    "targetType": "heading",
    "target": "## In Progress",
    "content": "- [ ] New task"
  }
}
```

### Workflow Examples

#### Daily Note Workflow
1. Create today's note → 2. Add template → 3. Link yesterday's note

#### Research Workflow  
1. Search topic → 2. Read results → 3. Create synthesis note → 4. Link sources

#### Refactoring Workflow
1. Find all mentions → 2. Update links → 3. Rename/merge notes

### Configuration

The semantic workflow hints are defined in `src/config/workflows.json` and can be customized for your workflow preferences.

### Error Recovery

When operations fail, the semantic interface provides intelligent recovery hints:

```json
{
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found: daily/2024-01-15.md",
    "recovery_hints": [
      {
        "description": "Create this file",
        "command": "vault(action='create', path='daily/2024-01-15.md')"
      },
      {
        "description": "Search for similar files",
        "command": "vault(action='search', query='2024-01-15')"
      }
    ]
  }
}
```

## Environment Variables

- `OBSIDIAN_API_KEY` (required) - Your API key from the Local REST API plugin
- `OBSIDIAN_API_URL` (optional) - API URL (default: https://localhost:27124)
  - Supports both HTTP (port 27123) and HTTPS (port 27124)
  - HTTPS uses self-signed certificates which are automatically accepted
- `OBSIDIAN_VAULT_NAME` (optional) - Vault name for context

## PATCH Operations

The PATCH operations (`patch_active_file` and `patch_vault_file`) allow sophisticated content manipulation:

- **Target Types:**
  - `heading`: Target content under specific headings using paths like "Heading 1::Subheading"
  - `block`: Target specific block references
  - `frontmatter`: Target frontmatter fields

- **Operations:**
  - `append`: Add content after the target
  - `prepend`: Add content before the target
  - `replace`: Replace the target content

Example: Append content under a specific heading:
```json
{
  "operation": "append",
  "targetType": "heading",
  "target": "Daily Notes::Today",
  "content": "- New task added"
}
```

## Development

```bash
# Clone and install
git clone https://github.com/aaronsb/obsidian-semantic-mcp.git
cd obsidian-semantic-mcp
npm install

# Development mode
npm run dev

# Testing
npm test              # Run all tests
npm run test:coverage # With coverage report

# Build
npm run build         # Build the server
npm run build:full    # Test + Build

# Start
npm start             # Start the server
```

### Architecture

The semantic system consists of:

- **Semantic Router** (`src/semantic/router.ts`) - Routes operations to handlers
- **State Tokens** (`src/semantic/state-tokens.ts`) - Tracks context state
- **Workflow Config** (`src/config/workflows.json`) - Defines hints and suggestions
- **Classic Tools** (`src/tools/`) - Original tool implementations

### Testing

The project includes comprehensive Jest tests for the semantic system:

```bash
npm test                    # Run all tests
npm test semantic-router    # Test routing logic
npm test semantic-tools     # Test integration
```

## Known Issues

- **Search functionality**: The `search_vault_simple` tool may hang or timeout due to a [known issue](https://github.com/coddingtonbear/obsidian-local-rest-api/issues/172) in the Obsidian Local REST API plugin. As a workaround, use the file listing and reading tools to navigate your vault.

## Contributing

Contributions are welcome! Areas of interest:

- Additional workflow patterns in `workflows.json`
- New semantic operations
- Enhanced state tracking
- Integration with Obsidian plugins

## License

MIT