import { MCPToolset } from "@google/adk";
import { resolve } from "path";

/**
 * Creates an MCP toolset that connects to our custom Python Daytona MCP server
 */
export function createDaytonaToolset() {
    return new MCPToolset({
        serverName: "daytona",
        type: "StdioConnectionParams",
        serverParams: {
            command: "uvx",
            args: [
                "--with", "daytona-adk",
                "--with", "mcp",
                "python",
                // Resolve to absolute path relative to this file
                resolve(process.cwd(), "daytona_mcp_server.py")
            ],
            env: {
                ...process.env,
            }
        }
    });
}

/**
 * Checks if Daytona API key is configured
 * @returns {boolean} True if DAYTONA_API_KEY is defined
 */
export function isDaytonaConfigured() {
    return !!process.env.DAYTONA_API_KEY;
}
