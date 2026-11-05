using System.Collections.Concurrent;
using Bookollab.Api.Infrastructure;
using Bookollab.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace Bookollab.Tests;

/// <summary>
/// Boots the API against a real, disposable Postgres container. Emails are captured in memory.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public FakeEmailSender Emails { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
        builder.UseSetting("Jwt:SigningKey", "test-signing-key-0123456789-0123456789-abcdef");
        builder.UseSetting("App:BaseUrl", "http://app.test");
        builder.UseSetting("Smtp:Host", "localhost");
        builder.UseSetting("Smtp:From", "test@bookollab.dev");
        builder.UseSetting("Storage:LocalPath", Path.Combine(Path.GetTempPath(), "bookollab-tests", Guid.NewGuid().ToString("N")));
        builder.ConfigureTestServices(services => services.AddSingleton<IEmailSender>(Emails));
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

public sealed class FakeEmailSender : IEmailSender
{
    public ConcurrentQueue<EmailMessage> Sent { get; } = new();

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        Sent.Enqueue(message);
        return Task.CompletedTask;
    }

    public EmailMessage LastTo(string email) => Sent.Last(m => m.To.Equals(email, StringComparison.OrdinalIgnoreCase));
}
