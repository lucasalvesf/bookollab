using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Scenes;

/// <summary>Passes the turn when its time limit expires (checked every 30 seconds).</summary>
public sealed class TurnTimeoutService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<TurnTimeoutService> logger) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Turn timeout check failed");
            }
        }
    }

    /// <summary>Advances every expired turn. Returns how many scenes were advanced.</summary>
    public async Task<int> RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<SceneHub>>();
        var notifications = scope.ServiceProvider.GetRequiredService<NotificationService>();
        var now = clock.GetUtcNow();

        var candidates = await db.Scenes
            .Where(s => s.Status == SceneStatus.Open && s.WritingMode == SceneWritingMode.Turns
                && s.TurnTimeLimitMinutes != null && s.TurnStartedAt != null)
            .Include(s => s.Participants)
            .ToListAsync(ct);

        var advanced = 0;
        foreach (var scene in candidates.Where(s => s.TurnDeadline() <= now))
        {
            scene.AdvanceTurn(now);
            await db.SaveChangesAsync(ct);
            await SceneEndpoints.TurnChangedAsync(db, hub, notifications, scene, null, ct);
            advanced++;
        }
        return advanced;
    }
}
