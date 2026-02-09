namespace ThreeDSudoku.Server.Services
{
    public interface IGameService
    {
        //GameStateDto CreateNewGame();
        //MoveResponse ProcessMove(MoveRequest request);
        List<string> CheckCompletedLines();
    }
}