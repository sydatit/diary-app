namespace CranberryAPI.Models;

public class UpdateUserDto
{
  public string DetoxStartDate { get; set; }
  public int? BaselinePickups { get; set; }
  public int? DailyPickupGoal { get; set; }
}
