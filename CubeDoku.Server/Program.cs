using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using CubeDoku.Server.Data;
using CubeDoku.Server.Middleware;

var builder = WebApplication.CreateBuilder(args);

// configure JSON to serialize enums as strings instead of ints
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// using PostgreSQL
// Cloud providers (Neon, Supabase, Render) supply connection strings as postgresql:// URIs.
// Npgsql's DbConnectionStringBuilder can fail to parse these when query params are malformed
// (e.g. ?sslmode without a value), so we parse URI format manually and convert to key=value.
var rawConn = builder.Configuration.GetConnectionString("DefaultConnection")
              ?? Environment.GetEnvironmentVariable("DATABASE_URL")
              ?? throw new InvalidOperationException(
                     "No database connection string configured. " +
                     "Set ConnectionStrings__DefaultConnection or DATABASE_URL.");

static string ToNpgsqlConnectionString(string raw)
{
    if (!raw.StartsWith("postgresql://") && !raw.StartsWith("postgres://"))
        return raw; // already in key=value format, pass through unchanged

    var uri = new Uri(raw);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password  = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var host     = uri.Host;
    var port     = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');

    // parse query string for sslmode; default to Require for cloud DBs
    var sslMode = "Require";
    var query = uri.Query.TrimStart('?');
    foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var kv = part.Split('=', 2);
        if (kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase) && kv.Length == 2)
            sslMode = kv[1];
    }

    return $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode={sslMode};Trust Server Certificate=true;";
}

var connectionString = ToNpgsqlConnectionString(rawConn);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        connectionString,
        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorCodesToAdd: null)));

// HttpClient (Google OAuth)
builder.Services.AddHttpClient();

// JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
            ValidateIssuer = true,
            ValidIssuer = "CubeDoku",
            ValidateAudience = true,
            ValidAudience = "CubeDoku",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(
                "https://localhost:5173",
                "http://localhost:5173",
                "http://localhost:5175",
                "https://localhost:7055",
                "https://cubedoku.com",
                "https://www.cubedoku.com",
                "https://cube-doku.vercel.app",
                "https://cubedoku.onrender.com")
            .AllowAnyMethod()
            .WithHeaders("Authorization", "Content-Type", "Accept")
            .AllowCredentials();
    });
});

// Rate Limiting
builder.Services.AddRateLimiter(rateLimiter =>
{
    // auth endpoints: 10 requests per IP per minute
    rateLimiter.AddFixedWindowLimiter("AuthPolicy", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 2;
    });

    rateLimiter.AddPolicy("CompletionPolicy", context =>
    {
        // use the authenticated user's ID as the partition key;
        // fall back to IP so unauthenticated callers are also limited
        var userId = context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                     ?? context.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(userId, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 3,
            Window = TimeSpan.FromMinutes(10),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 1
        });
    });

    // global fallback: 120 requests per IP per minute across all other endpoints
    rateLimiter.AddFixedWindowLimiter("GlobalPolicy", opt =>
    {
        opt.PermitLimit = 120;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 10;
    });

    // return 429 Too Many Requests instead of throwing an exception
    rateLimiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// On Render.com (and similar cloud hosts), HTTPS is terminated at the edge.
// The app receives plain HTTP internally, so UseHttpsRedirection would issue
// 307 redirects on every request (breaking POST→GET and CORS preflight).
// HSTS is also only meaningful when the server itself is serving HTTPS.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
    app.UseHsts();
}

// TEMPORARY: expose exception details to diagnose production 500s — REVERT after fix
app.UseExceptionHandler(errApp => errApp.Run(async context =>
{
    var ex = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    context.Response.ContentType = "application/problem+json";
    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new
    {
        title = "An unexpected error occurred.",
        status = 500,
        detail = ex?.ToString()   // full stack trace — REMOVE before going live
    });
}));

app.UseSecurityHeaders();

app.UseRateLimiter();

app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Run();
