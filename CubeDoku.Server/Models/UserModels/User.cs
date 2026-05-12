// User.cs
// The application user entity - one row per registered account
//
// I kept this simple: just ID, username, email, password hash, and optional GoogleID
// The GoogleID field is nullable because traditional email/password users don't have one
// and Google-linked users might not have a password at all (PasswordHash will be null for them)
//
// The CreatedAt field is mainly for admin purposes - not shown in the UI anywhere right now
// but might be useful later if I add account management features
//
// Note: ICollection<GameResult> here is the EF navigation property
// It's used when I do Include(u => u.GameResults) in the controller
// For most queries I don't actually need it but EF requires it for relationship tracking

namespace CubeDoku.Server.Models.UserModels;

public class User
{
    // Guid because it's safer than auto-increment int
    // (can't guess other users' IDs by incrementing)
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