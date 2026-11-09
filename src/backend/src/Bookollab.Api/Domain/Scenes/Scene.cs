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

/// <summary>Who may take part in a scene (chosen by whoever opens it).</summary>
public enum SceneParticipation
{
    Public,
    InviteOnly,
    Request,
}

/// <summary>Who can read the scene after it is closed.</summary>
public enum SceneArchiveVisibility
{
    Community,
    Participants,
}

public enum SceneJoinRequestStatus
{
    Pending,
    Approved,
    Rejected,
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

    public SceneParticipation Participation { get; set; } = SceneParticipation.Public;
    public SceneArchiveVisibility ArchiveVisibility { get; set; } = SceneArchiveVisibility.Community;

    // Turns (WritingMode == Turns)
    /// <summary>Time limit per turn; null = no limit.</summary>
    public int? TurnTimeLimitMinutes { get; set; }
    public Guid? CurrentTurnCharacterId { get; set; }
    public DateTimeOffset? TurnStartedAt { get; set; }

    public List<SceneParticipant> Participants { get; init; } = [];

    /// <summary>Participants in turn order.</summary>
    public IEnumerable<SceneParticipant> InOrder() => Participants.OrderBy(p => p.Position).ThenBy(p => p.JoinedAt);

    /// <summary>Passes the turn to the next participant (wrapping around). Returns the new character, if any.</summary>
    public Guid? AdvanceTurn(DateTimeOffset now)
    {
        var order = InOrder().Select(p => p.CharacterId).ToList();
        if (WritingMode != SceneWritingMode.Turns || order.Count == 0)
        {
            CurrentTurnCharacterId = null;
            TurnStartedAt = null;
            return null;
        }
        var index = CurrentTurnCharacterId is null ? -1 : order.IndexOf(CurrentTurnCharacterId.Value);
        CurrentTurnCharacterId = order[(index + 1) % order.Count];
        TurnStartedAt = now;
        return CurrentTurnCharacterId;
    }

    /// <summary>When the current turn expires, if there is a time limit.</summary>
    public DateTimeOffset? TurnDeadline() =>
        WritingMode == SceneWritingMode.Turns && TurnTimeLimitMinutes is { } minutes && TurnStartedAt is { } started
            ? started.AddMinutes(minutes)
            : null;
}

public sealed class SceneParticipant
{
    public Guid SceneId { get; set; }
    public Guid CharacterId { get; set; }
    public DateTimeOffset JoinedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Position in the turn order (join order by default; reorderable).</summary>
    public int Position { get; set; }
}

/// <summary>Character invited into an invite-only scene.</summary>
public sealed class SceneInvite
{
    public Guid SceneId { get; set; }
    public Guid CharacterId { get; set; }
    public Guid InvitedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Request to join a scene whose participation is "Request".</summary>
public sealed class SceneJoinRequest
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid SceneId { get; set; }
    public Guid CharacterId { get; set; }
    public Guid UserId { get; set; }
    public SceneJoinRequestStatus Status { get; set; } = SceneJoinRequestStatus.Pending;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DecidedAt { get; set; }
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

    /// <summary>Server-generated dice roll (JSON of <see cref="Mechanics.DiceRoll"/>). Roll actions cannot be edited.</summary>
    public string? RollJson { get; init; }

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
