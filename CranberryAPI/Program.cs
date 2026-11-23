using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using CranberryAPI.Controllers;
using CranberryAPI.Models;
using CranberryAPI.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var MyAllowSpecificOrigins = "_myCranberryCORS";
builder.Services.AddCors(options => 
{
  options.AddPolicy(name: MyAllowSpecificOrigins,
                    policy => 
                    {
                      policy.WithOrigins("http://localhost:3000",
                                          "https://cranberry-axec.onrender.com")
                      .AllowAnyMethod()
                      .AllowAnyHeader();
                    });
});

builder.Services.AddControllers();

builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IVerificationService, VerificationService>();

builder.Services.Configure<WhisperSettings>(builder.Configuration.GetSection("Whisper"));
// Whisper on CPU: a 10-minute recording can take several minutes, and waits its turn if another one is running.
builder.Services.AddHttpClient(WhisperTranscriptionService.HttpClientName, c => c.Timeout = TimeSpan.FromMinutes(15));
builder.Services.AddScoped<ITranscriptionService, WhisperTranscriptionService>();

string connectionString = builder.Configuration["ConnectionStrings:DefaultConnection"];
// AutoDetect opens a connection to ask the server its version: do it once, not for every DbContext (every request).
var serverVersion = new Lazy<ServerVersion>(() => ServerVersion.AutoDetect(connectionString));
builder.Services.AddDbContext<CranberryAPIContext>(
  dbContextOptions => dbContextOptions.UseMySql(connectionString, serverVersion.Value));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
  {
    options.User.RequireUniqueEmail = true;
    // Accounts stay inactive until the emailed code is verified.
    options.SignIn.RequireConfirmedEmail = true;
  })
	.AddEntityFrameworkStores<CranberryAPIContext>()
  .AddDefaultTokenProviders();

builder.Services.AddAuthentication(options =>
{
  options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
  options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
  options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options => 
{
  options.SaveToken = true;
  options.RequireHttpsMetadata = false;
  options.TokenValidationParameters = new TokenValidationParameters()
  {
    ValidateIssuer = true,
    ValidateAudience = true,
    ValidAudience = builder.Configuration["JWT:ValidAudience"],
    ValidIssuer = builder.Configuration["JWT:ValidIssuer"],
    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JWT:Secret"]))
  };
  // Reject tokens whose security stamp no longer matches the user's (signed out everywhere,
  // password changed, account deleted). Tokens issued before stamps existed are rejected too.
  options.Events = new JwtBearerEvents
  {
    OnTokenValidated = async context =>
    {
      string userId = context.Principal?.FindFirst("userId")?.Value;
      string stamp = context.Principal?.FindFirst(UsersController.SecurityStampClaim)?.Value;
      if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(stamp))
      {
        context.Fail("Token has no security stamp.");
        return;
      }

      var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
      ApplicationUser user = await userManager.FindByIdAsync(userId);
      if (user == null || user.SecurityStamp != stamp)
      {
        context.Fail("Token has been revoked.");
      }
    }
  };
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Tests set Database__MigrateOnStartup=false and create their own schema.
if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
  using var scope = app.Services.CreateScope();
  var dbContext = scope.ServiceProvider.GetRequiredService<CranberryAPI.Models.CranberryAPIContext>();
  dbContext.Database.Migrate();
}


if (app.Environment.IsDevelopment())
{
  app.UseSwagger();
  app.UseSwaggerUI();
}
else
{
  app.UseHttpsRedirection();
}



app.UseCors(MyAllowSpecificOrigins);

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Ok(new { status = "ok" }));

app.Run();

// Lets the test project start the app with WebApplicationFactory<Program>.
public partial class Program { }
