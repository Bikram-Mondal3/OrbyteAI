import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: ['../.env', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SAFE_DIR = path.resolve(__dirname, 'uploads');
const SAFE_FILE_DIR = path.resolve(process.env.PERSONAFORGE_SAFE_FILE_DIR || DEFAULT_SAFE_DIR);
const MAX_FILE_SIZE_BYTES = Number(process.env.PERSONAFORGE_MAX_FILE_SIZE_BYTES || 1024 * 1024);

const server = new FastMCP({
  name: 'PersonaForge-MCP',
  version: '1.0.0'
});

// --- Google Web Search Tool ---
server.addTool({
  name: 'google_web_search',
  description: 'Search the web using Google to get up-to-date information, news, and facts.',
  parameters: z.object({
    query: z.string().describe('The search query to execute on Google'),
  }),
  execute: async ({ query }) => {
    console.log(`[MCP] Executing Google Web Search for: "${query}"`);

    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

    // Debugging (non-secret parts only)
    console.log(`[MCP Debug] API Key present: ${!!apiKey}, CX present: ${!!cx}`);

    if (!apiKey) {
      return "Error: GOOGLE_API_KEY is not configured.";
    }

    if (!cx) {
      return "Error: GOOGLE_SEARCH_ENGINE_ID is not configured.";
    }

    // Using Google Custom Search JSON API
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error(`[MCP] Google Search Error Details:`, JSON.stringify(data.error));
        return `Google Search Error: ${data.error.message}`;
      }

      const results = data.items?.map((item: any) => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      })) || [];

      if (results.length === 0) {
        return `No results found for "${query}".`;
      }

      return JSON.stringify(results);
    } catch (error) {
      return `Error performing search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

// --- Read File Tool (Migrated from readFileTool.js) ---
server.addTool({
  name: 'read_file',
  description: 'Reads a local uploaded file from the safe directory and returns its real contents for analysis or summarization.',
  parameters: z.object({
    file_path: z.string().describe('Path to the file to read'),
    encoding: z.string().optional().default('utf8').describe('File encoding'),
  }),
  execute: async ({ file_path, encoding }) => {
    try {
      // Basic security check: prevent directory traversal
      const resolvedPath = path.resolve(SAFE_FILE_DIR, file_path);
      if (!resolvedPath.startsWith(SAFE_FILE_DIR)) {
        return {
          status: 'error',
          filePath: file_path,
          message: 'Access denied. Path is outside the safe directory.'
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        return {
          status: 'error',
          filePath: file_path,
          sizeBytes: stats.size,
          message: 'File too large.'
        };
      }

      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);
      return {
        status: 'success',
        filePath: resolvedPath,
        requestedPath: file_path,
        sizeBytes: stats.size,
        encoding,
        content
      };
    } catch (error) {
      return {
        status: 'error',
        filePath: file_path,
        message: `Error reading file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

/**
 * Start the MCP server
 * Use HTTP transport for easier integration with the main backend
 */
const startServer = async () => {
  const port = Number(process.env.MCP_SERVER_PORT || 3001);
  await server.start({
    transportType: 'httpStream',
    httpStream: {
      port
    }
  });
  console.log(`[MCP] Server running on http://localhost:${port}`);
};

// Check if this script is being run directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath || process.argv[1]?.endsWith('mcp_server.ts')) {
    startServer().catch(console.error);
  }
}

export { server };
