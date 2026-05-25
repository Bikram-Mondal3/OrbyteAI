import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function test() {
    try {
        const transport = new SSEClientTransport(new URL("http://localhost:3001/mcp"));
        const client = new Client(
            { name: "test-client", version: "1.0.0" },
            { capabilities: {} }
        );
        await client.connect(transport);
        console.log("Connected to MCP server");
        const tools = await client.listTools();
        console.log("Tools:", JSON.stringify(tools, null, 2));
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

test();
