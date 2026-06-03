// Used in the StartResponse to send the initial puzzle clues

namespace CubeDoku.Server.Models
{
    public class CellDTO
    {
        public string Face { get; set; }   // "Front", "Back", "Top", etc
        public int Row { get; set; }
        public int Column { get; set; }
        public int Value { get; set; }     // 1-9
    }
}