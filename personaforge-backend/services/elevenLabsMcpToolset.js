import { MCPToolset } from "@google/adk";

function getElevenLabsApiKey() {
    return process.env.ELEVENLABS_API_KEY ?? "";
}

export function isElevenLabsConfigured() {
    return Boolean(getElevenLabsApiKey());
}

export function createElevenLabsToolset() {
    const apiKey = getElevenLabsApiKey();

    if (!isElevenLabsConfigured()) {
        throw new Error("Missing ELEVENLABS_API_KEY in environment.");
    }

    return new MCPToolset({
        type: "StdioConnectionParams",
        serverParams: {
            // `uvx.exe` on Windows natively handles the bin, no .cmd needed
            command: "uvx",
            args: ["elevenlabs-mcp"],
            env: {
                ...process.env,
                ELEVENLABS_API_KEY: apiKey,
            }
        }
    });
}
