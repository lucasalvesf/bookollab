using System.Security.Claims;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Links;

/// <summary>
/// Something inside a community that can be linked or mentioned with "@" (posts, side menu).
/// <see cref="Target"/> is the stable "kind:id" written in texts as <c>@[Label](kind:id)</c>.
/// </summary>
public sealed record LinkableDto(string Kind, string Target, string Label, string? Subtitle, string? ImageKey, string? Tag);

/// <summary>Format of link targets: "kind:id".</summary>
public static class LinkTargets
{
    public static readonly string[] GuidKinds = ["character", "sheet", "chat", "post"];

    public static bool IsValid(string? target)
    {
        if (string.IsNullOrWhiteSpace(target) || target.Length > 200) return false;
        var i = target.IndexOf(':');
        if (i <= 0) return false;
        var (kind, id) = (target[..i], target[(i + 1)..]);
        return kind switch
        {
            _ when GuidKinds.Contains(kind) => Guid.TryParse(id, out _),
            "member" => id.Length is > 0 and <= 64,
            "section" => CommunitySections.Default.Contains(id),
            "url" => Uri.TryCreate(id, UriKind.Absolute, out var uri) && (uri.Scheme == "https" || uri.Scheme == "http"),
            _ => false,
        };
    }
}

public static class LinkEndpoints
{
    public static void MapLinkEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/communities/{slug}/linkables", Search).WithTags("Communities").RequireAuthorization()
            .WithName("SearchLinkables").Produces<List<LinkableDto>>();
    }

    /// <summary>Searches everything linkable by name (empty term = most recent of each kind), grouped by kind.</summary>
    private static async Task<IResult> Search(string slug, string? q, int? limit, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        var take = Math.Clamp(limit ?? 5, 1, 20);
        var term = (q ?? "").Trim();
        var escaped = term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        var like = $"%{escaped}%";
        var prefix = $"{escaped}%"; // names starting with the term come first
        var any = term.Length == 0;

        var characters = await db.Characters
            .Where(c => c.CommunityId == communityId && c.Status == CharacterStatus.Active && (any || EF.Functions.ILike(c.Name, like)))
            .OrderByDescending(c => !any && EF.Functions.ILike(c.Name, prefix)).ThenByDescending(c => c.LastActivityAt).Take(take)
            .Select(c => new LinkableDto("character", "character:" + c.Id, c.Name, "Personagem", c.AvatarKey, null))
            .ToListAsync(ct);
        var sheets = await db.EncyclopediaSheets
            .Where(s => s.CommunityId == communityId && (any || EF.Functions.ILike(s.Name, like)))
            .OrderByDescending(s => !any && EF.Functions.ILike(s.Name, prefix)).ThenByDescending(s => s.UpdatedAt ?? s.CreatedAt).Take(take)
            .Select(s => new LinkableDto("sheet", "sheet:" + s.Id, s.Name, s.Kind ?? "Ficha", s.ImageKey, null))
            .ToListAsync(ct);
        var chats = await db.Scenes
            .Where(s => s.CommunityId == communityId && (s.Status == SceneStatus.Open || s.ArchiveVisibility == SceneArchiveVisibility.Community)
                && (any || EF.Functions.ILike(s.Title, like)))
            .OrderByDescending(s => !any && EF.Functions.ILike(s.Title, prefix)).ThenBy(s => s.Status).ThenByDescending(s => s.CreatedAt).Take(take)
            .Select(s => new LinkableDto("chat", "chat:" + s.Id, s.Title, s.Kind == SceneKind.Chat ? "Chat público" : "Chat de cena", s.CoverKey, s.Kind == SceneKind.Chat ? "Off" : "On"))
            .ToListAsync(ct);
        var posts = await db.Chapters
            .Where(c => c.CommunityId == communityId && c.Status == ChapterStatus.Published && c.DeletedAt == null && (any || EF.Functions.ILike(c.Title, like)))
            .OrderByDescending(c => !any && EF.Functions.ILike(c.Title, prefix)).ThenByDescending(c => c.PublishedAt).Take(take)
            .Select(c => new LinkableDto("post", "post:" + c.Id, c.Title, c.Kind == PostKind.Blog ? "Blog" : "Capítulo", c.CoverKey, null))
            .ToListAsync(ct);
        var members = await db.Memberships
            .Where(m => m.CommunityId == communityId && (any || EF.Functions.ILike(m.Nickname ?? m.User.DisplayName, like) || EF.Functions.ILike(m.User.UserName!, like)))
            .OrderByDescending(m => !any && EF.Functions.ILike(m.Nickname ?? m.User.DisplayName, prefix)).ThenBy(m => m.Nickname ?? m.User.DisplayName).Take(take)
            .Select(m => new LinkableDto("member", "member:" + m.User.UserName, m.Nickname ?? m.User.DisplayName, "@" + m.User.UserName, m.AvatarKey ?? m.User.AvatarKey, null))
            .ToListAsync(ct);

        return TypedResults.Ok(characters.Concat(sheets).Concat(chats).Concat(posts).Concat(members).ToList());
    }
}
