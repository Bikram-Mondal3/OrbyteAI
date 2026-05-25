import { Agent, Gemini, InMemoryRunner, LogLevel, isFinalResponse, setLogLevel, stringifyContent, GOOGLE_SEARCH } from "@google/adk";
import { readFileTool } from "./readFileTool.js";
import { getMcpToolsAsAdkTools, TOOL_NAME_MAP } from "./mcpBridge.js";
import { createAgentMailToolset, isAgentMailConfigured } from "./agentMailToolset.js";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import dotenv from "dotenv";
dotenv.config({ path: ['../.env', '.env'] });

const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
const GITHUB_ENDPOINT = "https://models.github.ai/inference";
const GITHUB_MODELS = ["openai/gpt-4o", "deepseek/DeepSeek-V3-0324"];
const QWEN_CODER_MODEL = "qwen-coder";
const KIMI_MODEL = "kimi";
const CLAUDE_MODEL = "claude-fast";
const ZAI_MODEL = "glm";
const GEMINI_3_1_PRO_MODEL = "gemini-large";
const GROQ_LLAMA_MODEL = "llama-3.3-70b-versatile";

const GEMINI_MODEL = "gemini-2.5-flash";
setLogLevel(LogLevel.WARN);

// ─── Groq internal task runner ───────────────────────────────────────────────
async function runGroqTask(prompt, systemInstruction, { model = 'llama-3.3-70b-versatile', responseFormat = null, temperature = 0.7 } = {}) {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return null;

    try {
        const body = {
            model,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
            ],
            temperature
        };

        if (responseFormat) {
            body.response_format = responseFormat;
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`[Groq Task] Failed: ${response.status}`, err);
            return null;
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (e) {
        console.error('[Groq Task] Error:', e);
        return null;
    }
}

function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function getGeminiApiKey() {
    return process.env.GEMINI_API_KEY
        || process.env.GOOGLE_GENAI_API_KEY
        || process.env.GOOGLE_API_KEY;
}

function sanitizeDomain(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeModelSelection(model) {
    const normalized = typeof model === "string" ? model.trim() : "";

    if (!normalized) {
        return GEMINI_MODEL;
    }

    const modelMap = {
        "gemini-2.0-flash": "gemini-2.5-flash", // Map 2.0 to 2.5 because of quota limits
        "Gemini 2.5 Flash": GEMINI_MODEL,
        "Grok: Llama 3.3 80b versatile": GROQ_LLAMA_MODEL,
        "Grok: Llama 3.3 80b": GROQ_LLAMA_MODEL,
        "DeepSeek-V3": "deepseek/DeepSeek-V3-0324",
        "OpenAI GPT-4o": "openai/gpt-4o",
        "Gemini 3.1 Pro": GEMINI_3_1_PRO_MODEL,
        "Z.ai GLM-5.1": ZAI_MODEL,
        "Moonshot Kimi K2.5": KIMI_MODEL,
        "Claude Haiku 4.5": CLAUDE_MODEL,
        "Qwen3 Coder 30B": QWEN_CODER_MODEL,
    };

    return modelMap[normalized] || normalized;
}

function toAdkContent(text) {
    return {
        role: "user",
        parts: [{ text }]
    };
}

function formatHistory(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return "";
    }

    return history
        .filter(message => message && typeof message.content === "string")
        .map(message => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
        .join("\n");
}

function createPersonaAgent({ name = "persona_forge_agent", description, instruction, tools = [], temperature = 0.7 }) {
    const apiKey = getGeminiApiKey();
    const model = apiKey
        ? new Gemini({ model: GEMINI_MODEL, apiKey })
        : GEMINI_MODEL;

    return new Agent({
        model,
        name,
        description,
        instruction,
        tools,
        generateContentConfig: {
            temperature
        }
    });
}

async function runAgentText(agent, prompt) {
    const runner = new InMemoryRunner({
        appName: "PersonaForge",
        agent
    });

    let finalText = "";

    console.log(`[ADK] Running agent: ${agent.name} with prompt: ${prompt.substring(0, 100)}...`);

    for await (const event of runner.runEphemeral({
        userId: "personaforge-user",
        newMessage: toAdkContent(prompt)
    })) {
        const eventType = event.type || (event.constructor ? event.constructor.name : 'Unknown');
        const eventSummary = JSON.stringify(event);

        if (event.errorCode) {
            console.error(`[ADK Error]: ${event.errorCode} - ${event.errorMessage}`);
            // Check if it's a 429 inside the stream
            if (eventSummary.includes("429") || eventSummary.includes("quota")) {
                throw new Error(`QUOTA_EXCEEDED: ${event.errorMessage || "429"}`);
            }
        } else {
            console.log(`[ADK Event]: ${eventType}`, eventSummary.substring(0, 200));
        }

        if (isFinalResponse(event)) {
            const text = stringifyContent(event).trim();
            if (text) {
                finalText = text;
            }
        } else if (event.type === 'toolCall' || (event.toolCalls && event.toolCalls.length > 0)) {
            console.log(`[ADK Tool Call]:`, JSON.stringify(event.toolCalls || event, null, 2));
        } else if (event.type === 'toolResponse' || (event.toolResults && event.toolResults.length > 0)) {
            console.log(`[ADK Tool Response]:`, JSON.stringify(event.toolResults || event, null, 2));
        }
    }

    if (!finalText) {
        throw new Error("ADK agent returned an empty response.");
    }

    return finalText;
}

export async function runAdkTextCompletion(prompt, instruction, { name = "persona_forge_task_agent", temperature = 0 } = {}) {
    const agent = createPersonaAgent({
        name,
        description: "PersonaForge internal ADK task agent.",
        instruction,
        temperature
    });

    return runAgentText(agent, prompt);
}

export function buildIdentityPrompt(agentName, domain, description, tone) {
    const name = agentName || "Specialist Assistant";
    const roleText = description?.trim() || "Provide domain-specific guidance.";
    const toneLine = tone ? `\nTone: ${tone}.` : "";

    return `Identity: ${name}.
Role: ${roleText}${toneLine}
Domain: ${domain}

STRICT BEHAVIOR RULES:
- Provide DIRECT, to-the-point answers. No conversational filler or self-promotion.
- NEVER mention your domain ("${domain}"), your role, or that you are a "specialist" / "assistant".
- NEVER explain that you are going to use a tool or what tool you are using. Just USE the tool and provide the answer.
- If the user's query requires current data (news, weather, real-time facts), invoke the Google Search tool IMMEDIATELY.
- Do NOT say "I can help with that" or "Let me find that for you". Just give the result.
- You MUST stay in the ${domain} persona at all times, but do so implicitly through your knowledge and tone, not by stating it.
- If a query is strictly irrelevant to ${domain} and cannot be solved with tools, politely redirect focus to ${domain} without mentioning you are "specialized" in it.

FINAL RULE:
No self-introduction. No self-promotion. No talk about tools. Only results.`;
}

export async function forgePersona(description, tone, guardrails, selectedDomain = "General Knowledge") {
    const promptText = `Description: ${description}
Tone: ${tone}
Domain: ${selectedDomain}
Guardrails: ${Array.isArray(guardrails) ? guardrails.join(", ") : guardrails}

Return JSON in this exact shape:
{ "name": "...", "systemPrompt": "...", "domain": "${selectedDomain}", "sampleReply": "..." }`;

    let res = await runGroqTask(
        promptText,
        "You convert persona descriptions into agent config JSON only. Return plain JSON with no markdown and no explanation.",
        { responseFormat: { type: 'json_object' }, temperature: 0.7 }
    );

    if (!res) {
        console.warn("[Forge] Groq failed, falling back to Gemini ADK");
        res = await runAdkTextCompletion(
            promptText,
            "You convert persona descriptions into agent config JSON only. Return plain JSON with no markdown and no explanation.",
            { name: "persona_forge_config_agent", temperature: 0.7 }
        );
    }

    try {
        let cleanedRes = res.trim();
        if (cleanedRes.startsWith("```json")) {
            cleanedRes = cleanedRes.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        } else if (cleanedRes.startsWith("```")) {
            cleanedRes = cleanedRes.replace(/```\n?/g, "");
        }

        const parsed = JSON.parse(cleanedRes.trim());
        const agentName = parsed.name || `${selectedDomain} Specialist`;

        return {
            name: agentName,
            systemPrompt: buildIdentityPrompt(agentName, selectedDomain, description, tone),
            domain: selectedDomain,
            sampleReply: parsed.sampleReply
        };
    } catch {
        console.error("Failed to parse JSON from AI response during persona creation.");
        throw new Error("Invalid format returned by the AI service during persona creation.");
    }
}

export async function chatWithPersona(systemPrompt, history, userMessage, enabledTools = [], model = GEMINI_MODEL) {
    try {
        const normalizedModel = normalizeModelSelection(model);
        console.log(`[Chat] Starting chat with persona. Enabled tools: ${enabledTools.join(", ")}. Model: ${normalizedModel}`);
        const conversationHistory = formatHistory(history);
        const fullPrompt = conversationHistory
            ? `Conversation so far:\n${conversationHistory}\n\nCurrent user message:\n${userMessage}`
            : userMessage;

        if (GITHUB_MODELS.includes(normalizedModel)) {
            return runGitHubModel(fullPrompt, systemPrompt, normalizedModel);
        } else if (normalizedModel === QWEN_CODER_MODEL) {
            return runQwenCoderModel(fullPrompt);
        } else if (normalizedModel === KIMI_MODEL) {
            return runKimiModel(fullPrompt);
        } else if (normalizedModel === CLAUDE_MODEL) {
            return runClaudeModel(fullPrompt);
        } else if (normalizedModel === ZAI_MODEL) {
            return runZaiModel(fullPrompt);
        } else if (normalizedModel === GEMINI_3_1_PRO_MODEL) {
            return runGemini31ProModel(fullPrompt);
        } else if (normalizedModel === GROQ_LLAMA_MODEL) {
            const groqReply = await runGroqTask(
                fullPrompt,
                systemPrompt,
                { model: GROQ_LLAMA_MODEL, temperature: 0.4 }
            );
            if (groqReply) {
                return groqReply;
            }
            throw new Error("Groq model returned an empty response.");
        } else if (normalizedModel === GEMINI_MODEL) {
            const tools = [];

            try {
                const allMcpTools = await getMcpToolsAsAdkTools();
                console.log(`[Chat] Found ${allMcpTools.length} MCP tools.`);

                for (const uiToolName of enabledTools) {
                    const mcpName = TOOL_NAME_MAP[uiToolName];
                    if (mcpName) {
                        const mcpTool = allMcpTools.find(t => t.name === mcpName);
                        if (mcpTool) {
                            tools.push(mcpTool);
                        }
                    }
                }

                // Fallback for native tools if MCP fails or tool not found in MCP
                if (enabledTools.includes("Read File") && !tools.find(t => t.name === "read_file")) {
                    tools.push(readFileTool);
                }
                if (enabledTools.includes("Google Search") && !tools.find(t => t.name === "google_web_search")) {
                    tools.push(GOOGLE_SEARCH);
                }
                if (enabledTools.includes("AgentMail") && isAgentMailConfigured()) {
                    tools.push(createAgentMailToolset());
                }
            } catch (mcpError) {
                console.error("[Chat] MCP Tool loading failed, using native fallbacks:", mcpError.message);
                if (enabledTools.includes("Read File")) tools.push(readFileTool);
                if (enabledTools.includes("Google Search")) tools.push(GOOGLE_SEARCH);
                if (enabledTools.includes("AgentMail") && isAgentMailConfigured()) tools.push(createAgentMailToolset());
            }

            const agent = createPersonaAgent({
                name: "persona_forge_chat_agent",
                description: "PersonaForge ADK persona agent that answers as the configured specialist.",
                instruction: systemPrompt,
                tools,
                temperature: 0.4
            });

            try {
                console.log(`[Chat] Responding with Gemini Model: ${normalizedModel} with tools: ${tools.map(t => t.name).join(", ") || "none"}`);
                const response = await runAgentText(agent, fullPrompt);
                console.log("[Chat] ADK response received.");
                return response;
            } catch (error) {
                const rawErrorMsg = safeErrorMessage(error);
                const errorMsg = typeof rawErrorMsg === 'string' ? rawErrorMsg : String(rawErrorMsg || "");
                console.error("[Chat] ADK agent with tools failed:", errorMsg);

                // If it's a quota error (429), just return the error message directly without falling back
                if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit") || errorMsg.includes("QUOTA_EXCEEDED")) {
                    return `Error: API Quota Exceeded. Please check your plan and billing details.`;
                }

                if (tools.length === 0) {
                    return `Error generating response: ${errorMsg}`;
                }

                console.log("[Chat] Falling back to simple ADK chat (no tools)...");
                const fallbackAgent = createPersonaAgent({
                    name: "persona_forge_chat_agent_fallback",
                    description: "PersonaForge ADK persona agent without tools.",
                    instruction: systemPrompt,
                    temperature: 0.4
                });

                try {
                    return await runAgentText(fallbackAgent, fullPrompt);
                } catch (fallbackError) {
                    const rawFallbackMsg = safeErrorMessage(fallbackError);
                    const fallbackErrorMsg = typeof rawFallbackMsg === 'string' ? rawFallbackMsg : String(rawFallbackMsg || "");
                    console.error("[Chat] Simple ADK fallback also failed:", fallbackErrorMsg);
                    return `Error generating response: ${fallbackErrorMsg}`;
                }
            }
        }
        throw new Error(`Unsupported model: ${model}`);
    } catch (chatError) {
        console.error("[Chat] Fatal error in chatWithPersona:", chatError);
        throw chatError;
    }
}

export async function judgeMessage(message, context) {
    let res = await runGroqTask(
        `Context: ${context}\nMessage: ${message}`,
        "Judge if the message is safe and on-topic for the given AI agent context. Reply with ONLY one word: SAFE or UNSAFE.",
        { model: 'llama-3.1-8b-instant', temperature: 0 }
    );

    if (!res) {
        console.warn("[Guardrails] Groq failed, falling back to Gemini ADK");
        res = await runAdkTextCompletion(
            `Context: ${context}\nMessage: ${message}`,
            "Judge if the message is safe and on-topic for the given AI agent context. Reply with ONLY one word: SAFE or UNSAFE.",
            { name: "persona_forge_guardrail_judge", temperature: 0 }
        );
    }

    return res.trim();
}

async function runGitHubModel(prompt, systemPrompt, model) {
    if (!GITHUB_TOKEN) {
        throw new Error("GITHUB_TOKEN is not set in the environment variables.");
    }

    const client = ModelClient(GITHUB_ENDPOINT, new AzureKeyCredential(GITHUB_TOKEN));

    const response = await client.path("/chat/completions").post({
        body: {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            model: model
        }
    });

    if (isUnexpected(response)) {
        throw response.body.error;
    }
    console.log(`Responding with GitHub Model: ${model}`);
    return response.body.choices[0].message.content;
}

async function runQwenCoderModel(prompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        throw new Error("POLLINATIONS_API_KEY is not set in the environment variables.");
    }

    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen-coder",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await res.json();
    console.log("Responding with Qwen Coder Model");
    return data.choices?.[0]?.message?.content;
}

async function runKimiModel(prompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        throw new Error("POLLINATIONS_API_KEY is not set in the environment variables.");
    }

    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "kimi",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await res.json();
    console.log("Responding with Kimi Model");
    return data.choices?.[0]?.message?.content;
}

async function runClaudeModel(prompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        throw new Error("POLLINATIONS_API_KEY is not set in the environment variables.");
    }

    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "claude-fast",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await res.json();
    console.log("Responding with Claude Model");
    return data.choices?.[0]?.message?.content;
}

async function runZaiModel(prompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        throw new Error("POLLINATIONS_API_KEY is not set in the environment variables.");
    }

    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "glm",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await res.json();
    console.log("Responding with Z.ai Model");
    return data.choices?.[0]?.message?.content;
}

async function runGemini31ProModel(prompt) {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
        throw new Error("POLLINATIONS_API_KEY is not set in the environment variables.");
    }

    const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gemini-large",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await res.json();
    console.log("Responding with Gemini 3.1 Pro Model");
    return data.choices?.[0]?.message?.content;
}
