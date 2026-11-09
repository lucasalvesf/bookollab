using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Encyclopedia;
using Bookollab.Api.Features.Communities;

namespace Bookollab.Api.Features.Encyclopedia;

public sealed record EncyclopediaSettingsDto(bool FreeSheetsEnabled, TemplateMode TemplateMode);

public sealed record TemplateDto(Guid Id, string Name, string? Description, string? Kind, IReadOnlyList<SheetFieldDto> Fields);

public sealed record SaveTemplateRequest(string Name, string? Description, string? Kind, List<SheetFieldDto>? Fields);

public sealed record FolderDto(Guid Id, string Name, int Position, int ItemCount);

public sealed record SaveFolderRequest(string Name, int? Position);

public enum EncyclopediaItemType
{
    Character,
    Sheet,
}

/// <summary>One card of the encyclopedia: a playable character or another sheet.</summary>
public sealed record EncyclopediaItemDto(
    Guid Id, EncyclopediaItemType ItemType, string Name, string Kind, string? ImageKey,
    Guid OwnerUserId, string OwnerUserName, Guid? FolderId);

public sealed record EncyclopediaDto(
    EncyclopediaSettingsDto Settings, IReadOnlyList<FolderDto> Folders, IReadOnlyList<TemplateDto> Templates,
    IReadOnlyList<EncyclopediaItemDto> Items, bool CanManage, bool CanCreate);

public sealed record SheetFieldInput(string Key, string? Label, SheetFieldType? Type, string? Value);

public sealed record CreateSheetRequest(string Name, string? Kind, string? ImageKey, Guid? TemplateId, List<SheetFieldInput>? Fields);

public sealed record UpdateSheetRequest(string Name, string? Kind, string? ImageKey, List<SheetFieldInput>? Fields);

public sealed record MoveToFolderRequest(Guid? FolderId);

public sealed record SheetFieldValueDto(string Key, string Label, SheetFieldType Type, bool Required, bool FromTemplate, string? Value);

public sealed record SheetDto(
    Guid Id, string CommunitySlug, string CommunityName, Guid OwnerUserId, string OwnerUserName,
    string Name, string? Kind, string? ImageKey, Guid? TemplateId, string? TemplateName, Guid? FolderId,
    IReadOnlyList<SheetFieldValueDto> Fields, DateTimeOffset CreatedAt, DateTimeOffset? UpdatedAt,
    bool CanEdit, bool CanManage, bool CanAddFields);
