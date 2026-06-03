namespace CubeDoku.Server.Core
{
    public enum Difficulty
    {

        Classic = 1,

        BrainTerror = 2
    }

    // represents a single step in the logical solution

    public class LogicalStep
    {
        public CellPosition Position { get; set; }
        public int Value { get; set; }

        public string Reason { get; set; }

        public override string ToString()
        {
            return $"[{Position.face} {Position.row},{Position.column}]: {Value} - {Reason}";
        }
    }

    // returned by LogicalSolver.Solve() to describe what happened during solving

    public class SolvabilityResult
    {
        public bool IsSolvable { get; set; }
        public Difficulty Difficulty { get; set; }

        // how many steps it took total (more steps = harder puzzle)
        public int StepsRequired { get; set; }

        public Dictionary<string, int> TechniquesUsed { get; set; }

        // the actual step-by-step solution (used by hint system)
        public List<LogicalStep> Steps { get; set; }

        public SolvabilityResult()
        {
            IsSolvable = false;
            Difficulty = Difficulty.BrainTerror;
            StepsRequired = 0;
            TechniquesUsed = new Dictionary<string, int>();
            Steps = new List<LogicalStep>();
        }
    }
}

