using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CranberryAPI.Models;

public class Journal
{
  public int JournalId { get; set; }

  [Required]
  [MaxLength(10)]
  public string Date { get; set; }          // YYYY-MM-DD, one entry per user per day

  public int Mood { get; set; }             // 1..5
  public int UrgeLevel { get; set; }        // 1..10, how strongly you wanted to grab the phone
  public int Pickups { get; set; }          // phone pickups that day

  public string DayReflection { get; set; } // How was today?
  public string Gratitude { get; set; }     // What am I grateful for?
  public string Win { get; set; }           // What did I do well?
  public string Improvement { get; set; }   // One thing to improve

  public string UserId { get; set; }
  [JsonIgnore]
  public ApplicationUser User { get; set; }
}
