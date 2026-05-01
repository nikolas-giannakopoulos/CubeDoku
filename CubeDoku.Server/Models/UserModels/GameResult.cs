// GameResult.cs
// Stores the result of one completed puzzle session
// One row per user per puzzle per difficulty - so the same user can't submit twice for the same puzzle
//
// The score formula is computed on the client side (CubeViewer.tsx) based on:
//   time taken, number of mistakes, and hints used
// Then the client sends the final score here and we store it
//
// I initially thought about computing the score server-side (more trustworthy) but then
// the score formula would need to be in C# AND typescript and keeping them in sync would be annoying.
// I added server-side clamping in the controller to prevent obviously fake scores.
//
// PuzzleDate uses DateOnly (not DateTime) because the puzzle doesn't change throughout a day
// The leaderboard is per-day, so we need to group by date exactly

namespace CubeDoku.Server.Models.UserModels;

public class GameResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // foreign key to Users table
    public Guid UserId { get; set; }

    // navigation property - used when we do Include(r => r.User) for leaderboard queries
    // Note: this causes an extra join even when I only need basic game data
    // probably fine at this scale but could be optimized if leaderboard gets slow
    public User User { get; set; } = null!;

    // "Classic" or "BrainTerror" - stored as string for simplicity
    // could have been a foreign key to a Difficulties table but that seems over-engineered
    public string Difficulty { get; set; } = string.Empty;

    // which day's puzzle was completed (DateOnly = just YYYY-MM-DD, no time component)
    public DateOnly PuzzleDate { get; set; }

    // when this record was inserted - used for tie-breaking on the leaderboard
    // (if two players have the same score AND time, earlier submission wins)
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    public int DurationSeconds { get; set; }

    public int Mistakes { get; set; }

    public int Score { get; set; }

    public int HintsUsed { get; set; }
}