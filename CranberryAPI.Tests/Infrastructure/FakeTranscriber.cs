using CranberryAPI.Services;
using Microsoft.AspNetCore.Http;

namespace CranberryAPI.Tests.Infrastructure;

/// <summary>Stands in for the Whisper server; each test sets what the next answer streams (or throws).</summary>
public class FakeTranscriber : ITranscriptionService
{
  public Func<IAsyncEnumerable<string>> Next { get; set; } = () => Pieces("ok");

  public static async IAsyncEnumerable<string> Pieces(params string[] pieces)
  {
    foreach (string p in pieces)
    {
      await Task.Yield();
      yield return p;
    }
  }

  public static async IAsyncEnumerable<string> Throws(Exception ex)
  {
    await Task.Yield();
    throw ex;
#pragma warning disable CS0162 // makes this an iterator
    yield break;
#pragma warning restore CS0162
  }

  public async Task<string> TranscribeAsync(IFormFile audioFile, CancellationToken ct = default)
  {
    var parts = new List<string>();
    await foreach (string p in StreamTranscriptAsync(audioFile, ct)) parts.Add(p);
    return string.Concat(parts).Trim();
  }

  public IAsyncEnumerable<string> StreamTranscriptAsync(IFormFile audioFile, CancellationToken ct = default) => Next();
}
