import { Agent, Gemini, InMemoryRunner, LogLevel, isFinalResponse, setLogLevel, stringifyContent } from "@google/adk";
import { readFileTool } from "./readFileTool.js";

const GEMINI_MODEL = "gemini-2.5-flash";
setLogLevel(LogLevel.WARN);

const DOMAIN_KEYWORDS = [
    { domain: "Women's Health", keywords: ["gynecolog", "obgyn", "ob-gyn", "obstetric", "pregnan", "menstrual", "fertility", "reproductive"] },
    { domain: "Orthopedics", keywords: ["orthopedic", "orthopaedic", "bone", "joint", "fracture", "arthritis"] },
    { domain: "Cardiology", keywords: ["cardiolog", "heart", "cardiac"] },
    { domain: "Dermatology", keywords: ["dermatolog", "skin", "acne", "eczema", "psoriasis"] },
    { domain: "Neurology", keywords: ["neurolog", "brain", "seizure", "migraine"] },
    { domain: "Pediatrics", keywords: ["pediatric", "child health", "children", "infant"] },
    { domain: "Mental Health", keywords: ["therapist", "therapy", "counselor", "psycholog", "psychiatr", "mental health"] },
    { domain: "Dentistry", keywords: ["dentist", "dental", "tooth", "teeth"] },
    { domain: "Nutrition", keywords: ["nutrition", "dietitian", "diet", "meal plan", "macros"] },
    { domain: "Fitness & Training", keywords: ["fitness", "trainer", "workout", "exercise", "strength training"] },
    { domain: "Startup & Business", keywords: ["startup", "founder", "entrepreneur", "business mentor", "venture", "pitch", "mvp"] },
    { domain: "Legal Advisory", keywords: ["lawyer", "attorney", "legal", "contract", "litigation"] },
    { domain: "Accounting & Tax", keywords: ["accountant", "tax", "cpa", "bookkeeping", "audit"] },
    { domain: "Software Engineering", keywords: ["software", "developer", "programmer", "coding", "engineer", "api", "javascript", "python"] },
    { domain: "Education", keywords: ["teacher", "tutor", "education", "lesson", "curriculum"] },
    { domain: "Marketing", keywords: ["marketing", "seo", "brand", "growth", "campaign"] },
    { domain: "Human Resources", keywords: ["hr", "human resources", "recruit", "hiring", "talent"] },
    { domain: "Sales", keywords: ["sales", "pipeline", "crm", "lead generation"] },
    { domain: "Product Management", keywords: ["product manager", "product management", "roadmap", "user story"] },
    { domain: "UX Design", keywords: ["ux", "ui", "designer", "user experience", "wireframe"] },
    { domain: "Data Science", keywords: ["data science", "analytics", "machine learning", "ml", "ai"] },
    { domain: "Finance & Investing", keywords: ["finance", "investment", "investing", "stocks", "portfolio"] },
    { domain: "Real Estate", keywords: ["real estate", "property", "realtor", "mortgage"] },
    { domain: "Travel", keywords: ["travel", "trip", "itinerary", "flight", "hotel", "tour"] },
    { domain: "Culinary", keywords: ["chef", "cooking", "recipe", "kitchen", "baking"] },
    { domain: "Customer Support", keywords: ["customer support", "helpdesk", "support agent"] },
    { domain: "Cybersecurity", keywords: ["cybersecurity", "security", "infosec", "penetration", "vulnerability"] }
];

function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function getGeminiApiKey() {
    return process.env.GOOGLE_API_KEY
        || process.env.GEMINI_API_KEY
        || process.env.GOOGLE_GENAI_API_KEY;
}

function normalizeText(value) {
    return typeof value === "string" ? value.toLowerCase() : "";
}

function extractDomainFromText(description) {
    const text = normalizeText(description);
    if (!text) return "";

    let bestMatch = { domain: "", score: 0 };

    for (const entry of DOMAIN_KEYWORDS) {
        let score = 0;
        for (const keyword of entry.keywords) {
            if (text.includes(keyword)) {
                score += 1;
            }
        }
        if (score > bestMatch.score) {
            bestMatch = { domain: entry.domain, score };
        }
    }

    return bestMatch.score > 0 ? bestMatch.domain : "";
}

function sanitizeDomain(value) {
    return typeof value === "string" ? value.trim() : "";
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

    for await (const event of runner.runEphemeral({
        userId: "personaforge-user",
        newMessage: toAdkContent(prompt)
    })) {
        if (isFinalResponse(event)) {
            const text = stringifyContent(event).trim();
            if (text) {
                finalText = text;
            }
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

    return `You are ${name}, a highly specialized AI assistant in ${domain}.\n\nROLE:\n${roleText}${toneLine}\n\nSTRICT RULES:\n- You are NOT a general assistant.\n- You MUST ONLY answer within ${domain}.\n- If a query is outside your domain, politely refuse and redirect.\n- NEVER say phrases like:\n  'I help with a wide range of topics'\n  'I can assist with anything'\n- Maintain domain-specific tone at all times.\n\nTOOL USAGE:\nUse tools only when relevant to your domain.\n\nFINAL RULE:\nIf you break persona, regenerate the response.`;
}

export async function forgePersona(description, tone, guardrails) {
    const extractedDomain = extractDomainFromText(description);

    const promptText = `Description: ${description}
Tone: ${tone}
Guardrails: ${Array.isArray(guardrails) ? guardrails.join(", ") : guardrails}

Return JSON in this exact shape:
{ "name": "...", "systemPrompt": "...", "domain": "...", "sampleReply": "..." }`;

    const res = await runAdkTextCompletion(
        promptText,
        "You convert persona descriptions into agent config JSON only. Return plain JSON with no markdown and no explanation.",
        { name: "persona_forge_config_agent", temperature: 0.7 }
    );

    try {
        let cleanedRes = res.trim();
        if (cleanedRes.startsWith("```json")) {
            cleanedRes = cleanedRes.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        } else if (cleanedRes.startsWith("```")) {
            cleanedRes = cleanedRes.replace(/```\n?/g, "");
        }

        const parsed = JSON.parse(cleanedRes.trim());
        const modelDomain = sanitizeDomain(parsed.domain);
        const finalDomain = extractedDomain || modelDomain || "General Knowledge";
        const agentName = sanitizeDomain(parsed.name) || `${finalDomain} Specialist`;

        return {
            name: agentName,
            systemPrompt: buildIdentityPrompt(agentName, finalDomain, description, tone),
            domain: finalDomain,
            sampleReply: parsed.sampleReply
        };
    } catch {
        console.error("Failed to parse JSON from Gemini ADK response.");
        throw new Error("Invalid format returned by the ADK agent during persona creation.");
    }
}

export async function chatWithPersona(systemPrompt, history, userMessage, enabledTools = []) {
    const hasReadFileTool = Array.isArray(enabledTools) && enabledTools.includes("Read File");
    const tools = hasReadFileTool ? [readFileTool] : [];
    const conversationHistory = formatHistory(history);
    const prompt = conversationHistory
        ? `Conversation so far:\n${conversationHistory}\n\nCurrent user message:\n${userMessage}`
        : userMessage;

    const agent = createPersonaAgent({
        name: "persona_forge_chat_agent",
        description: "PersonaForge ADK persona agent that answers as the configured specialist.",
        instruction: systemPrompt,
        tools,
        temperature: 0.7
    });

    try {
        return await runAgentText(agent, prompt);
    } catch (error) {
        if (!hasReadFileTool) {
            throw error;
        }

        console.error("ADK agent with tools failed, falling back to simple ADK chat:", safeErrorMessage(error));
        const fallbackAgent = createPersonaAgent({
            name: "persona_forge_chat_agent_fallback",
            description: "PersonaForge ADK persona agent without tools.",
            instruction: systemPrompt,
            temperature: 0.7
        });
        return runAgentText(fallbackAgent, prompt);
    }
}

export async function judgeMessage(message, context) {
    const res = await runAdkTextCompletion(
        `Context: ${context}\nMessage: ${message}`,
        "Judge if the message is safe and on-topic for the given AI agent context. Reply with ONLY one word: SAFE or UNSAFE.",
        { name: "persona_forge_guardrail_judge", temperature: 0 }
    );

    return res.trim();
}
