'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, RotateCcw, Send, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What does the unemployment rate tell us about the economy?',
  'Explain the relationship between inflation and interest rates.',
  'What is GDP and how is it measured?',
  'How does the Federal Reserve use monetary policy to control inflation?',
  'What are leading vs lagging economic indicators?',
  'Why does the yield curve invert before recessions?',
];

function renderContent(text: string) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] | null = null;

  function flushList(key: string) {
    if (!listItems) return;
    nodes.push(
      <ul key={key} className="list-disc list-inside text-sm space-y-0.5 my-1.5">
        {listItems.map((item, i) => (
          <li key={i} style={{ color: 'var(--text-muted)' }}>
            {inlineBold(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = null;
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(`gap-${i}`); return; }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems = listItems ?? [];
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList(`pre-${i}`);

    if (trimmed.startsWith('### ')) {
      nodes.push(
        <p key={i} className="text-xs font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: 'var(--accent)' }}>
          {trimmed.slice(4)}
        </p>,
      );
    } else if (trimmed.startsWith('## ')) {
      nodes.push(
        <p key={i} className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text)' }}>
          {trimmed.slice(3)}
        </p>,
      );
    } else {
      nodes.push(
        <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {inlineBold(trimmed)}
        </p>,
      );
    }
  });

  flushList('end');
  return nodes;
}

function inlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} style={{ color: 'var(--text)' }}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setError(null);
      setStreamingText('');
      setIsStreaming(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const msg = await res.text();
          setError(msg || 'Something went wrong.');
          setIsStreaming(false);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamingText(accumulated);
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamingText('');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('Connection failed. Please try again.');
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [messages],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isStreaming) return;
      send(input);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText('');
    setError(null);
    setIsStreaming(false);
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Economic AI Chat
          </h1>
        </div>
        {!isEmpty && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New chat
          </button>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Empty state with suggestions */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
            >
              <MessageCircle className="w-7 h-7" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-center flex flex-col gap-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                Ask anything about economics
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Indicators, policy, markets, data interpretation — or type your own question.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-4 py-3 rounded-xl transition-colors leading-snug"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3"
              style={
                msg.role === 'user'
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)' }
              }
            >
              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed" style={{ color: '#fff' }}>
                  {msg.content}
                </p>
              ) : (
                <div className="flex flex-col gap-1">{renderContent(msg.content)}</div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming assistant reply */}
        {streamingText && (
          <div className="flex justify-start">
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col gap-1">
                {renderContent(streamingText)}
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                  style={{ background: 'var(--accent)', verticalAlign: 'text-bottom' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingText && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Thinking…</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--red) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              color: 'var(--red)',
            }}
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about an economic indicator, trend, or concept… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 overflow-hidden"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              minHeight: '42px',
              maxHeight: '160px',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="shrink-0 p-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title="Send"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
          AI responses may be inaccurate. Verify important figures with the live data on this site.
        </p>
      </div>
    </div>
  );
}
