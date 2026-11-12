namespace CranberryAPI.Models;

/// <summary>Transcript made in the browser (Web Speech API) to turn into diary lines.</summary>
public class TextToDiaryDto
{
  public string Text { get; set; }
  /// <summary>reflection|gratitude|win|improvement; unknown values are ignored.</summary>
  public string Section { get; set; }
}
