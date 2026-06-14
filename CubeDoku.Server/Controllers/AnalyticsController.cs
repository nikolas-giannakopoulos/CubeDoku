using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CubeDoku.Server.Data;

namespace CubeDoku.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/analytics/metrics
        // Pulls aggregated gameplay statistics and correlations
        [HttpGet("metrics")]
        public async Task<IActionResult> GetMetrics()
        {
            var results = await db.GameResults.ToListAsync();
            if (results.Count == 0)
            {
                return Ok(new
                {
                    TotalGames = 0,
                    Classic = new { Games = 0, AvgTime = 0.0, AvgMistakes = 0.0, AvgHints = 0.0 },
                    BrainTerror = new { Games = 0, AvgTime = 0.0, AvgMistakes = 0.0, AvgHints = 0.0 },
                    ScatterData = new List<object>()
                });
            }

            var classic = results.Where(r => r.Difficulty == "Classic").ToList();
            var brainTerror = results.Where(r => r.Difficulty == "BrainTerror").ToList();

            var scatter = results.Select(r => new
            {
                x = r.DurationSeconds,
                y = r.Mistakes,
                difficulty = r.Difficulty
            }).ToList();

            return Ok(new
            {
                TotalGames = results.Count,
                Classic = new
                {
                    Games = classic.Count,
                    AvgTime = classic.Any() ? Math.Round(classic.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes = classic.Any() ? Math.Round(classic.Average(r => r.Mistakes), 1) : 0,
                    AvgHints = classic.Any() ? Math.Round(classic.Average(r => r.HintsUsed), 1) : 0
                },
                BrainTerror = new
                {
                    Games = brainTerror.Count,
                    AvgTime = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.Mistakes), 1) : 0,
                    AvgHints = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.HintsUsed), 1) : 0
                },
                ScatterData = scatter
            });
        }

        // GET /api/analytics/audit
        // Returns basic gameplay audit rows for study
        [HttpGet("audit")]
        public async Task<IActionResult> GetAuditLogs()
        {
            var logs = await db.GameResults
                .Include(r => r.User)
                .OrderByDescending(r => r.CompletedAt)
                .Take(100)
                .Select(r => new
                {
                    r.Id,
                    Username = r.User != null ? r.User.Username : "Guest",
                    r.Difficulty,
                    r.PuzzleDate,
                    r.Score,
                    r.DurationSeconds,
                    r.Mistakes,
                    r.HintsUsed,
                    CompletedAt = r.CompletedAt.ToString("yyyy-MM-dd HH:mm:ss")
                })
                .ToListAsync();

            return Ok(logs);
        }

    }
}

