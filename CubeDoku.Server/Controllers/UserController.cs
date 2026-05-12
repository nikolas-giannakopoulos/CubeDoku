// UserController.cs
// Handles user-related operations: completing a game, viewing stats, leaderboards
//
// This controller got bigger than I planned. My supervisor suggested splitting it into
// a LeaderboardController and a StatsController but at this point in the project it would
// take too long to refactor without breaking things, so I'm leaving it as-is.
//
// Key features:
//   - POST /api/user/complete: saves a completed game result and returns leaderboard position
//   - POST /api/user/preview-rank: shows where a player WOULD rank (for non-logged-in players)
//   - GET /api/user/stats: returns personal stats (total games, best times, etc.)
//   - GET /api/user/today-best: returns today's best time for each difficulty (for the welcome modal)
//   - GET /api/user/leaderboard: full leaderboard for a given date
//
// The leaderboard display is a "nearby rows" view - shows the player +/- 2 positions
// rather than showing all players (which could be hundreds). This is how Wordle and similar
// games do it, and it looks much better in the UI.
//
// The "preview rank" feature was added late in development because guest players (not logged in)
// complete puzzles too, and we want to show them how they would rank to encourage signup.
// It inserts a fake entry into the leaderboard and shows the surrounding rows.

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
    // internal DTO for leaderboard rows - only used within this controller
    // could have been a separate file but seemed overkill for something this small
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
        public int StartRank { get; set; }   // for animation: where to start the counter before settling
        public int TotalPlayers { get; set; }
        public List<LeaderboardRowDto> NearbyRows { get; set; } = [];
    }

    // fetch leaderboard rows for a given difficulty and date, sorted by score then time
    // Note: Include(r => r.User) does an extra join to get the username
    // Could optimize with a projection that avoids loading the full User object
    // but it works fine at this scale and I'd rather have readable code
    private async Task<List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes, int HintsUsed)>>
        GetPuzzleLeaderboardRows(string difficulty, DateOnly puzzleDate)
    {
        return await db.GameResults
            .Where(r => r.Difficulty == difficulty && r.PuzzleDate == puzzleDate)
            .Include(r => r.User)   // eager load user for username - N+1 avoided here
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.DurationSeconds)
            .ThenBy(r => r.CompletedAt)   // tiebreaker: earlier completion wins
            .Select(r => new ValueTuple<Guid, string, int, int, int, int>(
                r.Id,
                r.User.Username,
                r.Score,
                r.DurationSeconds,
                r.Mistakes,
                r.HintsUsed))
            .ToListAsync();
    }

    // build the "nearby rows" view for a player who just submitted their result
    // shows up to 2 rows above and 2 rows below the player's rank
    private RankedResult BuildRankedResult(
        List<(Guid Id, string Username, int Score, int DurationSeconds, int Mistakes, int HintsUsed)> rows,
        Guid playerResultId,
        string playerName)
    {
        var rank = rows.FindIndex(r => r.Id == playerResultId) + 1;
        if (rank <= 0) rank = rows.Count; // fallback if not found (shouldn't happen)

        // startRank is one position lower than actual rank for a nice "climbing" animation
        // if already rank 1, animate from rank 2 (can't go higher than 1)
        var startRank = rank == 1 ? Math.Min(2, Math.Max(1, rows.Count)) : rank + 1;
        if (startRank < rank) startRank = rank;

        // show player rank ±2
        var start = Math.Max(1, rank - 2);
        var end = Math.Min(rows.Count, rank + 2);

        var nearby = new List<LeaderboardRowDto>();
        for (var i = start; i <= end; i++)
        {
            var row = rows[i - 1];
            nearby.Add(new LeaderboardRowDto
            {
                Rank = i,
                // use the actual player name for the player's row (not the stored username)
                // this handles the case where the name was just changed
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
    // stitches a fake entry into the sorted list to show where the player would appear
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
        var totalPlayers = rows.Count + 1;  // +1 for this player
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
                // insert the player's fake row here
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

        // slice to ±2 around player rank
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
    //
    // Upsert logic:
    //   - If no prior result exists → insert a new record.
    //   - If a prior result exists AND the new score is strictly better
    //     (higher score, or equal score with a faster time) → overwrite it.
    //   - Otherwise → return the existing best result unchanged.
    //     The client can show a "Your previous best is still your highest" message.
    //
    // Rate limited per user to prevent rapid-fire spam submissions.
    [HttpPost("complete")]
    [Authorize]
    [EnableRateLimiting("CompletionPolicy")]
    public async Task<IActionResult> CompleteGame([FromBody] CompleteGameRequest req)
    {
        var userId   = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name) ?? "You";

        // clamp incoming values to sane ranges
        // (basic anti-cheat: doesn't stop determined attackers but filters obvious tampering)
        var newScore    = Math.Clamp(req.Score, 0, 10_000);
        var newDuration = Math.Max(0, req.DurationSeconds);
        var newMistakes = Math.Max(0, req.Mistakes);
        var newHints    = Math.Max(0, req.HintsUsed);

        var existing = await db.GameResults.FirstOrDefaultAsync(r =>
            r.UserId     == userId &&
            r.Difficulty == req.Difficulty &&
            r.PuzzleDate == req.PuzzleDate);

        GameResult result;

        if (existing == null)
        {
            // first submission for this puzzle - insert a fresh record
            result = new GameResult
            {
                UserId          = userId,
                Difficulty      = req.Difficulty,
                PuzzleDate      = req.PuzzleDate,
                DurationSeconds = newDuration,
                Mistakes        = newMistakes,
                Score           = newScore,
                HintsUsed       = newHints
            };
            db.GameResults.Add(result);
        }
        else
        {
            // player is retrying - only overwrite if this attempt is genuinely better:
            // higher score wins; on a tie, the faster time wins
            bool isBetter = newScore > existing.Score ||
                            (newScore == existing.Score && newDuration < existing.DurationSeconds);

            if (isBetter)
            {
                existing.Score           = newScore;
                existing.DurationSeconds = newDuration;
                existing.Mistakes        = newMistakes;
                existing.HintsUsed       = newHints;
                existing.CompletedAt     = DateTime.UtcNow;
            }

            result = existing;
        }

        await db.SaveChangesAsync();

        var leaderboardRows = await GetPuzzleLeaderboardRows(req.Difficulty, req.PuzzleDate);
        var ranked = BuildRankedResult(leaderboardRows, result.Id, username);

        return Ok(new
        {
            Username     = username,
            Score        = result.Score,
            Rank         = ranked.Rank,
            StartRank    = ranked.StartRank,
            TotalPlayers = ranked.TotalPlayers,
            NearbyRows   = ranked.NearbyRows,
            Difficulty   = req.Difficulty,
            PuzzleDate   = req.PuzzleDate
        });
    }

    // POST /api/user/preview-rank
    // Shows where a player would rank WITHOUT saving to the database
    // Used for guest players (not logged in) who want to see a leaderboard preview
    // Also used for logged-in players before they decide to submit (though they usually skip this)
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
    // Loads all results in memory and groups them - could do this in SQL instead
    // but the query was getting complicated and for the scale of this project it doesn't matter
    [HttpGet("stats")]
    [Authorize]
    public async Task<IActionResult> GetStats()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // load all results for this user at once - no pagination because users typically
        // won't have more than a few hundred results (one per day per difficulty max)
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
                .Select(r => new {
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
    // Returns the full leaderboard for a given date (defaults to today UTC)
    // This is the full list - the client filters by difficulty tab
    // No pagination: could be needed if we get hundreds of players per day
    // but right now it's fine to load everything
    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] string? date = null)
    {
        var puzzleDate = DateOnly.TryParse(date, out var parsed)
            ? parsed
            : DateOnly.FromDateTime(DateTime.UtcNow);

        var entries = await db.GameResults
            .Where(r => r.PuzzleDate == puzzleDate)
            .Include(r => r.User)   // need username for display
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.DurationSeconds)
            .ThenBy(r => r.CompletedAt)
            .Select(r => new {
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