namespace ThreeDSudoku.Server.Models
{
    public class MoveRequest
    {
        public string Face { get; set; }
        public int Row { get; set;}
        public int Column { get; set; }
        public int Value { get; set; }
        public int[] CurrentState { get; set; } // [0, 4, 5, ..., 6]
    }
}