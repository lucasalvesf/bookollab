using System.Security.Claims;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Bookollab.Api.Features.Notifications;

public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string? Body, string? Link, Guid? CommunityId, DateTimeOffset CreatedAt, bool Read);

public sealed record NotificationListDto(IReadOnlyList<NotificationDto> Items, int UnreadCount);

public sealed record UnreadByCommunityDto(Guid CommunityId, int Count);

/// <summary>Per-user realtime channel: pushes "NotificationCreated" as soon as a notification is stored.</summary>
[Authorize]
public sealed class NotificationHub(Presence.PresenceTracker presence) : Hub
{
    public override Task OnConnectedAsync() => presence.ConnectedAsync(Context.UserIdentifier);

    public override Task OnDisconnectedAsync(Exception? exception) => presence.DisconnectedAsync(Context.UserIdentifier);
}

/// <summary>SignalR user id = the JWT "sub" claim, so Clients.User(userId) reaches every device of the user.</summary>
public sealed class SubUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) => connection.User?.FindFirstValue(JwtRegisteredClaimNames.Sub);
}

/// <summary>Stores in-app notifications and pushes them in realtime. Never notifies the actor themselves.</summary>
public sealed class NotificationService(AppDbContext db, IHubContext<NotificationHub> hub)
{
    public async Task NotifyAsync(IEnumerable<Guid> userIds, NotificationType type, string title, string? body, string? link, Guid? communityId, Guid? actorId, CancellationToken ct)
    {
        var targets = userIds.Distinct().Where(id => id != actorId).ToList();
        if (targets.Count == 0) return;
        var items = targets.Select(id => new Notification { UserId = id, Type = type, Title = title, Body = body, Link = link, CommunityId = communityId }).ToList();
        db.Notifications.AddRange(items);
        await db.SaveChangesAsync(ct);
        foreach (var n in items)
            await hub.Clients.User(n.UserId.ToString()).SendAsync("NotificationCreated", ToDto(n), ct);
    }

    public Task NotifyAsync(Guid userId, NotificationType type, string title, string? body, string? link, Guid? communityId, Guid? actorId, CancellationToken ct) =>
        NotifyAsync([userId], type, title, body, link, communityId, actorId, ct);

    public static NotificationDto ToDto(Notification n) => new(n.Id, n.Type, n.Title, n.Body, n.Link, n.CommunityId, n.CreatedAt, n.ReadAt is not null);
}

public static class NotificationEndpoints
{
    public static void MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/notifications").WithTags("Notifications").RequireAuthorization();
        g.MapGet("/", List).WithName("ListNotifications").Produces<NotificationListDto>();
        g.MapGet("/unread-by-community", UnreadByCommunity).WithName("UnreadNotificationsByCommunity").Produces<List<UnreadByCommunityDto>>();
        g.MapPost("/{id:guid}/read", MarkRead).WithName("MarkNotificationRead").Produces(StatusCodes.Status204NoContent);
        g.MapPost("/read-all", MarkAllRead).WithName("MarkAllNotificationsRead").Produces(StatusCodes.Status204NoContent);
        app.MapHub<NotificationHub>("/hubs/notifications");
    }

    /// <summary>Latest notifications; with communityId, only that community's (the unread count follows the filter).</summary>
    private static async Task<IResult> List(Guid? communityId, ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.UserId();
        var mine = db.Notifications.Where(n => n.UserId == userId && (communityId == null || n.CommunityId == communityId));
        var items = await mine.OrderByDescending(n => n.CreatedAt).Take(50).ToListAsync(ct);
        var unread = await mine.CountAsync(n => n.ReadAt == null, ct);
        return TypedResults.Ok(new NotificationListDto(items.Select(NotificationService.ToDto).ToList(), unread));
    }

    private static async Task<IResult> MarkRead(Guid id, ClaimsPrincipal user, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var userId = user.UserId();
        await db.Notifications.Where(n => n.Id == id && n.UserId == userId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, clock.GetUtcNow()), ct);
        return TypedResults.NoContent();
    }

    /// <summary>Unread notifications per community (red dots on the community rail).</summary>
    private static async Task<IResult> UnreadByCommunity(ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.UserId();
        var rows = await db.Notifications.Where(n => n.UserId == userId && n.ReadAt == null && n.CommunityId != null)
            .GroupBy(n => n.CommunityId!.Value)
            .Select(g => new UnreadByCommunityDto(g.Key, g.Count()))
            .ToListAsync(ct);
        return TypedResults.Ok(rows);
    }

    private static async Task<IResult> MarkAllRead(Guid? communityId, ClaimsPrincipal user, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var userId = user.UserId();
        await db.Notifications.Where(n => n.UserId == userId && n.ReadAt == null && (communityId == null || n.CommunityId == communityId))
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, clock.GetUtcNow()), ct);
        return TypedResults.NoContent();
    }
}
