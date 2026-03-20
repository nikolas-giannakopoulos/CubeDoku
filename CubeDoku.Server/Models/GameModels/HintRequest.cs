namespace CubeDoku.Server.Models
{
    public class HintRequest
    {
        public int[] CurrentState { get; set; } = [];
        public bool[]? LockedState { get; set; }
    }
}
