namespace Bookollab.Api.Domain.Chapters;

public enum ChapterStatus
{
    Draft,
    Published,
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

    public List<ChapterRevision> Revisions { get; init; } = [];

    public void Publish(DateTimeOffset now)
    {
        Status = ChapterStatus.Published;
        PublishedAt ??= now;
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
