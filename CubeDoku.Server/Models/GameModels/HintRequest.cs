// HintRequest.cs
// Sent by the client when the player requests a hint
//
// We need the FULL current board state (all 54 cells including empty ones)
// so the server can figure out:
//   1. if the player has placed any wrong numbers (and correct them first)
//   2. which logical step to reveal next (from the logical solution)
//
// LockedState tells us which cells are original clues vs player-placed
// This matters because we need to distinguish "player placed 0" (empty) vs "clue was 0" (impossible)

using System.ComponentModel.DataAnnotations;

namespace CubeDoku.Server.Models
{
    public class HintRequest
    {
        // full board state: 54 ints, 0 = empty, 1-9 = placed number
        [Required]
        [MinLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        public int[] CurrentState { get; set; } = [];

        // which cells are original puzzle clues (true = locked, player can't modify)
        // if null, assume no locked cells (shouldn't happen in practice but handle gracefully)
        [MinLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        public bool[]? LockedState { get; set; }
    }
}

