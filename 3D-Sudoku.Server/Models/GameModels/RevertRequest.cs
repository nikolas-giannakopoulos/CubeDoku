namespace ThreeDSudoku.Server.Models
{
    public class RevertRequest
    {
        public int[] CurrentState { get; set; } // 54-element full board state
    }
}
