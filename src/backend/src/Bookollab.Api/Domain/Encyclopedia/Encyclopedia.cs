using Bookollab.Api.Domain.Communities;

namespace Bookollab.Api.Domain.Encyclopedia;

/// <summary>How strictly sheets created from a template must follow it (community setting).</summary>
public enum TemplateMode
{
    /// <summary>The sheet has exactly the template's fields.</summary>
    Strict,

    /// <summary>The sheet starts with the template's fields and the player may add new ones.</summary>
    Base,
}

/// <summary>A sheet template created by the staff ("modelo de ficha").</summary>
public sealed class SheetTemplate
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    /// <summary>Suggested type label for sheets made from it (e.g. "Pet", "Local").</summary>
    public string? Kind { get; set; }

    public List<SheetField> Fields { get; set; } = [];
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Folder of the encyclopedia, organized by the staff.</summary>
public sealed class EncyclopediaFolder
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public required string Name { get; set; }
    public int Position { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// A non-playable sheet of the encyclopedia (location, pet, family, faction, item…).
/// Playable characters are <see cref="Characters.Character"/>; both are listed together.
/// </summary>
public sealed class EncyclopediaSheet
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public Guid OwnerUserId { get; set; }
    public required string Name { get; set; }

    /// <summary>Type label shown on the card (e.g. "Pet").</summary>
    public string? Kind { get; set; }

    public string? ImageKey { get; set; }

    /// <summary>Template the sheet was created from; null = free sheet. Kept null if the template is deleted.</summary>
    public Guid? TemplateId { get; set; }

    public Guid? FolderId { get; set; }

    /// <summary>The sheet's own fields (definition + value), copied from the template and possibly extended.</summary>
    public List<SheetEntryField> Fields { get; set; } = [];

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class SheetEntryField
{
    public required string Key { get; set; }
    public required string Label { get; set; }
    public SheetFieldType Type { get; set; } = SheetFieldType.Text;
    public bool Required { get; set; }

    /// <summary>True when the field comes from the template (cannot be removed or renamed).</summary>
    public bool FromTemplate { get; set; }

    public string? Value { get; set; }
}
