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

builder.Services.Configure<GeminiSettings>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddHttpClient(GeminiAudioService.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(90));
builder.Services.AddScoped<IGeminiAudioService, GeminiAudioService>();

builder.Services.AddDbContext<CranberryAPIContext>(
                  dbContextOptions => dbContextOptions
                    .UseMySql(
                    	builder.Configuration["ConnectionStrings:DefaultConnection"],
                      ServerVersion.AutoDetect(builder.Configuration["ConnectionStrings:DefaultConnection"]
                    )
                  )
                );

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

using (var scope = app.Services.CreateScope())
{
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