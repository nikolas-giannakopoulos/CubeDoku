// StartResponse.cs

// What the server sends back when the game starts (GET /api/game/start)

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