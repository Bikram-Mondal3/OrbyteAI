import { NextRequest, NextResponse } from 'next/server'

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildIdentityPrompt(agentName: string, domain: string, description: string, tone?: string) {
  const name = agentName || 'Specialist Assistant'
  const roleText = description?.trim() || 'Provide domain-specific guidance.'
  const toneLine = tone ? `\nTone: ${tone}.` : ''

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
No self-introduction. No self-promotion. No talk about tools. Only results.`
}

function deriveAgentName(prompt: string, domain: string) {
  const text = normalizeText(prompt)
  if (text.includes('mentor')) return `${domain} Mentor`
  if (text.includes('doctor')) return `${domain} Doctor`
  if (text.includes('advisor') || text.includes('adviser')) return `${domain} Advisor`
  return `${domain} Specialist`
}

function logForgeError(error: unknown) {
  console.error('Forge API error', {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error)
  })
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, domain: providedDomain } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const selectedDomain = providedDomain || "General Knowledge"

    // Support both GEMINI_API_KEY and GOOGLE_API_KEY env var names
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    // For demonstration purposes, if API key is missing, we'll return a mock response
    // but the implementation is ready for Gemini
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is missing. Returning mock response for Forge Engine.')

      // Simulate brief delay
      await new Promise(resolve => setTimeout(resolve, 3000))

      const agentName = deriveAgentName(prompt, selectedDomain)

      return NextResponse.json({
        agentName,
        tone: "Professional",
        domain: selectedDomain,
        memory: "session",
        responseStyle: "Clear and concise",
        guardrails: [
          "No illegal advice",
          "Maintain professional tone",
          "Avoid harmful or unethical guidance"
        ],
        systemPrompt: buildIdentityPrompt(agentName, selectedDomain, prompt)
      })
    }

    const systemInstruction = `You are an AI system that converts descriptions of AI assistants into structured agent configurations.

Analyze the user description and generate a configuration with the following fields:
- agentName: An appropriate name for the agent based on the description and domain.
- tone: The personality of the agent (e.g., Professional, Friendly, Clinical).
- domain: This MUST be exactly "${selectedDomain}".
- memory: Must be one of "stateless", "session", or "persistent".
- responseStyle: How the agent should structure its answers.
- guardrails: list of 3-5 specific safety and behavior rules.
- systemPrompt: A comprehensive system instruction for THIS specific agent.

Return ONLY a valid JSON object. No markdown formatting, no preamble, no explanation.

JSON Format:
{
  "agentName": "...",
  "tone": "...",
  "domain": "${selectedDomain}",
  "memory": "...",
  "responseStyle": "...",
  "guardrails": ["...", "...", "..."],
  "systemPrompt": "..."
}

USER DESCRIPTION TO CONVERT:
${prompt}`

    let content = ''
    let configSource = ''

    // Primary: Groq AI for configuration generation — fast and reliable
    const groqApiKey = process.env.GROQ_API_KEY
    if (groqApiKey) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You generate structured JSON configurations for AI agents based on the provided description.' },
              { role: 'user', content: systemInstruction }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
          }),
        })

        if (groqResponse.ok) {
          const groqData = await groqResponse.json()
          content = groqData.choices[0].message.content
          configSource = 'Groq'
          console.log('[Groq] Generated agent configuration')
        } else {
          const err = await groqResponse.text()
          console.warn(`[Groq] Configuration generation failed: ${groqResponse.status}`, err)
        }
      } catch (e) {
        console.error('[Groq] Configuration generation error:', e)
      }
    }

    // Fallback: Gemini AI if Groq fails or is unavailable
    if (!content && apiKey) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-3.0-flash',
          messages: [
            { role: 'system', content: 'You generate structured JSON configurations for AI agents based on the provided description.' },
            { role: 'user', content: systemInstruction }
          ],
          response_format: { type: 'json_object' }
        })
      })

      if (response.ok) {
        const data = await response.json()
        content = data.choices[0].message.content
        configSource = 'Gemini'
        console.log('[Gemini] Generated agent configuration')
      } else {
        const errorData = await response.json()
        console.error(`[Gemini] Configuration generation failed: ${response.status}`, errorData.error?.message)
        // If both failed, return error
        return NextResponse.json({ error: errorData.error?.message || 'AI configuration request failed' }, { status: response.status })
      }
    }

    if (!content) {
      return NextResponse.json({ error: 'No AI service available for configuration generation' }, { status: 503 })
    }

    try {
      // Clean potential markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      }

      const config = JSON.parse(cleanedContent)

      const agentName = sanitizeText(config.agentName) || deriveAgentName(prompt, selectedDomain)

      return NextResponse.json({
        ...config,
        agentName,
        domain: selectedDomain,
        systemPrompt: buildIdentityPrompt(agentName, selectedDomain, prompt, config.tone),
        _meta: { source: configSource }
      })
    } catch (parseError) {
      console.error(`[${configSource}] JSON Parse Error:`, parseError);
      console.error(`[${configSource}] Raw content:`, content);
      return NextResponse.json({ error: `Failed to parse ${configSource || 'AI'} response` }, { status: 500 })
    }

  } catch (error: unknown) {
    logForgeError(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
