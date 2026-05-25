import { MCPToolset } from "@google/adk";

function getNotionToken() {
    return process.env.NOTION_TOKEN ?? "";
}

export function isNotionConfigured() {
    return Boolean(getNotionToken());
}

export function createNotionToolset() {
    const token = getNotionToken();

    if (!isNotionConfigured()) {
        throw new Error("Missing NOTION_TOKEN in environment.");
    }

    return new MCPToolset({
        type: "StdioConnectionParams",
        serverParams: {
            command: process.platform === "win32" ? "npx.cmd" : "npx",
            args: ["-y", "@notionhq/notion-mcp-server"],
            env: {
                ...process.env,
                NOTION_TOKEN: token,
            }
        }
    });
}
