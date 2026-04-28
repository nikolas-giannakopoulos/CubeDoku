using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CubeDoku.Server.Data;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController(ApplicationDbContext db) : ControllerBase
{
    private sealed class LeaderboardRowDto
    {
        public int Rank { get; set; }
        public string Username { get; set; } = string.Empty;
        public int Score { get; set; }
        public int DurationSeconds { get; set; }
        public int Mistakes { get; set; }
        public bool IsPlayer { get; set; }
    }

    private sealed class RankedResult
    {
        public int Rank { get; set; }
        public int StartRank { get; set; }
        public int TotalPlayers { get; set; }
        public List<LeaderboardRowDto> NearbyRows { get; set; } = [];
    }

    private async Task<List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes)>>
        GetPuzzleLeaderboardRows(string difficulty, DateOnly puzzleDate)
    {
        return await db.GameResults
            .Where(r => r.Difficulty == difficulty && r.PuzzleDate == puzzleDate)
            .Include(r => r.User)
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.DurationSeconds)
            .ThenBy(r => r.CompletedAt)
            .Select(r => new ValueTuple<Guid, string, int, int, int>(
                r.Id,
                r.User.Username,
                r.Score,
                r.DurationSeconds,
                r.Mistakes))
            .ToListAsync();
    }

    private RankedResult BuildRankedResult(
        List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes)> rows,
        Guid playerResultId,
        string playerName)
    {
        var rank = rows.FindIndex(r => r.Id == playerResultId) + 1;
        if (rank <= 0) rank = rows.Count;

        // Start one spot below when possible to show the "climb" animation.
        var startRank = rank == 1 ? Math.Min(2, Math.Max(1, rows.Count)) : rank + 1;
        if (startRank < rank) startRank = rank;

        var start = Math.Max(1, rank - 2);
        var end = Math.Min(rows.Count, rank + 2);

        var nearby = new List<LeaderboardRowDto>();
        for (var i = start; i <= end; i++)
        {
            var row = rows[i - 1];
            nearby.Add(new LeaderboardRowDto
            {
                Rank = i,
                Username = row.Id == playerResultId ? playerName : row.Username,
                Score = row.Score,
                DurationSeconds = row.DurationSeconds,
                Mistakes = row.Mistakes,
                IsPlayer = row.Id == playerResultId
            });
        }

        return new RankedResult
        {
            Rank = rank,
            StartRank = startRank,
            TotalPlayers = rows.Count,
            NearbyRows = nearby
        };
    }

    private RankedResult BuildPreviewRankedResult(
        List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes)> rows,
        PreviewRankRequest req,
        string playerName)
    {
        var betterCount = rows.Count(r =>
            r.Score > req.Score ||
            (r.Score == req.Score && r.DurationSeconds < req.DurationSeconds));

        var rank = betterCount + 1;
        var totalPlayers = rows.Count + 1;
        var startRank = rank == 1 ? 2 : rank + 1;
        if (startRank > totalPlayers) startRank = totalPlayers;

        var stitched = new List<LeaderboardRowDto>();
        var inserted = false;
        var currentRank = 1;

        foreach (var row in rows)
        {
            if (!inserted && currentRank == rank)
            {
                stitched.Add(new LeaderboardRowDto
                {
                    Rank = currentRank,
                    Username = playerName,
                    Score = req.Score,
                    DurationSeconds = req.DurationSeconds,
                    Mistakes = req.Mistakes,
                    IsPlayer = true
                });
                inserted = true;
                currentRank++;
            }

            stitched.Add(new LeaderboardRowDto
            {
                Rank = currentRank,
                Username = row.Username,
                Score = row.Score,
                DurationSeconds = row.DurationSeconds,
                Mistakes = row.Mistakes,
                IsPlayer = false
            });
            currentRank++;
        }

        if (!inserted)
        {
            stitched.Add(new LeaderboardRowDto
            {
                Rank = currentRank,
                Username = playerName,
                Score = req.Score,
                DurationSeconds = req.DurationSeconds,
                Mistakes = req.Mistakes,
                IsPlayer = true
            });
        }

        var start = Math.Max(1, rank - 2);
        var end = Math.Min(stitched.Count, rank + 2);

        return new RankedResult
        {
            Rank = rank,
            StartRank = startRank,
            TotalPlayers = totalPlayers,
            NearbyRows = stitched.Where(r => r.Rank >= start && r.Rank <= end).ToList()
        };
    }

    // POST /api/user/complete
    [HttpPost("complete")]
    [Authorize]
    public async Task<IActionResult> CompleteGame([FromBody] CompleteGameRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name) ?? "You";

        var result = new GameResult
        {
            UserId = userId,
            Difficulty = req.Difficulty,
            PuzzleDate = req.PuzzleDate,
            DurationSeconds = req.DurationSeconds,
            Mistakes = req.Mistakes,
            Score = req.Score
        };

        db.GameResults.Add(result);
        await db.SaveChangesAsync();

        var leaderboardRows = await GetPuzzleLeaderboardRows(req.Difficulty, req.PuzzleDate);
        var ranked = BuildRankedResult(leaderboardRows, result.Id, username);

        return Ok(new
        {
            Username = username,
            Score = result.Score,
            Rank = ranked.Rank,
            StartRank = ranked.StartRank,
            TotalPlayers = ranked.TotalPlayers,
            NearbyRows = ranked.NearbyRows,
            Difficulty = req.Difficulty,
            PuzzleDate = req.PuzzleDate
        });
    }

    // POST /api/user/preview-rank
    [HttpPost("preview-rank")]
    public async Task<IActionResult> PreviewRank([FromBody] PreviewRankRequest req)
    {
        var playerName = string.IsNullOrWhiteSpace(req.PlayerName) ? "Player 1" : req.PlayerName.Trim();
        var leaderboardRows = await GetPuzzleLeaderboardRows(req.Difficulty, req.PuzzleDate);
        var ranked = BuildPreviewRankedResult(leaderboardRows, req, playerName);

        return Ok(new
        {
            Rank = ranked.Rank,
            StartRank = ranked.StartRank,
            TotalPlayers = ranked.TotalPlayers,
            NearbyRows = ranked.NearbyRows,
            Difficulty = req.Difficulty,
            PuzzleDate = req.PuzzleDate
        });
    }

    // GET /api/user/stats
    [HttpGet("stats")]
    [Authorize]
    public async Task<IActionResult> GetStats()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var results = await db.GameResults
            .Where(r => r.UserId == userId)
            .ToListAsync();

        var classicResults = results.Where(r => r.Difficulty == "Classic").ToList();
        var brainTerrorResults = results.Where(r => r.Difficulty == "BrainTerror").ToList();

        return Ok(new
        {
            TotalGames = results.Count,
            Classic = new
            {
                Games = classicResults.Count,
                BestScore = classicResults.Any() ? classicResults.Max(r => r.Score) : 0,
                BestTime = classicResults.Any() ? classicResults.Min(r => r.DurationSeconds) : 0,
                TotalMistakes = classicResults.Sum(r => r.Mistakes)
            },
            BrainTerror = new
            {
                Games = brainTerrorResults.Count,
                BestScore = brainTerrorResults.Any() ? brainTerrorResults.Max(r => r.Score) : 0,
                BestTime = brainTerrorResults.Any() ? brainTerrorResults.Min(r => r.DurationSeconds) : 0,
                TotalMistakes = brainTerrorResults.Sum(r => r.Mistakes)
            },
            RecentGames = results
                .OrderByDescending(r => r.CompletedAt)
                .Take(5)
                .Select(r => new {
                    r.Difficulty,
                    r.PuzzleDate,
                    r.Score,
                    r.DurationSeconds,
                    r.Mistakes
                })
        });
    }

    // GET /api/user/today-best  — returns the current user's best time for today's puzzle (per difficulty)
    [HttpGet("today-best")]
    [Authorize]
    public async Task<IActionResult> GetTodayBest()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var todayResults = await db.GameResults
            .Where(r => r.UserId == userId && r.PuzzleDate == today)
            .ToListAsync();

        int? ClassicBest(string diff) =>
            todayResults.Where(r => r.Difficulty == diff).Any()
                ? todayResults.Where(r => r.Difficulty == diff).Min(r => r.DurationSeconds)
                : null;

        return Ok(new
        {
            Classic = ClassicBest("Classic"),
            BrainTerror = ClassicBest("BrainTerror"),
            PuzzleDate = today
        });
    }

    // GET /api/user/leaderboard?date=YYYY-MM-DD  (defaults to today UTC)
    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] string? date = null)
    {
        var puzzleDate = DateOnly.TryParse(date, out var parsed)
            ? parsed
            : DateOnly.FromDateTime(DateTime.UtcNow);

        var entries = await db.GameResults
            .Where(r => r.PuzzleDate == puzzleDate)
            .Include(r => r.User)
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.DurationSeconds)
            .ThenBy(r => r.CompletedAt)
            .Select(r => new {
                r.User.Username,
                r.Difficulty,
                r.Score,
                r.DurationSeconds,
                r.Mistakes
            })
            .ToListAsync();

        return Ok(entries);
    }
}