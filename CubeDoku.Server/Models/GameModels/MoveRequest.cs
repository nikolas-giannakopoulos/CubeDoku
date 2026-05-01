// MoveRequest.cs
// Sent by the client when the player places a number in a cell
//
// The request includes the FULL board state (not just the single cell change)
// because the server needs to rebuild the entire cube to validate constraints
// The server is stateless - it doesn't remember what moves were made before
//
// I thought about making the server stateful (keeping game state in memory) but
// that would complicate multi-tab support and server restarts. Stateless is simpler.
//
// LockedState is included so the server can double-check that the client isn't
// trying to modify a cell that should be locked (defense in depth against cheating)

using System.ComponentModel.DataAnnotations;

namespace CubeDoku.Server.Models
{
    public class MoveRequest
    {
        // face string: must be one of the 6 valid face names
        // using regex to validate here instead of trying to catch enum parse errors in the controller
        [Required]
        [RegularExpression("^(Front|Back|Left|Right|Top|Bottom)$",
            ErrorMessage = "Face must be one of: Front, Back, Left, Right, Top, Bottom.")]
        public string Face { get; set; } = string.Empty;

        [Range(0, 2, ErrorMessage = "Row must be 0, 1, or 2.")]
        public int Row { get; set; }

        [Range(0, 2, ErrorMessage = "Column must be 0, 1, or 2.")]
        public int Column { get; set; }

        // 0 = erase cell content, 1-9 = valid sudoku number
        [Range(0, 9, ErrorMessage = "Value must be between 0 and 9.")]
        public int Value { get; set; }

        // all 54 cell values representing the current board state
        // indices go: face0-row0-col0, face0-row0-col1, ..., face5-row2-col2
        [Required]
        [MinLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "CurrentState must contain exactly 54 values.")]
        public int[] CurrentState { get; set; } = [];

        // which of the 54 cells are original clues (true = locked, cannot be modified)
        [MinLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        [MaxLength(54, ErrorMessage = "LockedState must contain exactly 54 values.")]
        public bool[]? LockedState { get; set; }
    }
}