import { LlmAgent, MCPToolset } from "@google/adk";
import dotenv from "dotenv";

dotenv.config();

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY ?? "";

if (!AGENTMAIL_API_KEY) {
    throw new Error("Missing AGENTMAIL_API_KEY in .env");
}

export const rootAgent = new LlmAgent({
    model: "gemini-2.5-flash",
    name: "agentmail_agent",
    description: "An AI agent that manages email inboxes via AgentMail.",
    instruction: `
You are an email management assistant powered by AgentMail.

You can:
- Create and manage dedicated email inboxes
- Send, reply to, and forward emails
- List and search email threads and messages
- Download attachments
- Mark messages as read/unread

Always confirm with the user before sending or deleting anything.
Be concise and clear when summarizing emails.
`,
    tools: [
        new MCPToolset({
            type: "StdioConnectionParams",
            serverParams: {
                command: "npx",
                args: ["-y", "agentmail-mcp"],
                env: {
                    AGENTMAIL_API_KEY: AGENTMAIL_API_KEY,
                },
            },
        }),
    ],
});

/*
SETUP:
1. Create an account at https://agentmail.to/
2. Get your API key from the AgentMail Dashboard
3. Add to your .env:
   AGENTMAIL_API_KEY="am_us_dee1abfcb43ac102d4ac52b7914443ba9d8593ca227ca0402832aa2223248f79"

RUN:
npx adk run agent.ts

EXAMPLE PROMPTS:
- "Create a new inbox called assistant@yourdomain.com"
- "List all my inboxes"
- "Send an email to john@example.com saying hello"
- "Show me unread threads in my inbox"
- "Reply to the latest email in my inbox"
*/