namespace CubeDoku.Server.Models
{
    public class MoveResponse
    {
        public List<CellUpdateDTO> updatedCells { get; set; }
        public bool IsSolved { get; set; }
    }
}