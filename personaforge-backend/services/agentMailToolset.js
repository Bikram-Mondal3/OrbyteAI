import { MCPToolset } from "@google/adk";

function getAgentMailApiKey() {
    return process.env.AGENTMAIL_API_KEY ?? "";
}

export function isAgentMailConfigured() {
    return Boolean(getAgentMailApiKey());
}

export function createAgentMailToolset() {
    const agentMailApiKey = getAgentMailApiKey();

    if (!isAgentMailConfigured()) {
        throw new Error("Missing AGENTMAIL_API_KEY in environment.");
    }

    return new MCPToolset({
        type: "StdioConnectionParams",
        serverParams: {
            command: process.platform === "win32" ? "npx.cmd" : "npx",
            args: ["-y", "agentmail-mcp"],
            env: {
                ...process.env,
                AGENTMAIL_API_KEY: agentMailApiKey
            }
        }
    });
}
