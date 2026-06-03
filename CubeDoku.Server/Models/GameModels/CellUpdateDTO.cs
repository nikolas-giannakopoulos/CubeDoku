// DTO for a cell update response from the server after a move

namespace CubeDoku.Server.Models
{
    public class CellUpdateDTO
    {
        public string Face { get; set; }
        public int Row { get; set; }
        public int Column { get; set; }
        public string State { get; set; } // "Default", "Error"
        public int Value { get; set; }    // 1-9
    }
}