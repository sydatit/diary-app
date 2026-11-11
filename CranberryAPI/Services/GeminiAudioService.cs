using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace CranberryAPI.Services;

public class GeminiSettings
{
  // Env: Gemini__ApiKey (config keys are case-insensitive, so GEMINI__APIKEY works too)
  public string ApiKey { get; set; }
  // gemini-2.5-flash is closed to new API keys; override with Gemini__Model if needed.
  public string Model { get; set; } = "gemini-3.5-flash";
}

/// <summary>Gemini answered with an error or with no usable text.</summary>
public class GeminiException : Exception
{
  public GeminiException(string message) : base(message) { }
}

public interface IGeminiAudioService
{
  Task<string> SummarizeAsync(IFormFile audioFile, string section = null, CancellationToken ct = default);
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

  /// <summary>Journal prompt the recording answers; keys match the web client's sections.</summary>
  public static readonly IReadOnlyDictionary<string, string> SectionHints = new Dictionary<string, string>
  {
    ["reflection"] = "Đoạn ghi âm này dành cho mục \"Hôm nay thế nào?\": tóm tắt các sự việc, cách dùng thời gian và cảm xúc trong ngày.",
    ["gratitude"] = "Đoạn ghi âm này dành cho mục \"Những điều biết ơn hôm nay\": mỗi dòng là một điều biết ơn.",
    ["win"] = "Đoạn ghi âm này dành cho mục \"Những điều làm tốt hôm nay\": mỗi dòng là một việc đã làm tốt.",
    ["improvement"] = "Đoạn ghi âm này dành cho mục \"Một điều cần làm tốt hơn\": viết điều người nói muốn cải thiện, ngắn gọn.",
  };

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

  public async Task<string> SummarizeAsync(IFormFile audioFile, string section = null, CancellationToken ct = default)
  {
    if (string.IsNullOrWhiteSpace(_settings.ApiKey))
    {
      throw new InvalidOperationException("Gemini settings are missing (Gemini__ApiKey).");
    }

    string base64;
    using (var ms = new MemoryStream())
    {
      await audioFile.CopyToAsync(ms, ct);
      base64 = Convert.ToBase64String(ms.GetBuffer(), 0, (int)ms.Length);
    }

    var payload = new
    {
      contents = new[]
      {
        new
        {
          parts = new object[]
          {
            new { inline_data = new { mime_type = NormalizeMimeType(audioFile.ContentType), data = base64 } },
            new { text = section != null && SectionHints.TryGetValue(section, out string hint) ? $"{Prompt} {hint}" : Prompt }
          }
        }
      }
    };

    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{_settings.Model}:generateContent?key={Uri.EscapeDataString(_settings.ApiKey)}";
    using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8);
    content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

    HttpClient client = _httpFactory.CreateClient(HttpClientName);
    using HttpResponseMessage res = await client.PostAsync(url, content, ct);
    string body = await res.Content.ReadAsStringAsync(ct);

    if (!res.IsSuccessStatusCode)
    {
      _logger.LogError("Gemini returned {Status}: {Body}", (int)res.StatusCode, body);
      throw new GeminiException($"Gemini returned HTTP {(int)res.StatusCode}.");
    }

    // candidates[0].content.parts[0].text
    try
    {
      using JsonDocument doc = JsonDocument.Parse(body);
      if (doc.RootElement.TryGetProperty("candidates", out JsonElement candidates) &&
          candidates.ValueKind == JsonValueKind.Array && candidates.GetArrayLength() > 0 &&
          candidates[0].TryGetProperty("content", out JsonElement c) &&
          c.TryGetProperty("parts", out JsonElement parts) &&
          parts.ValueKind == JsonValueKind.Array && parts.GetArrayLength() > 0 &&
          parts[0].TryGetProperty("text", out JsonElement text))
      {
        return text.GetString()?.Trim() ?? "";
      }
    }
    catch (JsonException ex)
    {
      _logger.LogError(ex, "Could not parse Gemini response: {Body}", body);
      throw new GeminiException("Gemini response was not valid JSON.");
    }

    // e.g. blocked by safety filters (promptFeedback.blockReason) or finishReason != STOP
    _logger.LogWarning("Gemini response had no text: {Body}", body);
    throw new GeminiException("Gemini response contained no text.");
  }
}
