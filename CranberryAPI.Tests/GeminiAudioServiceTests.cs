using System.Net;
using System.Text;
using CranberryAPI.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace CranberryAPI.Tests;

public class GeminiAudioServiceTests
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

  private static string Chunk(string text) =>
    "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":" + System.Text.Json.JsonSerializer.Serialize(text) + "}]}}]}\n\n";

  private static HttpResponseMessage Sse(params string[] chunks) => new(HttpStatusCode.OK)
  {
    Content = new StringContent(string.Concat(chunks), Encoding.UTF8, "text/event-stream")
  };

  private static GeminiAudioService Service(StubHandler handler, string apiKey = "key", string thinking = "minimal") =>
    new(new Factory(handler), Options.Create(new GeminiSettings { ApiKey = apiKey, ThinkingLevel = thinking }),
      NullLogger<GeminiAudioService>.Instance);

  private static async Task<List<string>> Collect(IAsyncEnumerable<string> source)
  {
    var list = new List<string>();
    await foreach (string s in source) list.Add(s);
    return list;
  }

  [Fact]
  public async Task Streams_text_pieces_and_skips_thought_parts()
  {
    var handler = new StubHandler(Sse(
      "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"thinking...\",\"thought\":true}]}}]}\n\n",
      Chunk("- Sáng nay"),
      ": keep-alive comment\n\n",
      Chunk(" đi bộ")));

    List<string> pieces = await Collect(Service(handler).StreamTextSummaryAsync("walked this morning", "win"));

    Assert.Equal(new[] { "- Sáng nay", " đi bộ" }, pieces);
    Assert.Contains("walked this morning", handler.Bodies[0]);
    Assert.Contains("minimal", handler.Bodies[0]);
    Assert.Equal("key", handler.Requests[0].Headers.GetValues("x-goog-api-key").Single());
    Assert.DoesNotContain("key=", handler.Requests[0].RequestUri!.Query); // key stays out of the URL
  }

  [Fact]
  public async Task No_speech_marker_is_never_sent_and_raises_NoSpeechException()
  {
    var handler = new StubHandler(Sse(Chunk("NO_"), Chunk("SPEECH")));
    await Assert.ThrowsAsync<NoSpeechException>(() => Collect(Service(handler).StreamTextSummaryAsync("...")));
  }

  [Fact]
  public async Task Text_held_back_as_a_possible_marker_is_released_once_it_cannot_be_one()
  {
    var handler = new StubHandler(Sse(Chunk("N"), Chunk("ice walk"), Chunk(" today")));
    Assert.Equal(new[] { "Nice walk", " today" }, await Collect(Service(handler).StreamTextSummaryAsync("hi")));
  }

  [Fact]
  public async Task An_empty_answer_counts_as_no_speech()
  {
    var handler = new StubHandler(Sse("data: {\"candidates\":[]}\n\n"));
    await Assert.ThrowsAsync<NoSpeechException>(() => Collect(Service(handler).StreamTextSummaryAsync("hi")));
  }

  [Fact]
  public async Task Rejected_thinking_level_is_retried_once_without_it()
  {
    var handler = new StubHandler(
      new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("bad thinking level") },
      Sse(Chunk("- ok")));

    Assert.Equal(new[] { "- ok" }, await Collect(Service(handler).StreamTextSummaryAsync("hi")));
    Assert.Equal(2, handler.Bodies.Count);
    Assert.Contains("thinkingLevel", handler.Bodies[0]);
    Assert.DoesNotContain("thinkingLevel", handler.Bodies[1]);
  }

  [Fact]
  public async Task Error_status_becomes_GeminiException()
  {
    var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("quota") });
    await Assert.ThrowsAsync<GeminiException>(() => Collect(Service(handler).StreamTextSummaryAsync("hi")));
  }

  [Fact]
  public async Task Malformed_chunk_becomes_GeminiException()
  {
    var handler = new StubHandler(Sse("data: {not json\n\n"));
    await Assert.ThrowsAsync<GeminiException>(() => Collect(Service(handler).StreamTextSummaryAsync("hi")));
  }

  [Fact]
  public async Task Missing_api_key_is_InvalidOperationException()
  {
    var handler = new StubHandler();
    await Assert.ThrowsAsync<InvalidOperationException>(() => Collect(Service(handler, apiKey: "").StreamTextSummaryAsync("hi")));
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
    Assert.Equal(expected, GeminiAudioService.NormalizeMimeType(input));
  }

  [Theory]
  [InlineData("", true)]
  [InlineData("NO", true)]
  [InlineData("no_spe", true)]
  [InlineData("`NO_SPEECH`.", true)]
  [InlineData("NO_SPEECHES", false)]
  [InlineData("- Hôm nay", false)]
  public void CouldBeNoSpeech_cases(string text, bool expected)
  {
    Assert.Equal(expected, GeminiAudioService.CouldBeNoSpeech(text));
  }
}
