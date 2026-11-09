using System.Security.Claims;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Profile;

public sealed record ShowcaseCharacterDto(Guid Id, string Name, string? AvatarKey, string? CommunitySlug, string? CommunityName);

public sealed record GlobalProfileDto(
    Guid UserId, string UserName, string DisplayName, string? Bio, string? AvatarKey, DateTimeOffset CreatedAt,
    IReadOnlyList<ShowcaseCharacterDto> Showcase, bool IsMe);

public sealed record ProfileCharacterDto(Guid Id, string Name, string? AvatarKey);

public sealed record ProfileSheetDto(Guid Id, string Name, string? Kind, string? ImageKey);

public sealed record ProfileChapterDto(Guid Id, string Title, string CharacterName, DateTimeOffset? PublishedAt);

public sealed record ProfileSceneDto(Guid Id, string Title, string Status, DateTimeOffset CreatedAt);

/// <summary>Effective community profile: community fields, falling back to the global profile.</summary>
public sealed record CommunityProfileDto(
    Guid UserId, string UserName, string CommunitySlug, string CommunityName,
    string Nickname, string? Bio, string? AvatarKey, string? CoverKey,
    string RoleName, Domain.Communities.BaseRoleKind BaseKind, DateTimeOffset JoinedAt,
    IReadOnlyList<ProfileCharacterDto> Characters, IReadOnlyList<ProfileSheetDto> Sheets, IReadOnlyList<ProfileChapterDto> Chapters, IReadOnlyList<ProfileSceneDto> Scenes,
    int? Level, string? Title,
    bool IsMe,
    // Raw community values (null = inherited), for the edit form.
    string? OwnNickname, string? OwnBio, string? OwnAvatarKey);

public sealed record UpdateCommunityProfileRequest(string? Nickname, string? Bio, string? AvatarKey, string? CoverKey);

public static class PublicProfileEndpoints
{
    public static void MapPublicProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/users/{userName}", GetGlobal).WithTags("Profile").WithName("GetGlobalProfile")
            .RequireAuthorization().Produces<GlobalProfileDto>();
        app.MapGet("/communities/{slug}/members/{userName}", GetCommunity).WithTags("Profile").WithName("GetCommunityProfile")
            .RequireAuthorization().Produces<CommunityProfileDto>();
        app.MapPut("/communities/{slug}/me/profile", UpdateCommunity).WithTags("Profile").WithName("UpdateMyCommunityProfile")
            .RequireAuthorization().Produces<CommunityProfileDto>();
    }

    /// <summary>Global profile with the showcase: only characters the owner chose to show.</summary>
    private static async Task<IResult> GetGlobal(string userName, ClaimsPrincipal viewer, AppDbContext db, CancellationToken ct)
    {
        var normalized = userName.Trim().ToUpperInvariant();
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.NormalizedUserName == normalized, ct);
        if (user is null) return Problems.NotFound("Usuário não encontrado.");

        var showcase = await db.Characters
            .Where(c => c.OwnerUserId == user.Id && c.ShowOnGlobalProfile && c.Status == CharacterStatus.Active)
            .OrderBy(c => c.Name)
            .Join(db.Communities, c => c.CommunityId, co => co.Id, (c, co) => new { c, co.Slug, co.Name })
            .ToListAsync(ct);

        return TypedResults.Ok(new GlobalProfileDto(
            user.Id, user.UserName!, user.DisplayName, user.Bio, user.AvatarKey, user.CreatedAt,
            showcase.Select(x => new ShowcaseCharacterDto(
                x.c.Id, x.c.Name, x.c.AvatarKey,
                x.c.ShowCommunityOnProfile ? x.Slug : null,
                x.c.ShowCommunityOnProfile ? x.Name : null)).ToList(),
            user.Id == viewer.UserId()));
    }

    /// <summary>A member's profile inside a community. Only members of that community can see it.</summary>
    private static async Task<IResult> GetCommunity(string slug, string userName, ClaimsPrincipal viewer, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, viewer, perms, ct);
        if (error is not null) return error;
        var normalized = userName.Trim().ToUpperInvariant();
        var member = await db.Memberships.Include(m => m.User).Include(m => m.Role)
            .SingleOrDefaultAsync(m => m.CommunityId == access!.Community.Id && m.User.NormalizedUserName == normalized, ct);
        if (member is null) return Problems.NotFound("Este usuário não é membro da comunidade.");
        return TypedResults.Ok(await BuildAsync(db, member, access!.Community, viewer.UserId(), ct));
    }

    private static async Task<IResult> UpdateCommunity(string slug, UpdateCommunityProfileRequest req, ClaimsPrincipal viewer, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, viewer, perms, ct);
        if (error is not null) return error;
        var userId = viewer.UserId();

        var nickname = string.IsNullOrWhiteSpace(req.Nickname) ? null : req.Nickname.Trim();
        if (nickname?.Length > 64) return Problems.Validation("nickname", "O apelido pode ter até 64 caracteres.");
        if (req.Bio?.Length > 1000) return Problems.Validation("bio", "A bio pode ter até 1.000 caracteres.");

        var member = await db.Memberships.Include(m => m.User).Include(m => m.Role)
            .SingleAsync(m => m.CommunityId == access!.Community.Id && m.UserId == userId, ct);
        foreach (var (field, key, current) in new[] { ("avatarKey", req.AvatarKey, member.AvatarKey), ("coverKey", req.CoverKey, member.CoverKey) })
        {
            if (!string.IsNullOrWhiteSpace(key) && key != current && !await UploadEndpoints.OwnsAsync(db, key, userId, ct))
                return Problems.Validation(field, "Imagem inválida. Envie novamente.");
        }

        member.Nickname = nickname;
        member.Bio = string.IsNullOrWhiteSpace(req.Bio) ? null : req.Bio.Trim();
        member.AvatarKey = string.IsNullOrWhiteSpace(req.AvatarKey) ? null : req.AvatarKey;
        member.CoverKey = string.IsNullOrWhiteSpace(req.CoverKey) ? null : req.CoverKey;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await BuildAsync(db, member, access!.Community, userId, ct));
    }

    private static async Task<CommunityProfileDto> BuildAsync(AppDbContext db, Domain.Communities.Membership m, Domain.Communities.Community community, Guid viewerId, CancellationToken ct)
    {
        var characters = await db.Characters
            .Where(c => c.CommunityId == community.Id && c.OwnerUserId == m.UserId && c.Status == CharacterStatus.Active)
            .OrderBy(c => c.Name)
            .Select(c => new ProfileCharacterDto(c.Id, c.Name, c.AvatarKey))
            .ToListAsync(ct);

        var sheets = await db.EncyclopediaSheets
            .Where(s => s.CommunityId == community.Id && s.OwnerUserId == m.UserId)
            .OrderBy(s => s.Name)
            .Select(s => new ProfileSheetDto(s.Id, s.Name, s.Kind, s.ImageKey))
            .ToListAsync(ct);

        var chapters = await db.Chapters
            .Where(c => c.CommunityId == community.Id && c.AuthorUserId == m.UserId && c.Status == ChapterStatus.Published && c.DeletedAt == null)
            .OrderByDescending(c => c.PublishedAt).Take(20)
            .Join(db.Characters, c => c.CharacterId, ch => ch.Id, (c, ch) => new ProfileChapterDto(c.Id, c.Title, ch.Name, c.PublishedAt))
            .ToListAsync(ct);

        var characterIds = characters.Select(c => c.Id).ToList();
        var scenes = await db.Scenes
            .Where(s => s.CommunityId == community.Id && s.Participants.Any(p => characterIds.Contains(p.CharacterId)))
            .OrderByDescending(s => s.CreatedAt).Take(20)
            .Select(s => new ProfileSceneDto(s.Id, s.Title, s.Status.ToString(), s.CreatedAt))
            .ToListAsync(ct);

        return new CommunityProfileDto(
            m.UserId, m.User.UserName!, community.Slug, community.Name,
            Nickname: m.Nickname ?? m.User.DisplayName,
            Bio: m.Bio ?? m.User.Bio,
            AvatarKey: m.AvatarKey ?? m.User.AvatarKey,
            CoverKey: m.CoverKey,
            m.Role.Name, m.Role.BaseKind, m.JoinedAt,
            characters, sheets, chapters, scenes,
            Level: null, Title: null, // points/levels arrive in Milestone 4
            IsMe: m.UserId == viewerId,
            OwnNickname: m.Nickname, OwnBio: m.Bio, OwnAvatarKey: m.AvatarKey);
    }
}
