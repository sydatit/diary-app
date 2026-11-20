using System.Net;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

public class JournalTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public JournalTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private async Task<int> CreateAsync(Session s, string date)
  {
    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Post, $"/api/users/{s.UserId}/journals", s.Token, ApiClient.Journal(date));
    res.ShouldBe(HttpStatusCode.Created);
    return (await res.JsonAsync()).GetProperty("data").GetProperty("journalId").GetInt32();
  }

  [Fact]
  public async Task Create_read_update_delete()
  {
    Session s = await _factory.NewUserAsync(_http);
    int id = await CreateAsync(s, "2026-11-01");
    string url = $"/api/users/{s.UserId}/journals/{id}";

    var got = (await (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal("2026-11-01", got.GetProperty("date").GetString());
    Assert.Equal("A calm day", got.GetProperty("dayReflection").GetString());

    (await _http.SendAuthed(HttpMethod.Put, url, s.Token, ApiClient.Journal("2026-11-01", mood: 5))).ShouldBe(HttpStatusCode.NoContent);
    got = (await (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal(5, got.GetProperty("mood").GetInt32());

    (await _http.SendAuthed(HttpMethod.Delete, url, s.Token)).ShouldBe(HttpStatusCode.NoContent);
    (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).ShouldBe(HttpStatusCode.NotFound);
  }

  [Fact]
  public async Task List_is_newest_first()
  {
    Session s = await _factory.NewUserAsync(_http);
    await CreateAsync(s, "2026-11-01");
    await CreateAsync(s, "2026-11-03");
    await CreateAsync(s, "2026-11-02");

    var data = (await (await _http.SendAuthed(HttpMethod.Get, $"/api/users/{s.UserId}/journals", s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal(new[] { "2026-11-03", "2026-11-02", "2026-11-01" }, data.EnumerateArray().Select(j => j.GetProperty("date").GetString()));
  }

  [Fact]
  public async Task Second_entry_on_the_same_day_is_409_DuplicateDate()
  {
    Session s = await _factory.NewUserAsync(_http);
    await CreateAsync(s, "2026-11-05");

    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Post, $"/api/users/{s.UserId}/journals", s.Token, ApiClient.Journal("2026-11-05"));
    res.ShouldBe(HttpStatusCode.Conflict);
    Assert.Equal("DuplicateDate", await res.CodeAsync());
  }

  [Fact]
  public async Task Moving_an_entry_onto_a_taken_day_is_409_DuplicateDate()
  {
    Session s = await _factory.NewUserAsync(_http);
    await CreateAsync(s, "2026-11-06");
    int id = await CreateAsync(s, "2026-11-07");

    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Put, $"/api/users/{s.UserId}/journals/{id}", s.Token, ApiClient.Journal("2026-11-06"));
    res.ShouldBe(HttpStatusCode.Conflict);
    Assert.Equal("DuplicateDate", await res.CodeAsync());
  }

  [Fact]
  public async Task Two_users_can_write_on_the_same_day()
  {
    Session a = await _factory.NewUserAsync(_http);
    Session b = await _factory.NewUserAsync(_http);
    await CreateAsync(a, "2026-11-08");
    await CreateAsync(b, "2026-11-08");
  }

  [Theory]
  [InlineData("2026/11/09", 3)]
  [InlineData("2026-11-09", 6)]
  [InlineData("2026-11-09", 0)]
  public async Task Invalid_input_is_400(string date, int mood)
  {
    Session s = await _factory.NewUserAsync(_http);
    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Post, $"/api/users/{s.UserId}/journals", s.Token, ApiClient.Journal(date, mood));
    res.ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Bedtime_round_trips_and_can_be_cleared()
  {
    Session s = await _factory.NewUserAsync(_http);
    int id = await CreateAsync(s, "2026-11-10");
    string url = $"/api/users/{s.UserId}/journals/{id}";

    var got = (await (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal("23:30", got.GetProperty("bedtime").GetString());

    (await _http.SendAuthed(HttpMethod.Put, url, s.Token, ApiClient.Journal("2026-11-10", bedtime: "00:45"))).ShouldBe(HttpStatusCode.NoContent);
    got = (await (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal("00:45", got.GetProperty("bedtime").GetString());

    // Bedtime is optional: null (and an empty string) clear it.
    (await _http.SendAuthed(HttpMethod.Put, url, s.Token, ApiClient.Journal("2026-11-10", bedtime: null))).ShouldBe(HttpStatusCode.NoContent);
    got = (await (await _http.SendAuthed(HttpMethod.Get, url, s.Token)).JsonAsync()).GetProperty("data");
    Assert.Equal(System.Text.Json.JsonValueKind.Null, got.GetProperty("bedtime").ValueKind);
  }

  [Theory]
  [InlineData("25:00")]
  [InlineData("23:60")]
  [InlineData("9:05")]
  [InlineData("11pm")]
  public async Task Invalid_bedtime_is_400(string bedtime)
  {
    Session s = await _factory.NewUserAsync(_http);
    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Post, $"/api/users/{s.UserId}/journals", s.Token, ApiClient.Journal("2026-11-12", bedtime: bedtime));
    res.ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Updating_the_profile_changes_only_the_given_fields()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await _http.SendAuthed(HttpMethod.Put, $"/api/users/{s.UserId}", s.Token,
      new { detoxStartDate = "2026-10-01", dailyPickupGoal = 40 })).ShouldBe(HttpStatusCode.NoContent);
    (await _http.SendAuthed(HttpMethod.Put, $"/api/users/{s.UserId}", s.Token, new { baselinePickups = 90 })).ShouldBe(HttpStatusCode.NoContent);

    var p = await (await _http.SendAuthed(HttpMethod.Get, "/api/users/profile", s.Token)).JsonAsync();
    Assert.Equal("2026-10-01", p.GetProperty("detoxStartDate").GetString());
    Assert.Equal(40, p.GetProperty("dailyPickupGoal").GetInt32());
    Assert.Equal(90, p.GetProperty("baselinePickups").GetInt32());
  }

  [Fact]
  public async Task Deleting_the_account_removes_its_journals()
  {
    Session s = await _factory.NewUserAsync(_http);
    await CreateAsync(s, "2026-11-10");
    await CreateAsync(s, "2026-11-11");

    (await _http.SendAuthed(HttpMethod.Delete, $"/api/users/{s.UserId}", s.Token)).ShouldBe(HttpStatusCode.NoContent);

    await _factory.WithDbAsync(async db =>
    {
      Assert.False(await db.Journals.AnyAsync(j => j.UserId == s.UserId));
      Assert.False(await db.Users.AnyAsync(u => u.Id == s.UserId));
    });
  }
}
