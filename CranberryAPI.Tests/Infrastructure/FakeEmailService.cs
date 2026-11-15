using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using CranberryAPI.Services;

namespace CranberryAPI.Tests.Infrastructure;

public record SentEmail(string To, string Subject, string Body);

public class FakeEmailService : IEmailService
{
  public ConcurrentQueue<SentEmail> Sent { get; } = new();

  public Task SendAsync(string to, string subject, string body, string htmlBody = null)
  {
    Sent.Enqueue(new SentEmail(to, subject, body));
    return Task.CompletedTask;
  }

  /// <summary>The 6-digit code in the newest email to this address.</summary>
  public string LatestCode(string to)
  {
    SentEmail mail = Sent.LastOrDefault(m => m.To.Equals(to, StringComparison.OrdinalIgnoreCase))
      ?? throw new InvalidOperationException($"No email was sent to {to}.");
    return Regex.Match(mail.Body, @"\b\d{6}\b").Value;
  }

  public int CountTo(string to) => Sent.Count(m => m.To.Equals(to, StringComparison.OrdinalIgnoreCase));
}
