using System.ComponentModel.DataAnnotations;

namespace CranberryAPI.Models;

public class SleepInputDto
{
  [Required]
  [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "Bedtime must be in HH:mm (24-hour) format.")]
  public string Bedtime { get; set; }
}
