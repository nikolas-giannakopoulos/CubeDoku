using Microsoft.AspNetCore.Mvc;
using CubeDoku.Server.Core;
using CubeDoku.Server.Models;

namespace CubeDoku.Server.Controllers
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
        // Full solutions (all 54 cells) — used by the DEV auto-solve endpoint
        private static List<CellDTO>? _classicSolution = null;
        private static List<CellDTO>? _brainterrorSolution = null;
        // Today's Seed
        private static int _cachedPuzzleDay = 0;

        // GET /api/game/start
        [HttpGet("start")]
        public ActionResult<StartResponse> StartGame([FromQuery] string difficulty = "Classic")
        {
            try
            {
                var todayDate = DateTime.UtcNow.Date;
                int todaySeed = todayDate.Year * 10000 + todayDate.Month * 100 + todayDate.Day;

                lock (_lock)
                {
                    // Cache reset on day change
                    if (_cachedPuzzleDay != todaySeed)
                    {
                        _classicPuzzle = null;
                        _brainterrorPuzzle = null;
                        _classicSolution = null;
                        _brainterrorSolution = null;
                        _cachedPuzzleDay = todaySeed;
                    }

                    if (difficulty == "Classic" && _classicPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var result = generator.GeneratePuzzle(Difficulty.Classic);
                        _classicPuzzle = ConvertToStartResponse(result.Puzzle, "Classic", result.Steps);
                        _classicSolution = SolvePuzzleToFull(result.Puzzle, todaySeed);
                    }

                    if (difficulty == "BrainTerror" && _brainterrorPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var result = generator.GeneratePuzzle(Difficulty.BrainTerror);
                        _brainterrorPuzzle = ConvertToStartResponse(result.Puzzle, "BrainTerror", result.Steps);
                        _brainterrorSolution = SolvePuzzleToFull(result.Puzzle, todaySeed);
                    }

                    var response = difficulty == "Classic" ? _classicPuzzle : _brainterrorPuzzle;
                    return Ok(response);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        // GET /api/game/solution  — DEV ONLY: returns all 54 solution cells
        [HttpGet("solution")]
        public ActionResult<List<CellDTO>> GetSolution([FromQuery] string difficulty = "Classic")
        {
            lock (_lock)
            {
                var solution = difficulty == "Classic" ? _classicSolution : _brainterrorSolution;
                if (solution == null)
                    return BadRequest("No puzzle generated yet. Call /api/game/start first.");
                return Ok(solution);
            }
        }
        
        // POST /api/game/revert — re-validates a full board state (used by undo)
        [HttpPost("revert")]
        public ActionResult<MoveResponse> RevertBoard([FromBody] RevertRequest request)
        {
            try
            {
                Cube cube = new Cube();
                int[] values = request.CurrentState;
                int counter = 0;
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            cube.getCell(new CellPosition(face, row, column)).setNumber(values[counter]);
                            counter++;
                        }
                    }
                }

                // Run IndividualChecker for every non-empty cell to compute final states
                var checker = new Checkers();
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            var cell = cube.getCell(new CellPosition(face, row, column));
                            if (cell.getNumber() != 0)
                                checker.IndividualChecker(cell, cube);
                        }
                    }
                }

                // Collect all non-empty cells with their final computed states
                var allCells = new List<Cell>();
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            var cell = cube.getCell(new CellPosition(face, row, column));
                            if (cell.getNumber() != 0)
                                allCells.Add(cell);
                        }
                    }
                }

                var response = ConvertToMoveResponse(allCells, cube);
                response.IsSolved = false; // cannot be solved after undo
                return Ok(response);
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

                if (request.LockedState != null && request.LockedState.Length == 54)
                {
                    int targetIndex = GetCellIndex(targetFace, request.Row, request.Column);
                    if (request.LockedState[targetIndex])
                    {
                        return BadRequest("Cannot modify locked clue cell.");
                    }
                }

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

        // POST /api/game/hint
        [HttpPost("hint")]
        public ActionResult<HintResponse> GetHint([FromBody] HintRequest request)
        {
            try
            {
                if (request.CurrentState == null || request.CurrentState.Length != 54)
                    return BadRequest("CurrentState must contain exactly 54 values.");

                Cube cube = new Cube();
                int counter = 0;
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            var cell = cube.getCell(new CellPosition(face, row, column));
                            cell.setNumber(request.CurrentState[counter]);
                            counter++;
                        }
                    }
                }

                var solver = new LogicalSolver(cube);
                var result = solver.Solve();

                // LogicalSolver mutates the working cube while solving, so cell emptiness
                // must be checked against the original request state, not the solved cube.
                var nextStep = result.Steps.FirstOrDefault(step =>
                {
                    int idx = GetCellIndex(step.Position.face, step.Position.row, step.Position.column);
                    if (idx < 0 || idx >= request.CurrentState.Length) return false;
                    return request.CurrentState[idx] == 0;
                });

                if (nextStep == null)
                    return BadRequest("No logical hint is available for the current board state.");

                if (request.LockedState != null && request.LockedState.Length == 54)
                {
                    int idx = GetCellIndex(nextStep.Position.face, nextStep.Position.row, nextStep.Position.column);
                    if (request.LockedState[idx])
                        return BadRequest("Hint points to a locked clue. Please try again.");
                }

                return Ok(new HintResponse
                {
                    Face = nextStep.Position.face.ToString(),
                    Row = nextStep.Position.row,
                    Column = nextStep.Position.column,
                    Value = nextStep.Value,
                    Reason = nextStep.Reason
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        private int GetCellIndex(CubeFaces face, int row, int column)
        {
            return ((int)face * 9) + (row * 3) + column;
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
            return new StartResponse
            {
                GameId = 5,
                LockedCells = lockedCells,
                LogicalSteps = steps
            };
        }

        /// <summary>
        /// Clones the puzzle cube, solves it completely, and returns all 54 cells.
        /// Used to pre-cache the full solution for the DEV auto-solve endpoint.
        /// </summary>
        private List<CellDTO> SolvePuzzleToFull(Cube puzzleCube, int seed)
        {
            // Work on a fresh clone so we never mutate the cached puzzle
            Cube solveCube = new Cube();
            foreach (var face in Enum.GetValues<CubeFaces>())
                for (int r = 0; r < 3; r++)
                    for (int c = 0; c < 3; c++)
                    {
                        var pos = new CellPosition(face, r, c);
                        solveCube.getCell(pos).setNumber(puzzleCube.getCell(pos).getNumber());
                    }

            var solver = new Solver(seed);
            solver.run(solveCube);   // fills all empty cells

            var result = new List<CellDTO>();
            foreach (var face in Enum.GetValues<CubeFaces>())
                for (int r = 0; r < 3; r++)
                    for (int c = 0; c < 3; c++)
                        result.Add(new CellDTO
                        {
                            Face = face.ToString(),
                            Row = r,
                            Column = c,
                            Value = solveCube.getCell(new CellPosition(face, r, c)).getNumber()
                        });

            return result;
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