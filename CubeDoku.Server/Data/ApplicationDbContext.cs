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

