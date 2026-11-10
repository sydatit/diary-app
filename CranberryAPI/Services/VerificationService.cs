using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using CranberryAPI.Models;

namespace CranberryAPI.Services;

public enum VerifyResult { Success, Invalid, Expired, TooManyAttempts, AlreadyVerified }

public interface IVerificationService
{
  /// <summary>Seconds until a new code may be sent (0 = allowed now).</summary>
  int CooldownRemaining(ApplicationUser user);
  Task IssueCodeAsync(ApplicationUser user);
  Task<VerifyResult> VerifyAsync(ApplicationUser user, string code);
}

public class VerificationService : IVerificationService
{
  public const int CodeLifetimeMinutes = 15;
  public const int ResendCooldownSeconds = 60;
  public const int MaxAttempts = 5;

  private readonly UserManager<ApplicationUser> _userManager;
  private readonly IEmailService _email;

  public VerificationService(UserManager<ApplicationUser> userManager, IEmailService email)
  {
    _userManager = userManager;
    _email = email;
  }

  public int CooldownRemaining(ApplicationUser user)
  {
    if (user.EmailCodeSentAt == null) return 0;
    var remaining = ResendCooldownSeconds - (DateTime.UtcNow - user.EmailCodeSentAt.Value).TotalSeconds;
    return remaining > 0 ? (int)Math.Ceiling(remaining) : 0;
  }

  public async Task IssueCodeAsync(ApplicationUser user)
  {
    string code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    user.EmailCodeHash = Hash(user.Id, code);
    user.EmailCodeExpiresAt = DateTime.UtcNow.AddMinutes(CodeLifetimeMinutes);
    user.EmailCodeSentAt = DateTime.UtcNow;
    user.EmailCodeAttempts = 0;
    await _userManager.UpdateAsync(user);

    await _email.SendAsync(user.Email, "Your Unplug verification code", PlainBody(user.UserName, code), HtmlBody(user.UserName, code));
  }

  public async Task<VerifyResult> VerifyAsync(ApplicationUser user, string code)
  {
    if (user.EmailConfirmed) return VerifyResult.AlreadyVerified;
    if (user.EmailCodeHash == null || user.EmailCodeExpiresAt == null) return VerifyResult.Expired;
    if (user.EmailCodeAttempts >= MaxAttempts) return VerifyResult.TooManyAttempts;
    if (DateTime.UtcNow > user.EmailCodeExpiresAt.Value) return VerifyResult.Expired;

    byte[] expected = Encoding.ASCII.GetBytes(user.EmailCodeHash);
    byte[] actual = Encoding.ASCII.GetBytes(Hash(user.Id, code ?? ""));
    if (!CryptographicOperations.FixedTimeEquals(expected, actual))
    {
      user.EmailCodeAttempts++;
      await _userManager.UpdateAsync(user);
      return user.EmailCodeAttempts >= MaxAttempts ? VerifyResult.TooManyAttempts : VerifyResult.Invalid;
    }

    user.EmailConfirmed = true;
    user.EmailCodeHash = null;
    user.EmailCodeExpiresAt = null;
    user.EmailCodeAttempts = 0;
    await _userManager.UpdateAsync(user);
    return VerifyResult.Success;
  }

  private static string Hash(string userId, string code)
  {
    byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{userId}:{code}"));
    return Convert.ToHexString(bytes);
  }

  private static string PlainBody(string name, string code) =>
$@"Hi {name},

Your Unplug verification code is: {code}

It expires in {CodeLifetimeMinutes} minutes. If you didn't create an Unplug account, you can ignore this email.

— Unplug";

  private static string HtmlBody(string name, string code)
  {
    string safeName = System.Net.WebUtility.HtmlEncode(name);
    string spaced = string.Join("&nbsp;", code.ToCharArray());
    return $@"<!doctype html>
<html><body style=""margin:0;background:#f6f3ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2a2420"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""padding:40px 16px"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:460px;background:#ffffff;border:1px solid #ebe4d9;border-radius:16px;padding:36px 32px"">
        <tr><td style=""font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f6f62;padding-bottom:24px"">Unplug</td></tr>
        <tr><td style=""font-size:15px;line-height:1.6;padding-bottom:20px"">Hi {safeName},<br>Use this code to verify your email and activate your account.</td></tr>
        <tr><td align=""center"" style=""padding:8px 0 24px"">
          <div style=""display:inline-block;background:#eaf3f0;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:600;letter-spacing:4px;color:#2f6f62;font-family:Menlo,Consolas,monospace"">{spaced}</div>
        </td></tr>
        <tr><td style=""font-size:13px;line-height:1.6;color:#958a7f"">This code expires in {CodeLifetimeMinutes} minutes. If you didn't create an Unplug account, you can safely ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>";
  }
}
