// Sent by the client when the player requests a hint

using System.ComponentModel.DataAnnotations;

namespace CubeDoku.Server.Models
{
    public class HintRequest
    {
        // full board state: 54 ints, 0 = empty, 1-9 
        [Required]
        [MinLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        public int[] CurrentState { get; set; } = [];

        // which cells are original puzzle clues (true = locked, player can't modify)
        [MinLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        public bool[]? LockedState { get; set; }
    }
}

