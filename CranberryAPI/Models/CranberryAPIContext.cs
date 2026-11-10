using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CranberryAPI.Models;

public class CranberryAPIContext : IdentityDbContext<ApplicationUser>
{
  public DbSet<Journal> Journals { get; set; }

  public CranberryAPIContext(DbContextOptions<CranberryAPIContext> options) : base(options) { }

  protected override void OnModelCreating(ModelBuilder builder)
  {
    base.OnModelCreating(builder);

    builder.Entity<Journal>()
      .HasIndex(j => new { j.UserId, j.Date })
      .IsUnique();
  }
}
