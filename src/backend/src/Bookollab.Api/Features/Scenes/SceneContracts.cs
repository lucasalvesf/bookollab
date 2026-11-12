using Bookollab.Api.Domain.Scenes;

namespace Bookollab.Api.Features.Scenes;

public sealed record CreateSceneRequest(
    string Title, string? Description,
    SceneParticipation Participation = SceneParticipation.Public,
    SceneWritingMode WritingMode = SceneWritingMode.Free,
    int? TurnTimeLimitMinutes = null,
    SceneKind Kind = SceneKind.Scene,
    string? CoverKey = null);

public sealed record JoinSceneRequest(Guid CharacterId);

/// <summary>Text, an image (AttachmentKey from POST /uploads), or both.</summary>
/// <summary>CharacterId is required in scenes and ignored in OffGame chats (the author speaks as themselves).</summary>
public sealed record SendActionRequest(Guid? CharacterId, string? Content, string? AttachmentKey = null);

public sealed record UpdateSceneCoverRequest(string? CoverKey);

public sealed record EditActionRequest(string Content);

/// <summary>"preset:&lt;name&gt;", "image:&lt;upload key&gt;" or null for the default background.</summary>
public sealed record UpdateSceneBackgroundRequest(string? Background);

/// <summary>Chat settings of a scene (opener or staff).</summary>
public sealed record UpdateSceneSettingsRequest(
    SceneWritingMode WritingMode, int? TurnTimeLimitMinutes, SceneParticipation Participation, SceneArchiveVisibility ArchiveVisibility);

public sealed record TurnOrderRequest(List<Guid> CharacterIds);

public sealed record InviteCharacterRequest(Guid CharacterId);

public sealed record SceneSummary(
    Guid Id, string Title, string? Description, SceneStatus Status, SceneWritingMode WritingMode, SceneParticipation Participation,
    string OpenedByUserName, int ParticipantCount, DateTimeOffset CreatedAt, DateTimeOffset? LastActionAt,
    SceneKind Kind = SceneKind.Scene, string? CoverKey = null, string? Background = null);

public sealed record SceneParticipantDto(Guid CharacterId, string CharacterName, string? CharacterAvatarKey, Guid OwnerUserId, string OwnerUserName);

public sealed record SceneDetail(
    Guid Id, Guid CommunityId, string CommunitySlug, string CommunityName, string Title, string? Description,
    SceneStatus Status, SceneWritingMode WritingMode, Guid OpenedByUserId, DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt,
    string? Background, IReadOnlyList<SceneParticipantDto> Participants,
    bool CanJoin, bool CanClose, bool CanModerate, bool CanViewRevisions, bool CanEditBackground,
    SceneParticipation Participation, SceneArchiveVisibility ArchiveVisibility,
    int? TurnTimeLimitMinutes, Guid? CurrentTurnCharacterId, DateTimeOffset? TurnDeadline,
    bool CanManage, bool CanSkipTurn,
    IReadOnlyList<Guid> InvitedCharacterIds, IReadOnlyList<Guid> MyPendingCharacterIds, int PendingRequestCount,
    SceneKind Kind = SceneKind.Scene, string? CoverKey = null, bool CanSend = false);

public sealed record SceneJoinRequestDto(Guid Id, Guid CharacterId, string CharacterName, string? CharacterAvatarKey, string UserName, DateTimeOffset CreatedAt);

public sealed record SceneActionDto(
    Guid Id, Guid SceneId, Guid? CharacterId, string CharacterName, string? CharacterAvatarKey, Guid AuthorUserId,
    string? Content, string? AttachmentKey, DateTimeOffset CreatedAt, DateTimeOffset? EditedAt, bool Deleted,
    Domain.Mechanics.DiceRoll? Roll = null);

public sealed record RevisionDto(string Content, DateTimeOffset CreatedAt);

public sealed record PresenceDto(Guid UserId, string UserName);

public sealed record TypingDto(Guid SceneId, Guid UserId, string CharacterName);
