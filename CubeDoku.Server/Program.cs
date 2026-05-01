// Program.cs
// Main app setup and middleware pipeline configuration
//
// This is where everything gets wired together: database, JWT auth, CORS, rate limiting,
// security headers, and the HTTP pipeline order.
//
// I spent a lot of time getting the middleware ORDER right. ASP.NET is particular about
// order - for example CORS must come before Authentication, and Authentication must come
// before Authorization. Got bitten by this a few times during development.
//
// The security hardening here was added after the security audit earlier this semester.
// Notable things added:
//   - Zero ClockSkew on JWT validation (no grace period after token expiry)
//   - HSTS (HTTP Strict Transport Security) in production
//   - Rate limiting with separate policies for auth vs game completion vs general
//   - Custom error handler so stack traces don't leak in production
//   - Security headers middleware (X-Frame-Options, CSP, etc.)
//
// Configuration values come from appsettings.json (or environment variables in production)
// The connection string and JWT secret should NEVER be in source control

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using CubeDoku.Server.Data;
using CubeDoku.Server.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ─── Controllers ─────────────────────────────────────────────────────────────
// configure JSON to serialize enums as strings instead of ints
// (so the frontend receives "Front" not 0 for face names)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// ─── Database ─────────────────────────────────────────────────────────────────
// using PostgreSQL (Npgsql) - hosted on a cloud database
// EnableRetryOnFailure handles transient connection drops automatically
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorCodesToAdd: null)));

// ─── HttpClient (Google OAuth) ────────────────────────────────────────────────
// needed by Google.Apis.Auth to validate tokens
builder.Services.AddHttpClient();

// ─── JWT Authentication ───────────────────────────────────────────────────────
// validate all the important JWT fields: signature, issuer, audience, expiry
// ClockSkew = zero means tokens expire exactly when they say they do (no extra time)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
            ValidateIssuer = true,
            ValidIssuer     = "CubeDoku",
            ValidateAudience = true,
            ValidAudience    = "CubeDoku",
            ValidateLifetime = true,
            ClockSkew        = TimeSpan.Zero
        };
    });

// ─── CORS ─────────────────────────────────────────────────────────────────────
// restrict to known origins only - never use AllowAnyOrigin in production
// AllowCredentials() is needed because we send Authorization headers
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(
                "https://localhost:5173",         // Vite dev proxy
                "https://localhost:7055",         // ASP.NET HTTPS dev port
                "https://cubedoku.com",           // production domain
                "https://www.cubedoku.com")
            .AllowAnyMethod()
            .WithHeaders("Authorization", "Content-Type", "Accept")
            .AllowCredentials();
    });
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// three separate policies with different limits:
//   AuthPolicy: tight limit on login/register to prevent brute force
//   CompletionPolicy: prevent score spam (only ~1 completion per puzzle anyway)
//   GlobalPolicy: general fallback to prevent DoS
builder.Services.AddRateLimiter(rateLimiter =>
{
    // auth endpoints: 10 requests per IP per minute
    rateLimiter.AddFixedWindowLimiter("AuthPolicy", opt =>
    {
        opt.PermitLimit         = 10;
        opt.Window              = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit          = 2;
    });

    // game completion: 5 submissions per user per hour
    // (you can't complete more than 2 puzzles per day in practice, this is generous)
    rateLimiter.AddFixedWindowLimiter("CompletionPolicy", opt =>
    {
        opt.PermitLimit         = 5;
        opt.Window              = TimeSpan.FromHours(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit          = 0;
    });

    // global fallback: 120 requests per IP per minute across all other endpoints
    rateLimiter.AddFixedWindowLimiter("GlobalPolicy", opt =>
    {
        opt.PermitLimit         = 120;
        opt.Window              = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit          = 10;
    });

    // return 429 Too Many Requests instead of throwing an exception
    rateLimiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// ─── Build ────────────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// ─── Pipeline ─────────────────────────────────────────────────────────────────
// ORDER MATTERS - each middleware wraps the ones below it

// always redirect HTTP to HTTPS
app.UseHttpsRedirection();

// HSTS: tell browsers to always use HTTPS for this domain (cached by browser)
// only in production because dev certs don't have real HSTS meaning
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// custom error handler: returns a JSON problem+json response instead of showing stack traces
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/api/error");
}

// add security headers to every response (X-Frame-Options, CSP, etc.)
app.UseSecurityHeaders();

app.UseRateLimiter();

// CORS must come before auth middleware
app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// SPA fallback: any route that doesn't match an API controller serves index.html
app.MapFallbackToFile("/index.html");

// ─── Generic error endpoint ────────────────────────────────────────────────────
// this is what UseExceptionHandler("/api/error") routes to in production
// returns a minimal problem+json response with no internal detail
app.Map("/api/error", (HttpContext context) =>
{
    context.Response.ContentType = "application/problem+json";
    return Results.Problem(
        title: "An unexpected error occurred.",
        detail: null,          // never expose internal detail in production
        statusCode: 500);
});

app.Run();

