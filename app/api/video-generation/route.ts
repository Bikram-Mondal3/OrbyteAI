import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
        const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : "ltx-2"

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
        }

        const apiKey = process.env.POLLINATIONS_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: "POLLINATIONS_API_KEY is not set in the environment variables." }, { status: 500 })
        }

        const response = await fetch(
            `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
                { error: errorText || `HTTP Error: ${response.status}` },
                { status: response.status }
            )
        }

        const contentType = response.headers.get("content-type") || "video/mp4"
        const videoBuffer = await response.arrayBuffer()

        return new Response(videoBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "no-store"
            }
        })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate video" },
            { status: 500 }
        )
    }
}