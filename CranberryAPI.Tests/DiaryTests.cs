using System.Net;
using System.Net.Http.Headers;
using CranberryAPI.Services;
using CranberryAPI.Tests.Infrastructure;
using Xunit;

namespace CranberryAPI.Tests;

public class DiaryTests : IClassFixture<ApiFactory>
{
  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public DiaryTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private async Task<HttpResponseMessage> TextToDiary(string token, object body) =>
    await _http.SendAuthed(HttpMethod.Post, "/api/diary/text-to-diary/stream", token, body);

  [Fact]
  public async Task Diary_endpoints_need_a_signed_in_user()
  {
    (await TextToDiary(null, new { text = "hello" })).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Text_to_diary_streams_pieces_then_done()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Pieces("- Sáng nay", " đi bộ");

    HttpResponseMessage res = await TextToDiary(s.Token, new { text = "sáng nay tôi đi bộ", section = "win" });

    res.ShouldBe(HttpStatusCode.OK);
    Assert.Equal("text/event-stream", res.Content.Headers.ContentType?.MediaType);
    string body = await res.Content.ReadAsStringAsync();
    Assert.Equal("data: {\"text\":\"- S\\u00E1ng nay\"}\n\ndata: {\"text\":\" \\u0111i b\\u1ED9\"}\n\nevent: done\ndata: {}\n\n", body);
    Assert.Equal("win", _factory.Gemini.LastSection);
  }

  [Fact]
  public async Task Unknown_section_is_ignored()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Pieces("- ok");
    (await TextToDiary(s.Token, new { text = "hi", section = "hack" })).ShouldBe(HttpStatusCode.OK);
    Assert.Null(_factory.Gemini.LastSection);
  }

  [Fact]
  public async Task Empty_transcript_is_422()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await TextToDiary(s.Token, new { text = "   " })).ShouldBe(HttpStatusCode.UnprocessableEntity);
  }

  [Fact]
  public async Task Too_long_transcript_is_413()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await TextToDiary(s.Token, new { text = new string('a', 20_001) })).ShouldBe(HttpStatusCode.RequestEntityTooLarge);
  }

  [Fact]
  public async Task Gemini_failing_before_any_text_is_a_502_json_error()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Throws(new GeminiException("boom"));

    HttpResponseMessage res = await TextToDiary(s.Token, new { text = "hi" });
    res.ShouldBe(HttpStatusCode.BadGateway);
    Assert.Equal("Error", (await res.JsonAsync()).GetProperty("status").GetString());
  }

  [Fact]
  public async Task No_speech_is_422()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Throws(new NoSpeechException());
    (await TextToDiary(s.Token, new { text = "uh" })).ShouldBe(HttpStatusCode.UnprocessableEntity);
  }

  [Fact]
  public async Task Gemini_not_configured_is_503()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Throws(new InvalidOperationException("no key"));
    (await TextToDiary(s.Token, new { text = "hi" })).ShouldBe(HttpStatusCode.ServiceUnavailable);
  }

  [Fact]
  public async Task Uploading_a_non_audio_file_is_400()
  {
    Session s = await _factory.NewUserAsync(_http);
    var form = new MultipartFormDataContent();
    var file = new ByteArrayContent(new byte[] { 1, 2, 3 });
    file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
    form.Add(file, "file", "pic.png");

    var req = ApiClient.Authed(HttpMethod.Post, "/api/diary/voice-to-diary", s.Token);
    req.Content = form;
    (await _http.SendAsync(req)).ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Voice_to_diary_returns_the_summary()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Gemini.Next = () => FakeGemini.Pieces("- một", "\n- hai ");
    var form = new MultipartFormDataContent();
    var file = new ByteArrayContent(new byte[] { 1, 2, 3 });
    file.Headers.ContentType = new MediaTypeHeaderValue("audio/webm");
    form.Add(file, "file", "rec.webm");

    var req = ApiClient.Authed(HttpMethod.Post, "/api/diary/voice-to-diary", s.Token);
    req.Content = form;
    HttpResponseMessage res = await _http.SendAsync(req);
    res.ShouldBe(HttpStatusCode.OK);
    Assert.Equal("- một\n- hai", (await res.JsonAsync()).GetProperty("summary").GetString());
  }
}
