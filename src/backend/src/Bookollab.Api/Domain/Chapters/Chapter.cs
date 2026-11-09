namespace Bookollab.Api.Domain.Chapters;

public enum ChapterStatus
{
    Draft,
    Published,

    /// <summary>Waiting in the staff approval queue; hidden from other members.</summary>
    Pending,

    /// <summary>Rejected by the staff (see <see cref="Chapter.RejectionReason"/>); the author may edit and resubmit.</summary>
    Rejected,
}

/// <summary>Community setting: which chapters need staff approval before showing up.</summary>
public enum ChapterApprovalMode
{
    Off,

    /// <summary>Every member's chapters (except the staff, who run the queue).</summary>
    All,

    /// <summary>Only authors whose role is in the selected list.</summary>
    Roles,
}

/// <summary>Co-author of a chapter written from a scene (one of the scene's characters).</summary>
public sealed class ChapterCoauthor
{
    public Guid ChapterId { get; set; }
    public Guid CharacterId { get; set; }
}

/// <summary>Character or player tagged with "@" in a chapter (e.g. the recipient of a letter).</summary>
public sealed class ChapterMention
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid ChapterId { get; set; }
    public Guid? CharacterId { get; set; }
    public Guid? UserId { get; set; }
}

/// <summary>Narrative text ("Capítulo"), always OnGame. Displayed name is configurable per community.</summary>
public sealed class Chapter
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public Guid CharacterId { get; set; }
    public Guid AuthorUserId { get; set; }
    public required string Title { get; set; }

    /// <summary>Markdown.</summary>
    public required string Content { get; set; }

    public ChapterStatus Status { get; set; } = ChapterStatus.Draft;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>Scene this chapter was written from (optional).</summary>
    public Guid? SourceSceneId { get; set; }

    /// <summary>Chapter this one answers (e.g. a reply to a letter).</summary>
    public Guid? ReplyToChapterId { get; set; }

    public string? RejectionReason { get; set; }

    public List<ChapterRevision> Revisions { get; init; } = [];
    public List<ChapterCoauthor> Coauthors { get; init; } = [];
    public List<ChapterMention> Mentions { get; init; } = [];

    public void Publish(DateTimeOffset now)
    {
        Status = ChapterStatus.Published;
        PublishedAt ??= now;
        RejectionReason = null;
    }

    public void SubmitForApproval()
    {
        Status = ChapterStatus.Pending;
        RejectionReason = null;
    }

    public void Reject(string reason)
    {
        Status = ChapterStatus.Rejected;
        RejectionReason = reason;
    }

    /// <summary>
    /// Edits title/content. Edits after publishing keep the previous version and mark the chapter as edited;
    /// drafts are edited freely.
    /// </summary>
    public void Edit(string title, string content, DateTimeOffset now)
    {
        if (Status == ChapterStatus.Published)
        {
            Revisions.Add(new ChapterRevision
            {
                ChapterId = Id,
                Title = Title,
                Content = Content,
                CreatedAt = EditedAt ?? PublishedAt ?? CreatedAt,
            });
            EditedAt = now;
        }

        Title = title;
        Content = content;
    }
}

public sealed class ChapterRevision
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid ChapterId { get; set; }
    public required string Title { get; init; }
    public required string Content { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
