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

    const transcript = messages
      .map((m: { role: string; text: string }) => `${m.role === "user" ? "Student" : "AI"}: ${m.text}`)
      .join("\n");

    if (!userMessages.trim()) {
      return NextResponse.json({ score: null, comment: "まだメッセージがありません。" });
    }

    const prompt = `You are an English teacher reviewing a full conversation session with a Japanese student who just finished practicing.

Full transcript:
${transcript}

The student's messages only:
${userMessages}

Analyze the session and respond ONLY in this exact JSON format:
{
  "total": <number 0-100>,
  "grammar": <number 0-25>,
  "vocabulary": <number 0-25>,
  "fluency": <number 0-25>,
  "communication": <number 0-25>,
  "comment": "<encouraging overall evaluation in Japanese, 2-3 sentences>",
  "habits": ["<a phrase, word, or grammar pattern the student repeated often or overused across the session, described briefly in Japanese>", "..."],
  "expressions": ["<a useful English expression or corrected phrase from this session the student should remember, in English>", "..."]
}

- "habits" (口癖): list 2-4 recurring words/phrases/patterns the student leaned on repeatedly (e.g. always starting with "I think", overusing "very", repeating the same grammar mistake). If nothing stands out, return an empty array.
- "expressions": list 3-6 concrete English phrases worth remembering from this session (corrections or new expressions introduced). If none, return an empty array.`;

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
    return NextResponse.json({ error: "Failed to get report" }, { status: 500 });
  }
}
