namespace ThreeDSudoku.Server.Models
{
    public class CellUpdateDTO
    {
        public string Face { get; set; }
        public int Row { get; set;}
        public int Column { get; set; }
        public string State { get; set; } // Default, Error, Completed
        public int Value { get; set; }
    }
}