#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GetBoardTool } from './src/tools/get-board.js';
import { DebugBoardTool } from './src/tools/debug-board.js';
import { GetTokensTool } from './src/tools/get-tokens.js';

class PenpotMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'penpot-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.accessToken = this.loadAccessToken();
    this.tools = {
      getBoardTool: new GetBoardTool(this),
      debugBoardTool: new DebugBoardTool(this),
      getTokensTool: new GetTokensTool(this),
    };
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  loadAccessToken() {
    try {
      const configPath = path.join(os.homedir(), '.penpot-mcp-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.accessToken;
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error.message);
    }
    return process.env.PENPOT_ACCESS_TOKEN || null;
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        this.tools.getBoardTool.getDefinition(),
        this.tools.debugBoardTool.getDefinition(),
        this.tools.getTokensTool.getDefinition(),
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_board':
          return await this.tools.getBoardTool.handle(request.params.arguments);
        case 'debug_board':
          return await this.tools.debugBoardTool.handle(request.params.arguments);
        case 'get_tokens':
          return await this.tools.getTokensTool.handle(request.params.arguments);
        default:
          throw new Error(`Tool unknown: ${request.params.name}`);
      }
    });
  }

  parseUrlParams(url) {
    try {
      const urlObj = new URL(url);
      const hash = urlObj.hash.substring(1);
      const [path, queryString] = hash.split('?');
      
      if (!queryString) {
        throw new Error('URL invalide: paramètres manquants');
      }

      const params = new URLSearchParams(queryString);
      
      return {
        teamId: params.get('team-id'),
        fileId: params.get('file-id'),
        pageId: params.get('page-id'),
        boardId: params.get('board-id'),
        layout: params.get('layout'),
      };
    } catch (error) {
      throw new Error(`Erreur lors du parsing de l'URL: ${error.message}`);
    }
  }

  async makeApiRequest(endpoint, params, token, acceptFormat = 'application/json') {
    const apiUrl = 'https://design.penpot.app/api/rpc/command/' + endpoint;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': acceptFormat,
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API Error: ${data.error.type || 'Unknown'} - ${data.error.hint || data.error.message || 'No details'}`);
    }

    return data;
  }


  convertTransitToCleanJson(transitData) {
    if (Array.isArray(transitData)) {
      if (transitData.length >= 2 && transitData[0] === "^ ") {
        const result = {};
        for (let i = 1; i < transitData.length; i += 2) {
          const key = transitData[i];
          const value = transitData[i + 1];
          const cleanKey = typeof key === 'string' && key.startsWith('~:') ? key.substring(2) : key;
          result[cleanKey] = this.convertTransitToCleanJson(value);
        }
        return result;
      } else if (transitData.length >= 2 && transitData[0] && typeof transitData[0] === 'string' && transitData[0].startsWith('~#')) {
        const type = transitData[0].substring(2);
        const value = this.convertTransitToCleanJson(transitData[1]);
        return { _type: type, ...value };
      } else {
        return transitData.map(item => this.convertTransitToCleanJson(item));
      }
    } else if (typeof transitData === 'string') {
      if (transitData.startsWith('~u')) {
        return transitData.substring(2);
      } else if (transitData.startsWith('~m')) {
        return parseInt(transitData.substring(2));
      } else if (transitData.startsWith('~:')) {
        return transitData.substring(2);
      }
      return transitData;
    } else if (typeof transitData === 'object' && transitData !== null) {
      const result = {};
      for (const [key, value] of Object.entries(transitData)) {
        const cleanKey = typeof key === 'string' && key.startsWith('~:') ? key.substring(2) : key;
        result[cleanKey] = this.convertTransitToCleanJson(value);
      }
      return result;
    }
    return transitData;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serveur MCP Penpot démarré sur stdio');
  }
}

const server = new PenpotMCPServer();
server.run().catch(console.error);