namespace ThreeDSudoku.Server.Models
{
    public class StartResponse
    {
        public int GameId { get; set; }
        public List<CellDTO> LockedCells { get; set; } 
    }
}