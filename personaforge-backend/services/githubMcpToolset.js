import { MCPToolset } from "@google/adk";

function getGithubMcpToken() {
    return process.env.GithubMCP ?? "";
}

export function isGithubMcpConfigured() {
    return Boolean(getGithubMcpToken());
}

export function createGithubMcpToolset() {
    const token = getGithubMcpToken();

    if (!isGithubMcpConfigured()) {
        throw new Error("Missing GithubMCP token in environment.");
    }

    return new MCPToolset({
        type: "StreamableHTTPConnectionParams",
        url: "https://api.githubcopilot.com/mcp/",
        transportOptions: {
            requestInit: {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-MCP-Toolsets": "all",
                    "X-MCP-Readonly": "true",
                },
            },
        },
    });
}