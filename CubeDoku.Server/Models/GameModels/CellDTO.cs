namespace CubeDoku.Server.Models
{
    public class CellDTO
    {
        public string Face { get; set; }
        public int Row { get; set;}
        public int Column { get; set; }
        public int Value { get; set; }
    }
}