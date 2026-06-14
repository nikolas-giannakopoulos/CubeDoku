import { useState, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  ArcElement,
} from 'chart.js';
import { Bar, Scatter, Doughnut } from 'react-chartjs-2';
import type { Metrics, ChatMessage } from '../types';
import { API_BASE } from '../config';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, Tooltip, Legend, Title, ArcElement);

// Shared chart theme
const gridColor  = 'rgba(255,255,255,0.05)';
const labelColor = '#8b909e';
const font       = { family: 'Inter, system-ui, sans-serif', size: 12 };

const baseScaleOpts = {
  grid: { color: gridColor },
  ticks: { color: labelColor, font },
};

interface Props {
  metrics: Metrics | null;
  onExportCSV: () => void;
}

function now() {
  return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

export default function ResearchTab({ metrics, onExportCSV: _onExportCSV }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]     = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      if (!res.ok) {
        let errMsg: string;
        if (res.status === 429) {
          // Parse the actual Gemini error message to distinguish rate-limit vs quota
          const rawError: string = data?.error ?? '';
          if (rawError.toLowerCase().includes('quota') || rawError.toLowerCase().includes('resource_exhausted')) {
            errMsg = `⚠ Το Gemini API quota εξαντλήθηκε. Λεπτομέρειες: ${rawError}`;
          } else if (rawError.toLowerCase().includes('rate') || rawError.toLowerCase().includes('too many')) {
            errMsg = '⚠ Πολλά αιτήματα σε σύντομο χρονικό διάστημα. Περίμενε λίγο και ξαναπροσπάθησε.';
          } else {
            errMsg = `⚠ Gemini 429: ${rawError || 'Υπέρβαση ορίου αιτημάτων.'}`;
          }
        } else {
          errMsg = `⚠ Σφάλμα ${res.status}: ${data?.error ?? 'Άγνωστο σφάλμα'}`;
        }
        setMessages(prev => [...prev, { sender: 'ai', text: errMsg, time: now() }]);
        return;
      }

      setMessages(prev => [...prev, { sender: 'ai', text: data.reply ?? '(κενή απάντηση)', time: now() }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'ai', text: '⚠ Αδυναμία σύνδεσης με τον server.', time: now() }]);
    } finally {
      setSending(false);
    }
  }

  if (!metrics) return null;

  const classicPts = metrics.scatterData.filter(d => d.difficulty === 'Classic');
  const brainPts   = metrics.scatterData.filter(d => d.difficulty === 'BrainTerror');

  // Chart 1 – Scatter: Time vs Mistakes
  const scatterData = {
    datasets: [
      {
        label: 'Classic',
        data: classicPts,
        backgroundColor: 'rgba(52,201,138,0.55)',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'BrainTerror',
        data: brainPts,
        backgroundColor: 'rgba(240,80,79,0.55)',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  // Chart 2 – Bar: Avg comparison
  const barData = {
    labels: ['Classic', 'BrainTerror'],
    datasets: [
      {
        label: 'Μέσος Χρόνος (δευτ.)',
        data: [metrics.classic.avgTime, metrics.brainTerror.avgTime],
        backgroundColor: 'rgba(91,106,245,0.65)',
        borderRadius: 4,
        barThickness: 36,
        yAxisID: 'y',
      },
      {
        label: 'Μέσα Λάθη',
        data: [metrics.classic.avgMistakes, metrics.brainTerror.avgMistakes],
        backgroundColor: 'rgba(240,80,79,0.65)',
        borderRadius: 4,
        barThickness: 36,
        yAxisID: 'y1',
      },
      {
        label: 'Μέσα Hints',
        data: [metrics.classic.avgHints, metrics.brainTerror.avgHints],
        backgroundColor: 'rgba(232,160,48,0.65)',
        borderRadius: 4,
        barThickness: 36,
        yAxisID: 'y1',
      },
    ],
  };

  // Chart 3 – Doughnut: Game split by difficulty
  const doughnutData = {
    labels: ['Classic', 'BrainTerror'],
    datasets: [
      {
        data: [metrics.classic.games, metrics.brainTerror.games],
        backgroundColor: [
          'rgba(52,201,138,0.75)',
          'rgba(240,80,79,0.75)',
        ],
        borderColor: [
          'rgba(52,201,138,1)',
          'rgba(240,80,79,1)',
        ],
        borderWidth: 1.5,
        hoverOffset: 6,
      },
    ],
  };

  const scatterOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: labelColor, font, boxWidth: 10 } },
      tooltip: { bodyFont: font, titleFont: font },
    },
    scales: {
      x: { ...baseScaleOpts, title: { display: true, text: 'Χρόνος (δευτερόλεπτα)', color: labelColor, font } },
      y: { ...baseScaleOpts, title: { display: true, text: 'Αριθμός Λαθών', color: labelColor, font } },
    },
  };

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: labelColor, font, boxWidth: 10 } },
      tooltip: { bodyFont: font, titleFont: font },
    },
    scales: {
      x: { ...baseScaleOpts },
      y: { 
        ...baseScaleOpts, 
        type: 'linear' as const, 
        position: 'left' as const,
        title: { display: true, text: 'Χρόνος', color: labelColor, font: { family: 'Inter, system-ui, sans-serif', size: 12 } }
      },
      y1: { 
        ...baseScaleOpts, 
        type: 'linear' as const, 
        position: 'right' as const, 
        title: { display: true, text: 'Λάθη/Hints', color: labelColor, font: { family: 'Inter, system-ui, sans-serif', size: 12 } },
        grid: { drawOnChartArea: false }
      },
    },
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: labelColor, font, boxWidth: 12, padding: 16 },
      },
      tooltip: { bodyFont: font, titleFont: font },
    },
  };

  return (
    <div>
      {/* All 3 charts in one responsive grid */}
      <div className="chart-grid chart-grid-3" style={{ marginBottom: '14px' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Scatter — Χρόνος vs Λάθη</div>
              <div className="card-desc">Κάθε σημείο αντιστοιχεί σε ένα ολοκληρωμένο παιχνίδι</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Scatter data={scatterData} options={scatterOpts} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Σύγκριση Δυσκολίας</div>
              <div className="card-desc">Μέσες τιμές ανά κατηγορία δυσκολίας</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Bar data={barData} options={barOpts} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Κατανομή ανά Δυσκολία</div>
              <div className="card-desc">Αναλογία Classic / BrainTerror</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>
      </div>

      {/* AI Αναλυτής */}
      <div className="card ai-analyst-card">
        <div className="card-header" style={{ marginBottom: '0' }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Αναλυτής
              <div className="ai-badge">AI</div>
            </div>
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
              <div className="chat-bubble chat-typing">
                <span /><span /><span />
              </div>
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
