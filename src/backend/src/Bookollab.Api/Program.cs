using System.Security.Claims;
using System.Text.Json.Serialization;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Features.Auth;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Profile;
using Bookollab.Api.Features.Scenes;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure.Storage;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Encyclopedia;
using Bookollab.Api.Features.Mechanics;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Infrastructure;
using Bookollab.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .UseSnakeCaseNamingConvention());

builder.Services.AddSingleton(TimeProvider.System);

// Needed by Identity token providers (email confirmation, password reset).
builder.Services.AddDataProtection();

builder.Services
    .AddIdentityCore<User>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyz0123456789_";
        options.SignIn.RequireConfirmedEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
        options.ClaimsIdentity.UserIdClaimType = JwtRegisteredClaimNames.Sub;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddErrorDescriber<PortugueseIdentityErrorDescriber>()
    .AddDefaultTokenProviders();

builder.Services.AddOptions<JwtOptions>().BindConfiguration(JwtOptions.Section)
    .Validate(o => o.SigningKey.Length >= 32, "Jwt:SigningKey must have at least 32 characters.").ValidateOnStart();
builder.Services.AddOptions<AppLinkOptions>().BindConfiguration(AppLinkOptions.Section).ValidateOnStart();
builder.Services.AddOptions<SmtpOptions>().BindConfiguration(SmtpOptions.Section);
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<PermissionService>();
builder.Services.AddSingleton<ScenePresence>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, SubUserIdProvider>();
builder.Services.AddSingleton<TurnTimeoutService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TurnTimeoutService>());
builder.Services.AddOptions<StorageOptions>().BindConfiguration(StorageOptions.Section);
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
// Configured from JwtOptions lazily, so tests and environments can override settings.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.SigningKey(jwt),
            NameClaimType = JwtRegisteredClaimNames.UniqueName,
            RoleClaimType = ClaimTypes.Role,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        // Browsers cannot send headers on WebSocket connections: SignalR passes the token in the query string.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    context.Token = token;
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();

// Enums travel as readable text ("InviteOnly"), matching how they are stored.
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    // Numbers are numbers (no "123" strings): keeps the OpenAPI types as plain integers for the app.
    o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

const string AppCorsPolicy = "app";
builder.Services.AddCors(options => options.AddPolicy(AppCorsPolicy, policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(AppCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();

app.MapGet("/health", async Task<Results<Ok<HealthResponse>, ProblemHttpResult>> (AppDbContext db, CancellationToken ct) =>
        await db.Database.CanConnectAsync(ct)
            ? TypedResults.Ok(new HealthResponse("ok"))
            : TypedResults.Problem("Database unavailable", statusCode: StatusCodes.Status503ServiceUnavailable))
    .WithName("GetHealth");

app.MapAuthEndpoints();
app.MapCommunityEndpoints();
app.MapCharacterEndpoints();
app.MapSceneEndpoints();
app.MapChapterEndpoints();
app.MapUploadEndpoints();
app.MapProfileEndpoints();
app.MapPublicProfileEndpoints();
app.MapEncyclopediaEndpoints();
app.MapNotificationEndpoints();
app.MapMechanicsEndpoints();
app.MapHub<SceneHub>("/hubs/scenes");

app.Run();

public sealed record HealthResponse(string Status);

public partial class Program;
