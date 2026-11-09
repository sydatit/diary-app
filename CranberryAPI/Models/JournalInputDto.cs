using System.ComponentModel.DataAnnotations;

namespace CranberryAPI.Models;

public class JournalInputDto
{
  [Required]
  [RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "Date must be in YYYY-MM-DD format.")]
  public string Date { get; set; }

  [Range(1, 5)]
  public int Mood { get; set; }

  [Range(1, 10)]
  public int UrgeLevel { get; set; }

  [Range(0, 2000)]
  public int Pickups { get; set; }

  [MaxLength(4000)] public string DayReflection { get; set; }
  [MaxLength(2000)] public string Gratitude { get; set; }
  [MaxLength(2000)] public string Win { get; set; }
  [MaxLength(2000)] public string Improvement { get; set; }
}
