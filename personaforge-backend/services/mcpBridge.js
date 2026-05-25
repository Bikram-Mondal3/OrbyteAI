import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

const MCP_SERVER_URL = (process.env.MCP_SERVER_URL || 'http://localhost:3001') + '/sse';

let mcpClient = null;

async function getClient() {
    if (mcpClient) return mcpClient;
    try {
        const transport = new SSEClientTransport(new URL(MCP_SERVER_URL));
        const client = new Client(
            { name: "PersonaForge-Bridge", version: "1.0.0" },
            { capabilities: {} }
        );
        await client.connect(transport);
        mcpClient = client;
        return mcpClient;
    } catch (error) {
        console.error(`[MCP Bridge] Failed to connect to MCP server at ${MCP_SERVER_URL}:`, error.message);
        return null;
    }
}

export async function getMcpToolsAsAdkTools() {
    const client = await getClient();
    if (!client) return [];

    try {
        const response = await client.listTools();
        const mcpTools = response.tools;

        return mcpTools.map(tool => {
            return new FunctionTool({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || z.object({}),
                execute: async (args) => {
                    console.log(`[MCP Bridge] Calling MCP tool "${tool.name}" with:`, JSON.stringify(args));
                    try {
                        const result = await client.callTool({
                            name: tool.name,
                            arguments: args
                        });
                        if (result.content && result.content.length > 0) {
                            return result.content[0].text || JSON.stringify(result.content[0]);
                        }
                        return JSON.stringify(result);
                    } catch (err) {
                        console.error(`[MCP Bridge] Error calling tool "${tool.name}":`, err.message);
                        return `Error: ${err.message}`;
                    }
                }
            });
        });
    } catch (error) {
        console.error("[MCP Bridge] Error listing MCP tools:", error.message);
        return [];
    }
}

/**
 * Maps UI tool names to MCP tool names
 */
export const TOOL_NAME_MAP = {
    "Google Search": "google_web_search",
    "Read File": "read_file"
};
