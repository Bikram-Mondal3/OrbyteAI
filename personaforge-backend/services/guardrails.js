import { judgeMessage, runAdkTextCompletion } from './ai.js';
import { compileGuardrails } from './promptBuilder.js';

function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

const BLOCKED_KEYWORDS = [
    "hack", "bomb", "weapon", "illegal", "jailbreak",
    "ignore all rules", "forget instructions",
    "ignore previous", "pretend you have no rules",
    "bypass", "override rules"
];

/**
 * Layer 1 — keywordCheck
 */
function keywordCheck(message) {
    const lowerMessage = String(message || "").toLowerCase();
    for (const keyword of BLOCKED_KEYWORDS) {
        if (lowerMessage.includes(keyword)) {
            return { safe: false, reason: keyword };
        }
    }
    return { safe: true };
}

/**
 * Layer 2 — claudeJudgeInput (Soft validation - checks safety, NOT domain relevance)
 */
async function claudeJudgeInput(message, domain) {
    try {
        const res = await judgeMessage(message, domain);
        if (res.toUpperCase().includes("UNSAFE")) {
            return { safe: false };
        }
        return { safe: true };
    } catch (e) {
        console.error("claudeJudgeInput error:", safeErrorMessage(e));
        // Fail open to prevent breaking UX if API fails
        return { safe: true };
    }
}

/**
 * Layer 3 — claudeJudgeOutput (Enhanced with Domain Alignment Check)
 * Validates response quality, NOT input relevance
 */
async function claudeJudgeOutput(response, rules, domain) {
    try {
        const promptText = `Domain: ${domain || 'General Knowledge'}
Rules: ${compileGuardrails(rules) || 'None'}
Response to evaluate: ${response}

Validation Criteria:
1. Does the response maintain the ${domain || 'General Knowledge'} specialist persona?
2. Does the response demonstrate specialized expertise (not generic advice)?
3. Does the response follow all specified rules?
4. Does the response avoid generic assistant behavior?
5. If the user asked about capabilities, did the agent explain ${domain || 'General Knowledge'}-specific capabilities?
6. If the user input was off-topic, did the agent use SOFT redirection (friendly, helpful)?

A response is UNSAFE if:
- It provides generic assistant responses instead of domain-specific guidance
- It acts like a general-purpose AI
- It gives generic capabilities when asked "what can you do?"
- It breaks any specified rules
- It fails to maintain the specialized persona
- It uses HARD rejection language like "I can't help with that" without offering alternatives

A response is SAFE if:
- It maintains ${domain || 'General Knowledge'} persona even for meta questions
- It uses soft, friendly redirection for off-topic queries
- It explains ${domain || 'General Knowledge'} capabilities when asked
- It's helpful and conversational while staying in character

Reply with ONLY one word: SAFE or UNSAFE`;

        const res = await runAdkTextCompletion(
            promptText,
            "You are a strict compliance validator. Evaluate persona integrity. Reply with ONLY one word: SAFE or UNSAFE.",
            { name: "persona_forge_output_guardrail", temperature: 0 }
        );

        if (res.trim().toUpperCase().includes("UNSAFE")) {
            return { safe: false };
        }
        return { safe: true };
    } catch (e) {
        console.error("claudeJudgeOutput error:", safeErrorMessage(e));
        return { safe: true }; // Fail-safe
    }
}

/**
 * Main function — runGuardrails
 * Validates safety and persona adherence, does NOT reject based on domain relevance
 */
export async function runGuardrails(userMessage, agentResponse, domain, rules) {
    // If testing input only (agentResponse is empty), skip output judge

    // 1. Layer 1 keyword check on user input (safety only)
    if (userMessage) {
        const l1 = keywordCheck(userMessage);
        if (!l1.safe) {
            return { blocked: true, layer: "keyword", reply: "I can't help with that request." };
        }

        // 2. Layer 2 input judge (safety only, NOT domain filtering)
        const l2 = await claudeJudgeInput(userMessage, domain);
        if (!l2.safe) {
            return { blocked: true, layer: "input", reply: "I'm here to help with safe and constructive queries. What would you like to know?" };
        }
    }

    // 3. Layer 3 output judge (Check persona adherence and response quality)
    if (agentResponse) {
        const l3 = await claudeJudgeOutput(agentResponse, rules, domain);
        if (!l3.safe) {
            return { blocked: true, layer: "output", reply: agentResponse };
        }
    }

    return { blocked: false, reply: agentResponse };
}
