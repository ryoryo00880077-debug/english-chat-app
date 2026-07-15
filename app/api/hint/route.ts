import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { mode, level, history } = await req.json();

    const lastAiMessage = [...history].reverse().find((m: { role: string }) => m.role === "model");
    const context = lastAiMessage ? `The AI just said: "${lastAiMessage.text}"` : "The conversation is just starting.";

    const prompt = `You are helping a Japanese person practice English conversation.
Mode: ${mode}, Level: ${level}
${context}

Give a SHORT hint in Japanese about what they could say next in English.
Include 1-2 example English phrases they could use.
Keep it under 60 words total. Be encouraging.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });

    const hint = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ hint });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get hint" }, { status: 500 });
  }
}
