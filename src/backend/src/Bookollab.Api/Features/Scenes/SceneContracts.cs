using Bookollab.Api.Domain.Scenes;

namespace Bookollab.Api.Features.Scenes;

public sealed record CreateSceneRequest(string Title, string? Description);

public sealed record JoinSceneRequest(Guid CharacterId);

public sealed record SendActionRequest(Guid CharacterId, string Content);

public sealed record EditActionRequest(string Content);

public sealed record SceneSummary(
    Guid Id, string Title, string? Description, SceneStatus Status, SceneWritingMode WritingMode,
    string OpenedByUserName, int ParticipantCount, DateTimeOffset CreatedAt, DateTimeOffset? LastActionAt);

public sealed record SceneParticipantDto(Guid CharacterId, string CharacterName, Guid OwnerUserId, string OwnerUserName);

public sealed record SceneDetail(
    Guid Id, Guid CommunityId, string CommunitySlug, string CommunityName, string Title, string? Description,
    SceneStatus Status, SceneWritingMode WritingMode, Guid OpenedByUserId, DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt,
    IReadOnlyList<SceneParticipantDto> Participants, bool CanJoin, bool CanClose, bool CanModerate, bool CanViewRevisions);

public sealed record SceneActionDto(
    Guid Id, Guid SceneId, Guid CharacterId, string CharacterName, Guid AuthorUserId, string? Content,
    DateTimeOffset CreatedAt, DateTimeOffset? EditedAt, bool Deleted);

public sealed record RevisionDto(string Content, DateTimeOffset CreatedAt);

public sealed record PresenceDto(Guid UserId, string UserName);

public sealed record TypingDto(Guid SceneId, Guid UserId, string CharacterName);
