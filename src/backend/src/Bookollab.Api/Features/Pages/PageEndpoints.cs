using System.Security.Claims;
using System.Text.RegularExpressions;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Encyclopedia;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Pages;

/// <summary>The "page" of a sheet or character: body text (like a post) and the reading background.</summary>
public sealed record PageDto(string? Content, string? BackgroundKey, string? BackgroundColor, int BackgroundBlur, bool CanEdit);

public sealed record SavePageRequest(string? Content, string? BackgroundKey, string? BackgroundColor, int BackgroundBlur);

/// <summary>One line of the community's "Acontecimentos": who did what, with a link to it.</summary>
public sealed record ActivityDto(string Kind, string ActorName, string? ActorUserName, string Verb, string TargetLabel, string? Target, DateTimeOffset At);

public static partial class PageEndpoints
{
    public const int MaxContent = 60_000;

    public static void MapPageEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/").WithTags("Pages").RequireAuthorization();
        g.MapGet("/sheets/{id:guid}/page", GetSheetPage).WithName("GetSheetPage").Produces<PageDto>();
        g.MapPut("/sheets/{id:guid}/page", SaveSheetPage).WithName("SaveSheetPage").Produces<PageDto>();
        g.MapGet("/characters/{id:guid}/page", GetCharacterPage).WithName("GetCharacterPage").Produces<PageDto>();
        g.MapPut("/characters/{id:guid}/page", SaveCharacterPage).WithName("SaveCharacterPage").Produces<PageDto>();
        g.MapGet("/communities/{slug}/activity", Activity).WithName("CommunityActivity").Produces<List<ActivityDto>>();
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex Hex();

    /// <summary>"#rrggbb" normalized, or null when empty/invalid.</summary>
    public static string? CleanColor(string? value) => value is not null && Hex().IsMatch(value.Trim()) ? value.Trim().ToUpperInvariant() : null;

    private static async Task<IResult?> ValidateAsync(SavePageRequest req, string? currentKey, AppDbContext db, Guid userId, CancellationToken ct)
    {
        if (req.Content?.Length > MaxContent) return Problems.Validation("content", "O texto pode ter até 60.000 caracteres.");
        if (req.BackgroundKey is not null && req.BackgroundKey != currentKey && !await UploadEndpoints.OwnsAsync(db, req.BackgroundKey, userId, ct))
            return Problems.Validation("backgroundKey", "Envie a imagem antes de usá-la.");
        return null;
    }

    private static async Task<IResult> GetSheetPage(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var access = await perms.GetAccessAsync(sheet.CommunityId, user.UserId(), ct);
        if (access is null) return Problems.Forbidden("Você não é membro desta comunidade.");
        return TypedResults.Ok(new PageDto(sheet.Content, sheet.BackgroundKey, sheet.BackgroundColor, sheet.BackgroundBlur, EncyclopediaEndpoints.CanEdit(sheet, access, user.UserId())));
    }

    private static async Task<IResult> SaveSheetPage(Guid id, SavePageRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(sheet.CommunityId, userId, ct);
        if (access is null || !EncyclopediaEndpoints.CanEdit(sheet, access, userId)) return Problems.Forbidden();
        if (await ValidateAsync(req, sheet.BackgroundKey, db, userId, ct) is { } error) return error;
        sheet.Content = string.IsNullOrWhiteSpace(req.Content) ? null : req.Content.Trim();
        sheet.BackgroundKey = req.BackgroundKey;
        sheet.BackgroundColor = CleanColor(req.BackgroundColor);
        sheet.BackgroundBlur = Math.Clamp(req.BackgroundBlur, 0, 40);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new PageDto(sheet.Content, sheet.BackgroundKey, sheet.BackgroundColor, sheet.BackgroundBlur, true));
    }

    private static async Task<IResult> GetCharacterPage(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var c = await db.Characters.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return Problems.NotFound("Personagem não encontrado.");
        var access = await perms.GetAccessAsync(c.CommunityId, user.UserId(), ct);
        if (access is null) return Problems.Forbidden("Você não é membro desta comunidade.");
        return TypedResults.Ok(new PageDto(c.Content, c.BackgroundKey, c.BackgroundColor, c.BackgroundBlur, CharacterEndpoints.CanEdit(c, user.UserId(), access)));
    }

    private static async Task<IResult> SaveCharacterPage(Guid id, SavePageRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var c = await db.Characters.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return Problems.NotFound("Personagem não encontrado.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(c.CommunityId, userId, ct);
        if (access is null || !CharacterEndpoints.CanEdit(c, userId, access)) return Problems.Forbidden();
        if (await ValidateAsync(req, c.BackgroundKey, db, userId, ct) is { } error) return error;
        c.Content = string.IsNullOrWhiteSpace(req.Content) ? null : req.Content.Trim();
        c.BackgroundKey = req.BackgroundKey;
        c.BackgroundColor = CleanColor(req.BackgroundColor);
        c.BackgroundBlur = Math.Clamp(req.BackgroundBlur, 0, 40);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new PageDto(c.Content, c.BackgroundKey, c.BackgroundColor, c.BackgroundBlur, true));
    }

    /// <summary>Latest happenings of the community, newest first, from what already exists (no event table).</summary>
    private static async Task<IResult> Activity(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var cid = access!.Community.Id;
        const int take = 25;
        var names = db.Memberships.Where(m => m.CommunityId == cid);

        var chats = await db.Scenes.Where(s => s.CommunityId == cid && (s.Status == SceneStatus.Open || s.ArchiveVisibility == SceneArchiveVisibility.Community))
            .OrderByDescending(s => s.CreatedAt).Take(take)
            .Select(s => new ActivityDto(s.Kind == SceneKind.Chat ? "chat" : "scene",
                names.Where(m => m.UserId == s.OpenedByUserId).Select(m => m.Nickname ?? m.User.DisplayName).FirstOrDefault() ?? "Alguém",
                db.Users.Where(u => u.Id == s.OpenedByUserId).Select(u => u.UserName).FirstOrDefault(),
                s.Kind == SceneKind.Chat ? "criou o chat" : "abriu a cena", s.Title, "chat:" + s.Id, s.CreatedAt))
            .ToListAsync(ct);
        var characters = await db.Characters.Where(c => c.CommunityId == cid && c.Status == CharacterStatus.Active)
            .OrderByDescending(c => c.CreatedAt).Take(take)
            .Select(c => new ActivityDto("character",
                names.Where(m => m.UserId == c.OwnerUserId).Select(m => m.Nickname ?? m.User.DisplayName).FirstOrDefault() ?? "Alguém",
                db.Users.Where(u => u.Id == c.OwnerUserId).Select(u => u.UserName).FirstOrDefault(),
                "criou o personagem", c.Name, "character:" + c.Id, c.CreatedAt))
            .ToListAsync(ct);
        var sheets = await db.EncyclopediaSheets.Where(s => s.CommunityId == cid)
            .OrderByDescending(s => s.CreatedAt).Take(take)
            .Select(s => new ActivityDto("sheet",
                names.Where(m => m.UserId == s.OwnerUserId).Select(m => m.Nickname ?? m.User.DisplayName).FirstOrDefault() ?? "Alguém",
                db.Users.Where(u => u.Id == s.OwnerUserId).Select(u => u.UserName).FirstOrDefault(),
                "criou a ficha", s.Name, "sheet:" + s.Id, s.CreatedAt))
            .ToListAsync(ct);
        var posts = await db.Chapters.Where(c => c.CommunityId == cid && c.Status == ChapterStatus.Published && c.DeletedAt == null && c.PublishedAt != null)
            .OrderByDescending(c => c.PublishedAt).Take(take)
            .Select(c => new ActivityDto(c.Kind == PostKind.Blog ? "blog" : "chapter",
                names.Where(m => m.UserId == c.AuthorUserId).Select(m => m.Nickname ?? m.User.DisplayName).FirstOrDefault() ?? "Alguém",
                db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.UserName).FirstOrDefault(),
                c.Kind == PostKind.Blog ? "publicou o blog" : "publicou o capítulo", c.Title, "post:" + c.Id, c.PublishedAt!.Value))
            .ToListAsync(ct);
        var joins = await names.OrderByDescending(m => m.JoinedAt).Take(take)
            .Select(m => new ActivityDto("member", m.Nickname ?? m.User.DisplayName, m.User.UserName, "entrou na comunidade", "", null, m.JoinedAt))
            .ToListAsync(ct);

        return TypedResults.Ok(chats.Concat(characters).Concat(sheets).Concat(posts).Concat(joins).OrderByDescending(a => a.At).Take(60).ToList());
    }
}
