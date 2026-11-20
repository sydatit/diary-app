using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CranberryAPI.Models;

public class CranberryAPIContext : IdentityDbContext<ApplicationUser>
{
  public DbSet<Journal> Journals { get; set; }
  public DbSet<SleepLog> SleepLogs { get; set; }

  public CranberryAPIContext(DbContextOptions<CranberryAPIContext> options) : base(options) { }

  protected override void OnModelCreating(ModelBuilder builder)
  {
    base.OnModelCreating(builder);

    builder.Entity<Journal>()
      .HasIndex(j => new { j.UserId, j.Date })
      .IsUnique();

    builder.Entity<SleepLog>()
      .HasIndex(s => new { s.UserId, s.Date })
      .IsUnique();
    builder.Entity<SleepLog>()
      .HasOne<ApplicationUser>()
      .WithMany()
      .HasForeignKey(s => s.UserId)
      .OnDelete(DeleteBehavior.Cascade)
      .IsRequired();
  }
}
