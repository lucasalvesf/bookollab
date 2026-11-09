namespace Bookollab.Api.Domain.Notifications;

public enum NotificationType
{
    YourTurn,
    SceneInvite,
    SceneJoinRequest,
    SceneJoinDecision,
    Mention,
    ChapterApproval,
    ChapterDecision,
    RemovedFromCommunity,
}

/// <summary>In-app notification. <see cref="Link"/> is an app route (e.g. "/cenas/{id}").</summary>
public sealed class Notification
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public Guid? CommunityId { get; set; }
    public NotificationType Type { get; set; }
    public required string Title { get; set; }
    public string? Body { get; set; }
    public string? Link { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }
}
