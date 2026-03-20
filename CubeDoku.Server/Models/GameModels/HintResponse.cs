namespace CubeDoku.Server.Models
{
    public class HintResponse
    {
        public string Face { get; set; } = string.Empty;
        public int Row { get; set; }
        public int Column { get; set; }
        public int Value { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}
