// GameController.cs
// Main game API - handles starting puzzles, validating moves, undos, and hints
//
// Design decision: the server is STATELESS for game logic. Each request includes the
// full board state so the server doesn't need to remember what happened before.
// This makes it easier to support multiple tabs and avoids session management complexity.
//
// The one exception is puzzle caching: we generate the daily puzzle once and cache it
// in static fields. Generating a puzzle takes a few seconds (due to the backtracking solver)
// so we don't want to do it on every request. The cache resets at midnight UTC.
//
// Thread safety: the static fields are protected by a lock because multiple requests
// might come in simultaneously (e.g. two players starting a game at the same time).
// I looked up how to do this properly - Monitor/lock is the right approach here.
//
// Note to self: the GameId in StartResponse is hardcoded to 5. I planned to use this
// for session tracking but never implemented it. Should either implement or remove before
// final submission. Mentioned this to my supervisor and he said it's fine as-is for the demo.

using Microsoft.AspNetCore.Mvc;
using CubeDoku.Server.Core;
using CubeDoku.Server.Models;

namespace CubeDoku.Server.Controllers
{
    [ApiController]              
    [Route("api/[controller]")]    
    public class GameController(IWebHostEnvironment env) : ControllerBase
    {

        // static lock to prevent race conditions when multiple requests try to generate puzzles simultaneously
        private static readonly object _lock = new object();

        // cached daily puzzles - null until first request triggers generation
        private static StartResponse? _classicPuzzle = null;
        private static StartResponse? _brainterrorPuzzle = null;

        // cached full solutions (all 54 cells) - only accessible in development via /api/game/solution
        private static List<CellDTO>? _classicSolution = null;
        private static List<CellDTO>? _brainterrorSolution = null;

        // which day's puzzle is currently cached (as a YYYYMMDD int)
        // when the day changes, we clear the cache and generate new puzzles
        private static int _cachedPuzzleDay = 0;

        // GET /api/game/start?difficulty=Classic|BrainTerror
        // Returns the puzzle for today - either Classic or BrainTerror difficulty
        // Generates and caches it on first call, returns cached version afterwards
        [HttpGet("start")]
        public ActionResult<StartResponse> StartGame([FromQuery] string difficulty = "Classic")
        {
            try
            {
                var todayDate = DateTime.UtcNow.Date;
                // seed is just the date as YYYYMMDD - makes daily puzzle reproducible
                int todaySeed = todayDate.Year * 10000 + todayDate.Month * 100 + todayDate.Day;

                lock (_lock)
                {
                    // reset cache if the day has changed
                    if (_cachedPuzzleDay != todaySeed)
                    {
                        _classicPuzzle = null;
                        _brainterrorPuzzle = null;
                        _classicSolution = null;
                        _brainterrorSolution = null;
                        _cachedPuzzleDay = todaySeed;
                    }

                    // generate Classic puzzle if not cached yet
                    if (difficulty == "Classic" && _classicPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var result = generator.GeneratePuzzle(Difficulty.Classic);
                        _classicPuzzle = ConvertToStartResponse(result.Puzzle, "Classic", result.Steps);
                        _classicSolution = SolvePuzzleToFull(result.Puzzle, todaySeed);
                    }

                    // generate BrainTerror puzzle if not cached yet
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
                // never show internal error details in production - could leak solver logic or seed
                var detail = env.IsDevelopment() ? ex.Message : "An unexpected error occurred.";
                return StatusCode(500, detail);
            }
        }

        // GET /api/game/solution?difficulty=Classic|BrainTerror
        // DEV ONLY: returns the full solved puzzle (all 54 cells)
        // This was incredibly useful during development for debugging the frontend rendering
        // Blocked in production - returns 404 so it doesn't exist from the outside
        [HttpGet("solution")]
        public ActionResult<List<CellDTO>> GetSolution([FromQuery] string difficulty = "Classic")
        {
            if (!env.IsDevelopment())
                return NotFound();

            lock (_lock)
            {
                var solution = difficulty == "Classic" ? _classicSolution : _brainterrorSolution;
                if (solution == null)
                    return BadRequest("No puzzle generated yet. Call /api/game/start first.");
                return Ok(solution);
            }
        }
        
        // POST /api/game/revert
        // Called when the player uses undo - re-validates the whole board after undo
        // The client already handles the undo logic, this just recomputes the error/completion states
        [HttpPost("revert")]
        public ActionResult<MoveResponse> RevertBoard([FromBody] RevertRequest request)
        {
            try
            {
                // rebuild the cube from the flat array
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

                // run IndividualChecker for every non-empty cell to compute cell states
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

                // collect all non-empty cells with their final computed states
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
                response.IsSolved = false; // can't be solved after undo (you removed a correct answer)
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        // POST /api/game/move
        // Called every time the player places a number (or erases one)
        // Validates the entire board and returns the updated cell states
        [HttpPost("move")]
        public ActionResult<MoveResponse> ValidateMove([FromBody] MoveRequest request)
        {
            try
         
            {
                // reconstruct the cube from the flat array sent by the client
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

                // server-side lock check - reject if the client is trying to modify a clue cell
                // the client should prevent this too but we double-check here as a safeguard
                if (request.LockedState != null && request.LockedState.Length == 54)
                {
                    int targetIndex = GetCellIndex(targetFace, request.Row, request.Column);
                    if (request.LockedState[targetIndex])
                    {
                        return BadRequest("Cannot modify locked clue cell.");
                    }
                }

                // apply the new value to the target cell
                Cell newCell = cube.getCell(new CellPosition(targetFace, request.Row, request.Column));
                newCell.setNumber(request.Value);

                // validate the cell that was just changed and its neighbors (edge/corner partners, same face)
                List<Cell> updatedCells = checker.IndividualChecker(newCell, cube);

                // make sure the cell we just changed is always in the response
                // (even if it's not in error and nothing "changed" visually)
                if (!updatedCells.Contains(newCell))
                {
                    updatedCells.Add(newCell);
                }

                // re-validate ALL other filled cells across the whole board
                // this is needed so that CheckIfSolved can detect errors that existed before this move
                // without this, old errors in other cells would be invisible and IsSolved would return true prematurely
                // (had a very nasty bug here during testing because of this)
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            var cell = cube.getCell(new CellPosition(face, row, column));
                            if (cell.getNumber() != 0 && cell != newCell)
                            {
                                checker.IndividualChecker(cell, cube);
                            }
                        }
                    }
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
        // Returns the next logical hint for the current board state
        //
        // The hint logic has two phases:
        //   1. If any player-placed number is WRONG: correct it first (higher priority)
        //   2. Otherwise: reveal the next step from the logical solution
        //
        // We derive the correct solution by taking only the locked cells and solving from scratch.
        // This means hints work even if the player has placed some wrong numbers.
        [HttpPost("hint")]
        public ActionResult<HintResponse> GetHint([FromBody] HintRequest request)
        {
            try
            {
                if (request.CurrentState == null || request.CurrentState.Length != 54)
                    return BadRequest("CurrentState must contain exactly 54 values.");

                // build a cube with ONLY the locked (given) cells, then solve it to get the correct solution
                Cube baseCube = new Cube();
                int idx = 0;
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            if (request.LockedState != null && request.LockedState[idx])
                            {
                                baseCube.getCell(new CellPosition(face, row, column)).setNumber(request.CurrentState[idx]);
                            }
                            idx++;
                        }
                    }
                }

                // solve from the locked state to get the definitive correct answer
                // using a fixed seed (12345) for consistency - same puzzle always has same solution
                var solutionSolver = new Solver(12345);
                solutionSolver.run(baseCube);

                // phase 1: check if the player has any wrong numbers placed
                idx = 0;
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            int currentVal = request.CurrentState[idx];
                            if (currentVal != 0 && request.LockedState != null && !request.LockedState[idx])
                            {
                                int correctVal = baseCube.getCell(new CellPosition(face, row, column)).getNumber();
                                if (currentVal != correctVal)
                                {
                                    // found a wrong number - hint corrects it first
                                    return Ok(new HintResponse
                                    {
                                        Face = face.ToString(),
                                        Row = row,
                                        Column = column,
                                        Value = correctVal,
                                        Reason = "Corrected a wrongly placed number."
                                    });
                                }
                            }
                            idx++;
                        }
                    }
                }

                // phase 2: no wrong numbers - reveal the next logical step
                // run the LogicalSolver on the current (correct) board state
                Cube currentCube = new Cube();
                idx = 0;
                foreach (var face in Enum.GetValues<CubeFaces>())
                {
                    for (int row = 0; row < 3; row++)
                    {
                        for (int column = 0; column < 3; column++)
                        {
                            currentCube.getCell(new CellPosition(face, row, column)).setNumber(request.CurrentState[idx]);      
                            idx++;
                        }
                    }
                }

                var solver = new LogicalSolver(currentCube);
                var result = solver.Solve();

                // find the first step that applies to a cell the player hasn't filled yet
                // (the LogicalSolver mutates currentCube while solving, so we check against
                //  the ORIGINAL request state to find truly empty cells)
                var nextStep = result.Steps.FirstOrDefault(step =>
                {
                    int stepIdx = GetCellIndex(step.Position.face, step.Position.row, step.Position.column);
                    if (stepIdx < 0 || stepIdx >= request.CurrentState.Length) return false;
                    return request.CurrentState[stepIdx] == 0;
                });

                if (nextStep == null)
                {
                    // logical solver didn't find a step - fall back to just showing any empty cell from the solution
                    // this handles cases where the puzzle is partially in a state the logical solver can't handle
                    idx = 0;
                    foreach (var face in Enum.GetValues<CubeFaces>())
                    {
                        for (int row = 0; row < 3; row++)
                        {
                            for (int column = 0; column < 3; column++)
                            {
                                if (request.CurrentState[idx] == 0)
                                {
                                    return Ok(new HintResponse
                                    {
                                        Face = face.ToString(),
                                        Row = row,
                                        Column = column,
                                        Value = baseCube.getCell(new CellPosition(face, row, column)).getNumber(),
                                        Reason = "Revealed an empty cell."
                                    });
                                }
                                idx++;
                            }
                        }
                    }
                    return BadRequest("No hint is available for the current board state.");
                }

                // safety check: make sure hint doesn't point at a locked cell
                if (request.LockedState != null && request.LockedState.Length == 54)
                {
                    int stepIdx = GetCellIndex(nextStep.Position.face, nextStep.Position.row, nextStep.Position.column);
                    if (request.LockedState[stepIdx])
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

        // helper: convert face/row/col to a flat array index (0-53)
        // face 0 = indices 0-8, face 1 = indices 9-17, etc.
        private int GetCellIndex(CubeFaces face, int row, int column)
        {
            return ((int)face * 9) + (row * 3) + column;
        }
        
        // converts the puzzle cube (with only clue cells non-zero) to the StartResponse format
        // locked cells = cells with values from the generator (player can't change these)
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
                        // only include cells that have a value (non-zero = is a clue)
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
                GameId = 5,   // placeholder - see note at top of file
                LockedCells = lockedCells,
                LogicalSteps = steps
            };
        }

        // solve the puzzle fully and return all 54 cells
        // used to pre-cache the complete solution for the DEV endpoint
        // works on a fresh clone so we never touch the cached puzzle
        private List<CellDTO> SolvePuzzleToFull(Cube puzzleCube, int seed)
        {
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

        // convert a list of Cell objects to the MoveResponse DTO format
        // also computes whether the puzzle is solved (all filled, none in Error state)
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
            // ^ old code from when I was planning to use session IDs - keeping as a note
            return new MoveResponse
            {
                updatedCells = updatedCells,
                IsSolved = CheckIfSolved(cube)
            };
        }

        // puzzle is solved when ALL 54 cells have a non-zero value AND none are in Error state
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