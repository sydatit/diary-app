using Microsoft.AspNetCore.Identity;
using System.Text.Json.Serialization;

namespace CranberryAPI.Models;

public class ApplicationUser : IdentityUser
{
  // Phone-detox setup
  public string DetoxStartDate { get; set; }   // YYYY-MM-DD
  public int BaselinePickups { get; set; }     // phone pickups per day before starting
  public int DailyPickupGoal { get; set; }     // target pickups per day

  // Email verification (6-digit code, stored hashed)
  [JsonIgnore] public string EmailCodeHash { get; set; }
  [JsonIgnore] public DateTime? EmailCodeExpiresAt { get; set; }
  [JsonIgnore] public DateTime? EmailCodeSentAt { get; set; }
  [JsonIgnore] public int EmailCodeAttempts { get; set; }

  [JsonIgnore]
  public List<Journal> Journals { get; set; }
}
