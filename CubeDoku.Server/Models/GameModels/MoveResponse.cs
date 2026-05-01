// MoveResponse.cs
// Returned by POST /api/game/move and POST /api/game/revert
//
// updatedCells: only the cells that changed state (not all 54)
//   the client applies these updates to its local board state
//   keeping this list small is an optimization to avoid re-rendering unchanged cells
//
// IsSolved: true when ALL 54 cells are filled AND none are in Error state
//   the client checks this after each move to trigger the completion screen

namespace CubeDoku.Server.Models
{
    public class MoveResponse
    {
        public List<CellUpdateDTO> updatedCells { get; set; }   // lowercase property name intentional (matched frontend early on)
        public bool IsSolved { get; set; }
    }
}