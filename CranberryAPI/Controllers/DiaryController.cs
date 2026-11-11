using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CranberryAPI.Services;

namespace CranberryAPI.Controllers;

[Route("api/diary")]
[ApiController]
[Authorize] // signed-in users only, so strangers can't burn the Gemini quota
public class DiaryController : ControllerBase
{
  private const long MaxAudioBytes = 20_000_000;

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
    if (file == null || file.Length == 0)
    {
      return BadRequest(new { status = "Error", message = "Không nhận được file ghi âm." });
    }
    if (file.Length > MaxAudioBytes)
    {
      return StatusCode(413, new { status = "Error", message = "File ghi âm vượt quá 20MB." });
    }

    string mime = GeminiAudioService.NormalizeMimeType(file.ContentType);
    if (!mime.StartsWith("audio/"))
    {
      return BadRequest(new { status = "Error", message = "File không phải định dạng âm thanh." });
    }

    try
    {
      string knownSection = section != null && GeminiAudioService.SectionHints.ContainsKey(section) ? section : null;
      string summary = await _gemini.SummarizeAsync(file, knownSection, ct);
      if (string.IsNullOrWhiteSpace(summary))
      {
        return UnprocessableEntity(new { status = "Error", message = "Không nghe rõ nội dung. Bạn thử ghi âm lại nhé." });
      }
      return Ok(new { summary });
    }
    catch (InvalidOperationException ex)
    {
      _logger.LogError(ex, "Gemini is not configured");
      return StatusCode(503, new { status = "Error", message = "Tính năng ghi âm AI chưa được cấu hình trên máy chủ." });
    }
    catch (Exception ex) when (ex is GeminiException || ex is HttpRequestException ||
                               (ex is TaskCanceledException && !ct.IsCancellationRequested))
    {
      _logger.LogError(ex, "Voice-to-diary failed");
      return StatusCode(502, new { status = "Error", message = "AI chưa xử lý được đoạn ghi âm. Vui lòng thử lại sau." });
    }
  }
}
