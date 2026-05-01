// AuthDTOs.cs
// Request/response models for the authentication endpoints
//
// I'm using C# records here (not classes) because they're immutable which makes sense for
// request objects - you don't want anything modifying the request after it's been bound.
// I learned about records last semester and this feels like a good use case.
//
// DataAnnotations here enforce basic input constraints before any controller code runs
// These are my "first line of defense" against bad input
// More serious validation (e.g. "is this email already taken?") happens in the controller

using System.ComponentModel.DataAnnotations;

namespace CubeDoku.Server.Models.UserModels;

// used by POST /api/auth/register
public record RegisterRequest(
    [Required, MaxLength(50)]  string Username,
    [Required, EmailAddress, MaxLength(256)] string Email,
    // minimum 8 chars for password security
    [Required, MinLength(8), MaxLength(128)] string Password);

// used by POST /api/auth/login
public record LoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(128)] string Password);

// used by POST /api/auth/google - the frontend sends the Google ID token (a JWT)
public record GoogleAuthRequest(
    [Required, MaxLength(2048)] string IdToken);

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
    [MaxLength(50)]            string? NewUsername,
    [MinLength(8), MaxLength(128)] string? NewPassword);

// used by POST /api/user/complete - sent when player finishes a puzzle
public record CompleteGameRequest(
    // must be exactly one of these two values
    [Required, RegularExpression("^(Classic|BrainTerror)$",
        ErrorMessage = "Difficulty must be 'Classic' or 'BrainTerror'.")] string Difficulty,
    DateOnly PuzzleDate,
    [Range(0, 86400)] int DurationSeconds,    // max 24h ceiling (no one takes longer than this)
    [Range(0, 1000)]  int Mistakes,
    [Range(0, 10000)] int Score,
    [Range(0, 10)]    int HintsUsed);         // max 10 hints (5 for Classic, 3 for BrainTerror in practice)

// used by POST /api/user/preview-rank - shows where a player would rank before they're logged in
public record PreviewRankRequest(
    [Required, RegularExpression("^(Classic|BrainTerror)$",
        ErrorMessage = "Difficulty must be 'Classic' or 'BrainTerror'.")] string Difficulty,
    DateOnly PuzzleDate,
    [Range(0, 86400)] int DurationSeconds,
    [Range(0, 1000)]  int Mistakes,
    [Range(0, 10000)] int Score,
    [Range(0, 10)]    int HintsUsed,
    [MaxLength(50)]   string? PlayerName);