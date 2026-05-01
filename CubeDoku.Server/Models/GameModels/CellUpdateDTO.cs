// CellUpdateDTO.cs
// DTO for a cell update response from the server after a move
//
// This contains more info than CellDTO because it includes the cell's visual STATE
// (Default/Error/Completed) which is computed server-side by the checker.
// The client updates the cube rendering based on this state.
//
// I could have merged CellDTO and CellUpdateDTO into one class but they serve different purposes:
// CellDTO = locked clues (initial puzzle), CellUpdateDTO = state after player moves

namespace CubeDoku.Server.Models
{
    public class CellUpdateDTO
    {
        public string Face { get; set; }
        public int Row { get; set;}
        public int Column { get; set; }
        public string State { get; set; } // "Default", "Error", or "Completed"
        public int Value { get; set; }    // the number in this cell (0 = empty but that shouldn't happen here)
    }
}