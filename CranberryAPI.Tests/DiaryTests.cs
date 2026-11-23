using System.Net;
using System.Net.Http.Headers;
using CranberryAPI.Controllers;
using CranberryAPI.Services;
using CranberryAPI.Tests.Infrastructure;
using Xunit;

namespace CranberryAPI.Tests;

public class DiaryTests : IClassFixture<ApiFactory>
{
  private const string Json = "/api/diary/voice-to-diary";
  private const string Stream = "/api/diary/voice-to-diary/stream";

  private readonly ApiFactory _factory;
  private readonly HttpClient _http;

  public DiaryTests(ApiFactory factory)
  {
    _factory = factory;
    _http = factory.CreateClient();
  }

  private async Task<HttpResponseMessage> Upload(string url, string token, string contentType = "audio/webm", string name = "rec.webm")
  {
    var form = new MultipartFormDataContent();
    var file = new ByteArrayContent(new byte[] { 1, 2, 3 });
    file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
    form.Add(file, "file", name);

    HttpRequestMessage req = ApiClient.Authed(HttpMethod.Post, url, token);
    req.Content = form;
    return await _http.SendAsync(req);
  }

  [Fact]
  public async Task Diary_endpoints_need_a_signed_in_user()
  {
    (await Upload(Json, null)).ShouldBe(HttpStatusCode.Unauthorized);
    (await Upload(Stream, null)).ShouldBe(HttpStatusCode.Unauthorized);
  }

  [Fact]
  public async Task Stream_sends_pieces_then_done()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FakeTranscriber.Pieces("Sáng nay", "\nđi bộ");

    HttpResponseMessage res = await Upload(Stream, s.Token);

    res.ShouldBe(HttpStatusCode.OK);
    Assert.Equal("text/event-stream", res.Content.Headers.ContentType?.MediaType);
    string body = await res.Content.ReadAsStringAsync();
    Assert.Equal("data: {\"text\":\"S\\u00E1ng nay\"}\n\ndata: {\"text\":\"\\n\\u0111i b\\u1ED9\"}\n\nevent: done\ndata: {}\n\n", body);
  }

  [Fact]
  public async Task Transcriber_failing_before_any_text_is_a_502_json_error()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FakeTranscriber.Throws(new TranscriptionException("boom"));

    HttpResponseMessage res = await Upload(Stream, s.Token);
    res.ShouldBe(HttpStatusCode.BadGateway);
    Assert.Equal("Error", (await res.JsonAsync()).GetProperty("status").GetString());
  }

  [Fact]
  public async Task Transcriber_unreachable_is_502()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FakeTranscriber.Throws(new HttpRequestException("connection refused"));
    (await Upload(Stream, s.Token)).ShouldBe(HttpStatusCode.BadGateway);
    (await Upload(Json, s.Token)).ShouldBe(HttpStatusCode.BadGateway);
  }

  [Fact]
  public async Task Transcriber_failing_midway_ends_the_stream_with_an_error_event()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FailsAfter("Sáng nay");

    HttpResponseMessage res = await Upload(Stream, s.Token);
    res.ShouldBe(HttpStatusCode.OK);
    string body = await res.Content.ReadAsStringAsync();
    Assert.Contains("event: error\ndata: {\"message\":", body);
    Assert.DoesNotContain("event: done", body);
  }

  private static async IAsyncEnumerable<string> FailsAfter(string first)
  {
    await Task.Yield();
    yield return first;
    throw new TranscriptionException("boom");
  }

  [Fact]
  public async Task No_speech_is_422()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FakeTranscriber.Throws(new NoSpeechException());
    (await Upload(Stream, s.Token)).ShouldBe(HttpStatusCode.UnprocessableEntity);
    (await Upload(Json, s.Token)).ShouldBe(HttpStatusCode.UnprocessableEntity);
  }

  [Fact]
  public async Task Uploading_a_non_audio_file_is_400()
  {
    Session s = await _factory.NewUserAsync(_http);
    (await Upload(Json, s.Token, "image/png", "pic.png")).ShouldBe(HttpStatusCode.BadRequest);
    (await Upload(Stream, s.Token, "image/png", "pic.png")).ShouldBe(HttpStatusCode.BadRequest);
  }

  [Fact]
  public async Task Voice_to_diary_returns_the_transcript()
  {
    Session s = await _factory.NewUserAsync(_http);
    _factory.Transcriber.Next = () => FakeTranscriber.Pieces("một", "\nhai ");

    HttpResponseMessage res = await Upload(Json, s.Token);
    res.ShouldBe(HttpStatusCode.OK);
    Assert.Equal("một\nhai", (await res.JsonAsync()).GetProperty("summary").GetString());
  }

  [Theory]
  [InlineData("audio/webm;codecs=opus", "audio/webm")]
  [InlineData("AUDIO/MP4", "audio/mp4")]
  [InlineData("", "audio/webm")]
  [InlineData(null, "audio/webm")]
  [InlineData("application/octet-stream", "audio/webm")]
  [InlineData("image/png", "image/png")]
  public void NormalizeMimeType_cases(string input, string expected)
  {
    Assert.Equal(expected, DiaryController.NormalizeMimeType(input));
  }
}
