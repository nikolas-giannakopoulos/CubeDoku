export interface Metrics {
  totalGames: number;
  classic: {
    games: number;
    avgTime: number;
    avgMistakes: number;
    avgHints: number;
  };
  brainTerror: {
    games: number;
    avgTime: number;
    avgMistakes: number;
    avgHints: number;
  };
  scatterData: Array<{ x: number; y: number; difficulty: string }>;
}

export interface AuditLog {
  id: string;
  username: string;
  difficulty: string;
  puzzleDate: string;
  score: number;
  durationSeconds: number;
  mistakes: number;
  hintsUsed: number;
  completedAt: string;
}

export type Tab = 'overview' | 'research' | 'audit';
