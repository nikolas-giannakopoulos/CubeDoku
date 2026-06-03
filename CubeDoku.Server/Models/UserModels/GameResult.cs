// GameResult.cs
// Stores the result of one completed puzzle session

namespace CubeDoku.Server.Models.UserModels;

public class GameResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // foreign key to Users table
    public Guid UserId { get; set; }


    public User User { get; set; } = null!;

    // "Classic" or "BrainTerror" 
    public string Difficulty { get; set; } = string.Empty;

    // which day's puzzle was completed (DateOnly = just YYYY-MM-DD, no time component)
    public DateOnly PuzzleDate { get; set; }

    // when this record was inserted - used for tie-breaking on the leaderboard
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    public int DurationSeconds { get; set; }

    public int Mistakes { get; set; }

    public int Score { get; set; }

    public int HintsUsed { get; set; }
}