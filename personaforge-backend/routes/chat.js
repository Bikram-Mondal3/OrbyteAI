import { Router } from 'express';
import crypto from 'crypto';
import { agentsDb } from './forge.js';
import { getHistory, saveHistory } from '../services/memory.js';
import { buildStructuredPrompt } from '../services/promptBuilder.js';
import { chatWithPersona } from '../services/ai.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { getAgentById } from '../services/agentStore.js';
import { performWebSearch } from '../services/searchAgent.js';
import { readFileContent } from '../services/readFileTool.js';
import { isAgentMailConfigured } from '../services/agentMailToolset.js';
import { isElevenLabsConfigured } from '../services/elevenLabsMcpToolset.js';
import { isNotionConfigured } from '../services/notionMcpToolset.js';
import { isPostmanConfigured } from '../services/postmanMcpToolset.js';

const router = Router();

function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function isLocalRequest(req) {
    const origin = req.headers.origin || "";
    const remoteAddress = req.ip || req.socket?.remoteAddress || "";

    return origin.startsWith("http://localhost:")
        || origin.startsWith("http://127.0.0.1:")
        || remoteAddress === "::1"
        || remoteAddress === "127.0.0.1"
        || remoteAddress === "::ffff:127.0.0.1";
}

async function authenticateApiKeyOrLocalSandbox(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader && isLocalRequest(req)) {
        return next();
    }

    return authenticateApiKey(req, res, next);
}

/**
 * Helper function to detect generic assistant responses
 * Returns true if response appears to be generic/non-persona
 */
function detectGenericResponse(response, domain) {
    const genericPatterns = [
        /^(hello|hi|hey)[!.]?\s+(i'm|i am)\s+(claude|an ai|a language model|an assistant)/i,
        /^(i'm|i am)\s+(claude|an ai|a language model|an assistant)/i,
        /how can i (help|assist) you today\?$/i,
        /^(sure|of course|certainly)[!,.]?\s+i('d| would) be (happy|glad) to help/i,
        /as an ai (assistant|language model)/i,
        /i don't have personal (opinions|feelings|experiences)/i,
        /wide range of topics/i,
        /help with anything/i,
        /general knowledge/i,
    ];

    const lowerResponse = response.toLowerCase();

    // Check for generic patterns
    for (const pattern of genericPatterns) {
        if (pattern.test(response)) {
            return true;
        }
    }

    return false;
}

function isFileRelatedMessage(message, attachedFiles = []) {
    const normalizedMessage = String(message || "").toLowerCase();

    if (!normalizedMessage) {
        return false;
    }

    if (/\b(file|document|upload|uploaded|attachment|attached|json|csv|txt|md|read|open|analy[sz]e|summari[sz]e|content|contents|inside|what'?s in|what is in)\b/i.test(normalizedMessage)) {
        return true;
    }

    return attachedFiles.some(file => {
        const fileName = String(file.file_name || "").toLowerCase();
        return fileName && normalizedMessage.includes(fileName);
    });
}

function normalizeAttachedFiles(files) {
    if (!Array.isArray(files)) return [];

    return files
        .filter(file => file && typeof file.file_path === 'string')
        .map(file => ({
            file_path: file.file_path,
            file_name: typeof file.file_name === 'string' ? file.file_name : file.file_path,
            size_bytes: typeof file.size_bytes === 'number' ? file.size_bytes : null
        }));
}

async function loadAgentRecord(agentId) {
    const localAgent = agentsDb.get(agentId);
    if (localAgent) {
        return localAgent;
    }

    return getAgentById(agentId);
}

function selectFilesForMessage(message, attachedFiles) {
    const normalizedMessage = String(message || "").toLowerCase();
    const fileNameMatches = attachedFiles.filter(file => {
        const fileName = String(file.file_name || "").toLowerCase();
        return fileName && normalizedMessage.includes(fileName);
    });

    if (fileNameMatches.length > 0) {
        return fileNameMatches;
    }

    if (attachedFiles.length === 1) {
        return attachedFiles;
    }

    return attachedFiles.slice(0, 3);
}

async function buildAttachedFilePromptContext(message, attachedFiles) {
    const selectedFiles = selectFilesForMessage(message, attachedFiles);
    const sections = [];

    for (const file of selectedFiles) {
        const result = await readFileContent({ file_path: file.file_path });

        if (result?.status === 'success') {
            sections.push([
                `FILE: ${file.file_name}`,
                `PATH: ${file.file_path}`,
                `SIZE: ${result.sizeBytes} bytes`,
                "CONTENT START",
                result.content,
                "CONTENT END"
            ].join("\n"));
            continue;
        }

        const errorMessage = result?.message || "Unknown file read error.";
        sections.push([
            `FILE: ${file.file_name}`,
            `PATH: ${file.file_path}`,
            `READ ERROR: ${errorMessage}`
        ].join("\n"));
    }

    if (sections.length === 0) {
        return "";
    }

    return `\n\nAttached file content loaded by the server:\n${sections.join("\n\n")}\nUse only this loaded content for any summary, analysis, or quotation of the file. If a file section contains READ ERROR, explain that clearly and do not invent content.`;
}

function assertAgentIdentity(agent, agentId) {
    const domain = typeof agent?.domain === "string" ? agent.domain.trim() : "";
    const systemPrompt = typeof agent?.systemPrompt === "string" ? agent.systemPrompt.trim() : "";

    if (!systemPrompt) {
        throw new Error("Agent systemPrompt is missing");
    }

    if (!domain || domain === "General Knowledge") {
        throw new Error("Agent domain is missing or invalid");
    }

    return { domain, systemPrompt };
}

async function handleAgentRequest(agentId, message, sessionId, attachedFiles, model) {
    const agent = await loadAgentRecord(agentId);
    if (!agent) {
        return { status: 404, payload: { error: "Agent not found" } };
    }

    const enabledTools = Array.isArray(agent.tools) ? agent.tools : [];
    const canReadFiles = enabledTools.includes("Read File");

    const { domain, systemPrompt } = assertAgentIdentity(agent, agentId);

    const history = await getHistory(sessionId);
    let structuredMessage = buildStructuredPrompt(message, domain);

    if (canReadFiles && attachedFiles.length > 0) {
        const fileContext = attachedFiles
            .map(file => `- ${file.file_name}: ${file.file_path}${file.size_bytes !== null ? ` (${file.size_bytes} bytes)` : ""}`)
            .join("\n");
        structuredMessage += `\n\nUploaded files available to this session:\n${fileContext}\nIf the user refers to "the file", "this file", an uploaded file, or asks to read/analyze/summarize file content, call read_file with the matching file_path before answering.`;

        if (isFileRelatedMessage(message, attachedFiles)) {
            structuredMessage += await buildAttachedFilePromptContext(message, attachedFiles);
        }
    }

    if (enabledTools.includes("Google Search")) {
        structuredMessage += `\n\nNote: You have access to a Google Search tool. If you need current events, latest news, or real-time data to answer the user's request accurately, you MUST use the search tool to find facts before responding. Provide the final answer directly based on the search results without explaining that you used a tool.`;
    }

    if (enabledTools.includes("AgentMail")) {
        structuredMessage += isAgentMailConfigured()
            ? `\n\nNote: You have access to AgentMail tools for inbox and email management. Use them for inbox creation, email search, thread lookup, sending, replying, forwarding, attachment downloads, and read/unread actions. Always confirm with the user before sending, forwarding, deleting, or making any irreversible email change.`
            : `\n\nNote: AgentMail is enabled for this agent, but the backend is missing AGENTMAIL_API_KEY. Explain that email actions are unavailable until AgentMail is configured, and do not pretend an inbox or email action succeeded.`;
    }

    if (enabledTools.includes("GitHub MCP Server")) {
        structuredMessage += `\n\nNote: You have access to the GitHub MCP Server. You can query GitHub for repos, issues, pull requests, stargazers, discussions, orgs, projects, and users.`;
    }

    if (enabledTools.includes("ElevenLabs")) {
        structuredMessage += isElevenLabsConfigured()
            ? `\n\nNote: You have access to the ElevenLabs MCP Server. You can generate speech from text, clone voices, process audio, create sound effects, and transcribe audio. Use these tools when audio generation or voice services are requested.`
            : `\n\nNote: ElevenLabs is enabled for this agent, but the backend is missing ELEVENLABS_API_KEY. Explain that audio features are unavailable.`;
    }

    if (enabledTools.includes("Notion")) {
        structuredMessage += isNotionConfigured()
            ? `\n\nNote: You have access to the Notion MCP Server. You can search workspace pages, create content, manage tasks/databases, update Notion documents and retrieve team/user information using the provided tools.`
            : `\n\nNote: Notion MCP is enabled for this agent, but the backend is missing NOTION_TOKEN in its environment variables. Explain that Notion access is unavailable until this is configured.`;
    }

    if (enabledTools.includes("Postman")) {
        structuredMessage += isPostmanConfigured()
            ? `\n\nNote: You have access to the Postman MCP Server. You can manage API collections, workspaces, environments, and perform API testing. Use these tools when API lifecycle management is requested.`
            : `\n\nNote: Postman MCP is enabled for this agent, but the backend is missing POSTMAN_API_KEY in its environment variables. Explain that Postman access is unavailable until this is configured.`;
    }

    let reply = await chatWithPersona(systemPrompt, history, structuredMessage, enabledTools, model);

    if (detectGenericResponse(reply, domain)) {
        const regenPrompt = `${systemPrompt}\n\nRespond DIRECTLY. Remove all generic assistant language ("As an AI...", "I can help with..."). Stay in persona implicitly without self-promotion.`;
        reply = await chatWithPersona(regenPrompt, history, structuredMessage, enabledTools, model);
    }

    await saveHistory(sessionId, message, reply);

    return { status: 200, payload: { message: reply, blocked: false, session_id: sessionId } };
}

router.post('/:agentId/chat', authenticateApiKeyOrLocalSandbox, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { message, session_id, model } = req.body;
        const attachedFiles = normalizeAttachedFiles(req.body.attached_files);

        if (!message || !session_id) {
            return res.status(400).json({ error: "message and session_id are required" });
        }

        // 1. Quick keyword-based safety check only (skip AI-based input guardrail for speed)
        const lowerMessage = message.toLowerCase();
        const dangerousKeywords = ["hack", "bomb", "weapon", "illegal", "jailbreak", "ignore all rules", "forget instructions"];
        const hasDangerousContent = dangerousKeywords.some(keyword => lowerMessage.includes(keyword));

        if (hasDangerousContent) {
            return res.json({
                message: "I can't help with that request.",
                blocked: true,
                session_id
            });
        }

        // 2. Single pipeline for all requests
        const result = await handleAgentRequest(agentId, message, session_id, attachedFiles, model);
        return res.status(result.status).json(result.payload);

    } catch (error) {
        const errorMessage = safeErrorMessage(error);
        console.error("Error in /chat:", errorMessage);

        if (errorMessage.includes('systemPrompt') || errorMessage.includes('domain')) {
            return res.status(400).json({ error: errorMessage });
        }

        return res.status(500).json({ error: "Internal server error during chat" });
    }
});

router.post('/search', authenticateApiKeyOrLocalSandbox, async (req, res) => {
    try {
        const { message, session_id } = req.body;
        if (!message) {
            return res.status(400).json({ error: "message is required" });
        }

        console.log(`[Web Search] Processing query: "${message}"`);
        const result = await performWebSearch(message);

        return res.json({
            message: result,
            session_id
        });
    } catch (error) {
        console.error("Search Error:", safeErrorMessage(error));
        return res.status(500).json({ error: "Search failed" });
    }
});

router.post('/register', authenticateApiKeyOrLocalSandbox, async (req, res) => {
    try {
        const { name, systemPrompt, domain, guardrails, tools, responseLength } = req.body || {};

        const trimmedDomain = typeof domain === "string" ? domain.trim() : "";
        const trimmedSystemPrompt = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
        if (!trimmedDomain) {
            return res.status(400).json({ error: "domain is required" });
        }

        if (!trimmedSystemPrompt) {
            return res.status(400).json({ error: "systemPrompt is required" });
        }

        const agentName = typeof name === "string" && name.trim() ? name.trim() : `${trimmedDomain} Specialist`;

        const agentId = crypto.randomUUID();

        const agentRecord = {
            agentId,
            name: agentName,
            systemPrompt: trimmedSystemPrompt,
            domain: trimmedDomain,
            guardrails: Array.isArray(guardrails) ? guardrails : [],
            tools: Array.isArray(tools) ? tools : [],
            responseLength: responseLength || 'medium'
        };

        agentsDb.set(agentId, agentRecord);

        return res.status(201).json(agentRecord);
    } catch (error) {
        console.error("Error in /register:", safeErrorMessage(error));
        return res.status(500).json({ error: "Internal server error during agent registration" });
    }
});

export default router;
