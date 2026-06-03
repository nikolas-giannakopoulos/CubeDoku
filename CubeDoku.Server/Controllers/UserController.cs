using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CubeDoku.Server.Data;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController(ApplicationDbContext db) : ControllerBase
{
    // internal DTO for leaderboard rows
    private sealed class LeaderboardRowDto
    {
        public int Rank { get; set; }
        public string Username { get; set; } = string.Empty;
        public int Score { get; set; }
        public int DurationSeconds { get; set; }
        public int Mistakes { get; set; }
        public int HintsUsed { get; set; }
        public bool IsPlayer { get; set; }   // true = highlight this row in the UI
    }

    // contains the ranked position and the nearby rows to display
    private sealed class RankedResult
    {
        public int Rank { get; set; }
        public int StartRank { get; set; }
        public int TotalPlayers { get; set; }
        public List<LeaderboardRowDto> NearbyRows { get; set; } = [];
    }

    // fetch leaderboard rows for a given difficulty and date, sorted by score then time
    private async Task<List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes, int HintsUsed)>>
        GetPuzzleLeaderboardRows(string difficulty, DateOnly puzzleDate)
    {
        return await db.GameResults
            .Where(r => r.Difficulty == difficulty && r.PuzzleDate == puzzleDate)
            .Include(r => r.User)
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.DurationSeconds)
            .ThenBy(r => r.CompletedAt)
            .Select(r => new ValueTuple<Guid, string, int, int, int, int>(
                r.Id,
                r.User.Username,
                r.Score,
                r.DurationSeconds,
                r.Mistakes,
                r.HintsUsed))
            .ToListAsync();
    }

    private RankedResult BuildRankedResult(
        List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes, int HintsUsed)> rows,
        Guid playerResultId,
        string playerName)
    {
        var rank = rows.FindIndex(r => r.Id == playerResultId) + 1;
        if (rank <= 0) rank = rows.Count; // fallback if not found (shouldn't happen)

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
                HintsUsed = row.HintsUsed,
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

    // build a "preview" ranked result for guest players (not actually in the database)
    private RankedResult BuildPreviewRankedResult(
        List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes, int HintsUsed)> rows,
        PreviewRankRequest req,
        string playerName)
    {
        // figure out where the player would place based on score and time
        var betterCount = rows.Count(r =>
            r.Score > req.Score ||
            (r.Score == req.Score && r.DurationSeconds < req.DurationSeconds));

        var rank = betterCount + 1;
        var totalPlayers = rows.Count + 1;
        var startRank = rank == 1 ? 2 : rank + 1;
        if (startRank > totalPlayers) startRank = totalPlayers;

        // build the merged list with the player inserted at the right spot
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
                    HintsUsed = req.HintsUsed,
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
                HintsUsed = row.HintsUsed,
                IsPlayer = false
            });
            currentRank++;
        }

        // if player is last, append at the end
        if (!inserted)
        {
            stitched.Add(new LeaderboardRowDto
            {
                Rank = currentRank,
                Username = playerName,
                Score = req.Score,
                DurationSeconds = req.DurationSeconds,
                Mistakes = req.Mistakes,
                HintsUsed = req.HintsUsed,
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
    // Called when an authenticated player finishes a puzzle.
    // Players can retry the same puzzle to improve their score.
    [HttpPost("complete")]
    [Authorize]
    [EnableRateLimiting("CompletionPolicy")]
    public async Task<IActionResult> CompleteGame([FromBody] CompleteGameRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name) ?? "You";

        var newScore = Math.Clamp(req.Score, 0, 10_000);
        var newDuration = Math.Max(0, req.DurationSeconds);
        var newMistakes = Math.Max(0, req.Mistakes);
        var newHints = Math.Max(0, req.HintsUsed);

        var existing = await db.GameResults.FirstOrDefaultAsync(r =>
            r.UserId == userId &&
            r.Difficulty == req.Difficulty &&
            r.PuzzleDate == req.PuzzleDate);

        GameResult result;

        if (existing == null)
        {
            // first submission for this puzzle - insert a fresh record
            result = new GameResult
            {
                UserId = userId,
                Difficulty = req.Difficulty,
                PuzzleDate = req.PuzzleDate,
                DurationSeconds = newDuration,
                Mistakes = newMistakes,
                Score = newScore,
                HintsUsed = newHints
            };
            db.GameResults.Add(result);
        }
        else
        {
            // player is retrying
            // only overwrite if this attempt is genuinely better:
            // higher score wins; on a tie, the faster time wins
            bool isBetter = newScore > existing.Score ||
                            (newScore == existing.Score && newDuration < existing.DurationSeconds);

            if (isBetter)
            {
                existing.Score = newScore;
                existing.DurationSeconds = newDuration;
                existing.Mistakes = newMistakes;
                existing.HintsUsed = newHints;
                existing.CompletedAt = DateTime.UtcNow;
            }

            result = existing;
        }

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
    // Shows where a player would rank WITHOUT saving to the database
    // Used for guest players who want to see a leaderboard preview
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
    // Returns personal stats for the logged-in user
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
            // last 5 games for the "recent activity" display
            RecentGames = results
                .OrderByDescending(r => r.CompletedAt)
                .Take(5)
                .Select(r => new
                {
                    r.Difficulty,
                    r.PuzzleDate,
                    r.Score,
                    r.DurationSeconds,
                    r.Mistakes,
                    r.HintsUsed
                })
        });
    }

    // GET /api/user/today-best
    // Returns the current user's best completion time for today's puzzle, per difficulty
    // Shown in the welcome modal as "Best today: MM:SS"
    // Returns null for a difficulty if they haven't completed it today
    [HttpGet("today-best")]
    [Authorize]
    public async Task<IActionResult> GetTodayBest()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // only load today's results for this user
        var todayResults = await db.GameResults
            .Where(r => r.UserId == userId && r.PuzzleDate == today)
            .ToListAsync();

        // local function to get the minimum time for a difficulty (null if no results)
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

    // GET /api/user/leaderboard?date=YYYY-MM-DD
    // Returns the full leaderboard for a given date
    // This is the full list - the client filters by difficulty tab
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
            .Select(r => new
            {
                r.User.Username,
                r.Difficulty,
                r.Score,
                r.DurationSeconds,
                r.Mistakes,
                r.HintsUsed
            })
            .ToListAsync();

        return Ok(entries);
    }
}