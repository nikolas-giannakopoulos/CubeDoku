// HintResponse.cs
// What the server sends back for a hint request
//
// Tells the client exactly which cell to fill and with what value
// Reason is the human-readable explanation like "Naked Single" or "Edge 12-Sum: 12 - 7 = 5"
// The client shows the cell highlighted and the Reason in a small popup

namespace CubeDoku.Server.Models
{
    public class HintResponse
    {
        public string Face { get; set; } = string.Empty;
        public int Row { get; set; }
        public int Column { get; set; }
        public int Value { get; set; }

        // descriptive reason for the hint - makes it educational not just a reveal
        public string Reason { get; set; } = string.Empty;
    }
}

