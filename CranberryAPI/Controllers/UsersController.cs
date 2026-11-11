using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using CranberryAPI.Models;
using CranberryAPI.Services;
using CranberryAPI.Wrappers;

namespace CranberryAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UsersController : ControllerBase
{
  private readonly CranberryAPIContext _db;
  private readonly UserManager<ApplicationUser> _userManager;
  private readonly IVerificationService _verification;
  private readonly IConfiguration _configuration;
  private readonly ILogger<UsersController> _logger;

  public UsersController(
    CranberryAPIContext db,
    UserManager<ApplicationUser> userManager,
    IVerificationService verification,
    IConfiguration configuration,
    ILogger<UsersController> logger)
  {
    _db = db;
    _userManager = userManager;
    _verification = verification;
    _configuration = configuration;
    _logger = logger;
  }

  private string CurrentUserId => User.FindFirst("userId")?.Value;

  // ## # # # # # # # # # # # # # # ##
  // # USER AUTHENTICATION ENDPOINTS #
  // ## # # # # # # # # # # # # # # ##

  // POST: api/users/register
  // Creates an inactive account and emails a 6-digit verification code.
  // Re-registering an email that was never verified updates that pending account and sends a new code.
  [HttpPost("register")]
  public async Task<IActionResult> Register([FromBody] RegisterDto dto)
  {
    string email = dto.Email.Trim();
    ApplicationUser user = await _userManager.FindByEmailAsync(email);

    if (user != null && user.EmailConfirmed)
    {
      return BadRequest(new { status = "Error", message = "Email is already registered." });
    }

    if (user != null)
    {
      int wait = _verification.CooldownRemaining(user);
      if (wait > 0)
      {
        return StatusCode(429, new { status = "Error", message = $"Please wait {wait}s before requesting a new code.", retryAfter = wait });
      }

      // Pending account: refresh its details with what the user just submitted.
      IdentityResult nameResult = await _userManager.SetUserNameAsync(user, dto.UserName.Trim());
      if (!nameResult.Succeeded) return BadRequest(nameResult.Errors);

      IdentityResult pwdResult = await _userManager.RemovePasswordAsync(user);
      if (pwdResult.Succeeded) pwdResult = await _userManager.AddPasswordAsync(user, dto.Password);
      if (!pwdResult.Succeeded) return BadRequest(pwdResult.Errors);

      ApplyHabits(user, dto.DetoxStartDate, dto.BaselinePickups, dto.DailyPickupGoal);
      await _userManager.UpdateAsync(user);
    }
    else
    {
      user = new ApplicationUser
      {
        Email = email,
        UserName = dto.UserName.Trim(),
        EmailConfirmed = false,
      };
      ApplyHabits(user, dto.DetoxStartDate, dto.BaselinePickups, dto.DailyPickupGoal);

      IdentityResult result = await _userManager.CreateAsync(user, dto.Password);
      if (!result.Succeeded) return BadRequest(result.Errors);
    }

    IActionResult sendError = await TrySendCode(user);
    if (sendError != null) return sendError;

    return Ok(new { status = "Success", message = $"We sent a verification code to {email}.", email });
  }

  // POST: api/users/verify-email
  [HttpPost("verify-email")]
  public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
  {
    ApplicationUser user = await _userManager.FindByEmailAsync(dto.Email.Trim());
    if (user == null)
    {
      return BadRequest(new { status = "Error", code = "Invalid", message = "That code isn't right. Please check and try again." });
    }

    VerifyResult result = await _verification.VerifyAsync(user, dto.Code);
    switch (result)
    {
      case VerifyResult.Success:
        return Ok(new { status = "Success", message = "Email verified.", token = CreateToken(user), userId = user.Id });
      case VerifyResult.AlreadyVerified:
        // Never hand out a token here: the code was not checked.
        return BadRequest(new { status = "Error", code = "AlreadyVerified", message = "This email is already verified. Please sign in." });
      case VerifyResult.Expired:
        return BadRequest(new { status = "Error", code = "Expired", message = "This code has expired. Request a new one." });
      case VerifyResult.TooManyAttempts:
        return BadRequest(new { status = "Error", code = "TooManyAttempts", message = "Too many incorrect attempts. Request a new code." });
      default:
        return BadRequest(new { status = "Error", code = "Invalid", message = "That code isn't right. Please check and try again." });
    }
  }

  // POST: api/users/resend-code
  [HttpPost("resend-code")]
  public async Task<IActionResult> ResendCode([FromBody] ResendCodeDto dto)
  {
    var ok = new { status = "Success", message = "If that email is waiting for verification, a new code is on its way." };
    ApplicationUser user = await _userManager.FindByEmailAsync(dto.Email.Trim());
    if (user == null || user.EmailConfirmed) return Ok(ok);

    int wait = _verification.CooldownRemaining(user);
    if (wait > 0)
    {
      return StatusCode(429, new { status = "Error", message = $"Please wait {wait}s before requesting a new code.", retryAfter = wait });
    }

    IActionResult sendError = await TrySendCode(user);
    return sendError ?? Ok(ok);
  }

  // POST: api/users/signin
  [HttpPost("signin")]
  public async Task<IActionResult> SignIn(SignInDto userInfo)
  {
    ApplicationUser user = await _userManager.FindByEmailAsync(userInfo.Email.Trim());

    if (user != null && await _userManager.CheckPasswordAsync(user, userInfo.Password))
    {
      if (!user.EmailConfirmed)
      {
        return StatusCode(403, new
        {
          status = "Error",
          code = "EmailNotConfirmed",
          message = "Please verify your email before signing in.",
          email = user.Email
        });
      }

      return Ok(new { status = "Success", message = $"{userInfo.Email} signed in.", token = CreateToken(user), userId = user.Id });
    }

    return BadRequest(new { status = "Error", message = "Unable to sign in." });
  }

  private async Task<IActionResult> TrySendCode(ApplicationUser user)
  {
    try
    {
      await _verification.IssueCodeAsync(user);
      return null;
    }
    catch (Exception ex) when (ex is SmtpException || ex is InvalidOperationException)
    {
      _logger.LogError(ex, "Failed to send verification code to {Email}", user.Email);
      return StatusCode(502, new { status = "Error", message = "We couldn't send the verification email. Please try again in a moment." });
    }
  }

  private static void ApplyHabits(ApplicationUser user, string startDate, int? baseline, int? goal)
  {
    if (!string.IsNullOrWhiteSpace(startDate)) user.DetoxStartDate = startDate;
    if (baseline.HasValue && baseline.Value > 0) user.BaselinePickups = baseline.Value;
    if (goal.HasValue && goal.Value > 0) user.DailyPickupGoal = goal.Value;
  }

  // Generate a user's Token
  private string CreateToken(ApplicationUser user)
  {
    List<Claim> authClaims = new List<Claim>
    {
      new Claim("userId", user.Id),
      new Claim("userName", user.UserName)
    };

    SymmetricSecurityKey authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT:Secret"]));

    JwtSecurityToken token = new JwtSecurityToken(
      issuer: _configuration["JWT:ValidIssuer"],
      audience: _configuration["JWT:ValidAudience"],
      expires: DateTime.Now.AddHours(12),
      claims: authClaims,
      signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
    );

    return new JwtSecurityTokenHandler().WriteToken(token);
  }

  // ## # # # # # # # # # # ##
  // #  USER CRUD ENDPOINTS  #
  // ## # # # # # # # # # # ##

  // GET: api/users/{id}
  [HttpGet("{id}")]
  [Authorize]
  public async Task<ActionResult> GetUserData(string id)
  {
    ApplicationUser user = await _userManager.FindByIdAsync(id);
    if (user == null || CurrentUserId != id) return NotFound();

    return Ok(new Response<UserProfileDto>
    {
      Status = "Success",
      Message = "User info retrieved successfully.",
      Data = UserProfileDto.From(user)
    });
  }

  // GET: api/users/profile
  [HttpGet("profile")]
  [Authorize]
  public async Task<ActionResult> GetUserProfile()
  {
    ApplicationUser user = await _userManager.FindByIdAsync(CurrentUserId);
    if (user == null) return NotFound();
    return Ok(UserProfileDto.From(user));
  }

  // PUT: api/users/{id}
  [HttpPut("{id}")]
  [Authorize]
  public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserDto userModel)
  {
    ApplicationUser user = await _userManager.FindByIdAsync(id);
    if (user == null || CurrentUserId != id) return NotFound();

    // Fields left out of the request body are not changed.
    ApplyHabits(user, userModel.DetoxStartDate, userModel.BaselinePickups, userModel.DailyPickupGoal);

    IdentityResult result = await _userManager.UpdateAsync(user);
    return result.Succeeded ? NoContent() : BadRequest(result.Errors);
  }

  // DELETE: api/users/{id}
  [HttpDelete("{id}")]
  [Authorize]
  public async Task<IActionResult> DeleteUser(string id)
  {
    if (CurrentUserId != id) return NotFound();

    ApplicationUser user = await _userManager.FindByIdAsync(id);
    if (user == null) return NotFound();

    // The Journals FK has no cascade, so remove the user's entries first.
    await using var tx = await _db.Database.BeginTransactionAsync();
    _db.Journals.RemoveRange(_db.Journals.Where(j => j.UserId == id));
    await _db.SaveChangesAsync();

    IdentityResult result = await _userManager.DeleteAsync(user);
    if (result.Succeeded) await tx.CommitAsync();
    return result.Succeeded ? NoContent() : BadRequest(result.Errors);
  }

  // ## # # # # # # # # # # # ##
  // # USER JOURNAL ENDPOINTS  #
  // ## # # # # # # # # # # # ##

  // GET: api/users/{id}/journals
  [HttpGet("{id}/journals")]
  [Authorize]
  public async Task<ActionResult<IEnumerable<Journal>>> GetUserJournals(string id)
  {
    if (CurrentUserId != id) return NotFound();

    List<Journal> userJournals = await _db.Journals
      .Where(j => j.UserId == id)
      .OrderByDescending(j => j.Date)
      .ToListAsync();

    return Ok(new Response<List<Journal>>
    {
      Status = "Success",
      Message = "Journals retrieved successfully.",
      Data = userJournals
    });
  }

  // GET: api/users/{id}/journals/{journalId}
  [HttpGet("{id}/journals/{journalId}")]
  [Authorize]
  public async Task<IActionResult> GetUserJournal(string id, int journalId)
  {
    if (CurrentUserId != id) return NotFound();

    Journal journal = await _db.Journals.FirstOrDefaultAsync(j => j.JournalId == journalId && j.UserId == id);
    if (journal == null) return NotFound();

    return Ok(new Response<Journal>
    {
      Status = "Success",
      Message = "Journal retrieved successfully.",
      Data = journal
    });
  }

  // POST: api/users/{id}/journals
  [HttpPost("{id}/journals")]
  [Authorize]
  public async Task<ActionResult<Journal>> PostJournal(string id, [FromBody] JournalInputDto input)
  {
    if (CurrentUserId != id) return Forbid();

    if (await _db.Journals.AnyAsync(j => j.UserId == id && j.Date == input.Date))
    {
      return DuplicateDate();
    }

    Journal journal = new Journal { UserId = id };
    Apply(journal, input);
    _db.Journals.Add(journal);

    try
    {
      await _db.SaveChangesAsync();
    }
    catch (DbUpdateException)
    {
      return DuplicateDate();
    }

    var response = new Response<Journal>
    {
      Status = "Success",
      Message = "Journal created successfully.",
      Data = journal
    };
    return CreatedAtAction(nameof(GetUserJournal), new { id, journalId = journal.JournalId }, response);
  }

  // PUT: api/users/{id}/journals/{journalId}
  [HttpPut("{id}/journals/{journalId}")]
  [Authorize]
  public async Task<ActionResult> UpdateJournal(string id, int journalId, [FromBody] JournalInputDto input)
  {
    if (CurrentUserId != id) return Forbid();

    Journal journal = await _db.Journals.FirstOrDefaultAsync(j => j.JournalId == journalId && j.UserId == id);
    if (journal == null) return NotFound();

    if (input.Date != journal.Date &&
        await _db.Journals.AnyAsync(j => j.UserId == id && j.Date == input.Date && j.JournalId != journalId))
    {
      return DuplicateDate();
    }

    Apply(journal, input);

    try
    {
      await _db.SaveChangesAsync();
    }
    catch (DbUpdateException)
    {
      return DuplicateDate();
    }

    return NoContent();
  }

  // DELETE: api/users/{id}/journals/{journalId}
  [HttpDelete("{id}/journals/{journalId}")]
  [Authorize]
  public async Task<IActionResult> DeleteJournal(string id, int journalId)
  {
    if (CurrentUserId != id) return NotFound();

    Journal journal = await _db.Journals.FirstOrDefaultAsync(j => j.JournalId == journalId && j.UserId == id);
    if (journal == null) return NotFound();

    _db.Journals.Remove(journal);
    await _db.SaveChangesAsync();
    return NoContent();
  }

  private ObjectResult DuplicateDate() =>
    Conflict(new { status = "Error", code = "DuplicateDate", message = "You already have an entry for this date." });

  private static void Apply(Journal journal, JournalInputDto input)
  {
    journal.Date = input.Date;
    journal.Mood = input.Mood;
    journal.UrgeLevel = input.UrgeLevel;
    journal.Pickups = input.Pickups;
    journal.StressLevel = input.StressLevel;
    journal.DayReflection = input.DayReflection?.Trim();
    journal.Gratitude = input.Gratitude?.Trim();
    journal.Win = input.Win?.Trim();
    journal.Improvement = input.Improvement?.Trim();
  }
}
