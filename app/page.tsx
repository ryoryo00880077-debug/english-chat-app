"use client";

import { useState, useRef, useEffect } from "react";

const MODES = [
  { id: "freetalk", label: "🗣️ Free Talk", description: "Chat about anything" },
  { id: "restaurant", label: "🍽️ Restaurant", description: "Order food & drinks" },
  { id: "business", label: "💼 Business", description: "Office conversations" },
  { id: "travel", label: "✈️ Travel", description: "Hotel & airport" },
  { id: "shopping", label: "🛍️ Shopping", description: "Buy clothes & items" },
];

const LEVELS = [
  { id: "beginner", label: "🌱 初級", description: "Simple words & short sentences" },
  { id: "intermediate", label: "🌿 中級", description: "Natural conversation" },
  { id: "advanced", label: "🌳 上級", description: "Complex expressions & idioms" },
];

type Message = {
  role: "user" | "ai";
  text: string;
  feedback?: string;
};

type Favorite = {
  id: string;
  text: string;
  type: "ai" | "correction";
  mode: string;
  savedAt: string;
};

type HistorySession = {
  id: string;
  mode: string;
  level: string;
  messages: Message[];
  savedAt: string;
  messageCount: number;
};

type Report = {
  total: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
  communication: number;
  comment: string;
  habits: string[];
  expressions: string[];
};

function loadFavorites(): Favorite[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("favorites") || "[]"); } catch { return []; }
}

function saveFavorites(favs: Favorite[]) {
  localStorage.setItem("favorites", JSON.stringify(favs));
}

function loadHistory(): HistorySession[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("chatHistory") || "[]"); } catch { return []; }
}

function saveHistory(sessions: HistorySession[]) {
  localStorage.setItem("chatHistory", JSON.stringify(sessions.slice(0, 20)));
}

export default function Home() {
  const [mode, setMode] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [score, setScore] = useState<null | { total: number; grammar: number; vocabulary: number; fluency: number; communication: number; comment: string }>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingSession, setViewingSession] = useState<HistorySession | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorites(loadFavorites());
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addFavorite(text: string, type: "ai" | "correction") {
    const id = `${Date.now()}-${Math.random()}`;
    const newFav: Favorite = { id, text, type, mode: mode || "freetalk", savedAt: new Date().toLocaleDateString("ja-JP") };
    const updated = [newFav, ...favorites];
    setFavorites(updated);
    saveFavorites(updated);
    setSavedIds((prev) => new Set(prev).add(text));
  }

  function deleteFavorite(id: string) {
    const updated = favorites.filter((f) => f.id !== id);
    setFavorites(updated);
    saveFavorites(updated);
  }

  function goBack() {
    if (messages.length > 0 && mode && level) {
      const session: HistorySession = {
        id: `${Date.now()}`,
        mode,
        level,
        messages,
        savedAt: new Date().toLocaleDateString("ja-JP"),
        messageCount: messages.length,
      };
      const updated = [session, ...history];
      setHistory(updated);
      saveHistory(updated);
    }
    setLevel(null);
    setMessages([]);
    setHint(null);
    setSavedIds(new Set());
  }

  function deleteSession(id: string) {
    const updated = history.filter((s) => s.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setHint(null);
    const newMessages: Message[] = [...messages, { role: "user", text: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const hist = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        text: m.role === "ai" ? m.text + (m.feedback ? "\n\n📝 Feedback:\n" + m.feedback : "") : m.text,
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, mode, level, history: hist }),
      });
      const data = await res.json();
      const fullReply: string = data.reply || "";
      const feedbackIndex = fullReply.indexOf("📝 Feedback:");
      let replyText = fullReply;
      let feedbackText = "";
      if (feedbackIndex !== -1) {
        replyText = fullReply.slice(0, feedbackIndex).trim();
        feedbackText = fullReply.slice(feedbackIndex + "📝 Feedback:".length).trim();
      }
      setMessages([...newMessages, { role: "ai", text: replyText, feedback: feedbackText }]);
    } catch {
      setMessages([...newMessages, { role: "ai", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function getScore() {
    if (scoreLoading || messages.length === 0) return;
    setScoreLoading(true);
    setShowScore(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      setScore(data);
    } catch { setScore(null); } finally { setScoreLoading(false); }
  }

  async function getReport() {
    if (reportLoading || messages.length === 0) return;
    setReportLoading(true);
    setShowReport(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      setReport(data);
    } catch { setReport(null); } finally { setReportLoading(false); }
  }

  function closeReport() {
    setShowReport(false);
    setReport(null);
    goBack();
  }

  async function getHint() {
    if (hintLoading) return;
    setHintLoading(true);
    setHint(null);
    try {
      const hist = messages.map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, level, history: hist }),
      });
      const data = await res.json();
      setHint(data.hint || "");
    } catch { setHint("ヒントを取得できませんでした。"); } finally { setHintLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function toggleListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("音声入力非対応のブラウザです。Chromeをお試しください。");
      return;
    }

    if (listening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        recognition.start();
      } else {
        setListening(false);
      }
    };

    recognition.onerror = () => { setListening(false); shouldListenRef.current = false; };

    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    setListening(true);
    recognition.start();
  }

  const FavoritesModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold text-center text-yellow-600 mb-4">⭐ お気に入りフレーズ</h2>
        {favorites.length === 0 ? (
          <p className="text-center text-gray-400 flex-1">まだ保存されていません</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {favorites.map((fav) => (
              <div key={fav.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fav.type === "ai" ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"}`}>
                    {fav.type === "ai" ? "AIの返答" : "修正例"}
                  </span>
                  <button onClick={() => deleteFavorite(fav.id)} className="text-gray-300 hover:text-red-400 text-xs">削除</button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{fav.text}</p>
                <p className="text-gray-400 text-xs mt-1">{fav.savedAt}</p>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowFavorites(false)} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold">閉じる</button>
      </div>
    </div>
  );

  if (!mode) {
    const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label || id;
    const levelLabel = (id: string) => LEVELS.find((l) => l.id === id)?.label || id;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <h1 className="text-3xl font-bold text-center text-indigo-700 mb-2">English Chat Practice</h1>
          <p className="text-center text-gray-500 mb-8">Choose a conversation mode to start</p>
          <div className="space-y-3">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="w-full bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl p-4 text-left transition-all shadow-sm">
                <div className="font-semibold text-lg text-indigo-700">{m.label}</div>
                <div className="text-gray-500 text-sm">{m.description}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowFavorites(true)}
              className="flex-1 bg-yellow-50 border-2 border-yellow-200 hover:border-yellow-400 rounded-xl p-3 text-center text-yellow-700 font-semibold transition-all">
              ⭐ お気に入り ({favorites.length})
            </button>
            <button onClick={() => setShowHistory(true)}
              className="flex-1 bg-blue-50 border-2 border-blue-200 hover:border-blue-400 rounded-xl p-3 text-center text-blue-700 font-semibold transition-all">
              🕐 履歴 ({history.length})
            </button>
          </div>
        </div>

        {showFavorites && <FavoritesModal />}

        {showHistory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] flex flex-col">
              <h2 className="text-xl font-bold text-center text-blue-600 mb-4">🕐 会話履歴</h2>
              {history.length === 0 ? (
                <p className="text-center text-gray-400 flex-1">まだ履歴がありません</p>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3">
                  {history.map((session) => (
                    <div key={session.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="font-semibold text-indigo-600">{modeLabel(session.mode)}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <span className="text-gray-500">{levelLabel(session.level)}</span>
                        </div>
                        <button onClick={() => deleteSession(session.id)} className="text-gray-300 hover:text-red-400 text-xs">削除</button>
                      </div>
                      <p className="text-gray-400 text-xs mb-2">{session.savedAt} · {session.messageCount}メッセージ</p>
                      <button onClick={() => { setViewingSession(session); setShowHistory(false); }}
                        className="text-indigo-500 hover:text-indigo-700 text-xs font-semibold">
                        内容を見る →
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowHistory(false)} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold">閉じる</button>
            </div>
          </div>
        )}

        {viewingSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] flex flex-col">
              <h2 className="text-lg font-bold text-indigo-700 mb-1">{modeLabel(viewingSession.mode)}</h2>
              <p className="text-gray-400 text-xs mb-4">{viewingSession.savedAt} · {levelLabel(viewingSession.level)}</p>
              <div className="flex-1 overflow-y-auto space-y-3">
                {viewingSession.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%] space-y-1">
                      <div className={`rounded-2xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      {msg.feedback && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                          <p className="font-semibold text-amber-700 mb-1">📝 Feedback</p>
                          <p className="text-amber-800 whitespace-pre-wrap">{msg.feedback}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setViewingSession(null)} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold">閉じる</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!level) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <button onClick={() => setMode(null)} className="text-indigo-400 hover:text-indigo-600 mb-6 block text-sm">← Back</button>
          <h1 className="text-3xl font-bold text-center text-indigo-700 mb-2">難易度を選択</h1>
          <p className="text-center text-gray-500 mb-8">Choose your English level</p>
          <div className="space-y-3">
            {LEVELS.map((l) => (
              <button key={l.id} onClick={() => setLevel(l.id)}
                className="w-full bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl p-4 text-left transition-all shadow-sm">
                <div className="font-semibold text-lg text-indigo-700">{l.label}</div>
                <div className="text-gray-500 text-sm">{l.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentMode = MODES.find((m) => m.id === mode);
  const currentLevel = LEVELS.find((l) => l.id === level);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-indigo-600 text-white p-4 flex items-center gap-3">
        <button onClick={goBack} className="text-indigo-200 hover:text-white text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-bold">{currentMode?.label}</div>
          <div className="text-indigo-200 text-xs">{currentLevel?.label} · {currentLevel?.description}</div>
        </div>
        <button onClick={() => setShowFavorites(true)} className="text-yellow-300 hover:text-yellow-100 text-sm font-semibold">
          ⭐ {favorites.length}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-4xl mb-2">👋</p>
            <p>Say something in English to start!</p>
            <p className="text-sm mt-2">わからなければ「💡 ヒント」ボタンを押してね</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] space-y-2">
              <div className={`rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm shadow-sm"}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.role === "ai" && (
                  <button onClick={() => addFavorite(msg.text, "ai")}
                    className={`mt-2 text-xs px-2 py-1 rounded-lg transition-colors ${savedIds.has(msg.text) ? "text-yellow-500 bg-yellow-50" : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"}`}>
                    {savedIds.has(msg.text) ? "⭐ 保存済み" : "☆ 保存"}
                  </button>
                )}
              </div>
              {msg.feedback && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-amber-700">📝 Feedback</p>
                    <button onClick={() => addFavorite(msg.feedback!, "correction")}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${savedIds.has(msg.feedback!) ? "text-yellow-500 bg-yellow-50" : "text-amber-400 hover:text-yellow-500 hover:bg-yellow-50"}`}>
                      {savedIds.has(msg.feedback!) ? "⭐ 保存済み" : "☆ 保存"}
                    </button>
                  </div>
                  <p className="text-amber-800 whitespace-pre-wrap">{msg.feedback}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {hint && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm mx-auto max-w-sm">
            <p className="font-semibold text-green-700 mb-1">💡 ヒント</p>
            <p className="text-green-800 whitespace-pre-wrap">{hint}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showScore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-center text-indigo-700 mb-4">📊 スコア結果</h2>
            {scoreLoading ? <p className="text-center text-gray-400">採点中...</p> : score ? (
              <>
                <div className="text-center mb-4">
                  <span className="text-5xl font-bold text-indigo-600">{score.total}</span>
                  <span className="text-gray-400 text-lg">/100</span>
                </div>
                <div className="space-y-2 mb-4">
                  {[{ label: "文法", value: score.grammar }, { label: "語彙", value: score.vocabulary }, { label: "流暢さ", value: score.fluency }, { label: "コミュニケーション", value: score.communication }].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-semibold">{item.value}/25</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(item.value / 25) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 text-center bg-indigo-50 rounded-xl p-3">{score.comment}</p>
              </>
            ) : <p className="text-center text-gray-400">スコアを取得できませんでした。</p>}
            <button onClick={() => setShowScore(false)} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold">閉じる</button>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[85vh] flex flex-col">
            <h2 className="text-xl font-bold text-center text-rose-600 mb-4">🏁 会話レポート</h2>
            {reportLoading ? (
              <p className="text-center text-gray-400">レポート作成中...</p>
            ) : report ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="text-center">
                  <span className="text-5xl font-bold text-indigo-600">{report.total}</span>
                  <span className="text-gray-400 text-lg">/100</span>
                </div>
                <div className="space-y-2">
                  {[{ label: "文法", value: report.grammar }, { label: "語彙", value: report.vocabulary }, { label: "流暢さ", value: report.fluency }, { label: "コミュニケーション", value: report.communication }].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-semibold">{item.value}/25</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(item.value / 25) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 text-center bg-indigo-50 rounded-xl p-3">{report.comment}</p>

                {report.habits && report.habits.length > 0 && (
                  <div>
                    <p className="font-semibold text-rose-700 text-sm mb-2">🗣️ 今日の口癖</p>
                    <ul className="space-y-1">
                      {report.habits.map((h, i) => (
                        <li key={i} className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-800">{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.expressions && report.expressions.length > 0 && (
                  <div>
                    <p className="font-semibold text-emerald-700 text-sm mb-2">📚 今日覚えた表現</p>
                    <ul className="space-y-1">
                      {report.expressions.map((e, i) => (
                        <li key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : <p className="text-center text-gray-400">レポートを取得できませんでした。</p>}
            <button onClick={closeReport} className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 font-semibold">会話を終了する</button>
          </div>
        </div>
      )}

      {showFavorites && <FavoritesModal />}

      <div className="bg-white border-t p-4">
        <div className="flex gap-2 max-w-2xl mx-auto mb-2">
          <button onClick={getHint} disabled={hintLoading}
            className="bg-green-100 hover:bg-green-200 disabled:bg-gray-100 text-green-700 disabled:text-gray-400 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
            {hintLoading ? "..." : "💡 ヒント"}
          </button>
          <button onClick={getScore} disabled={scoreLoading || messages.length === 0}
            className="bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-100 text-indigo-700 disabled:text-gray-400 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
            {scoreLoading ? "..." : "📊 スコア"}
          </button>
          <button onClick={getReport} disabled={reportLoading || messages.length === 0}
            className="bg-rose-100 hover:bg-rose-200 disabled:bg-gray-100 text-rose-700 disabled:text-gray-400 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
            {reportLoading ? "..." : "🏁 終了"}
          </button>
        </div>
        <div className="flex gap-2 max-w-2xl mx-auto">
          <button onClick={toggleListening}
            className={`rounded-xl px-4 py-3 text-lg transition-colors ${listening ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
            🎤
          </button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={listening ? "話してください..." : "Type in English... (Enter to send)"} rows={1}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-indigo-400 text-sm" />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl px-5 py-3 font-semibold transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
