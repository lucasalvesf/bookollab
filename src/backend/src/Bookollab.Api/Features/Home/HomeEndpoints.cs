using System.Security.Claims;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Home;

/// <summary>A post (chapter or blog). For blogs, CharacterId is null and Character* are the author's.</summary>
public sealed record HomeChapterDto(
    Guid Id, string Title, string Excerpt, DateTimeOffset PublishedAt,
    Guid? CharacterId, string CharacterName, string? CharacterAvatarKey,
    string CommunitySlug, string CommunityName, string? CommunityIconKey,
    Domain.Chapters.PostKind Kind = Domain.Chapters.PostKind.Chapter, string? CoverKey = null, string? AuthorUserName = null);

public sealed record HomeSceneDto(
    Guid Id, string Title, int ParticipantCount, DateTimeOffset? LastActionAt,
    string CommunitySlug, string CommunityName, string? CommunityIconKey);

/// <summary>Encyclopedia entry thumbnail: a sheet or a character.</summary>
public sealed record HomeEntryDto(Guid Id, bool IsCharacter, string Name, string? Kind, string? ImageKey, string CommunitySlug, string CommunityName);

public sealed record HomeDto(IReadOnlyList<string> Sections, IReadOnlyList<HomeChapterDto> Chapters, IReadOnlyList<HomeSceneDto> Scenes, IReadOnlyList<HomeEntryDto> Entries);

public sealed record UpdateHomeSectionsRequest(List<string> Sections);

/// <summary>
/// The user's start screen: latest chapters, live scenes and encyclopedia highlights from their communities.
/// The user chooses which sections appear and in what order (stored on the account).
/// </summary>
public static class HomeEndpoints
{
    public static readonly string[] AllSections = ["chapters", "scenes", "encyclopedia", "communities"];

    public static void MapHomeEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me").WithTags("Home").RequireAuthorization();
        g.MapGet("/home", Get).WithName("GetHome").Produces<HomeDto>();
        g.MapPut("/home-sections", UpdateSections).WithName("UpdateHomeSections").Produces<IReadOnlyList<string>>();
    }

    /// <summary>Visible sections in order. An empty saved list means the default (all, in the standard order).</summary>
    public static List<string> Normalize(IEnumerable<string>? saved)
    {
        var list = (saved ?? []).Where(AllSections.Contains).Distinct().ToList();
        return list.Count == 0 ? [.. AllSections] : list;
    }

    private static async Task<IResult> Get(int? take, ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.UserId();
        var limit = Math.Clamp(take ?? 12, 1, 60);
        var me = await db.Users.Where(u => u.Id == userId).Select(u => new { u.HomeSections }).SingleAsync(ct);
        var communityIds = db.Memberships.Where(m => m.UserId == userId).Select(m => m.CommunityId);

        var chapters = await db.Chapters
            .Where(c => communityIds.Contains(c.CommunityId) && c.Status == ChapterStatus.Published && c.DeletedAt == null)
            .OrderByDescending(c => c.PublishedAt)
            .Take(limit)
            .Select(c => new
            {
                c.Id, c.Title, c.PublishedAt, c.CharacterId, c.Kind, c.CoverKey,
                AuthorUserName = db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.UserName!).Single(),
                Start = c.Content.Substring(0, Math.Min(c.Content.Length, 260)),
                Character = db.Characters.Where(ch => ch.Id == c.CharacterId).Select(ch => new { ch.Name, ch.AvatarKey }).SingleOrDefault()
                    ?? db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => new { Name = u.DisplayName, u.AvatarKey }).Single(),
                Community = db.Communities.Where(x => x.Id == c.CommunityId).Select(x => new { x.Slug, x.Name, x.IconKey }).Single(),
            })
            .ToListAsync(ct);

        var scenes = await db.Scenes
            .Where(s => communityIds.Contains(s.CommunityId) && s.Status == SceneStatus.Open)
            .Select(s => new
            {
                s.Id, s.Title, Count = s.Participants.Count,
                Last = db.SceneActions.Where(a => a.SceneId == s.Id).Max(a => (DateTimeOffset?)a.CreatedAt),
                s.CreatedAt,
                Community = db.Communities.Where(x => x.Id == s.CommunityId).Select(x => new { x.Slug, x.Name, x.IconKey }).Single(),
            })
            .OrderByDescending(s => s.Last ?? s.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var sheets = await db.EncyclopediaSheets
            .Where(s => communityIds.Contains(s.CommunityId))
            .OrderByDescending(s => s.CreatedAt)
            .Take(limit)
            .Select(s => new { s.Id, s.Name, s.Kind, s.ImageKey, s.CreatedAt, Community = db.Communities.Where(x => x.Id == s.CommunityId).Select(x => new { x.Slug, x.Name }).Single() })
            .ToListAsync(ct);
        var characters = await db.Characters
            .Where(c => communityIds.Contains(c.CommunityId) && c.Status == CharacterStatus.Active)
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .Select(c => new { c.Id, c.Name, c.AvatarKey, c.CreatedAt, Community = db.Communities.Where(x => x.Id == c.CommunityId).Select(x => new { x.Slug, x.Name }).Single() })
            .ToListAsync(ct);

        var entries = sheets.Select(s => (s.CreatedAt, Dto: new HomeEntryDto(s.Id, false, s.Name, s.Kind, s.ImageKey, s.Community.Slug, s.Community.Name)))
            .Concat(characters.Select(c => (c.CreatedAt, Dto: new HomeEntryDto(c.Id, true, c.Name, "Personagem", c.AvatarKey, c.Community.Slug, c.Community.Name))))
            .OrderByDescending(x => x.Dto.ImageKey is not null).ThenByDescending(x => x.CreatedAt)
            .Take(limit).Select(x => x.Dto).ToList();

        return TypedResults.Ok(new HomeDto(
            Normalize(me.HomeSections),
            chapters.Select(c => new HomeChapterDto(c.Id, c.Title, Excerpt(c.Start), c.PublishedAt!.Value, c.CharacterId, c.Character.Name, c.Character.AvatarKey, c.Community.Slug, c.Community.Name, c.Community.IconKey, c.Kind, c.CoverKey, c.AuthorUserName)).ToList(),
            scenes.Select(s => new HomeSceneDto(s.Id, s.Title, s.Count, s.Last, s.Community.Slug, s.Community.Name, s.Community.IconKey)).ToList(),
            entries));
    }

    private static async Task<IResult> UpdateSections(UpdateHomeSectionsRequest req, ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        if (req.Sections.Any(s => !AllSections.Contains(s))) return Problems.Validation("sections", "Seção desconhecida.");
        if (req.Sections.Count == 0) return Problems.Validation("sections", "Deixe pelo menos uma seção visível.");
        var userId = user.UserId();
        var me = await db.Users.SingleAsync(u => u.Id == userId, ct);
        me.HomeSections = req.Sections.Distinct().ToList();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(Normalize(me.HomeSections));
    }

    private static string Excerpt(string start)
    {
        start = System.Text.RegularExpressions.Regex.Replace(start, @"!\[[^\]]*\]\([^)]*\)", " ");
        start = System.Text.RegularExpressions.Regex.Replace(start, @"@\[([^\]\n]{1,80})\]\([a-z]+:[^)\s]+\)", "$1"); // "@[Ayla](character:…)" → "Ayla"
        var flat = string.Join(' ', start.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= 220 ? flat : flat[..220].TrimEnd() + "…";
    }
}
