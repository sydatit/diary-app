using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CranberryAPI.Models;
using CranberryAPI.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace CranberryAPI.Tests.Infrastructure;

/// <summary>
/// The real API over TestServer, with a throwaway SQLite database, a fake mailbox and a fake Gemini.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
  public const string JwtSecret = "test-secret-that-is-at-least-32-characters-long";
  public const string JwtIssuer = "http://test.local";

  private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"cranberry-test-{Guid.NewGuid():N}.db");

  public FakeEmailService Email { get; } = new();
  public FakeGemini Gemini { get; } = new();

  static ApiFactory()
  {
    // .NET 6 minimal hosting reads builder.Configuration before WebApplicationFactory can add settings,
    // so the values Program.cs needs at startup come from environment variables.
    Environment.SetEnvironmentVariable("JWT__Secret", JwtSecret);
    Environment.SetEnvironmentVariable("JWT__ValidIssuer", JwtIssuer);
    Environment.SetEnvironmentVariable("JWT__ValidAudience", JwtIssuer);
    Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "false");
    Environment.SetEnvironmentVariable("Logging__LogLevel__Default", "Warning");
    Environment.SetEnvironmentVariable("Logging__LogLevel__Microsoft.AspNetCore", "Warning");
    Environment.SetEnvironmentVariable("Logging__LogLevel__Microsoft.AspNetCore.HttpsPolicy", "Error");
    Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", "Server=unused");
  }

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    builder.UseEnvironment("Testing");
    builder.ConfigureTestServices(services =>
    {
      services.RemoveAll<DbContextOptions<CranberryAPIContext>>();
      services.AddDbContext<CranberryAPIContext>(o => o.UseSqlite($"Data Source={_dbPath}"));

      services.RemoveAll<IEmailService>();
      services.AddSingleton<IEmailService>(Email);
      services.RemoveAll<IGeminiAudioService>();
      services.AddSingleton<IGeminiAudioService>(Gemini);
    });
  }

  protected override IHost CreateHost(IHostBuilder builder)
  {
    IHost host = base.CreateHost(builder);
    using IServiceScope scope = host.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<CranberryAPIContext>().Database.EnsureCreated();
    return host;
  }

  /// <summary>Run something against the database directly (seed or inspect state).</summary>
  public async Task WithDbAsync(Func<CranberryAPIContext, Task> action)
  {
    using IServiceScope scope = Services.CreateScope();
    await action(scope.ServiceProvider.GetRequiredService<CranberryAPIContext>());
  }

  /// <summary>A token signed with the test key; used to forge tokens the API must reject.</summary>
  public static string MintToken(string userId, string stamp = null, DateTime? expires = null)
  {
    var claims = new List<Claim> { new("userId", userId), new("userName", "forged") };
    if (stamp != null) claims.Add(new Claim("stamp", stamp));
    var token = new JwtSecurityToken(
      issuer: JwtIssuer,
      audience: JwtIssuer,
      claims: claims,
      notBefore: expires.HasValue ? expires.Value.AddHours(-1) : null,
      expires: expires ?? DateTime.UtcNow.AddHours(1),
      signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret)), SecurityAlgorithms.HmacSha256));
    return new JwtSecurityTokenHandler().WriteToken(token);
  }

  protected override void Dispose(bool disposing)
  {
    base.Dispose(disposing);
    if (!disposing) return;
    Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
    foreach (string f in new[] { _dbPath, _dbPath + "-wal", _dbPath + "-shm" })
    {
      try { File.Delete(f); } catch (IOException) { }
    }
  }
}
