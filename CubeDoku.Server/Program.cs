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
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
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

//  CORS 
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
                "https://cube-doku.vercel.app")
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

app.UseHttpsRedirection();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/api/error");
}

app.UseSecurityHeaders();

app.UseRateLimiter();

app.UseCors("FrontendPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Map("/api/error", (HttpContext context) =>
{
    context.Response.ContentType = "application/problem+json";
    return Results.Problem(
        title: "An unexpected error occurred.",
        detail: null,          // never expose internal detail in production
        statusCode: 500);
});

app.Run();

