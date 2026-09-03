// AuthDTOs.cs
// Request/response models for the authentication endpoints

using System.ComponentModel.DataAnnotations;

namespace CubeDoku.Server.Models.UserModels;

// used by POST /api/auth/register
public record RegisterRequest(
    [Required, MaxLength(50)] string Username,
    [Required, EmailAddress, MaxLength(256)] string Email,
    // minimum 8 chars for password security
    [Required, MinLength(8), MaxLength(128)] string Password);

// used by POST /api/auth/login
// No [EmailAddress] here — login just does a DB lookup, so if the format is wrong
// the query returns null and we respond with 401. No need to pre-validate format.
public record LoginRequest(
    [Required, MaxLength(256)] string Email,
    [Required, MaxLength(128)] string Password);

// used by POST /api/auth/google - the frontend sends the OAuth2 access token
// (from useGoogleLogin implicit flow). The field is named IdToken to avoid
// a breaking change to the existing request shape.
public record GoogleAuthRequest(
    [Required, MaxLength(2048)] string IdToken);

// response from Google's userinfo endpoint (https://www.googleapis.com/oauth2/v3/userinfo)
public record GoogleUserInfo(
    [property: System.Text.Json.Serialization.JsonPropertyName("sub")]   string Sub,
    [property: System.Text.Json.Serialization.JsonPropertyName("email")] string? Email,
    [property: System.Text.Json.Serialization.JsonPropertyName("name")]  string? Name);

// returned by all auth endpoints - the frontend saves the token to localStorage
public record AuthResponse(string Token, string Username, string Email);

// used by POST /api/auth/profile/validate-password
// separate from UpdateProfileRequest because we want to validate the new password
// before asking for the current password (better UX - show errors early)
public record ValidateNewPasswordRequest(
    [Required, MinLength(8), MaxLength(128)] string NewPassword);

// used by POST /api/auth/profile/update
public record UpdateProfileRequest(
    // current password required to authorize any profile changes
    [Required, MaxLength(128)] string CurrentPassword,
    [MaxLength(50)] string? NewUsername,
    [MinLength(8), MaxLength(128)] string? NewPassword);

// used by POST /api/user/complete - sent when player finishes a puzzle
public record CompleteGameRequest(
    // must be exactly one of these two values
    [Required, RegularExpression("^(Classic|BrainTerror)$",
        ErrorMessage = "Difficulty must be 'Classic' or 'BrainTerror'.")] string Difficulty,
    DateOnly PuzzleDate,
    [Range(0, 86400)] int DurationSeconds,
    [Range(0, 1000)] int Mistakes,
    [Range(0, 10000)] int Score,
    [Range(0, 10)] int HintsUsed);

// used by POST /api/user/preview-rank - shows where a player would rank before they're logged in
public record PreviewRankRequest(
    [Required, RegularExpression("^(Classic|BrainTerror)$",
        ErrorMessage = "Difficulty must be 'Classic' or 'BrainTerror'.")] string Difficulty,
    DateOnly PuzzleDate,
    [Range(0, 86400)] int DurationSeconds,
    [Range(0, 1000)] int Mistakes,
    [Range(0, 10000)] int Score,
    [Range(0, 10)] int HintsUsed,
    [MaxLength(50)] string? PlayerName);