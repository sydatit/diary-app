using System.Runtime.CompilerServices;
using CranberryAPI.Services;
using Microsoft.AspNetCore.Http;

namespace CranberryAPI.Tests.Infrastructure;

/// <summary>Stands in for Gemini; each test sets what the next answer streams (or throws).</summary>
public class FakeGemini : IGeminiAudioService
{
  public Func<IAsyncEnumerable<string>> Next { get; set; } = () => Pieces("- ok");
  public string LastText { get; private set; }
  public string LastSection { get; private set; }

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

  public async Task<string> SummarizeAsync(IFormFile audioFile, string section = null, CancellationToken ct = default)
  {
    var parts = new List<string>();
    await foreach (string p in StreamSummaryAsync(audioFile, section, ct)) parts.Add(p);
    return string.Concat(parts).Trim();
  }

  public IAsyncEnumerable<string> StreamSummaryAsync(IFormFile audioFile, string section = null, CancellationToken ct = default)
  {
    LastSection = section;
    return Next();
  }

  public IAsyncEnumerable<string> StreamTextSummaryAsync(string transcript, string section = null, CancellationToken ct = default)
  {
    LastText = transcript;
    LastSection = section;
    return Next();
  }
}
