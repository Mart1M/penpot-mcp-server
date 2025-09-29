# Penpot MCP Server

A Model Context Protocol (MCP) server for integrating Penpot with AI assistants.

## Installation & Publishing

### For development
```bash
npm install
npm start
```

### For publishing to npm
```bash
npm publish
```

### For users (via npx)
No installation needed - use directly with npx in your MCP configuration.

## Configuration

### Penpot Configuration
To use the Penpot API, you need to configure:

1. **Access Token**: Log in to Penpot → Profile → Access tokens → Create new token
2. **API URL** (optional): For self-hosted Penpot instances

Add both to your MCP configuration environment variables:
- `PENPOT_ACCESS_TOKEN`: Your access token
- `PENPOT_API_URL`: API base URL (defaults to `https://design.penpot.app/api`)

## Available Tools

### get_board
Retrieves a Penpot board.

**Parameters:**
- `url` (string, required): Complete Penpot board URL with `board-id`

**Returns:** HTML, JSON object, tokens used, and CSS variables

### debug_board  
Retrieves a Penpot board and displays the raw JSON for debugging.

**Parameters:**
- `url` (string, required): Complete Penpot board URL with `board-id`

### get_tokens
Retrieves design tokens from a Penpot file.

**Parameters:**
- `url` (string, required): Complete Penpot file URL (only needs `file-id`)

**Returns:** DTCG formatted tokens, CSS variables, and summary


## Project Structure

```
penpot-mcp/
├── index.js                 # Main server
├── src/
│   └── tools/
│       ├── get-board.js     # get_board tool
│       ├── debug-board.js   # debug_board tool
│       └── get-tokens.js    # get_tokens tool
├── package.json
└── README.md
```

## MCP Client Configuration

Add this configuration to your MCP client:

```json
{
  "mcpServers": {
    "penpot": {
      "command": "npx",
      "args": [
        "-y",
        "penpot-mcp-server@latest"
      ],
      "env": {
        "PENPOT_ACCESS_TOKEN": "your_penpot_token_here",
        "PENPOT_API_URL": "https://design.penpot.app/api"
      }
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "penpot": {
      "command": "node",
      "args": ["/path/to/penpot-mcp/index.js"],
      "env": {
        "PENPOT_ACCESS_TOKEN": "your_penpot_token_here",
        "PENPOT_API_URL": "https://design.penpot.app/api"
      }
    }
  }
}
```