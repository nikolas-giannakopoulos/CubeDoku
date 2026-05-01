// Difficulty.cs
// This file ended up being a bit of a catch-all for difficulty-related stuff
// I also put LogicalStep and SolvabilityResult here because they're closely related
// to the difficulty system - might split these out later if the file gets too big
//
// The naming "BrainTerror" is intentional - it was the name we decided on in class
// for the harder mode. "Classic" is the easier one with more clues

namespace CubeDoku.Server.Core
{
    public enum Difficulty
    {
        /// <summary>
        /// Classic difficulty: solvable with Naked Singles + Hidden Singles only
        /// Target clue count: around 25 (experimented to find what felt right)
        /// </summary>
        Classic = 1,

        /// <summary>
        /// BrainTerror: requires Naked Pairs and 12-Sum deduction on top of Classic techniques
        /// Fewer clues, significantly harder
        /// Previous name during development was "Hard" → renamed to "BrainTerror" for personality
        /// </summary>
        BrainTerror = 2
    }

    // represents a single step in the logical solution
    // used both by the solver (to track what it did) and by the hint system
    // (to give the player a meaningful hint with an explanation)
    public class LogicalStep
    {
        public CellPosition Position { get; set; }
        public int Value { get; set; }

        // human-readable reason like "Naked Single" or "Edge 12-Sum: 12 - 5 = 7"
        // this is what shows up in the hint popup
        public string Reason { get; set; }

        public override string ToString()
        {
            return $"[{Position.face} {Position.row},{Position.column}]: {Value} - {Reason}";
        }
    }

    // returned by LogicalSolver.Solve() to describe what happened during solving
    // IsSolvable = false means the puzzle couldn't be solved with pure logic (needs guessing)
    // and that's a fail condition for puzzle generation - we retry with a different seed
    public class SolvabilityResult
    {
        public bool IsSolvable { get; set; }
        public Difficulty Difficulty { get; set; }

        // how many steps it took total (more steps = harder puzzle probably)
        public int StepsRequired { get; set; }

        // breakdown of which techniques were needed and how many times
        // e.g. { "Naked Single": 14, "Hidden Single": 3, "Naked Pair": 2 }
        public Dictionary<string, int> TechniquesUsed { get; set; }

        // the actual step-by-step solution (used by hint system)
        public List<LogicalStep> Steps { get; set; }

        public SolvabilityResult()
        {
            IsSolvable = false;
            // default to hardest in case something goes wrong - better than showing wrong difficulty
            Difficulty = Difficulty.BrainTerror;
            StepsRequired = 0;
            TechniquesUsed = new Dictionary<string, int>();
            Steps = new List<LogicalStep>();
        }
    }
}

