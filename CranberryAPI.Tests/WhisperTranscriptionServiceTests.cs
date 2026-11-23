using System.Net;
using System.Text;
using CranberryAPI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace CranberryAPI.Tests;

public class WhisperTranscriptionServiceTests
{
  /// <summary>Answers each request with the next canned response and records what was sent.</summary>
  private class StubHandler : HttpMessageHandler
  {
    private readonly Queue<HttpResponseMessage> _responses;
    public List<string> Bodies { get; } = new();
    public List<HttpRequestMessage> Requests { get; } = new();

    public StubHandler(params HttpResponseMessage[] responses) => _responses = new Queue<HttpResponseMessage>(responses);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
      Requests.Add(request);
      Bodies.Add(await request.Content!.ReadAsStringAsync(ct));
      return _responses.Dequeue();
    }
  }

  private class Factory : IHttpClientFactory
  {
    private readonly HttpMessageHandler _handler;
    public Factory(HttpMessageHandler handler) => _handler = handler;
    public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
  }

  private const string Done = "{\"done\": true, \"durationSeconds\": 3.2, \"elapsedSeconds\": 1.1}\n";

  private static HttpResponseMessage Ndjson(params string[] lines) => new(HttpStatusCode.OK)
  {
    Content = new StringContent(string.Concat(lines), Encoding.UTF8, "application/x-ndjson")
  };

  private static WhisperTranscriptionService Service(StubHandler handler, string url = "http://whisper.test:8000/") =>
    new(new Factory(handler), Options.Create(new WhisperSettings { Url = url }), NullLogger<WhisperTranscriptionService>.Instance);

  private static IFormFile Audio(string name = "voice.m4a", string contentType = "audio/mp4")
  {
    byte[] bytes = Encoding.ASCII.GetBytes("fake-audio-bytes");
    return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
    {
      Headers = new HeaderDictionary(),
      ContentType = contentType
    };
  }

  private static async Task<List<string>> Collect(IAsyncEnumerable<string> source)
  {
    var list = new List<string>();
    await foreach (string s in source) list.Add(s);
    return list;
  }

  [Fact]
  public async Task Streams_one_piece_per_segment_each_on_its_own_line()
  {
    var handler = new StubHandler(Ndjson("{\"text\": \" Sáng nay tôi đi bộ. \"}\n", "\n", "{\"text\": \"\"}\n", "{\"text\": \"Trời đẹp.\"}\n", Done));

    List<string> pieces = await Collect(Service(handler).StreamTranscriptAsync(Audio()));

    Assert.Equal(new[] { "Sáng nay tôi đi bộ.", "\nTrời đẹp." }, pieces);
  }

  [Fact]
  public async Task Uploads_the_recording_as_multipart_field_file()
  {
    var handler = new StubHandler(Ndjson("{\"text\": \"ok\"}\n", Done));

    await Collect(Service(handler).StreamTranscriptAsync(Audio("note.m4a", "audio/mp4")));

    HttpRequestMessage req = handler.Requests.Single();
    Assert.Equal(HttpMethod.Post, req.Method);
    Assert.Equal("http://whisper.test:8000/transcribe", req.RequestUri!.ToString());
    Assert.Contains("name=file", handler.Bodies[0]);
    Assert.Contains("filename=voice.m4a", handler.Bodies[0]);
    Assert.Contains("Content-Type: audio/mp4", handler.Bodies[0]);
    Assert.Contains("fake-audio-bytes", handler.Bodies[0]);
  }

  [Fact]
  public async Task TranscribeAsync_joins_the_segments()
  {
    var handler = new StubHandler(Ndjson("{\"text\": \"một\"}\n", "{\"text\": \"hai\"}\n", Done));
    Assert.Equal("một\nhai", await Service(handler).TranscribeAsync(Audio()));
  }

  [Fact]
  public async Task No_segments_is_NoSpeechException()
  {
    var handler = new StubHandler(Ndjson(Done));
    await Assert.ThrowsAsync<NoSpeechException>(() => Collect(Service(handler).StreamTranscriptAsync(Audio())));
  }

  [Fact]
  public async Task Error_status_becomes_TranscriptionException()
  {
    var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent("boom") });
    await Assert.ThrowsAsync<TranscriptionException>(() => Collect(Service(handler).StreamTranscriptAsync(Audio())));
  }

  [Fact]
  public async Task Error_line_becomes_TranscriptionException_after_the_text_before_it()
  {
    var handler = new StubHandler(Ndjson("{\"text\": \"một\"}\n", "{\"error\": \"decoder died\"}\n"));
    var pieces = new List<string>();

    await Assert.ThrowsAsync<TranscriptionException>(async () =>
    {
      await foreach (string p in Service(handler).StreamTranscriptAsync(Audio())) pieces.Add(p);
    });
    Assert.Equal(new[] { "một" }, pieces);
  }

  [Fact]
  public async Task Malformed_line_becomes_TranscriptionException()
  {
    var handler = new StubHandler(Ndjson("{not json\n"));
    await Assert.ThrowsAsync<TranscriptionException>(() => Collect(Service(handler).StreamTranscriptAsync(Audio())));
  }

  [Fact]
  public async Task Reply_cut_off_before_done_becomes_TranscriptionException()
  {
    var handler = new StubHandler(Ndjson("{\"text\": \"một\"}\n"));
    await Assert.ThrowsAsync<TranscriptionException>(() => Collect(Service(handler).StreamTranscriptAsync(Audio())));
  }
}
