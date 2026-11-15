using System.Net;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

public class AuthTokenTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public AuthTokenTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private Task<HttpResponseMessage> Profile(string token) => _http.SendAuthed(HttpMethod.Get, "/api/users/profile", token);

  [Fact]
  public async Task No_token_is_401()
  {
    (await Profile(null)).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Garbage_token_is_401()
  {
    (await Profile("not-a-jwt")).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Token_without_a_security_stamp_is_401()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await Profile(ApiFactory.MintToken(s.UserId))).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Token_with_a_wrong_stamp_is_401()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await Profile(ApiFactory.MintToken(s.UserId, "made-up-stamp"))).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Expired_token_is_401()
  {
    Session s = await _factory.NewUserAsync(_http);
    string stamp = null;
    await _factory.WithDbAsync(async db => stamp = (await db.Users.SingleAsync(u => u.Id == s.UserId)).SecurityStamp);

    (await Profile(ApiFactory.MintToken(s.UserId, stamp, DateTime.UtcNow.AddMinutes(-10)))).ShouldBe(HttpStatusCode.Unauthorized);
    (await Profile(ApiFactory.MintToken(s.UserId, stamp))).ShouldBe(HttpStatusCode.OK); // same claims, still valid
  }

  [Fact]
  public async Task Token_is_valid_for_30_days_by_default()
  {
    Session s = await _factory.NewUserAsync(_http);
    var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(s.Token);
    Assert.InRange(jwt.ValidTo, DateTime.UtcNow.AddDays(29.9), DateTime.UtcNow.AddDays(30.1));
  }

  [Fact]
  public async Task Sign_out_everywhere_revokes_every_token()
  {
    Session s = await _factory.NewUserAsync(_http);
    string other = (await (await _http.SignInAsync(s.Email)).JsonAsync()).GetProperty("token").GetString();

    (await _http.SendAuthed(HttpMethod.Post, "/api/users/signout-all", s.Token)).ShouldBe(HttpStatusCode.NoContent);

    (await Profile(s.Token)).ShouldBe(HttpStatusCode.Unauthorized);
    (await Profile(other)).ShouldBe(HttpStatusCode.Unauthorized);
    string fresh = (await (await _http.SignInAsync(s.Email)).JsonAsync()).GetProperty("token").GetString();
    (await Profile(fresh)).ShouldBe(HttpStatusCode.OK);
  }

  [Fact]
  public async Task Deleting_the_account_revokes_its_token()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await _http.SendAuthed(HttpMethod.Delete, $"/api/users/{s.UserId}", s.Token)).ShouldBe(HttpStatusCode.NoContent);
    (await Profile(s.Token)).ShouldBe(HttpStatusCode.Unauthorized);
  }
}
