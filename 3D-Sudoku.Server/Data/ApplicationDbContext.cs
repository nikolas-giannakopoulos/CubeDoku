using Microsoft.EntityFrameworkCore;
using ThreeDSudoku.Server.Models.UserModels;

namespace ThreeDSudoku.Server.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<GameResult> GameResults => Set<GameResult>();
}
