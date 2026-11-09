namespace CranberryAPI.Models;

public class UserProfileDto
{
  public string UserId { get; set; }
  public string UserName { get; set; }
  public string Email { get; set; }
  public string DetoxStartDate { get; set; }
  public int BaselinePickups { get; set; }
  public int DailyPickupGoal { get; set; }

  public static UserProfileDto From(ApplicationUser user) => new()
  {
    UserId = user.Id,
    UserName = user.UserName,
    Email = user.Email,
    DetoxStartDate = user.DetoxStartDate,
    BaselinePickups = user.BaselinePickups,
    DailyPickupGoal = user.DailyPickupGoal,
  };
}
