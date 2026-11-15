using System.Net;
using CranberryAPI.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CranberryAPI.Tests;

/// <summary>Holes found in the November 2026 review; each test fails on the code before its fix.</summary>
public class SecurityRegressionTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public SecurityRegressionTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private Task AllowResendAsync(string email) => _factory.WithDbAsync(async db =>
  {
    var user = await db.Users.SingleAsync(u => u.Email == email);
    user.EmailCodeSentAt = DateTime.UtcNow.AddMinutes(-2);
    await db.SaveChangesAsync();
  });

  [Fact]
  public async Task Re_registering_a_pending_email_cannot_replace_its_password()
  {
    // The owner registers but hasn't verified yet; someone else re-registers the same email with their password.
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email, "Owner-Passw0rd!");
    await AllowResendAsync(email);

    HttpResponseMessage attack = await _http.RegisterAsync(email, "Attacker-Passw0rd!");
    attack.ShouldBe(HttpStatusCode.BadRequest);
    Assert.Equal("PendingVerification", await attack.CodeAsync());

    // The owner verifies with the code in their inbox: only the owner's password works afterwards.
    (await _http.VerifyAsync(email, _factory.Email.LatestCode(email))).ShouldBe(HttpStatusCode.OK);
    (await _http.SignInAsync(email, "Attacker-Passw0rd!")).ShouldBe(HttpStatusCode.BadRequest);
    (await _http.SignInAsync(email, "Owner-Passw0rd!")).ShouldBe(HttpStatusCode.OK);
  }

  [Fact]
  public async Task Re_registering_a_pending_email_with_the_same_password_resends_the_code()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    await AllowResendAsync(email);

    (await _http.RegisterAsync(email, userName: "renamed" + Guid.NewGuid().ToString("N")[..6])).ShouldBe(HttpStatusCode.OK);
    Assert.Equal(2, _factory.Email.CountTo(email));
    (await _http.VerifyAsync(email, _factory.Email.LatestCode(email))).ShouldBe(HttpStatusCode.OK);
  }

  [Fact]
  public async Task Parallel_wrong_codes_all_count_towards_the_limit()
  {
    string email = ApiClient.NewEmail();
    await _http.RegisterAsync(email);
    string code = _factory.Email.LatestCode(email);
    string wrong = code == "000000" ? "111111" : "000000";

    await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => _http.VerifyAsync(email, wrong)));

    HttpResponseMessage res = await _http.VerifyAsync(email, code);
    Assert.Equal("TooManyAttempts", await res.CodeAsync());
  }

  [Fact]
  public async Task Repeated_wrong_passwords_lock_the_account_for_a_while()
  {
    Session s = await _factory.NewUserAsync(_http);

    for (int i = 0; i < 5; i++) await _http.SignInAsync(s.Email, "Wr0ng-password");

    HttpResponseMessage res = await _http.SignInAsync(s.Email);
    res.ShouldBe((HttpStatusCode)429);
    Assert.Equal("LockedOut", await res.CodeAsync());
    Assert.True((await res.JsonAsync()).GetProperty("retryAfter").GetInt32() > 0);
  }

  [Fact]
  public async Task A_successful_sign_in_resets_the_failed_count()
  {
    Session s = await _factory.NewUserAsync(_http);

    for (int i = 0; i < 4; i++) await _http.SignInAsync(s.Email, "Wr0ng-password");
    (await _http.SignInAsync(s.Email)).ShouldBe(HttpStatusCode.OK);
    for (int i = 0; i < 4; i++) await _http.SignInAsync(s.Email, "Wr0ng-password");

    (await _http.SignInAsync(s.Email)).ShouldBe(HttpStatusCode.OK);
  }

  [Fact]
  public async Task The_open_mail_relay_endpoint_is_gone()
  {
    Session s = await _factory.NewUserAsync(_http);
    int before = _factory.Email.Sent.Count;

    HttpResponseMessage res = await _http.SendAuthed(HttpMethod.Post, "/api/sendmail", s.Token,
      new { receiver = "victim@example.com", header = "Hi", body = "phishing" });

    res.ShouldBe(HttpStatusCode.NotFound);
    Assert.Equal(before, _factory.Email.Sent.Count);
  }
}
