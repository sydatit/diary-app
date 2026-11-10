using System.ComponentModel.DataAnnotations;

namespace CranberryAPI.Models;

public class RegisterDto
{
  [Required]
  [EmailAddress]
  public string Email { get; set; }
  [Required]
  public string UserName { get; set; }
  [Required]
  public string Password { get; set; }

  public string DetoxStartDate { get; set; }
  [Range(0, 2000)]
  public int BaselinePickups { get; set; }
  [Range(0, 2000)]
  public int DailyPickupGoal { get; set; }
}
