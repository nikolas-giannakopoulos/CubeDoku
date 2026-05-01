// RevertRequest.cs
// Sent by the client when the player uses undo
//
// Contains the FULL board state AFTER the undo has been applied client-side
// The server re-validates the whole board and sends back updated cell states
// (because undoing a move might clear error states that existed before)
//
// Note: the undo logic itself happens on the client - the server just re-validates
// whatever board state the client sends. This is simpler than having the server
// track move history.

namespace CubeDoku.Server.Models
{
    public class RevertRequest
    {
        // 54-element flat array of the board state after undo has been applied
        // same layout as MoveRequest.CurrentState
        public int[] CurrentState { get; set; }
    }
}

