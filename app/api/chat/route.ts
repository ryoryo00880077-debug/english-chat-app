import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SCENARIOS = {
  restaurant: `You are a friendly waiter at an English restaurant. Have a natural conversation with the customer about ordering food and drinks. Stay in character.`,
  business: `You are a colleague in an English-speaking office. Have a professional business conversation. Topics can include meetings, projects, emails, etc.`,
  travel: `You are a hotel receptionist or airport staff member. Help the traveler with check-in, directions, or travel-related questions.`,
  shopping: `You are a shop assistant in an English clothing store. Help the customer find items, discuss sizes, prices, etc.`,
  freetalk: `You are a friendly English conversation partner. Chat naturally about any topic the user brings up.`,
};

const LEVEL_INSTRUCTIONS = {
  beginner: `The user is a BEGINNER English learner. Use very simple vocabulary and short sentences. Speak slowly and clearly. Avoid idioms or complex grammar.`,
  intermediate: `The user is an INTERMEDIATE English learner. Use natural everyday English. Moderate complexity is fine.`,
  advanced: `The user is an ADVANCED English learner. Use rich vocabulary, idioms, complex sentences, and natural native-level English.`,
};

function buildSystemPrompt(mode: string, level: string): string {
  const scenario = SCENARIOS[mode as keyof typeof SCENARIOS] || SCENARIOS.freetalk;
  const levelInstruction = LEVEL_INSTRUCTIONS[level as keyof typeof LEVEL_INSTRUCTIONS] || LEVEL_INSTRUCTIONS.intermediate;
  return `${scenario}

${levelInstruction}

IMPORTANT INSTRUCTIONS:
1. Reply naturally in English as the character above, matching the user's level.
2. Keep your reply SHORT: at most 2 sentences, structured as (1) a brief reaction/acknowledgment to what the user said, then (2) a question or a new topic to keep the conversation going.
3. After your reply, add a section called "📝 Feedback:" on a new line.
4. In the Feedback section, focus ONLY on the content of what the user said — never mention capitalization, punctuation, or other surface-level typos:
   - If the user's message is written in Japanese (because they didn't know how to say it in English), do NOT treat it as a mistake. Instead write "💬 英語で言うと:" followed by a natural English version of what they were trying to say.
   - Else if the user made grammar or word-choice mistakes that affect meaning or naturalness, point them out kindly and show the corrected version.
   - Else if the English was natural and correct, write "Great English! No mistakes found. 👍"
   - Keep feedback brief and encouraging.

Format your response like this:
[Your natural reply as the character, max 2 sentences]

📝 Feedback:
[Feedback here]`;
}

export async function POST(req: NextRequest) {
  try {
    const { message, mode, level, history } = await req.json();

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(mode, level) },
      ...history.map((msg: { role: string; text: string }) => ({
        role: msg.role === "user" ? "user" as const : "assistant" as const,
        content: msg.text,
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
