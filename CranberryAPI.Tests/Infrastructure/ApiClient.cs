using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace CranberryAPI.Tests.Infrastructure;

public record Session(string Email, string Password, string UserId, string Token);

/// <summary>Small helpers so tests read like the API calls the web app makes.</summary>
public static class ApiClient
{
  public const string Password = "Passw0rd!";

  public static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

  public static Task<HttpResponseMessage> RegisterAsync(this HttpClient http, string email, string password = Password, string userName = null) =>
    http.PostAsJsonAsync("/api/users/register", new
    {
      email,
      userName = userName ?? "u" + Guid.NewGuid().ToString("N")[..10],
      password,
    });

  public static Task<HttpResponseMessage> VerifyAsync(this HttpClient http, string email, string code) =>
    http.PostAsJsonAsync("/api/users/verify-email", new { email, code });

  public static Task<HttpResponseMessage> SignInAsync(this HttpClient http, string email, string password = Password) =>
    http.PostAsJsonAsync("/api/users/signin", new { email, password });

  /// <summary>Register, read the code from the fake mailbox and verify: a ready-to-use signed-in user.</summary>
  public static async Task<Session> NewUserAsync(this ApiFactory factory, HttpClient http)
  {
    string email = NewEmail();
    (await http.RegisterAsync(email)).EnsureSuccessStatusCode();
    HttpResponseMessage res = await http.VerifyAsync(email, factory.Email.LatestCode(email));
    res.EnsureSuccessStatusCode();
    JsonElement body = await res.JsonAsync();
    return new Session(email, Password, body.GetProperty("userId").GetString(), body.GetProperty("token").GetString());
  }

  public static HttpRequestMessage Authed(HttpMethod method, string url, string token, object json = null)
  {
    var req = new HttpRequestMessage(method, url);
    if (token != null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    if (json != null) req.Content = JsonContent.Create(json);
    return req;
  }

  public static Task<HttpResponseMessage> SendAuthed(this HttpClient http, HttpMethod method, string url, string token, object json = null) =>
    http.SendAsync(Authed(method, url, token, json));

  public static async Task<JsonElement> JsonAsync(this HttpResponseMessage res)
  {
    string text = await res.Content.ReadAsStringAsync();
    return JsonDocument.Parse(text).RootElement.Clone();
  }

  public static async Task<string> CodeAsync(this HttpResponseMessage res)
  {
    JsonElement body = await res.JsonAsync();
    return body.TryGetProperty("code", out JsonElement c) ? c.GetString() : null;
  }

  public static void ShouldBe(this HttpResponseMessage res, HttpStatusCode expected)
  {
    if (res.StatusCode != expected)
    {
      string body = res.Content.ReadAsStringAsync().GetAwaiter().GetResult();
      throw new Xunit.Sdk.XunitException($"Expected {(int)expected} {expected}, got {(int)res.StatusCode} {res.StatusCode}: {body}");
    }
  }

  public static object Journal(string date, int mood = 3, string bedtime = "23:30") => new
  {
    date,
    mood,
    urgeLevel = 5,
    pickups = 10,
    stressLevel = 4,
    bedtime,
    dayReflection = "A calm day",
  };
}
