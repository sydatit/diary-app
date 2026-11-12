using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using CranberryAPI.Models;
using CranberryAPI.Services;

namespace CranberryAPI.Controllers;

[Route("api/diary")]
[ApiController]
[Authorize] // signed-in users only, so strangers can't burn the Gemini quota
public class DiaryController : ControllerBase
{
  private const long MaxAudioBytes = 20_000_000;
  private const int MaxTranscriptChars = 20_000;

  private readonly IGeminiAudioService _gemini;
  private readonly ILogger<DiaryController> _logger;

  public DiaryController(IGeminiAudioService gemini, ILogger<DiaryController> logger)
  {
    _gemini = gemini;
    _logger = logger;
  }

  // POST: api/diary/voice-to-diary  (multipart/form-data, field "file")
  // Optional field "section" (reflection|gratitude|win|improvement) tailors the prompt; unknown values are ignored.
  // Sends the recording to Gemini and returns bullet-point diary lines: { "summary": "- ..." }
  [HttpPost("voice-to-diary")]
  [Consumes("multipart/form-data")]
  [RequestSizeLimit(MaxAudioBytes)]
  [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes)]
  public async Task<IActionResult> VoiceToDiary(IFormFile file, [FromForm] string section, CancellationToken ct)
  {
    IActionResult invalid = Validate(file);
    if (invalid != null) return invalid;

    try
    {
      string summary = await _gemini.SummarizeAsync(file, KnownSection(section), ct);
      if (string.IsNullOrWhiteSpace(summary))
      {
        return UnprocessableEntity(new { status = "Error", message = NotHeard });
      }
      return Ok(new { summary });
    }
    catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
    {
      IActionResult error = MapError(ex);
      if (error == null) throw;
      return error;
    }
  }

  // POST: api/diary/voice-to-diary/stream  (same form fields as above)
  // Server-Sent Events, so the text shows up while Gemini is still writing:
  //   data: {"text":"- Sáng nay"}   (repeated, each a piece to append)
  //   event: done / data: {}
  //   event: error / data: {"message":"..."}   (if it breaks after text was sent)
  // Errors before the first piece come back as normal JSON error responses, like the endpoint above.
  [HttpPost("voice-to-diary/stream")]
  [Consumes("multipart/form-data")]
  [RequestSizeLimit(MaxAudioBytes)]
  [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes)]
  public async Task VoiceToDiaryStream(IFormFile file, [FromForm] string section, CancellationToken ct)
  {
    IActionResult invalid = Validate(file);
    if (invalid != null)
    {
      await invalid.ExecuteResultAsync(ControllerContext);
      return;
    }

    await StreamSseAsync(_gemini.StreamSummaryAsync(file, KnownSection(section), ct), ct);
  }

  // POST: api/diary/text-to-diary/stream  (JSON { "text": "...", "section": "reflection" })
  // For a transcript the browser already made while the user spoke (Web Speech API): no audio upload,
  // so the diary lines come back almost at once. Same SSE reply as voice-to-diary/stream.
  [HttpPost("text-to-diary/stream")]
  public async Task TextToDiaryStream([FromBody] TextToDiaryDto dto, CancellationToken ct)
  {
    string text = dto?.Text?.Trim();
    if (string.IsNullOrEmpty(text))
    {
      await UnprocessableEntity(new { status = "Error", message = NotHeard }).ExecuteResultAsync(ControllerContext);
      return;
    }
    if (text.Length > MaxTranscriptChars)
    {
      await StatusCode(413, new { status = "Error", message = "Đoạn ghi âm quá dài." }).ExecuteResultAsync(ControllerContext);
      return;
    }
    await StreamSseAsync(_gemini.StreamTextSummaryAsync(text, KnownSection(dto.Section), ct), ct);
  }

  private static string KnownSection(string section) =>
    section != null && GeminiAudioService.SectionHints.ContainsKey(section) ? section : null;

  /// <summary>Relay text pieces as SSE. Waits for the first piece so failures before it get a proper HTTP status.</summary>
  private async Task StreamSseAsync(IAsyncEnumerable<string> source, CancellationToken ct)
  {
    await using IAsyncEnumerator<string> pieces = source.GetAsyncEnumerator(ct);

    bool hasFirst;
    try
    {
      hasFirst = await pieces.MoveNextAsync();
    }
    catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
    {
      IActionResult error = MapError(ex);
      if (error == null) throw;
      await error.ExecuteResultAsync(ControllerContext);
      return;
    }
    if (!hasFirst)
    {
      await UnprocessableEntity(new { status = "Error", message = NotHeard }).ExecuteResultAsync(ControllerContext);
      return;
    }

    Response.StatusCode = 200;
    Response.ContentType = "text/event-stream; charset=utf-8";
    Response.Headers.CacheControl = "no-cache";
    Response.Headers["X-Accel-Buffering"] = "no"; // tell nginx not to hold the chunks back

    try
    {
      do
      {
        await WriteEventAsync(null, new { text = pieces.Current }, ct);
      } while (await pieces.MoveNextAsync());
      await WriteEventAsync("done", new { }, ct);
    }
    catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
    {
      _logger.LogError(ex, "Diary stream broke midway");
      await WriteEventAsync("error", new { message = Failed }, CancellationToken.None);
    }
  }

  private async Task WriteEventAsync(string evt, object data, CancellationToken ct)
  {
    string frame = (evt != null ? $"event: {evt}\n" : "") + $"data: {JsonSerializer.Serialize(data)}\n\n";
    await Response.WriteAsync(frame, ct);
    await Response.Body.FlushAsync(ct);
  }

  private IActionResult Validate(IFormFile file)
  {
    if (file == null || file.Length == 0)
    {
      return BadRequest(new { status = "Error", message = "Không nhận được file ghi âm." });
    }
    if (file.Length > MaxAudioBytes)
    {
      return StatusCode(413, new { status = "Error", message = "File ghi âm vượt quá 20MB." });
    }
    if (!GeminiAudioService.NormalizeMimeType(file.ContentType).StartsWith("audio/"))
    {
      return BadRequest(new { status = "Error", message = "File không phải định dạng âm thanh." });
    }
    return null;
  }

  /// <summary>Known failures -> HTTP response; null for anything unexpected (let it bubble).</summary>
  private IActionResult MapError(Exception ex)
  {
    if (ex is NoSpeechException)
    {
      return UnprocessableEntity(new { status = "Error", message = NotHeard });
    }
    if (ex is InvalidOperationException)
    {
      _logger.LogError(ex, "Gemini is not configured");
      return StatusCode(503, new { status = "Error", message = "Tính năng ghi âm AI chưa được cấu hình trên máy chủ." });
    }
    if (ex is GeminiException || ex is HttpRequestException || ex is TaskCanceledException)
    {
      _logger.LogError(ex, "Voice-to-diary failed");
      return StatusCode(502, new { status = "Error", message = Failed });
    }
    return null;
  }

  private const string NotHeard = "Không nghe rõ nội dung. Bạn thử ghi âm lại nhé.";
  private const string Failed = "AI chưa xử lý được đoạn ghi âm. Vui lòng thử lại sau.";
}
