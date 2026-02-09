using ThreeDSudoku.Server.Core;
using ThreeDSudoku.Server.Models;

namespace ThreeDSudoku.Server.Services
{
    public class GameService : IGameService
    {
        private Cube _cube;
        private Solver _solver;
        private HashSet<string> _lockedCells;
        private Checkers _checker;
        
        public GameService()
        {
            _cube = new Cube(); 
            _solver = new Solver(DateTime.Now.GetHashCode());
            _checker = new Checkers();
            _lockedCells = new HashSet<string>();
        }
        
        public GameStateDTO CreateNewGame()
        {
            // Generate daily solution
            _solver.run(_cube);
            
            // 2. Remove cells to create puzzle
            RemoveCells(40); // Remove 40 cells
            
            // 3. Return initial state
            return ConvertCubeToDto();
        }
        
        public MoveResponse ProcessMove(MoveRequest request)
        {
            // 1. Parse cellId
            var position = ParseCellId(request.CellId);
            var cell = _cube.GetCell(position);
            
            // 2. Set number
            cell.setNumber(request.Value);
            
            // 3. Validate
            int flag = 0;

            if(!_checkers.CheckFace()){
                
            }

            if (!_solver.Checker(cell, _cube))
            {
                cell.setNumber(0);
                return new MoveResponse 
                { 
                    IsValid = false, 
                    Message = "Invalid move" 
                };
            }
            
            // 4. Check completed lines
            var completedLines = CheckCompletedLines();
            
            return new MoveResponse 
            { 
                IsValid = true, 
                CompletedLines = completedLines 
            };
        }
        
        public List<string> CheckCompletedLines()
        {
            // Logic to find rows/cols that sum to 12
            // Returns ["Front_Row_0", "Left_Col_2"]
        }
        
        private CellPosition ParseCellId(string cellId)
        {
            // "Front_1_2" → CellPosition(Front, 1, 2)
        }
        
        private GameStateDTO ConvertCubeToDto()
        {
            // Convert Cube → GameStateDto
        }
        
        private void RemoveCells(int count)
        {
            // Randomly remove cells while keeping puzzle solvable
        }
    }
}