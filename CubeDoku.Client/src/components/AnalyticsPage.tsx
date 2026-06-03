import React, { useState, useEffect, useRef } from 'react';
import '../styles/analytics.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  ChartTitle,
  Tooltip,
  Legend
);

interface Metrics {
  TotalGames: number;
  Classic: { Games: number; AvgTime: number; AvgMistakes: number; AvgHints: number };
  BrainTerror: { Games: number; AvgTime: number; AvgMistakes: number; AvgHints: number };
  ScatterData: Array<{ x: number; y: number; difficulty: string }>;
}

interface AuditLog {
  Id: string;
  Username: string;
  Difficulty: string;
  PuzzleDate: string;
  Score: number;
  DurationSeconds: number;
  Mistakes: number;
  HintsUsed: number;
  CompletedAt: string;
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'thesis' | 'audit' | 'ai'>('thesis');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // AI State
  const [aiReport, setAiReport] = useState<string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Γεια σας! Είμαι ο AI Ερευνητής του CubeDoku. Ρωτήστε με οτιδήποτε σχετικά με τα στατιστικά επίλυσης των παικτών.' }
  ]);
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = 'http://localhost:5105'; // Update port to match backend if necessary or dynamic

  useEffect(() => {
    fetchMetrics();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    setAiReport('Παρακαλώ περιμένετε, το Gemini αναλύει τα δεδομένα της βάσης...');
    try {
      const res = await fetch(`${API_BASE}/api/analytics/ai-report`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setAiReport(data.content);
      } else {
        setAiReport('Σφάλμα κατά την επικοινωνία με το Gemini API.');
      }
    } catch (err) {
      setAiReport('Αποτυχία σύνδεσης με τον διακομιστή.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat) return;

    const userText = chatMessage;
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setChatMessage('');
    setSendingChat(true);

    try {
      const res = await fetch(`${API_BASE}/api/analytics/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Message: userText }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'ai', text: 'Σφάλμα κατά την επικοινωνία με την AI.' }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Αποτυχία σύνδεσης με τον διακομιστή.' }]);
    } finally {
      setSendingChat(false);
    }
  };

  const exportCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = ['ID', 'Username', 'Difficulty', 'PuzzleDate', 'Score', 'DurationSeconds', 'Mistakes', 'HintsUsed', 'CompletedAt'];
    const rows = auditLogs.map(log => [
      log.Id,
      log.Username,
      log.Difficulty,
      log.PuzzleDate,
      log.Score,
      log.DurationSeconds,
      log.Mistakes,
      log.HintsUsed,
      log.CompletedAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cubedoku_dataset_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart Configs
  const classicScatter = metrics?.ScatterData.filter(d => d.difficulty === 'Classic') || [];
  const brainScatter = metrics?.ScatterData.filter(d => d.difficulty === 'BrainTerror') || [];

  const scatterData = {
    datasets: [
      {
        label: 'Classic',
        data: classicScatter,
        backgroundColor: '#10b981',
      },
      {
        label: 'BrainTerror',
        data: brainScatter,
        backgroundColor: '#ef4444',
      }
    ]
  };

  const barData = {
    labels: ['Classic', 'BrainTerror'],
    datasets: [
      {
        label: 'Μέσος Χρόνος (sec)',
        data: [metrics?.Classic.AvgTime || 0, metrics?.BrainTerror.AvgTime || 0],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
      },
      {
        label: 'Μέσα Λάθη',
        data: [metrics?.Classic.AvgMistakes || 0, metrics?.BrainTerror.AvgMistakes || 0],
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: '#ef4444',
        borderWidth: 1,
      }
    ]
  };

  if (loading) {
    return (
      <div className="analytics-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ color: '#00f2fe' }}>Φόρτωση δεδομένων CubeDoku...</h2>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <header className="analytics-header">
        <h1>CubeDoku Intelligence</h1>
        <p>Συνοδευτικό Ερευνητικό Portal & AI Αναλυτής Γνωστικής Επιβάρυνσης</p>
      </header>

      {/* Glow Cards Overview */}
      <section className="stats-overview-grid">
        <div className="stat-glow-card">
          <div className="stat-value">{metrics?.TotalGames || 0}</div>
          <div className="stat-label">Συνολικά Παιχνίδια</div>
        </div>
        <div className="stat-glow-card">
          <div className="stat-value">{metrics?.Classic.Games || 0}</div>
          <div className="stat-label">Classic Επιλύσεις</div>
        </div>
        <div className="stat-glow-card">
          <div className="stat-value">{metrics?.BrainTerror.Games || 0}</div>
          <div className="stat-label">BrainTerror Επιλύσεις</div>
        </div>
      </section>

      {/* Tabs */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === 'thesis' ? 'active' : ''}`}
          onClick={() => setActiveTab('thesis')}
        >
          📊 Ερευνητικά Γραφήματα
        </button>
        <button 
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📋 Μητρώο Καταγραφών (Audit)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🧠 AI Cognitive Analyst
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'thesis' && (
        <div>
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Συσχέτιση Χρόνου & Λαθών (Scatter Plot)</h3>
              <div style={{ height: '300px' }}>
                <Scatter 
                  data={scatterData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { title: { display: true, text: 'Χρόνος (δευτ.)', color: '#fff' } },
                      y: { title: { display: true, text: 'Λάθη', color: '#fff' } }
                    }
                  }} 
                />
              </div>
            </div>

            <div className="chart-card">
              <h3>Σύγκριση Δυσκολίας (Classic vs BrainTerror)</h3>
              <div style={{ height: '300px' }}>
                <Bar 
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn-glowing" onClick={exportCSV}>
              📥 Εξαγωγή Dataset σε CSV
            </button>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="table-panel">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Παίκτης</th>
                <th>Δυσκολία</th>
                <th>Ημερομηνία</th>
                <th>Σκορ</th>
                <th>Χρόνος (s)</th>
                <th>Λάθη</th>
                <th>Hints</th>
                <th>Ημ. Ολοκλήρωσης</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.Id}>
                  <td>{log.Username}</td>
                  <td>
                    <span className={`difficulty-badge ${log.Difficulty.toLowerCase()}`}>
                      {log.Difficulty}
                    </span>
                  </td>
                  <td>{log.PuzzleDate}</td>
                  <td>{log.Score}</td>
                  <td>{log.DurationSeconds}</td>
                  <td>{log.Mistakes}</td>
                  <td>{log.HintsUsed}</td>
                  <td>{log.CompletedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="ai-section">
          {/* Scientific Abstract Generator */}
          <div className="ai-card">
            <h3>Αυτόματη Ακαδημαϊκή Περίληψη (Gemini AI)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Το Gemini θα συντάξει μια επιστημονική περίληψη (Academic Abstract) βασισμένη στα πραγματικά στατιστικά της βάσης δεδομένων.
            </p>
            <div className="ai-abstract-output">
              {aiReport || 'Κάντε κλικ στο παρακάτω κουμπί για να δημιουργηθεί η αναφορά...'}
            </div>
            <button 
              className="btn-glowing" 
              onClick={generateReport}
              disabled={generatingReport}
              style={{ marginTop: '1.5rem' }}
            >
              {generatingReport ? 'Δημιουργία...' : '✨ Παραγωγή Ακαδημαϊκής Αναφοράς'}
            </button>
          </div>

          {/* Interactive AI Researcher Chat */}
          <div className="ai-card">
            <h3>Συνομιλία με τον AI Ερευνητή</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Κάντε σύνθετες ερωτήσεις για τις γνωστικές διαφορές των δυσκολιών με βάση τα δεδομένα.
            </p>
            <div className="ai-chat-history">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`chat-bubble ${chat.sender}`}>
                  {chat.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="ai-chat-input-row">
              <input 
                type="text" 
                placeholder="Π.χ. Πώς επηρεάζει η δυσκολία τα λάθη των παικτών;" 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                disabled={sendingChat}
              />
              <button type="submit" className="btn-glowing" disabled={sendingChat}>
                {sendingChat ? '...' : 'Αποστολή'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
