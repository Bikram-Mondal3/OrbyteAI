import { Gemini, Agent, InMemoryRunner, isFinalResponse, stringifyContent } from "@google/adk";
import dotenv from "dotenv";
dotenv.config({ path: ['../.env', '.env'] });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
// Prevent ADK from picking up GOOGLE_API_KEY which might be for search
delete process.env.GOOGLE_API_KEY;

async function test() {
    if (!apiKey) {
        console.error("No API key found");
        return;
    }

    const model = new Gemini({ model: "gemini-flash-latest", apiKey });
    const agent = new Agent({
        model,
        name: "test-agent",
        instruction: "You are a helpful assistant."
    });

    const runner = new InMemoryRunner({
        appName: "test",
        agent
    });

    try {
        console.log("Running agent...");
        for await (const event of runner.runEphemeral({
            userId: "test-user",
            newMessage: { role: "user", parts: [{ text: "Hello, how are you?" }] }
        })) {
            console.log("Event:", event.constructor.name, JSON.stringify(event));
            if (isFinalResponse(event)) {
                console.log("Final Response:", stringifyContent(event));
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

test();