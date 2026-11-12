using System.Security.Claims;
using System.Text.RegularExpressions;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Links;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.CommunityHome;

/// <summary>Community color and home arrangement (ManageCommunity).</summary>
public sealed record UpdateCommunityThemeRequest(string? AccentColor, HomeLayout HomeLayout);

public sealed record CommunityThemeDto(string? AccentColor, HomeLayout HomeLayout);

public sealed record SideMenuLinkDto(string Label, string Target);

public sealed record SideMenuGroupDto(string Title, IReadOnlyList<SideMenuLinkDto> Links);

/// <summary>Side menu (Amino-like): order and names of the main sections, plus groups of links.</summary>
public sealed record SideMenuDto(IReadOnlyList<string> Sections, IReadOnlyDictionary<string, string> SectionTitles, IReadOnlyList<SideMenuGroupDto> Groups);

public sealed record PinnedPostDto(Guid ChapterId, string Title, PostKind Kind);

public sealed record PinPostRequest(Guid ChapterId);

public sealed record ReorderPinsRequest(List<Guid> ChapterIds);

/// <summary>Community identity and navigation set by the moderation: color, home layout, pinned posts, side menu.</summary>
public static partial class CommunityHomeEndpoints
{
    public const int MaxPins = 5;
    public const int MaxGroups = 12;
    public const int MaxLinksPerGroup = 20;

    public static void MapCommunityHomeEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/communities/{slug}").WithTags("Communities").RequireAuthorization();
        g.MapPut("/theme", UpdateTheme).WithName("UpdateCommunityTheme").Produces<CommunityThemeDto>();
        g.MapGet("/side-menu", GetSideMenu).WithName("GetCommunitySideMenu").Produces<SideMenuDto>();
        g.MapPut("/side-menu", UpdateSideMenu).WithName("UpdateCommunitySideMenu").Produces<SideMenuDto>();
        g.MapGet("/pins", ListPins).WithName("ListPinnedPosts").Produces<List<PinnedPostDto>>();
        g.MapPost("/pins", Pin).WithName("PinPost").Produces<List<PinnedPostDto>>();
        g.MapPut("/pins/order", ReorderPins).WithName("ReorderPinnedPosts").Produces<List<PinnedPostDto>>();
        g.MapDelete("/pins/{chapterId:guid}", Unpin).WithName("UnpinPost").Produces<List<PinnedPostDto>>();
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexColor();

    private static async Task<IResult> UpdateTheme(string slug, UpdateCommunityThemeRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        var color = string.IsNullOrWhiteSpace(req.AccentColor) ? null : req.AccentColor.Trim().ToUpperInvariant();
        if (color is not null && !HexColor().IsMatch(color)) return Problems.Validation("accentColor", "Use uma cor no formato #RRGGBB.");
        access!.Community.AccentColor = color;
        access.Community.HomeLayout = req.HomeLayout;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new CommunityThemeDto(color, req.HomeLayout));
    }

    // ------------------------------------------------------------------ side menu

    private static async Task<IResult> GetSideMenu(string slug, ClaimsPrincipal user, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        return TypedResults.Ok(ToDto(access!.Community));
    }

    private static async Task<IResult> UpdateSideMenu(string slug, SideMenuDto req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ArrangeSections, user, perms, ct);
        if (error is not null) return error;
        if (req.Sections.Any(s => !CommunitySections.Default.Contains(s))) return Problems.Validation("sections", "Seção desconhecida.");
        var titles = new Dictionary<string, string>();
        foreach (var (key, title) in req.SectionTitles)
        {
            if (!CommunitySections.Default.Contains(key)) return Problems.Validation("sectionTitles", "Seção desconhecida.");
            var t = title?.Trim() ?? "";
            if (t.Length > 40) return Problems.Validation("sectionTitles", "O nome da seção pode ter até 40 caracteres.");
            if (t.Length > 0) titles[key] = t;
        }
        if (req.Groups.Count > MaxGroups) return Problems.Validation("groups", $"Crie até {MaxGroups} grupos.");
        var groups = new List<SideMenuGroup>();
        foreach (var group in req.Groups)
        {
            var title = group.Title?.Trim() ?? "";
            if (title.Length is < 1 or > 40) return Problems.Validation("groups", "Todo grupo precisa de um nome com até 40 caracteres.");
            if (group.Links.Count > MaxLinksPerGroup) return Problems.Validation("groups", $"Cada grupo pode ter até {MaxLinksPerGroup} links.");
            var links = new List<SideMenuLink>();
            foreach (var link in group.Links)
            {
                var label = link.Label?.Trim() ?? "";
                if (label.Length is < 1 or > 60) return Problems.Validation("groups", "Todo link precisa de um nome com até 60 caracteres.");
                if (!LinkTargets.IsValid(link.Target)) return Problems.Validation("groups", $"Destino inválido: \"{link.Target}\".");
                links.Add(new SideMenuLink { Label = label, Target = link.Target });
            }
            groups.Add(new SideMenuGroup { Title = title, Links = links });
        }

        var community = access!.Community;
        community.Sections = CommunitySections.Normalize(req.Sections);
        community.SectionTitles = titles;
        community.SideMenu = groups;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDto(community));
    }

    public static SideMenuDto ToDto(Community c) => new(
        CommunitySections.Normalize(c.Sections),
        c.SectionTitles,
        c.SideMenu.Select(g => new SideMenuGroupDto(g.Title, g.Links.Select(l => new SideMenuLinkDto(l.Label, l.Target)).ToList())).ToList());

    // ------------------------------------------------------------------ pinned posts

    private static async Task<IResult> ListPins(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        return TypedResults.Ok(await PinsAsync(db, access!.Community.Id, ct));
    }

    private static async Task<IResult> Pin(string slug, PinPostRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.PinPosts, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        var exists = await db.Chapters.AnyAsync(c => c.Id == req.ChapterId && c.CommunityId == communityId && c.Status == ChapterStatus.Published && c.DeletedAt == null, ct);
        if (!exists) return Problems.Validation("chapterId", "Só posts publicados desta comunidade podem ser fixados.");
        var pins = await db.PinnedPosts.Where(p => p.CommunityId == communityId).ToListAsync(ct);
        if (pins.Any(p => p.ChapterId == req.ChapterId)) return TypedResults.Ok(await PinsAsync(db, communityId, ct));
        if (pins.Count >= MaxPins) return Problems.Validation("chapterId", $"Fixe até {MaxPins} posts. Desafixe um antes.");
        db.PinnedPosts.Add(new PinnedPost { CommunityId = communityId, ChapterId = req.ChapterId, PinnedByUserId = user.UserId(), Position = pins.Count == 0 ? 0 : pins.Max(p => p.Position) + 1 });
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await PinsAsync(db, communityId, ct));
    }

    private static async Task<IResult> ReorderPins(string slug, ReorderPinsRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.PinPosts, user, perms, ct);
        if (error is not null) return error;
        var pins = await db.PinnedPosts.Where(p => p.CommunityId == access!.Community.Id).ToListAsync(ct);
        if (!pins.Select(p => p.ChapterId).ToHashSet().SetEquals(req.ChapterIds) || req.ChapterIds.Count != pins.Count)
            return Problems.Validation("chapterIds", "Envie todos os posts fixados, cada um uma vez.");
        for (var i = 0; i < req.ChapterIds.Count; i++) pins.Single(p => p.ChapterId == req.ChapterIds[i]).Position = i;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await PinsAsync(db, access!.Community.Id, ct));
    }

    private static async Task<IResult> Unpin(string slug, Guid chapterId, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.PinPosts, user, perms, ct);
        if (error is not null) return error;
        await db.PinnedPosts.Where(p => p.CommunityId == access!.Community.Id && p.ChapterId == chapterId).ExecuteDeleteAsync(ct);
        return TypedResults.Ok(await PinsAsync(db, access!.Community.Id, ct));
    }

    private static Task<List<PinnedPostDto>> PinsAsync(AppDbContext db, Guid communityId, CancellationToken ct) =>
        db.PinnedPosts.Where(p => p.CommunityId == communityId)
            .Join(db.Chapters.Where(c => c.DeletedAt == null && c.Status == ChapterStatus.Published), p => p.ChapterId, c => c.Id, (p, c) => new { p.Position, c.Id, c.Title, c.Kind })
            .OrderBy(x => x.Position)
            .Select(x => new PinnedPostDto(x.Id, x.Title, x.Kind))
            .ToListAsync(ct);
}
