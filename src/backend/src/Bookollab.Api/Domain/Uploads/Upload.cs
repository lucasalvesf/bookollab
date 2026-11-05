namespace Bookollab.Api.Domain.Uploads;

/// <summary>An uploaded file (image). Used to check ownership before a key is attached to anything.</summary>
public sealed class Upload
{
    /// <summary>Storage key, e.g. "2026/11/0193….webp". Unguessable; files are served publicly by key.</summary>
    public required string Key { get; init; }

    public Guid OwnerUserId { get; init; }
    public required string ContentType { get; init; }
    public long Size { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
