namespace ThreeDSudoku.Server.Models.UserModels;

public record RegisterRequest(string Username, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record GoogleAuthRequest(string IdToken);
public record AuthResponse(string Token, string Username, string Email);
public record ValidateNewPasswordRequest(string NewPassword);
public record UpdateProfileRequest(string CurrentPassword, string? NewUsername, string? NewPassword);
public record CompleteGameRequest(string Difficulty, DateOnly PuzzleDate, int DurationSeconds, int Mistakes, int Score);
public record PreviewRankRequest(string Difficulty, DateOnly PuzzleDate, int DurationSeconds, int Mistakes, int Score, string? PlayerName);