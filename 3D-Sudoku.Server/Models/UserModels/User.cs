namespace ThreeDSudoku.Server.Models.UserModels;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Username { get; set; } = string.Empty;
    
    public string Email { get; set; } = string.Empty;
    
    public string? PasswordHash { get; set; }
    
    public string? GoogleID { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<GameResult> GameResults { get; set; } = [];
}