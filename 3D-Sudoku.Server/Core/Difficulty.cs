namespace ThreeDSudoku.Server.Core
{
    public enum Difficulty
    {
        /// <summary>
        /// Classic: Naked Singles + Hidden Singles (12-13 clues)
        /// Προηγούμενο: Medium → Easy
        /// </summary>
        Classic = 1,

        /// <summary>
        /// Brain-Terror: + Naked Pairs + προχωρημένες 12-Sum (10-14 clues)
        /// Προηγούμενο: Hard → Medium
        /// </summary>
        BrainTerror = 2
    }

    /// <summary>
    /// Αποθηκεύει το αποτέλεσμα της λογικής επίλυσης
    /// </summary>
    public class SolvabilityResult
    {
        public bool IsSolvable { get; set; }
        public Difficulty Difficulty { get; set; }
        public int StepsRequired { get; set; }
        public Dictionary<string, int> TechniquesUsed { get; set; }

        public SolvabilityResult()
        {
            IsSolvable = false;
            Difficulty = Difficulty.BrainTerror;  // Default για unsolvable
            StepsRequired = 0;
            TechniquesUsed = new Dictionary<string, int>();
        }
    }
}
