using System.Collections.Concurrent;
using System.Security.Claims;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Presence;

/// <summary>What a viewer may see of someone's presence. Null = hidden by privacy.</summary>
public sealed record MemberPresence(bool? Online, DateTimeOffset? LastSeenAt);

public sealed record PrivacySettings(PresenceVisibility OnlineVisibility, PresenceVisibility LastSeenVisibility);

/// <summary>
/// Who is online right now: users with at least one open connection to the notifications hub (the app keeps
/// it open on every screen). In memory, per API instance (same limitation as the scene presence).
/// </summary>
public sealed class PresenceTracker(IServiceScopeFactory scopes, TimeProvider clock)
{
    private readonly ConcurrentDictionary<Guid, int> _connections = new();

    public bool IsOnline(Guid userId) => _connections.TryGetValue(userId, out var n) && n > 0;

    public Task ConnectedAsync(string? userId)
    {
        if (!Guid.TryParse(userId, out var id)) return Task.CompletedTask;
        _connections.AddOrUpdate(id, 1, (_, n) => n + 1);
        return TouchAsync(id);
    }

    public Task DisconnectedAsync(string? userId)
    {
        if (!Guid.TryParse(userId, out var id)) return Task.CompletedTask;
        var left = _connections.AddOrUpdate(id, 0, (_, n) => Math.Max(0, n - 1));
        if (left == 0) _connections.TryRemove(new KeyValuePair<Guid, int>(id, 0));
        return TouchAsync(id);
    }

    private async Task TouchAsync(Guid userId)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = clock.GetUtcNow();
        await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s.SetProperty(u => u.LastSeenAt, now));
    }

    /// <summary>
    /// Applies the privacy rules: the target must share it and, like WhatsApp, so must the viewer (reciprocity).
    /// Nobody is hidden from themselves.
    /// </summary>
    public MemberPresence View(Guid viewerId, PrivacySettings viewer, Guid targetId, PrivacySettings target, DateTimeOffset? lastSeenAt)
    {
        var self = viewerId == targetId;
        var showOnline = self || (viewer.OnlineVisibility == PresenceVisibility.Everyone && target.OnlineVisibility == PresenceVisibility.Everyone);
        var showLastSeen = self || (viewer.LastSeenVisibility == PresenceVisibility.Everyone && target.LastSeenVisibility == PresenceVisibility.Everyone);
        var online = IsOnline(targetId);
        return new MemberPresence(showOnline ? online : null, showLastSeen && !(showOnline && online) ? lastSeenAt : null);
    }
}

public static class PresenceEndpoints
{
    public static void MapPresenceEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me/privacy").WithTags("Profile").RequireAuthorization();
        g.MapGet("/", Get).WithName("GetPrivacy").Produces<PrivacySettings>();
        g.MapPut("/", Update).WithName("UpdatePrivacy").Produces<PrivacySettings>();
    }

    public static async Task<PrivacySettings> SettingsAsync(AppDbContext db, Guid userId, CancellationToken ct) =>
        await db.Users.Where(u => u.Id == userId).Select(u => new PrivacySettings(u.OnlineVisibility, u.LastSeenVisibility)).SingleAsync(ct);

    private static async Task<IResult> Get(ClaimsPrincipal user, AppDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await SettingsAsync(db, user.UserId(), ct));

    private static async Task<IResult> Update(PrivacySettings req, ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.UserId();
        await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s
            .SetProperty(u => u.OnlineVisibility, req.OnlineVisibility)
            .SetProperty(u => u.LastSeenVisibility, req.LastSeenVisibility), ct);
        return TypedResults.Ok(req);
    }
}
