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


        // -- END POINTS -- 

        // get /api/game/start
        [HttpGet("start")]
        public ActionResult<StartResponse> StartGame([FromQuery] string difficulty = )
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

                    // Create Classic puzzle if not not already
                    if(difficulty == "Classic" && _classicPuzzle == null)
                    {
                        var generator = new PuzzleGenerator(todaySeed);
                        var classicCube = generator.GenerateLogicallySolvablePuzzle(
                            Difficulty.Classic,
                            out int clueCount,
                            out var solvability
                        );
                        _classicPuzzle = ConvertToStartResponse(classicCube);
                    }

                    // Create BrainTerror puzzle if not not already
                    if(difficulty == "BrainTerror" && _brainterrorPuzzle == null)
                    {
                        var generatoe = new PuzzleGenerator(todaySeed);
                        var brainterrorCube = generator.GenerateLogicallySolvablePuzzle(
                            Difficulty.BrainTerror,
                            out int clueCount,
                            out var solvability
                        );
                        _brainterrorPuzzle = ConvertToStartResponse(brainterrorCube);
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
        
        // 📌 Endpoint 2: Validation κίνησης
        [HttpPost("move")]             // ← POST /api/game/move
        public ActionResult<MoveResponse> ValidateMove([FromBody] MoveRequest request)
        {
            // Θα το φτιάξουμε μετά...
            return Ok(new MoveResponse());
        }
        
        // ========== HELPER METHODS ==========
        // (Βοηθητικές μέθοδοι εδώ)
    }
}