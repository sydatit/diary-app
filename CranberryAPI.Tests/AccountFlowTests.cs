using System.Net;
using System.Net.Http.Json;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

public class AccountFlowTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public AccountFlowTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  [Fact]
  public async Task Register_verify_then_profile_works()
  {
    Session s = await _factory.NewUserAsync(_http);

    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Get, "/api/users/profile", s.Token);
    res.ShouldBe(HttpStatusCode.OK);
    Assert.Equal(s.Email, (await res.JsonAsync()).GetProperty("email").GetString());
  }

  [Fact]
  public async Task Sign_in_before_verifying_is_refused_with_EmailNotConfirmed()
  {
    string email = ApiClient.NewEmail();
    (await _http.RegisterAsync(email)).ShouldBe(HttpStatusCode.OK);

    HttpResponseMessage res = await _http.SignInAsync(email);
    res.ShouldBe(HttpStatusCode.Forbidden);
    Assert.Equal("EmailNotConfirmed", await res.CodeAsync());
  }

  [Fact]
  public async Task Sign_in_after_verifying_returns_a_working_token()
  {
    Session s = await _factory.NewUserAsync(_http);

    HttpResponseMessage res = await _http.SignInAsync(s.Email);
    res.ShouldBe(HttpStatusCode.OK);
    string token = (await res.JsonAsync()).GetProperty("token").GetString();
    (await _http.SendAuthed(HttpMethod.Get, "/api/users/profile", token)).ShouldBe(HttpStatusCode.OK);
  }

  [Fact]
  public async Task Wrong_password_is_refused()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await _http.SignInAsync(s.Email, "Wr0ng-password")).ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Registering_a_verified_email_again_is_refused()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await _http.RegisterAsync(s.Email)).ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Wrong_code_is_Invalid()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    string wrong = _factory.Email.LatestCode(email) == "000000" ? "111111" : "000000";

    HttpResponseMessage res = await _http.VerifyAsync(email, wrong);
    res.ShouldBe(HttpStatusCode.BadRequest);
    Assert.Equal("Invalid", await res.CodeAsync());
  }

  [Fact]
  public async Task Expired_code_is_Expired()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    await _factory.WithDbAsync(async db =>
    {
      var user = await db.Users.SingleAsync(u => u.Email == email);
      user.EmailCodeExpiresAt = DateTime.UtcNow.AddMinutes(-1);
      await db.SaveChangesAsync();
    });

    HttpResponseMessage res = await _http.VerifyAsync(email, _factory.Email.LatestCode(email));
    Assert.Equal("Expired", await res.CodeAsync());
  }

  [Fact]
  public async Task Five_wrong_codes_lock_the_code_even_for_the_right_one()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    string code = _factory.Email.LatestCode(email);
    string wrong = code == "000000" ? "111111" : "000000";

    for (int i = 0; i < 5; i++) await _http.VerifyAsync(email, wrong);

    HttpResponseMessage res = await _http.VerifyAsync(email, code);
    Assert.Equal("TooManyAttempts", await res.CodeAsync());
  }

  [Fact]
  public async Task Resending_a_code_too_soon_is_rate_limited()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);

    HttpResponseMessage res = await _http.PostAsJsonAsync("/api/users/resend-code", new { email });
    res.ShouldBe((HttpStatusCode)429);
    Assert.True((await res.JsonAsync()).GetProperty("retryAfter").GetInt32() > 0);
  }

  [Fact]
  public async Task Resending_after_the_cooldown_sends_a_new_code()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    await _factory.WithDbAsync(async db =>
    {
      var user = await db.Users.SingleAsync(u => u.Email == email);
      user.EmailCodeSentAt = DateTime.UtcNow.AddMinutes(-2);
      await db.SaveChangesAsync();
    });

    (await _http.PostAsJsonAsync("/api/users/resend-code", new { email })).ShouldBe(HttpStatusCode.OK);
    Assert.Equal(2, _factory.Email.CountTo(email));
    (await _http.VerifyAsync(email, _factory.Email.LatestCode(email))).ShouldBe(HttpStatusCode.OK);
  }
}
