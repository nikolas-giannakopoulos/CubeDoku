// User.cs
// The application user entity - one row per registered account

namespace CubeDoku.Server.Models.UserModels;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    // null means Google-only account (no password)
    public string? PasswordHash { get; set; }

    // null means email/password account
    public string? GoogleID { get; set; }

    // automatically set to now when the record is created
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // navigation property for EF - gives access to this user's game history
    public ICollection<GameResult> GameResults { get; set; } = [];
}