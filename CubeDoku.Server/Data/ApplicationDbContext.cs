// ApplicationDbContext.cs
// EF Core database context for CubeDoku
// Currently only has two tables: Users and GameResults
// I kept this file as thin as possible - no Fluent API config here yet,
// relying on EF conventions which works fine for this scale
// If I need to add indexes later (like on PuzzleDate for leaderboard queries)
// I'd add OnModelCreating here

using Microsoft.EntityFrameworkCore;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    // Users table - stores registered accounts
    public DbSet<User> Users => Set<User>();

    // GameResults table - one row per completed puzzle per user
    public DbSet<GameResult> GameResults => Set<GameResult>();
}

