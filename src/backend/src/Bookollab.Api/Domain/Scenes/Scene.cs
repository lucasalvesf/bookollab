namespace Bookollab.Api.Domain.Scenes;

public enum SceneWritingMode
{
    Free,
    Turns,
}

public enum SceneStatus
{
    Open,
    Closed,
}

public sealed class Scene
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public Guid OpenedByUserId { get; set; }
    public SceneWritingMode WritingMode { get; set; } = SceneWritingMode.Free;
    public SceneStatus Status { get; set; } = SceneStatus.Open;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ClosedAt { get; set; }

    /// <summary>Chat background chosen by the opener or the staff: "preset:&lt;name&gt;" or "image:&lt;upload key&gt;". Null = default.</summary>
    public string? Background { get; set; }

    public List<SceneParticipant> Participants { get; init; } = [];
}

public sealed class SceneParticipant
{
    public Guid SceneId { get; set; }
    public Guid CharacterId { get; set; }
    public DateTimeOffset JoinedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>A message sent inside a scene ("Ação"), always OnGame.</summary>
public sealed class SceneAction
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid SceneId { get; set; }
    public Guid CharacterId { get; set; }
    public Guid AuthorUserId { get; set; }
    /// <summary>Text of the action. May be empty when the action is only an image.</summary>
    public required string Content { get; set; }

    /// <summary>Optional image attached to the action (upload key).</summary>
    public string? AttachmentKey { get; init; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EditedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public List<SceneActionRevision> Revisions { get; init; } = [];

    /// <summary>Edits the content, keeping the previous version for staff auditing.</summary>
    public void Edit(string newContent, DateTimeOffset now)
    {
        Revisions.Add(new SceneActionRevision { ActionId = Id, Content = Content, CreatedAt = EditedAt ?? CreatedAt });
        Content = newContent;
        EditedAt = now;
    }
}

public sealed class SceneActionRevision
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid ActionId { get; set; }
    public required string Content { get; init; }

    /// <summary>When this version was originally written.</summary>
    public DateTimeOffset CreatedAt { get; init; }
}
