using System.Security.Claims;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Featured;

/// <summary>A featured item, resolved for display (title, image, who wrote it).</summary>
public sealed record FeaturedDto(
    Guid Id, FeaturedItemType ItemType, Guid ItemId, int Position,
    string Title, string? Subtitle, string? Excerpt, string? ImageKey, PostKind? PostKind);

public sealed record FeatureRequest(FeaturedItemType ItemType, Guid ItemId);

public sealed record FeaturedOrderRequest(List<Guid> Ids);

public sealed record FeedLayoutRequest(FeedLayout Layout);

/// <summary>
/// Amino-like highlights: the moderation features chapters, blogs and sheets; they show bigger on the
/// community home. The owner chooses the layout of the posts there.
/// </summary>
public static class FeaturedEndpoints
{
    public const int MaxFeatured = 12;

    public static void MapFeaturedEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/communities/{slug}").WithTags("Featured").RequireAuthorization();
        g.MapGet("/featured", List).WithName("ListFeatured").Produces<List<FeaturedDto>>();
        g.MapPost("/featured", Feature).WithName("FeatureItem").Produces<List<FeaturedDto>>();
        g.MapDelete("/featured/{id:guid}", Unfeature).WithName("UnfeatureItem").Produces<List<FeaturedDto>>();
        g.MapPut("/featured/order", Reorder).WithName("ReorderFeatured").Produces<List<FeaturedDto>>();
        g.MapPut("/feed-layout", UpdateLayout).WithName("UpdateFeedLayout").Produces(StatusCodes.Status204NoContent);
    }

    private static async Task<IResult> List(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        return error ?? TypedResults.Ok(await ResolveAsync(db, access!.Community.Id, ct));
    }

    private static async Task<IResult> Feature(string slug, FeatureRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ModerateContent, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        var exists = req.ItemType switch
        {
            FeaturedItemType.Post => await db.Chapters.AnyAsync(c => c.Id == req.ItemId && c.CommunityId == communityId && c.Status == ChapterStatus.Published && c.DeletedAt == null, ct),
            FeaturedItemType.Sheet => await db.EncyclopediaSheets.AnyAsync(s => s.Id == req.ItemId && s.CommunityId == communityId, ct),
            _ => await db.Characters.AnyAsync(c => c.Id == req.ItemId && c.CommunityId == communityId, ct),
        };
        if (!exists) return Problems.Validation("itemId", "Só é possível destacar conteúdo publicado desta comunidade.");
        if (await db.FeaturedItems.AnyAsync(f => f.CommunityId == communityId && f.ItemType == req.ItemType && f.ItemId == req.ItemId, ct))
            return TypedResults.Ok(await ResolveAsync(db, communityId, ct));
        var count = await db.FeaturedItems.CountAsync(f => f.CommunityId == communityId, ct);
        if (count >= MaxFeatured) return Problems.Conflict($"A comunidade pode ter até {MaxFeatured} destaques. Tire um antes.", "too_many_featured");

        // New highlights go first: the latest thing the moderation chose is the most visible.
        await db.FeaturedItems.Where(f => f.CommunityId == communityId).ExecuteUpdateAsync(s => s.SetProperty(f => f.Position, f => f.Position + 1), ct);
        db.FeaturedItems.Add(new FeaturedItem { CommunityId = communityId, ItemType = req.ItemType, ItemId = req.ItemId, Position = 0, FeaturedByUserId = user.UserId() });
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ResolveAsync(db, communityId, ct));
    }

    private static async Task<IResult> Unfeature(string slug, Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ModerateContent, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        await db.FeaturedItems.Where(f => f.Id == id && f.CommunityId == communityId).ExecuteDeleteAsync(ct);
        return TypedResults.Ok(await ResolveAsync(db, communityId, ct));
    }

    private static async Task<IResult> Reorder(string slug, FeaturedOrderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ModerateContent, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        var items = await db.FeaturedItems.Where(f => f.CommunityId == communityId).ToListAsync(ct);
        foreach (var item in items)
        {
            var index = req.Ids.IndexOf(item.Id);
            item.Position = index < 0 ? req.Ids.Count + item.Position : index;
        }
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ResolveAsync(db, communityId, ct));
    }

    private static async Task<IResult> UpdateLayout(string slug, FeedLayoutRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        access!.Community.FeedLayout = req.Layout;
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    /// <summary>Featured items in order, skipping anything deleted or unpublished since.</summary>
    public static async Task<List<FeaturedDto>> ResolveAsync(AppDbContext db, Guid communityId, CancellationToken ct)
    {
        var items = await db.FeaturedItems.Where(f => f.CommunityId == communityId).OrderBy(f => f.Position).ThenByDescending(f => f.CreatedAt).ToListAsync(ct);
        var postIds = items.Where(i => i.ItemType == FeaturedItemType.Post).Select(i => i.ItemId).ToList();
        var sheetIds = items.Where(i => i.ItemType == FeaturedItemType.Sheet).Select(i => i.ItemId).ToList();
        var characterIds = items.Where(i => i.ItemType == FeaturedItemType.Character).Select(i => i.ItemId).ToList();

        var posts = await db.Chapters.Where(c => postIds.Contains(c.Id) && c.Status == ChapterStatus.Published && c.DeletedAt == null)
            .Select(c => new
            {
                c.Id, c.Title, c.Kind, c.CoverKey,
                Start = c.Content.Substring(0, Math.Min(c.Content.Length, 300)),
                By = db.Characters.Where(ch => ch.Id == c.CharacterId).Select(ch => ch.Name).FirstOrDefault()
                    ?? db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.DisplayName).First(),
            }).ToDictionaryAsync(x => x.Id, ct);
        var sheets = await db.EncyclopediaSheets.Where(s => sheetIds.Contains(s.Id)).Select(s => new { s.Id, s.Name, s.Kind, s.ImageKey }).ToDictionaryAsync(x => x.Id, ct);
        var characters = await db.Characters.Where(c => characterIds.Contains(c.Id)).Select(c => new { c.Id, c.Name, c.AvatarKey }).ToDictionaryAsync(x => x.Id, ct);

        var result = new List<FeaturedDto>();
        foreach (var i in items)
        {
            switch (i.ItemType)
            {
                case FeaturedItemType.Post when posts.TryGetValue(i.ItemId, out var p):
                    result.Add(new FeaturedDto(i.Id, i.ItemType, i.ItemId, i.Position, p.Title, p.By, Excerpt(p.Start), p.CoverKey, p.Kind));
                    break;
                case FeaturedItemType.Sheet when sheets.TryGetValue(i.ItemId, out var s):
                    result.Add(new FeaturedDto(i.Id, i.ItemType, i.ItemId, i.Position, s.Name, s.Kind ?? "Ficha", null, s.ImageKey, null));
                    break;
                case FeaturedItemType.Character when characters.TryGetValue(i.ItemId, out var c):
                    result.Add(new FeaturedDto(i.Id, i.ItemType, i.ItemId, i.Position, c.Name, "Personagem", null, c.AvatarKey, null));
                    break;
            }
        }
        return result;
    }

    private static string Excerpt(string start)
    {
        start = System.Text.RegularExpressions.Regex.Replace(start, @"!\[[^\]]*\]\([^)]*\)", " ");
        var flat = string.Join(' ', start.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= 200 ? flat : flat[..200].TrimEnd() + "…";
    }
}
