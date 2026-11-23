using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using CranberryAPI.Services;

namespace CranberryAPI.Controllers;

[Route("api/diary")]
[ApiController]
[Authorize] // signed-in users only, so strangers can't keep the transcriber's CPUs busy
public class DiaryController : ControllerBase
{
  private const long MaxAudioBytes = 20_000_000;
  private const string DefaultMimeType = "audio/webm";

  private readonly ITranscriptionService _transcriber;
  private readonly ILogger<DiaryController> _logger;

  public DiaryController(ITranscriptionService transcriber, ILogger<DiaryController> logger)
  {
    _transcriber = transcriber;
    _logger = logger;
  }

  // POST: api/diary/voice-to-diary  (multipart/form-data, field "file")
  // Sends the recording to the local Whisper server and returns what was said, one line per segment: { "summary": "..." }
  [HttpPost("voice-to-diary")]
  [Consumes("multipart/form-data")]
  [RequestSizeLimit(MaxAudioBytes)]
  [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes)]
  public async Task<IActionResult> VoiceToDiary(IFormFile file, CancellationToken ct)
  {
    IActionResult invalid = Validate(file);
    if (invalid != null) return invalid;

    try
    {
      string summary = await _transcriber.TranscribeAsync(file, ct);
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

  // POST: api/diary/voice-to-diary/stream  (same form field as above)
  // Server-Sent Events, so the text shows up while the rest of the recording is still being transcribed:
  //   data: {"text":"Sáng nay"}   (repeated, each a piece to append)
  //   event: done / data: {}
  //   event: error / data: {"message":"..."}   (if it breaks after text was sent)
  // Errors before the first piece come back as normal JSON error responses, like the endpoint above.
  [HttpPost("voice-to-diary/stream")]
  [Consumes("multipart/form-data")]
  [RequestSizeLimit(MaxAudioBytes)]
  [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes)]
  public async Task VoiceToDiaryStream(IFormFile file, CancellationToken ct)
  {
    IActionResult invalid = Validate(file);
    if (invalid != null)
    {
      await invalid.ExecuteResultAsync(ControllerContext);
      return;
    }

    await StreamSseAsync(_transcriber.StreamTranscriptAsync(file, ct), ct);
  }

  /// <summary>"audio/webm;codecs=opus" -> "audio/webm"; empty -> audio/webm.</summary>
  public static string NormalizeMimeType(string contentType)
  {
    string mime = contentType?.Split(';')[0].Trim().ToLowerInvariant();
    return string.IsNullOrEmpty(mime) || mime == "application/octet-stream" ? DefaultMimeType : mime;
  }

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
    if (!NormalizeMimeType(file.ContentType).StartsWith("audio/"))
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
    if (ex is TranscriptionException || ex is HttpRequestException || ex is TaskCanceledException)
    {
      _logger.LogError(ex, "Voice-to-diary failed");
      return StatusCode(502, new { status = "Error", message = Failed });
    }
    return null;
  }

  private const string NotHeard = "Không nghe rõ nội dung. Bạn thử ghi âm lại nhé.";
  private const string Failed = "Chưa chép lời được đoạn ghi âm. Vui lòng thử lại sau.";
}
