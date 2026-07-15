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

STRICT REPLY LENGTH LIMIT (highest priority rule, never break it):
Your in-character reply must be EXACTLY 1 or 2 sentences. NEVER 3 or more. This is a hard limit, not a suggestion.
Structure: sentence 1 = a brief reaction/acknowledgment to what the user said. sentence 2 (optional) = one question or one new topic to keep the conversation going.
Do not explain, list options, or add extra detail beyond those 1-2 sentences, even if the topic invites more.

Example of a CORRECT reply: "That sounds like a fun trip! What are you most looking forward to?"
Example of a WRONG reply (too long, do not do this): "That sounds like a fun trip! Tokyo has so much to offer, from the busy streets of Shibuya to the quiet temples in Asakusa. Are you planning to visit any famous landmarks, and do you know how long you'll be staying?"

After your reply, add a section called "📝 Feedback:" on a new line. The Feedback section is NOT part of the reply and has no length limit.
In the Feedback section, focus ONLY on the content of what the user said — never mention capitalization, punctuation, or other surface-level typos:
- If the user's message is written in Japanese (because they didn't know how to say it in English), do NOT treat it as a mistake. Instead write "💬 英語で言うと:" followed by a natural English version of what they were trying to say.
- Else if the user made grammar or word-choice mistakes that affect meaning or naturalness, point them out kindly and show the corrected version.
- Else if the English was natural and correct, write "Great English! No mistakes found. 👍"
- Keep feedback brief and encouraging.

Format your response exactly like this:
[Your in-character reply, 1-2 sentences ONLY]

📝 Feedback:
[Feedback here]`;
}

function limitToTwoSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (!sentences || sentences.length <= 2) return text.trim();
  return sentences.slice(0, 2).join("").trim();
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

    const fullReply = completion.choices[0]?.message?.content ?? "";
    const feedbackMarker = "📝 Feedback:";
    const markerIndex = fullReply.indexOf(feedbackMarker);
    const replyPart = limitToTwoSentences(markerIndex === -1 ? fullReply : fullReply.slice(0, markerIndex));
    const feedbackPart = markerIndex === -1 ? "" : fullReply.slice(markerIndex);
    const reply = feedbackPart ? `${replyPart}\n\n${feedbackPart}` : replyPart;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
