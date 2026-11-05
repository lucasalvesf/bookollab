using Bookollab.Api.Domain.Communities;

namespace Bookollab.Api.Features.Communities;

public sealed record CreateCommunityRequest(string Name, string? Slug, string? Description, JoinPolicy JoinPolicy);

public sealed record CommunitySummary(Guid Id, string Slug, string Name, string? Description, JoinPolicy JoinPolicy, int MemberCount);

public sealed record MyAccess(string RoleName, BaseRoleKind BaseKind, IReadOnlyList<string> Permissions);

public sealed record CommunityDetail(
    Guid Id, string Slug, string Name, string? Description, JoinPolicy JoinPolicy, ContentRating ContentRating,
    int MemberCount, IReadOnlyList<SheetFieldDto> SheetFields, MyAccess? Me, bool HasPendingRequest);

public sealed record SheetFieldDto(string Key, string Label, SheetFieldType Type, bool Required);

public sealed record JoinResponse(string Status);

public sealed record MemberDto(Guid UserId, string UserName, string DisplayName, string RoleName, BaseRoleKind BaseKind, DateTimeOffset JoinedAt);

public sealed record JoinRequestDto(Guid Id, Guid UserId, string UserName, string DisplayName, DateTimeOffset CreatedAt);

public sealed record CreateInviteRequest(int? ExpiresInDays, int? MaxUses);

public sealed record InviteDto(string Code, DateTimeOffset? ExpiresAt, int? MaxUses, int Uses);

public sealed record InvitePreview(string Code, string CommunitySlug, string CommunityName, string? CommunityDescription, bool Usable, bool AlreadyMember);
