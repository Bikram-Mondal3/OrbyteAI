import { GOOGLE_SEARCH, LlmAgent, InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk';
import dotenv from "dotenv";

dotenv.config();

export const rootAgent = new LlmAgent({
    model: 'gemini-2.5-flash',
    name: 'root_agent',
    description:
        'an agent whose job it is to perform Google search queries and answer questions about the results.',
    instruction:
        'You are an agent whose job is to perform Google search queries and answer questions about the results.',
    tools: [GOOGLE_SEARCH],
});

export async function performWebSearch(message) {
    try {
        const runner = new InMemoryRunner({
            appName: "PersonaForge",
            agent: rootAgent
        });

        let finalText = "";

        for await (const event of runner.runEphemeral({
            userId: "personaforge-user",
            newMessage: {
                role: "user",
                parts: [{ text: message }]
            }
        })) {
            if (isFinalResponse(event)) {
                const text = stringifyContent(event).trim();
                if (text) {
                    finalText = text;
                }
            }
        }

        if (!finalText) {
            throw new Error("Search agent returned an empty response.");
        }

        return finalText;
    } catch (error) {
        console.error("Web Search Error:", error);
        throw error;
    }
}
