using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CranberryAPI.Models;

/// <summary>The moment the user tapped "going to bed". One per user per night, independent of journal entries.</summary>
public class SleepLog
{
  [JsonIgnore]
  public int SleepLogId { get; set; }

  [Required]
  [MaxLength(10)]
  public string Date { get; set; }     // YYYY-MM-DD of the day that night closes (00:30 still belongs to the day before)

  [Required]
  [MaxLength(5)]
  public string Bedtime { get; set; }  // "HH:mm" (24h), in the user's local time

  [Required]
  [JsonIgnore]
  public string UserId { get; set; }
}
