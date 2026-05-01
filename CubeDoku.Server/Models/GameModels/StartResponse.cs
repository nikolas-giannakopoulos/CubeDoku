// StartResponse.cs
// What the server sends back when the game starts (GET /api/game/start)
//
// LockedCells: the pre-filled "given" cells that the player cannot modify
//   - these have values 1-9 and the client marks them as locked in its internal state
//
// LogicalSteps: the step-by-step logical solution to the puzzle
//   - these are used by the hint system to give meaningful hints to the player
//   - the client doesn't show all steps at once, just uses them on demand
//
// GameId is always 5 right now because puzzles are daily (everyone plays the same puzzle)
// I was planning to use this for session tracking but never got around to it
// TODO: either use this properly or remove it before submission

namespace CubeDoku.Server.Models
{
    public class StartResponse
    {
        public int GameId { get; set; }

        // the cells that are pre-filled (given clues for this puzzle)
        public List<CellDTO> LockedCells { get; set; }

        // the logical solving steps - used by hint system
        public List<Core.LogicalStep> LogicalSteps { get; set; } 
    }
}