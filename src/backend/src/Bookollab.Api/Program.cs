using Bookollab.Api.Infrastructure;
using Bookollab.Api.Domain.Users;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .UseSnakeCaseNamingConvention());

// Needed by Identity token providers (email confirmation, password reset).
builder.Services.AddDataProtection();

builder.Services
    .AddIdentityCore<User>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.SignIn.RequireConfirmedEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

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

app.MapOpenApi();

app.MapGet("/health", async Task<Results<Ok<HealthResponse>, ProblemHttpResult>> (AppDbContext db, CancellationToken ct) =>
        await db.Database.CanConnectAsync(ct)
            ? TypedResults.Ok(new HealthResponse("ok"))
            : TypedResults.Problem("Database unavailable", statusCode: StatusCodes.Status503ServiceUnavailable))
    .WithName("GetHealth");

app.Run();

public sealed record HealthResponse(string Status);

public partial class Program;
