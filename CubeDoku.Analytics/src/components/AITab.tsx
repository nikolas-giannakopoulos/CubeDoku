import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { API_BASE } from '../config';

export default function AITab() {
  const [abstract, setAbstract]     = useState('');
  const [generating, setGenerating] = useState(false);

  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const chatEndRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function generateAbstract() {
    setGenerating(true);
    setAbstract('Επικοινωνία με το Gemini API…');
    try {
      const res = await fetch(`${API_BASE}/api/analytics/ai-report`, { method: 'POST' });
      const data = await res.json();
      setAbstract(data.content ?? 'Δεν ελήφθη απάντηση.');
    } catch {
      setAbstract('Σφάλμα σύνδεσης με τον server.');
    } finally {
      setGenerating(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages(prev => [...prev, { sender: 'user', text, time: now() }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/analytics/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { sender: 'ai', text: data.reply ?? '—', time: now() }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Σφάλμα σύνδεσης.', time: now() }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ai-grid">
      {/* Abstract Generator */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div className="card-title">Ακαδημαϊκή Περίληψη (Abstract)</div>
          <div className="card-desc" style={{ marginTop: '4px' }}>
            Το Gemini αναλύει τα δεδομένα της βάσης και συντάσσει επιστημονική περίληψη.
          </div>
        </div>

        <div className="ai-output">
          {abstract
            ? abstract
            : <span className="ai-output-placeholder">
                Πατήστε το κουμπί για να παραχθεί η περίληψη…
              </span>
          }
        </div>

        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          onClick={generateAbstract}
          disabled={generating}
        >
          {generating ? 'Παραγωγή…' : 'Παραγωγή Abstract'}
        </button>
      </div>

      {/* Chat */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Αναλυτής
            <span style={{ padding: '2px 7px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>AI</span>
          </div>
        </div>

        <div className="chat-window">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              <div className="chat-bubble">{msg.text}</div>
              <div className="chat-meta">{msg.time}</div>
            </div>
          ))}
          {sending && (
            <div className="chat-msg ai">
              <div className="chat-bubble" style={{ color: 'var(--text-3)' }}>Επεξεργασία…</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-row">
          <input
            className="chat-input"
            placeholder="π.χ. Πώς επηρεάζει η δυσκολία τα λάθη;"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
            Αποστολή
          </button>
        </form>
      </div>
    </div>
  );
}

function now() {
  return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}
