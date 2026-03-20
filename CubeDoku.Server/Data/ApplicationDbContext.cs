using Microsoft.EntityFrameworkCore;
using CubeDoku.Server.Models.UserModels;

namespace CubeDoku.Server.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<GameResult> GameResults => Set<GameResult>();
}
