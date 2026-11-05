using Bookollab.Api.Domain.Scenes;

namespace Bookollab.Api.Features.Scenes;

public sealed record CreateSceneRequest(string Title, string? Description);

public sealed record JoinSceneRequest(Guid CharacterId);

/// <summary>Text, an image (AttachmentKey from POST /uploads), or both.</summary>
public sealed record SendActionRequest(Guid CharacterId, string? Content, string? AttachmentKey = null);

public sealed record EditActionRequest(string Content);

/// <summary>"preset:&lt;name&gt;", "image:&lt;upload key&gt;" or null for the default background.</summary>
public sealed record UpdateSceneBackgroundRequest(string? Background);

public sealed record SceneSummary(
    Guid Id, string Title, string? Description, SceneStatus Status, SceneWritingMode WritingMode,
    string OpenedByUserName, int ParticipantCount, DateTimeOffset CreatedAt, DateTimeOffset? LastActionAt);

public sealed record SceneParticipantDto(Guid CharacterId, string CharacterName, string? CharacterAvatarKey, Guid OwnerUserId, string OwnerUserName);

public sealed record SceneDetail(
    Guid Id, Guid CommunityId, string CommunitySlug, string CommunityName, string Title, string? Description,
    SceneStatus Status, SceneWritingMode WritingMode, Guid OpenedByUserId, DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt,
    string? Background, IReadOnlyList<SceneParticipantDto> Participants,
    bool CanJoin, bool CanClose, bool CanModerate, bool CanViewRevisions, bool CanEditBackground);

public sealed record SceneActionDto(
    Guid Id, Guid SceneId, Guid CharacterId, string CharacterName, string? CharacterAvatarKey, Guid AuthorUserId,
    string? Content, string? AttachmentKey, DateTimeOffset CreatedAt, DateTimeOffset? EditedAt, bool Deleted);

public sealed record RevisionDto(string Content, DateTimeOffset CreatedAt);

public sealed record PresenceDto(Guid UserId, string UserName);

public sealed record TypingDto(Guid SceneId, Guid UserId, string CharacterName);
