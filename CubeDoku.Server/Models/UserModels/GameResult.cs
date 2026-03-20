namespace CubeDoku.Server.Models.UserModels;

public class GameResult
{

    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public string Difficulty { get; set; } = string.Empty;

    public DateOnly PuzzleDate { get; set; }

    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    public int DurationSeconds { get; set; }

    public int Mistakes { get; set; }

    public int Score { get; set; }
}