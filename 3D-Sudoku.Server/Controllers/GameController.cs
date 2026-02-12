using Microsoft.AspNetCore.Mvc;
using ThreeDSudoku.Server.Core;
using ThreeDSudoku.Server.Models;

namespace ThreeDSudoku.Server.Controllers
{
    [ApiController]              
    [Route("api/[controller]")]    
    public class GameController : ControllerBase
    {

        // Thread Lock
        private static readonly object _lock = new object(); 
        // Daily puzzles
        private static StartResponse? _classicPuzzle = null;
        private static StartResponse? _brainterrorPuzzle = null;
        // Today's Seed
        private static int _cachedPuzzleDay = 0;

        // get /api/game/start
        [HttpGet("start")]
        public ActionResult<StartResponse> StartGame([FromQuery] string difficulty = "Classic")
        {
            try
            {
                var todayDate = DateTime.UtcNow.Date;
                // 09-02-2026 -> 20260209
                int todaySeed = todayDate.Year * 10000 + todayDate.Month * 100 + todayDate.Day;

                // 1 request per time
                lock(_lock)
                {
                    // Cache reset on day change
                    if(_cachedPuzzleDay != todaySeed)
                    {
                        _classicPuzzle = null;
                        _brainterrorPuzzle = null;
                        _cachedPuzzleDay = todaySeed;
                    }

                    if(difficulty == "Classic" && _classicPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var result = generator.GeneratePuzzle(Difficulty.Classic);
                        _classicPuzzle = ConvertToStartResponse(result.Puzzle, "Classic", result.Steps);
                    }

                    if(difficulty == "BrainTerror" && _brainterrorPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var result = generator.GeneratePuzzle(Difficulty.BrainTerror);
                        _brainterrorPuzzle = ConvertToStartResponse(result.Puzzle, "BrainTerror", result.Steps);
                    }

                    var response = difficulty == "Classic" ? _classicPuzzle : _brainterrorPuzzle ;
                    return Ok(response);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }
        
        // get /api/game/move
        [HttpPost("move")]
        public ActionResult<MoveResponse> ValidateMove([FromBody] MoveRequest request)
        {
            try
         
            {
                Cube cube = new Cube();
                int[] values = request.CurrentState;
                int counter = 0;
                foreach(var face in Enum.GetValues<CubeFaces>())
                {
                    for(int row = 0; row < 3; row++)
                    {
                        for(int column = 0; column < 3; column++)
                        {
                            var cell = cube.getCell(new CellPosition(face, row, column));
                            cell.setNumber(values[counter]);
                            counter++;
                        }
                    }
                }

                var checker = new Checkers();
                string faceString = request.Face;
                CubeFaces targetFace = Enum.Parse<CubeFaces>(faceString);
                Cell newCell = cube.getCell(new CellPosition(targetFace, request.Row, request.Column));
                newCell.setNumber(request.Value);
                List<Cell> updatedCells = checker.IndividualChecker(newCell, cube);

                // Ensure the modified cell is always returned, even if valid and not completing anything
                if (!updatedCells.Contains(newCell))
                {
                    updatedCells.Add(newCell);
                }

                var response = ConvertToMoveResponse(updatedCells, cube);
                return Ok(response);
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }
        
        // Converting lockedCells from 'Cells' to 'JSON'
        private StartResponse ConvertToStartResponse(Cube cube, string difficulty, List<LogicalStep> steps)
        {
            var lockedCells = new List<CellDTO>();

            foreach(var face in Enum.GetValues<CubeFaces>())
            {
                for(int row = 0; row < 3; row++)
                {
                    for(int column = 0; column < 3; column++)
                    {
                        var tempPosition = new CellPosition(face, row, column);
                        var tempCell = cube.getCell(tempPosition);
                        // If not empty
                        if(tempCell.getNumber() != 0)
                        {
                            var lockedCell = new CellDTO
                            {
                                Face = face.ToString(),
                                Row = row,
                                Column = column,
                                Value = tempCell.getNumber()
                            };
                            lockedCells.Add(lockedCell);
                        }
                    }
                }
            }
            var gameId = $"{DateTime.UtcNow:yyyyMMdd}_{difficulty}_{Guid.NewGuid():N}";
            return new StartResponse
            {
                //GameId = gameId,
                GameId = 5,
                LockedCells = lockedCells,
                LogicalSteps = steps
            };
        }

        private MoveResponse ConvertToMoveResponse(List<Cell> list, Cube cube)
        {
            var updatedCells = new List<CellUpdateDTO>();

            foreach(var cell in list)
            {
                var cellDTO = new CellUpdateDTO
                {
                    Face = cell.getPosition().face.ToString(),
                    Row = cell.getPosition().row,
                    Column = cell.getPosition().column,
                    State = cell.getColor().ToString(),
                    Value = cell.getNumber()
                };
                updatedCells.Add(cellDTO);
            }
            // var gameId = $"{DateTime.UtcNow:yyyyMMdd}_{difficulty}_{Guid.NewGuid():N}";
            return new MoveResponse
            {
                updatedCells = updatedCells,
                IsSolved = CheckIfSolved(cube)
            };
        }

        private bool CheckIfSolved(Cube cube)
        {
            foreach(var face in Enum.GetValues<CubeFaces>())
            {
                for(int row = 0; row < 3; row++)
                {
                    for(int column = 0; column < 3; column++)
                    {
                        var tempCell = cube.getCell(new CellPosition(face, row, column));
                        if(tempCell.getNumber() == 0 || tempCell.getColor() == CellState.Error)
                        {
                            return false;
                        }
                    }
                }
            }
            return true;
        }
    }
}