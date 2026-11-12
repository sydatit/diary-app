using System.Diagnostics;
using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace CranberryAPI.Services;

public class GeminiSettings
{
  // Env: Gemini__ApiKey (config keys are case-insensitive, so GEMINI__APIKEY works too)
  public string ApiKey { get; set; }
  // gemini-2.5-flash is closed to new API keys; override with Gemini__Model if needed.
  public string Model { get; set; } = "gemini-3.5-flash";
  // "minimal" skips most of the model's thinking: ~2-3x faster and plenty for summarising a voice note.
  // Override with Gemini__ThinkingLevel (minimal|low|medium|high); empty = model default.
  public string ThinkingLevel { get; set; } = "minimal";
}

/// <summary>Gemini answered with an error or with no usable text.</summary>
public class GeminiException : Exception
{
  public GeminiException(string message) : base(message) { }
}

/// <summary>The recording has no speech (silence, noise, music...), so there is nothing to write.</summary>
public class NoSpeechException : Exception
{
  public NoSpeechException() : base("The recording contains no speech.") { }
}

public interface IGeminiAudioService
{
  Task<string> SummarizeAsync(IFormFile audioFile, string section = null, CancellationToken ct = default);
  IAsyncEnumerable<string> StreamSummaryAsync(IFormFile audioFile, string section = null, CancellationToken ct = default);
}

public class GeminiAudioService : IGeminiAudioService
{
  public const string HttpClientName = "gemini";
  public const string DefaultMimeType = "audio/webm";

  private const string Prompt =
    "Bạn là trợ lý viết nhật ký cá nhân. Hãy nghe đoạn ghi âm này và tổng hợp lại thành các gạch đầu dòng ngắn gọn, rõ ý. " +
    "Quy tắc: 1. Lọc bỏ từ ngập ngừng (ờ, à, kiểu như...), giữ đúng sự kiện, suy nghĩ và cảm xúc chính. " +
    "2. Giữ nguyên ngôi xưng của người nói và giọng văn tự nhiên. " +
    "3. Trình bày dưới dạng gạch đầu dòng (-), mỗi dòng một ý. " +
    "4. Chính tả: luôn viết \"Cha Mẹ\" (viết hoa chữ cái đầu cả hai từ) và viết \"Sion\" khi nghe \"si ôn\"/\"Si-ôn\". " +
    "Không tự bịa thêm thông tin và không viết câu mở đầu/kết thúc thừa thãi.";

  /// <summary>What Gemini answers when it hears no speech; never shown to the user.</summary>
  public const string NoSpeechMarker = "NO_SPEECH";

  // Goes last so it overrides the section hint: without it Gemini invents a whole diary entry for a silent clip.
  private const string NoSpeechRule =
    "QUAN TRỌNG: Chỉ ghi lại những gì người nói thực sự nói. Nếu đoạn ghi âm không có lời nói nghe rõ " +
    "(im lặng, tiếng ồn, tiếng bíp, nhạc, hoặc quá ngắn/không nghe ra từ nào), chỉ trả lời đúng một từ " +
    NoSpeechMarker + " và không viết gì thêm. Tuyệt đối không tự nghĩ ra nội dung nhật ký.";

  /// <summary>Journal prompt the recording answers; keys match the web client's sections.</summary>
  public static readonly IReadOnlyDictionary<string, string> SectionHints = new Dictionary<string, string>
  {
    ["reflection"] = "Đoạn ghi âm này dành cho mục \"Hôm nay thế nào?\": tóm tắt các sự việc, cách dùng thời gian và cảm xúc trong ngày.",
    ["gratitude"] = "Đoạn ghi âm này dành cho mục \"Những điều biết ơn hôm nay\": mỗi dòng là một điều biết ơn.",
    ["win"] = "Đoạn ghi âm này dành cho mục \"Những điều làm tốt hôm nay\": mỗi dòng là một việc đã làm tốt.",
    ["improvement"] = "Đoạn ghi âm này dành cho mục \"Một điều cần làm tốt hơn\": viết điều người nói muốn cải thiện, ngắn gọn.",
  };

  private static readonly JsonSerializerOptions JsonOpts = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

  private readonly IHttpClientFactory _httpFactory;
  private readonly GeminiSettings _settings;
  private readonly ILogger<GeminiAudioService> _logger;

  public GeminiAudioService(IHttpClientFactory httpFactory, IOptions<GeminiSettings> options, ILogger<GeminiAudioService> logger)
  {
    _httpFactory = httpFactory;
    _settings = options.Value;
    _logger = logger;
  }

  /// <summary>"audio/webm;codecs=opus" -> "audio/webm"; empty -> audio/webm.</summary>
  public static string NormalizeMimeType(string contentType)
  {
    string mime = contentType?.Split(';')[0].Trim().ToLowerInvariant();
    return string.IsNullOrEmpty(mime) || mime == "application/octet-stream" ? DefaultMimeType : mime;
  }

  /// <summary>Waits for the whole answer (kept for the non-streaming endpoint).</summary>
  public async Task<string> SummarizeAsync(IFormFile audioFile, string section = null, CancellationToken ct = default)
  {
    var sb = new StringBuilder();
    await foreach (string delta in StreamSummaryAsync(audioFile, section, ct))
    {
      sb.Append(delta);
    }
    return sb.ToString().Trim();
  }

  /// <summary>
  /// Streams the answer as text deltas (streamGenerateContent + SSE), so the client can show words as they arrive.
  /// Throws <see cref="GeminiException"/> before the first delta if Gemini rejects the request.
  /// </summary>
  public async IAsyncEnumerable<string> StreamSummaryAsync(IFormFile audioFile, string section = null,
    [EnumeratorCancellation] CancellationToken ct = default)
  {
    if (string.IsNullOrWhiteSpace(_settings.ApiKey))
    {
      throw new InvalidOperationException("Gemini settings are missing (Gemini__ApiKey).");
    }

    var sw = Stopwatch.StartNew();
    string base64;
    using (var ms = new MemoryStream())
    {
      await audioFile.CopyToAsync(ms, ct);
      base64 = Convert.ToBase64String(ms.GetBuffer(), 0, (int)ms.Length);
    }
    long readMs = sw.ElapsedMilliseconds;

    string mime = NormalizeMimeType(audioFile.ContentType);
    string prompt = section != null && SectionHints.TryGetValue(section, out string hint)
      ? $"{Prompt} {hint} {NoSpeechRule}"
      : $"{Prompt} {NoSpeechRule}";
    string level = string.IsNullOrWhiteSpace(_settings.ThinkingLevel) ? null : _settings.ThinkingLevel.Trim().ToLowerInvariant();

    HttpResponseMessage res = await SendAsync(BuildPayload(mime, base64, prompt, level), ct);
    if (res.StatusCode == HttpStatusCode.BadRequest && level != null)
    {
      // e.g. a model that does not accept this thinking level: retry once with the model's default.
      string err = await res.Content.ReadAsStringAsync(ct);
      res.Dispose();
      _logger.LogWarning("Gemini rejected thinkingLevel={Level}, retrying without it: {Body}", level, err);
      res = await SendAsync(BuildPayload(mime, base64, prompt, null), ct);
    }

    using (res)
    {
      if (!res.IsSuccessStatusCode)
      {
        string body = await res.Content.ReadAsStringAsync(ct);
        _logger.LogError("Gemini returned {Status}: {Body}", (int)res.StatusCode, body);
        throw new GeminiException($"Gemini returned HTTP {(int)res.StatusCode}.");
      }

      long firstMs = -1;
      int chars = 0;
      // Hold the start back until it can't be the NO_SPEECH marker, so the marker never reaches the client.
      var head = new StringBuilder();
      bool released = false;
      using Stream stream = await res.Content.ReadAsStreamAsync(ct);
      using var reader = new StreamReader(stream, Encoding.UTF8);
      string line;
      while ((line = await reader.ReadLineAsync()) != null)
      {
        ct.ThrowIfCancellationRequested();
        if (!line.StartsWith("data:")) continue; // SSE: blank separators, comments

        string text = ExtractText(line.Substring(5).Trim());
        if (string.IsNullOrEmpty(text)) continue;
        if (!released)
        {
          head.Append(text);
          if (CouldBeNoSpeech(head.ToString())) continue;
          released = true;
          text = head.ToString();
        }
        if (firstMs < 0) firstMs = sw.ElapsedMilliseconds;
        chars += text.Length;
        yield return text;
      }

      bool noSpeech = !released && CouldBeNoSpeech(head.ToString());
      _logger.LogInformation(
        "Voice-to-diary: {Bytes} B {Mime}, section={Section}, thinking={Level}, read={ReadMs}ms, first text={FirstMs}ms, total={TotalMs}ms, {Chars} chars{NoSpeech}",
        audioFile.Length, mime, section ?? "-", level ?? "default", readMs, firstMs, sw.ElapsedMilliseconds, chars,
        noSpeech ? ", no speech" : "");

      if (noSpeech)
      {
        throw new NoSpeechException();
      }
      if (!released)
      {
        // Short answer that turned out not to be the marker.
        yield return head.ToString();
      }
    }
  }

  private static readonly char[] MarkerNoise = { ' ', '\n', '\r', '\t', '`', '"', '\'', '*', '.', '-' };

  /// <summary>True while `text` is empty, a prefix of the marker, or the marker itself (ignoring quotes/punctuation).</summary>
  public static bool CouldBeNoSpeech(string text)
  {
    string t = text.Trim(MarkerNoise);
    return t.Length == 0 ||
           (t.Length <= NoSpeechMarker.Length
             ? NoSpeechMarker.StartsWith(t, StringComparison.OrdinalIgnoreCase)
             : t.Equals(NoSpeechMarker, StringComparison.OrdinalIgnoreCase));
  }

  private static object BuildPayload(string mime, string base64, string prompt, string thinkingLevel) => new
  {
    contents = new[]
    {
      new
      {
        parts = new object[]
        {
          new { inline_data = new { mime_type = mime, data = base64 } },
          new { text = prompt }
        }
      }
    },
    generationConfig = thinkingLevel == null ? null : new { thinkingConfig = new { thinkingLevel } }
  };

  private async Task<HttpResponseMessage> SendAsync(object payload, CancellationToken ct)
  {
    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(_settings.Model)}:streamGenerateContent?alt=sse";
    var req = new HttpRequestMessage(HttpMethod.Post, url)
    {
      Content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json")
    };
    req.Headers.Add("x-goog-api-key", _settings.ApiKey); // header, so the key never shows up in URLs/logs
    HttpClient client = _httpFactory.CreateClient(HttpClientName);
    // ResponseHeadersRead: start reading as soon as Gemini sends the first chunk.
    return await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
  }

  /// <summary>Text of one SSE chunk: candidates[0].content.parts[*].text, skipping thought parts.</summary>
  private string ExtractText(string json)
  {
    try
    {
      using JsonDocument doc = JsonDocument.Parse(json);
      if (!doc.RootElement.TryGetProperty("candidates", out JsonElement candidates) ||
          candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
      {
        // e.g. blocked by safety filters (promptFeedback.blockReason)
        if (doc.RootElement.TryGetProperty("promptFeedback", out _)) _logger.LogWarning("Gemini chunk had no candidates: {Body}", json);
        return null;
      }
      if (!candidates[0].TryGetProperty("content", out JsonElement c) ||
          !c.TryGetProperty("parts", out JsonElement parts) || parts.ValueKind != JsonValueKind.Array)
      {
        return null;
      }
      var sb = new StringBuilder();
      foreach (JsonElement part in parts.EnumerateArray())
      {
        if (part.TryGetProperty("thought", out JsonElement th) && th.ValueKind == JsonValueKind.True) continue;
        if (part.TryGetProperty("text", out JsonElement text)) sb.Append(text.GetString());
      }
      return sb.ToString();
    }
    catch (JsonException ex)
    {
      _logger.LogError(ex, "Could not parse Gemini chunk: {Body}", json);
      throw new GeminiException("Gemini response was not valid JSON.");
    }
  }
}
