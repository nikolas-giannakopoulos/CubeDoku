// Sent by the client when the player uses undo

namespace CubeDoku.Server.Models
{
    public class RevertRequest
    {
        // 54-element flat array of the board state after undo has been applied
        // same layout as MoveRequest.CurrentState
        public int[] CurrentState { get; set; }
    }
}

