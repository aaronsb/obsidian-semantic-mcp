# Obsidian MCP Server

A clean, simple MCP server for Obsidian integration via the Local REST API plugin.

## Quick Start

1. **Install in Obsidian:**
   - Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin
   - Enable it and copy the API key from settings

2. **Install the server:**
   ```bash
   npx obsidian-mcp-server
   ```

3. **Configure Claude Desktop:**
   
   Add to your Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "npx",
         "args": ["-y", "obsidian-mcp-server"],
         "env": {
           "OBSIDIAN_API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

## Available Tools

### Server Operations
- `get_server_info` - Check server status and authentication

### Active File Operations
- `get_active_file` - Read the currently active file
- `update_active_file` - Update the active file
- `append_to_active_file` - Append to the active file
- `delete_active_file` - Delete the currently active file
- `patch_active_file` - Insert or modify content relative to headings, blocks, or frontmatter

### Vault File Operations
- `list_vault_files` - List files in vault/directory
- `get_vault_file` - Read any file
- `create_vault_file` - Create new files
- `update_vault_file` - Update existing files
- `delete_vault_file` - Delete files
- `append_to_vault_file` - Append to files
- `patch_vault_file` - Insert or modify content in vault files relative to headings, blocks, or frontmatter

### Search and Navigation
- `search_vault_simple` - Simple text search across the vault
- `show_file_in_obsidian` - Open file in Obsidian UI

### Web Content
- `fetch` - Fetch and convert web content to markdown

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
git clone https://github.com/yourusername/obsidian-mcp-server.git
cd obsidian-mcp-server
npm install

# Development mode
npm run dev

# Build
npm run build

# Start
npm start
```

## License

MIT