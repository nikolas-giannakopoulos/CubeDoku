using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using CubeDoku.Server.Data;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(ApplicationDbContext db, IConfiguration config) : ControllerBase
{
    // POST /api/auth/register
    // Limit: 10 requests per IP per minute (Program.cs)
    [HttpPost("register")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req)
    {
        // check if email already exists 
        if (await db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest("Registration failed. Please check your details.");

        var user = new User
        {
            Username = req.Username,
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        // auto-login after registration
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/login
    // Limit: 10 requests per IP per minute
    [HttpPost("login")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user == null || user.PasswordHash == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Invalid e-mail or password.");

        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/google
    // The frontend (useGoogleLogin implicit flow) sends an OAuth2 access token.
    // We exchange it for user info via Google's userinfo endpoint.
    // If the user doesn't exist yet we create an account for them automatically.
    [HttpPost("google")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> GoogleAuth(
        [FromBody] GoogleAuthRequest req,
        [FromServices] IHttpClientFactory httpClientFactory)
    {
        if (string.IsNullOrWhiteSpace(req.IdToken))
            return BadRequest("Missing access token.");

        // Call Google's userinfo endpoint with the access token
        using var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", req.IdToken);

        HttpResponseMessage userInfoResponse;
        try
        {
            userInfoResponse = await client.GetAsync("https://www.googleapis.com/oauth2/v3/userinfo");
        }
        catch
        {
            return StatusCode(503, "Could not reach Google's authentication service.");
        }

        if (!userInfoResponse.IsSuccessStatusCode)
            return Unauthorized("Invalid or expired Google access token.");

        var userInfo = await userInfoResponse.Content.ReadFromJsonAsync<GoogleUserInfo>();

        if (userInfo == null || string.IsNullOrEmpty(userInfo.Email))
            return Unauthorized("Could not retrieve email from Google.");

        // check if this Google account has been used before
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == userInfo.Email);
        if (user == null)
        {
            // first time with this Google account, create a new user
            user = new User
            {
                Username = userInfo.Name ?? userInfo.Email,
                Email = userInfo.Email,
                GoogleID = userInfo.Sub
            };
            db.Users.Add(user);
        }
        else if (user.GoogleID == null)
        {
            // user registered with email/password before and is now linking Google
            user.GoogleID = userInfo.Sub;
        }

        await db.SaveChangesAsync();
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/profile/validate-password
    [HttpPost("profile/validate-password")]
    [Authorize]
    public async Task<IActionResult> ValidateNewPassword([FromBody] ValidateNewPasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

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
    // Requires current password to authorize any changes
    [HttpPost("profile/update")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

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

            // don't set password to the same value
            if (!string.IsNullOrWhiteSpace(user.PasswordHash) && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return BadRequest("New password must be different from your current password.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        }

        await db.SaveChangesAsync();
        // send back a fresh token because username might have changed 
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // Generates a JWT for the given user
    // Token includes user ID, email, username in the claims
    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // include both standard JWT claims and ASP.NET Identity claim types
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.NameIdentifier,     user.Id.ToString()),
            new Claim(ClaimTypes.Email,              user.Email),
            new Claim(ClaimTypes.Name,               user.Username),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: "CubeDoku",
            audience: "CubeDoku",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}