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

/// <summary>Kind of post: a Chapter (OnGame, from a character's point of view) or a Blog (OFF, by the player).</summary>
public enum PostKind
{
    Chapter,
    Blog,
}

/// <summary>
/// A post: "Capítulo" (OnGame, written as a character) or "Blog" (OFF, written as the player).
/// Both use the blog format: cover, images in the text, reading background and music.
/// </summary>
public sealed class Chapter
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public PostKind Kind { get; set; } = PostKind.Chapter;

    /// <summary>Narrator of a chapter. Null for blogs.</summary>
    public Guid? CharacterId { get; set; }

    /// <summary>Cover image (upload key).</summary>
    public string? CoverKey { get; set; }

    /// <summary>Background image behind the text while reading (upload key).</summary>
    public string? BackgroundKey { get; set; }
    /// <summary>Solid reading background (#RRGGBB) when there is no image.</summary>
    public string? BackgroundColor { get; set; }
    /// <summary>Blur applied to the background image (0-40 px).</summary>
    public int BackgroundBlur { get; set; }

    /// <summary>Music to listen to while reading (YouTube, Spotify or SoundCloud link).</summary>
    public string? MusicUrl { get; set; }
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
