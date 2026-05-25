import { MCPToolset } from "@google/adk";

function getPostmanApiKey() {
    return process.env.POSTMAN_API_KEY ?? "";
}

export function isPostmanConfigured() {
    return Boolean(getPostmanApiKey());
}

export function createPostmanToolset() {
    const apiKey = getPostmanApiKey();

    if (!isPostmanConfigured()) {
        throw new Error("Missing POSTMAN_API_KEY in environment.");
    }

    return new MCPToolset({
        type: "StdioConnectionParams",
        serverParams: {
            command: process.platform === "win32" ? "npx.cmd" : "npx",
            // We use default (minimal) tools. 
            // Note: you can add "--full" or "--code" to args for more tools.
            args: ["-y", "@postman/postman-mcp-server"],
            env: {
                ...process.env,
                POSTMAN_API_KEY: apiKey,
            }
        }
    });
}
