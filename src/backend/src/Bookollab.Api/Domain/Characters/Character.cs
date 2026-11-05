namespace Bookollab.Api.Domain.Characters;

public enum CharacterStatus
{
    Active,
    Archived,
}

public sealed class Character
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public Guid OwnerUserId { get; set; }
    public required string Name { get; set; }
    public string? AvatarKey { get; set; }

    /// <summary>Values of the community's sheet fields (stored as jsonb).</summary>
    public List<SheetValue> Sheet { get; set; } = [];

    public bool ShowOnGlobalProfile { get; set; }
    public bool ShowCommunityOnProfile { get; set; } = true;
    public CharacterStatus Status { get; set; } = CharacterStatus.Active;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Last scene, action, chapter or interaction; drives the inactivity rule.</summary>
    public DateTimeOffset LastActivityAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SheetValue
{
    public required string Key { get; set; }
    public string? Value { get; set; }
}
