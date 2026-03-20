using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
public class AuthController(ApplicationDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory) : ControllerBase
{
    // POST /api/auth/register
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>>Register([FromBody] RegisterRequest req){

        if (await db.Users.AnyAsync(u => u.Email == req.Email)){
            return BadRequest("Email already in use.");
        }

        var user = new User{
            Username = req.Username,
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>>Login([FromBody] LoginRequest req){
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

        if( user == null || user.PasswordHash == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash)){
            return Unauthorized("Invalid e-mail or password.");
        }

        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/google
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleAuth([FromBody] GoogleAuthRequest req)
    {
        // Verify access token by calling Google's userinfo endpoint
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", req.IdToken);

        var response = await client.GetAsync("https://www.googleapis.com/oauth2/v3/userinfo");
        if (!response.IsSuccessStatusCode)
            return Unauthorized("Invalid Google token.");

        var googleUser = await response.Content.ReadFromJsonAsync<GoogleUserInfo>();
        if (googleUser == null || string.IsNullOrEmpty(googleUser.Email))
            return Unauthorized("Could not retrieve Google user info.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == googleUser.Email);
        if (user == null)
        {
            user = new User
            {
                Username = googleUser.Name ?? googleUser.Email,
                Email = googleUser.Email,
                GoogleID = googleUser.Sub
            };
            db.Users.Add(user);
        }
        else if (user.GoogleID == null)
        {
            user.GoogleID = googleUser.Sub;
        }

        await db.SaveChangesAsync();
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    // POST /api/auth/profile/update
    [HttpPost("profile/validate-password")]
    [Authorize]
    public async Task<IActionResult> ValidateNewPassword([FromBody] ValidateNewPasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return Unauthorized("User not found.");

        var newPassword = req.NewPassword?.Trim() ?? string.Empty;
        if (newPassword.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        if (!string.IsNullOrWhiteSpace(user.PasswordHash) && BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
            return BadRequest("New password must be different from your current password.");

        return Ok();
    }

    // POST /api/auth/profile/update
    [HttpPost("profile/update")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return Unauthorized("User not found.");

        if (string.IsNullOrWhiteSpace(req.CurrentPassword))
            return BadRequest("Current password is required.");

        if (string.IsNullOrWhiteSpace(req.NewUsername) && string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest("Provide a new username or password.");

        if (string.IsNullOrWhiteSpace(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return Unauthorized("Current password is incorrect.");

        if (!string.IsNullOrWhiteSpace(req.NewUsername))
        {
            var newUsername = req.NewUsername.Trim();
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

            if (!string.IsNullOrWhiteSpace(user.PasswordHash) && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return BadRequest("New password must be different from your current password.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        }

        await db.SaveChangesAsync();
        return Ok(new AuthResponse(GenerateJwt(user), user.Username, user.Email));
    }

    private record GoogleUserInfo(string Sub, string Email, string? Name);

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username)
        };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}