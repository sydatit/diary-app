using System.Net;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

/// <summary>The one-tap "going to bed" log: one bedtime per user per night, independent of journal entries.</summary>
public class SleepTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public SleepTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private Task<HttpResponseMessage> PutAsync(Session s, string date, object body) =>
    _http.SendAuthed(HttpMethod.Put, $"/api/users/{s.UserId}/sleep/{date}", s.Token, body);

  private async Task<List<(string Date, string Bedtime)>> ListAsync(Session s)
  {
    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Get, $"/api/users/{s.UserId}/sleep", s.Token);
    res.ShouldBe(HttpStatusCode.OK);
    return (await res.JsonAsync()).GetProperty("data").EnumerateArray()
      .Select(x => (x.GetProperty("date").GetString(), x.GetProperty("bedtime").GetString()))
      .ToList();
  }

  [Fact]
  public async Task Logging_needs_no_journal_entry_and_lists_newest_first()
  {
    Session s = await _factory.NewUserAsync(_http);
    Assert.Empty(await ListAsync(s));

    HttpResponseMessage res = await PutAsync(s, "2026-11-10", new { bedtime = "23:30" });
    res.ShouldBe(HttpStatusCode.OK);
    var data = (await res.JsonAsync()).GetProperty("data");
    Assert.Equal("2026-11-10", data.GetProperty("date").GetString());
    Assert.Equal("23:30", data.GetProperty("bedtime").GetString());
    (await PutAsync(s, "2026-11-12", new { bedtime = "00:45" })).ShouldBe(HttpStatusCode.OK);

    Assert.Equal(new[] { ("2026-11-12", "00:45"), ("2026-11-10", "23:30") }, await ListAsync(s));
  }

  [Fact]
  public async Task Logging_the_same_night_again_replaces_the_time()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await PutAsync(s, "2026-11-10", new { bedtime = "23:30" })).ShouldBe(HttpStatusCode.OK);
    (await PutAsync(s, "2026-11-10", new { bedtime = "00:10" })).ShouldBe(HttpStatusCode.OK);

    Assert.Equal(new[] { ("2026-11-10", "00:10") }, await ListAsync(s));
  }

  [Fact]
  public async Task Undo_removes_the_log()
  {
    Session s = await _factory.NewUserAsync(_http);
    string url = $"/api/users/{s.UserId}/sleep/2026-11-10";
    (await PutAsync(s, "2026-11-10", new { bedtime = "23:30" })).ShouldBe(HttpStatusCode.OK);

    (await _http.SendAuthed(HttpMethod.Delete, url, s.Token)).ShouldBe(HttpStatusCode.NoContent);
    Assert.Empty(await ListAsync(s));
    (await _http.SendAuthed(HttpMethod.Delete, url, s.Token)).ShouldBe(HttpStatusCode.NotFound);
  }

  [Theory]
  [InlineData("2026-11-10", "25:00")]
  [InlineData("2026-11-10", "23:60")]
  [InlineData("2026-11-10", "9:05")]
  [InlineData("2026-11-10", "11pm")]
  [InlineData("2026-11-10", null)]
  [InlineData("2026-13-40", "23:30")]
  [InlineData("tonight", "23:30")]
  public async Task Invalid_input_is_400(string date, string bedtime)
  {
    Session s = await _factory.NewUserAsync(_http);
    (await PutAsync(s, date, new { bedtime })).ShouldBe(HttpStatusCode.BadRequest);
    Assert.Empty(await ListAsync(s));
  }

  [Fact]
  public async Task Two_users_can_log_the_same_night()
  {
    Session a = await _factory.NewUserAsync(_http);
    Session b = await _factory.NewUserAsync(_http);
    (await PutAsync(a, "2026-11-10", new { bedtime = "22:00" })).ShouldBe(HttpStatusCode.OK);
    (await PutAsync(b, "2026-11-10", new { bedtime = "01:00" })).ShouldBe(HttpStatusCode.OK);

    Assert.Equal(new[] { ("2026-11-10", "22:00") }, await ListAsync(a));
    Assert.Equal(new[] { ("2026-11-10", "01:00") }, await ListAsync(b));
  }

  [Fact]
  public async Task Requires_sign_in()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await _http.SendAuthed(HttpMethod.Get, $"/api/users/{s.UserId}/sleep", null)).ShouldBe(HttpStatusCode.Unauthorized);
    (await _http.SendAuthed(HttpMethod.Put, $"/api/users/{s.UserId}/sleep/2026-11-10", null, new { bedtime = "23:30" })).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Deleting_the_account_removes_its_sleep_logs()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await PutAsync(s, "2026-11-10", new { bedtime = "23:30" })).ShouldBe(HttpStatusCode.OK);

    (await _http.SendAuthed(HttpMethod.Delete, $"/api/users/{s.UserId}", s.Token)).ShouldBe(HttpStatusCode.NoContent);

    await _factory.WithDbAsync(async db => Assert.False(await db.SleepLogs.AnyAsync(x => x.UserId == s.UserId)));
  }
}
