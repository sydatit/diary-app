using System.Diagnostics;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace CranberryAPI.Services;

public class WhisperSettings
{
  // Env: Whisper__Url. Default is the `transcriber` service in docker-compose.yml.
  public string Url { get; set; } = "http://transcriber:8000";
}

/// <summary>The transcriber answered with an error or with something unreadable.</summary>
public class TranscriptionException : Exception
{
  public TranscriptionException(string message) : base(message) { }
}

/// <summary>The recording has no speech (silence, noise, music...), so there is nothing to write.</summary>
public class NoSpeechException : Exception
{
  public NoSpeechException() : base("The recording contains no speech.") { }
}

public interface ITranscriptionService
{
  /// <summary>Waits for the whole transcript.</summary>
  Task<string> TranscribeAsync(IFormFile audioFile, CancellationToken ct = default);

  /// <summary>
  /// Streams the transcript as pieces to append, one per spoken segment (each on its own line).
  /// Throws <see cref="NoSpeechException"/> if nothing was said.
  /// </summary>
  IAsyncEnumerable<string> StreamTranscriptAsync(IFormFile audioFile, CancellationToken ct = default);
}

/// <summary>Speech-to-text by the local Whisper server (see /transcriber): upload the audio, read NDJSON segments back.</summary>
public class WhisperTranscriptionService : ITranscriptionService
{
  public const string HttpClientName = "whisper";

  private readonly IHttpClientFactory _httpFactory;
  private readonly WhisperSettings _settings;
  private readonly ILogger<WhisperTranscriptionService> _logger;

  public WhisperTranscriptionService(IHttpClientFactory httpFactory, IOptions<WhisperSettings> options,
    ILogger<WhisperTranscriptionService> logger)
  {
    _httpFactory = httpFactory;
    _settings = options.Value;
    _logger = logger;
  }

  public async Task<string> TranscribeAsync(IFormFile audioFile, CancellationToken ct = default)
  {
    var sb = new StringBuilder();
    await foreach (string piece in StreamTranscriptAsync(audioFile, ct))
    {
      sb.Append(piece);
    }
    return sb.ToString().Trim();
  }

  public async IAsyncEnumerable<string> StreamTranscriptAsync(IFormFile audioFile,
    [EnumeratorCancellation] CancellationToken ct = default)
  {
    var sw = Stopwatch.StartNew();
    await using Stream audio = audioFile.OpenReadStream();
    var fileContent = new StreamContent(audio);
    if (MediaTypeHeaderValue.TryParse(audioFile.ContentType, out MediaTypeHeaderValue type))
    {
      fileContent.Headers.ContentType = type;
    }
    using var form = new MultipartFormDataContent();
    // The transcriber only uses the extension, as a hint for the decoder.
    form.Add(fileContent, "file", "voice" + Path.GetExtension(audioFile.FileName ?? ""));

    using var req = new HttpRequestMessage(HttpMethod.Post, _settings.Url.TrimEnd('/') + "/transcribe") { Content = form };
    HttpClient client = _httpFactory.CreateClient(HttpClientName);
    // ResponseHeadersRead: read segments as the transcriber writes them.
    using HttpResponseMessage res = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
    if (!res.IsSuccessStatusCode)
    {
      string body = await res.Content.ReadAsStringAsync(ct);
      _logger.LogError("Transcriber returned {Status}: {Body}", (int)res.StatusCode, body);
      throw new TranscriptionException($"Transcriber returned HTTP {(int)res.StatusCode}.");
    }

    long firstMs = -1;
    int segments = 0;
    bool done = false;
    using Stream stream = await res.Content.ReadAsStreamAsync(ct);
    using var reader = new StreamReader(stream, Encoding.UTF8);
    string line;
    while ((line = await reader.ReadLineAsync()) != null)
    {
      ct.ThrowIfCancellationRequested();
      if (string.IsNullOrWhiteSpace(line)) continue;

      (string text, string error, bool isDone) = Parse(line);
      if (error != null)
      {
        _logger.LogError("Transcriber failed: {Error}", error);
        throw new TranscriptionException("Transcriber could not process the recording.");
      }
      if (isDone)
      {
        done = true;
        break;
      }
      if (string.IsNullOrWhiteSpace(text)) continue;

      if (firstMs < 0) firstMs = sw.ElapsedMilliseconds;
      // One segment per line; the newline goes in front so the transcript has no trailing one.
      yield return segments++ == 0 ? text.Trim() : "\n" + text.Trim();
    }

    _logger.LogInformation("Voice-to-diary: {Bytes} B {Mime}, first text={FirstMs}ms, total={TotalMs}ms, {Segments} segments",
      audioFile.Length, audioFile.ContentType, firstMs, sw.ElapsedMilliseconds, segments);

    if (!done)
    {
      throw new TranscriptionException("Transcriber closed the connection before it finished.");
    }
    if (segments == 0)
    {
      throw new NoSpeechException();
    }
  }

  /// <summary>One NDJSON line: {"text": "..."} | {"done": true, ...} | {"error": "..."}.</summary>
  private (string Text, string Error, bool Done) Parse(string json)
  {
    try
    {
      using JsonDocument doc = JsonDocument.Parse(json);
      JsonElement root = doc.RootElement;
      if (root.TryGetProperty("error", out JsonElement error)) return (null, error.ToString(), false);
      if (root.TryGetProperty("done", out JsonElement d) && d.ValueKind == JsonValueKind.True) return (null, null, true);
      return (root.TryGetProperty("text", out JsonElement text) ? text.GetString() : null, null, false);
    }
    catch (Exception ex) when (ex is JsonException || ex is InvalidOperationException)
    {
      _logger.LogError(ex, "Could not parse transcriber line: {Body}", json);
      throw new TranscriptionException("Transcriber response was not valid JSON.");
    }
  }
}
