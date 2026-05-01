// AuthController.cs
// Handles all authentication: register, login, Google OAuth, and profile updates
//
// I put quite a bit of security work into this controller based on the feedback
// I got during the security audit earlier in the semester. The main things:
//   - Same error message for "wrong email" and "wrong password" (prevents user enumeration)
//   - BCrypt for password hashing (I tried MD5 at first as a placeholder, switched quickly)
//   - Rate limiting on all auth endpoints (configured in Program.cs, referenced here with [EnableRateLimiting])
//   - JWT tokens with 60-minute expiry (was 30 days initially, way too long)
//   - Google token validation using the official Google library (not just decoding the JWT myself)
//
// The GenerateJwt method is private and at the bottom - it's used by all 3 auth flows
// (register, login, google) so it made sense to keep it here rather than a separate service
//
// TODO: maybe move GenerateJwt to a separate JwtService class? My supervisor mentioned
// the controller is doing too much but I haven't gotten around to refactoring it

using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CubeDoku.Server.Data;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(ApplicationDbContext db, IConfiguration config) : ControllerBase
{
    // POST /api/auth/register
    // Rate limited: 10 requests per IP per minute (configured in Program.cs)
    [HttpPost("register")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req)
    {
        // check if email already exists - return generic message so we don't reveal if a specific
        // email is registered (this is a user enumeration attack prevention technique)
        if (await db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest("Registration failed. Please check your details.");

        var user = new User
        {
            Username     = req.Username,
            Email        = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        // auto-login after registration - send back a token immediately
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/login
    // Rate limited: 10 requests per IP per minute
    [HttpPost("login")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

        // same error message whether user doesn't exist or password is wrong
        // this prevents attackers from using the error message to check if an email is registered
        if (user == null || user.PasswordHash == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Invalid e-mail or password.");

        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/google
    // Handles Google Sign-In flow
    // The frontend sends the ID token from Google and we validate it server-side
    // If the user doesn't exist yet we create an account for them automatically
    [HttpPost("google")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> GoogleAuth([FromBody] GoogleAuthRequest req)
    {
        var clientId = config["Google:ClientId"]
            ?? throw new InvalidOperationException("Google:ClientId is not configured.");

        // validate the Google ID token - this checks signature, expiry, and audience
        GoogleJsonWebSignature.Payload? payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                req.IdToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId]   // reject tokens that weren't issued for this app specifically
                });
        }
        catch (InvalidJwtException)
        {
            return Unauthorized("Invalid or expired Google token.");
        }

        if (string.IsNullOrEmpty(payload.Email))
            return Unauthorized("Could not retrieve email from Google token.");

        // check if this Google account has been used before
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);
        if (user == null)
        {
            // first time with this Google account - create a new user
            user = new User
            {
                Username = payload.Name ?? payload.Email,
                Email    = payload.Email,
                GoogleID = payload.Subject
            };
            db.Users.Add(user);
        }
        else if (user.GoogleID == null)
        {
            // user registered with email/password before and is now linking Google
            user.GoogleID = payload.Subject;
        }

        await db.SaveChangesAsync();
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/profile/validate-password
    // Called before the full update to give early validation feedback in the UI
    // (so the user sees the password error before they've also filled in a new username)
    [HttpPost("profile/validate-password")]
    [Authorize]
    public async Task<IActionResult> ValidateNewPassword([FromBody] ValidateNewPasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return Unauthorized("User not found.");

        var newPassword = req.NewPassword?.Trim() ?? string.Empty;
        if (newPassword.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        // don't allow setting the same password you already have
        if (!string.IsNullOrWhiteSpace(user.PasswordHash) && BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
            return BadRequest("New password must be different from your current password.");

        return Ok();
    }

    // POST /api/auth/profile/update
    // Requires current password to authorize any changes (even just username changes)
    // This is slightly strict but I'd rather be safe
    [HttpPost("profile/update")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return Unauthorized("User not found.");

        if (string.IsNullOrWhiteSpace(req.CurrentPassword))
            return BadRequest("Current password is required.");

        // must provide at least one thing to change
        if (string.IsNullOrWhiteSpace(req.NewUsername) && string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest("Provide a new username or password.");

        // verify current password before allowing any changes
        if (string.IsNullOrWhiteSpace(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return Unauthorized("Current password is incorrect.");

        if (!string.IsNullOrWhiteSpace(req.NewUsername))
        {
            var newUsername = req.NewUsername.Trim();
            // only bother checking uniqueness if the username is actually changing
            if (!string.Equals(newUsername, user.Username, StringComparison.Ordinal))
            {
                var usernameExists = await db.Users.AnyAsync(u => u.Username == newUsername && u.Id != user.Id);
                if (usernameExists)
                    return BadRequest("Username is already taken.");

                user.Username = newUsername;
            }
        }

        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            var password = req.NewPassword.Trim();
            if (password.Length < 8)
                return BadRequest("Password must be at least 8 characters.");

            // don't set password to the same value (redundant but nice UX feedback)
            if (!string.IsNullOrWhiteSpace(user.PasswordHash) && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return BadRequest("New password must be different from your current password.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        }

        await db.SaveChangesAsync();
        // send back a fresh token because username might have changed (it's in the token claims)
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // Generates a JWT for the given user
    // Token includes user ID, email, username in the claims
    // Signed with HS256 using the secret from appsettings
    // 60 minute expiry - short enough to be safe, long enough to not annoy players mid-game
    private string GenerateJwt(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // include both standard JWT claims and ASP.NET Identity claim types
        // because different parts of the code use different ways to look up claims
        // (a bit messy but it works - cleaned up vs the original version which had even more redundancy)
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.NameIdentifier,     user.Id.ToString()),
            new Claim(ClaimTypes.Email,              user.Email),
            new Claim(ClaimTypes.Name,               user.Username),
            // unique token ID - useful if we ever want to add token revocation/blacklisting
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer:             "CubeDoku",          // must match ValidIssuer in Program.cs
            audience:           "CubeDoku",          // must match ValidAudience in Program.cs
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}