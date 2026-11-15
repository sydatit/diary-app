using System.Net;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

/// <summary>A signed-in user must never reach another user's profile or journal.</summary>
public class OwnershipTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public OwnershipTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  [Fact]
  public async Task Another_user_cannot_touch_my_profile_or_journals()
  {
    Session owner = await _factory.NewUserAsync(_http);
    Session other = await _factory.NewUserAsync(_http);
    HttpResponseMessage created = await _http.SendAuthed(HttpMethod.Post, $"/api/users/{owner.UserId}/journals", owner.Token, ApiClient.Journal("2026-11-12"));
    int id = (await created.JsonAsync()).GetProperty("data").GetProperty("journalId").GetInt32();
    string user = $"/api/users/{owner.UserId}";
    string journal = $"{user}/journals/{id}";

    var attempts = new (HttpMethod Method, string Url, object Body)[]
    {
      (HttpMethod.Get, user, null),
      (HttpMethod.Put, user, new { dailyPickupGoal = 1 }),
      (HttpMethod.Delete, user, null),
      (HttpMethod.Get, $"{user}/journals", null),
      (HttpMethod.Get, journal, null),
      (HttpMethod.Post, $"{user}/journals", ApiClient.Journal("2026-11-13")),
      (HttpMethod.Put, journal, ApiClient.Journal("2026-11-12", mood: 1)),
      (HttpMethod.Delete, journal, null),
    };

    foreach (var (method, url, body) in attempts)
    {
      HttpResponseMessage res = await _http.SendAuthed(method, url, other.Token, body);
      Assert.True(res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden,
        $"{method} {url} as another user returned {(int)res.StatusCode}");
    }

    // Nothing changed.
    await _factory.WithDbAsync(async db =>
    {
      var j = await db.Journals.SingleAsync(x => x.JournalId == id);
      Assert.Equal(3, j.Mood);
      Assert.Equal(1, await db.Journals.CountAsync(x => x.UserId == owner.UserId));
      Assert.NotEqual(1, (await db.Users.SingleAsync(u => u.Id == owner.UserId)).DailyPickupGoal);
    });
  }
}
