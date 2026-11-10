using System.ComponentModel.DataAnnotations;

namespace CranberryAPI.Models;

public class VerifyEmailDto
{
  [Required]
  [EmailAddress]
  public string Email { get; set; }

  [Required]
  [RegularExpression(@"^\d{6}$", ErrorMessage = "The code must be 6 digits.")]
  public string Code { get; set; }
}

public class ResendCodeDto
{
  [Required]
  [EmailAddress]
  public string Email { get; set; }
}
