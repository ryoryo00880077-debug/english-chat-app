import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const userMessages = messages
      .filter((m: { role: string }) => m.role === "user")
      .map((m: { text: string }) => m.text)
      .join("\n");

    if (!userMessages.trim()) {
      return NextResponse.json({ score: null, comment: "まだメッセージがありません。" });
    }

    const prompt = `You are an English teacher evaluating a Japanese student's English conversation.

Here are all the student's messages:
${userMessages}

Score their English on the following 4 criteria, each out of 25 points (total 100):
1. Grammar (文法)
2. Vocabulary (語彙)
3. Fluency (流暢さ・自然さ)
4. Communication (コミュニケーション力)

Respond ONLY in this exact JSON format:
{
  "total": <number>,
  "grammar": <number>,
  "vocabulary": <number>,
  "fluency": <number>,
  "communication": <number>,
  "comment": "<encouraging comment in Japanese, 1-2 sentences>"
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get score" }, { status: 500 });
  }
}
