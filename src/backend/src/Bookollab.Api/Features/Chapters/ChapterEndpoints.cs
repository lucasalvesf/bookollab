using System.Security.Claims;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Chapters;

public sealed record CreateChapterRequest(Guid CharacterId, string Title, string Content, bool Publish);

public sealed record UpdateChapterRequest(string Title, string Content);

public sealed record ChapterSummary(
    Guid Id, string Title, Guid CharacterId, string CharacterName, string AuthorUserName, ChapterStatus Status,
    DateTimeOffset CreatedAt, DateTimeOffset? PublishedAt, DateTimeOffset? EditedAt, string Excerpt);

public sealed record ChapterDetail(
    Guid Id, Guid CommunityId, string CommunitySlug, string CommunityName, Guid CharacterId, string CharacterName,
    Guid AuthorUserId, string AuthorUserName, string Title, string Content, ChapterStatus Status,
    DateTimeOffset CreatedAt, DateTimeOffset? PublishedAt, DateTimeOffset? EditedAt,
    bool CanEdit, bool CanDelete, bool CanViewRevisions);

public sealed record ChapterRevisionDto(string Title, string Content, DateTimeOffset CreatedAt);

public static class ChapterEndpoints
{
    public const int MaxContentLength = 200_000;

    public static void MapChapterEndpoints(this IEndpointRouteBuilder app)
    {
        var inCommunity = app.MapGroup("/communities/{slug}/chapters").WithTags("Chapters").RequireAuthorization();
        inCommunity.MapGet("/", List).WithName("ListChapters").Produces<List<ChapterSummary>>();
        inCommunity.MapPost("/", Create).WithName("CreateChapter").Produces<ChapterDetail>(StatusCodes.Status201Created);

        var chapters = app.MapGroup("/chapters").WithTags("Chapters").RequireAuthorization();
        chapters.MapGet("/{id:guid}", Get).WithName("GetChapter").Produces<ChapterDetail>();
        chapters.MapPut("/{id:guid}", Update).WithName("UpdateChapter").Produces<ChapterDetail>();
        chapters.MapPost("/{id:guid}/publish", Publish).WithName("PublishChapter").Produces<ChapterDetail>();
        chapters.MapDelete("/{id:guid}", Delete).WithName("DeleteChapter").Produces(StatusCodes.Status204NoContent);
        chapters.MapGet("/{id:guid}/revisions", Revisions).WithName("ListChapterRevisions").Produces<List<ChapterRevisionDto>>();
    }

    /// <summary>Published chapters of the community, plus the user's own drafts. Optional filter by character.</summary>
    private static async Task<IResult> List(string slug, Guid? characterId, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        var query = db.Chapters.Where(c => c.CommunityId == access!.Community.Id && c.DeletedAt == null
            && (c.Status == ChapterStatus.Published || c.AuthorUserId == userId));
        if (characterId is not null) query = query.Where(c => c.CharacterId == characterId);

        var rows = await query
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Take(100)
            .Select(c => new
            {
                c.Id, c.Title, c.CharacterId, c.Status, c.CreatedAt, c.PublishedAt, c.EditedAt,
                Start = c.Content.Substring(0, Math.Min(c.Content.Length, 200)),
                Character = db.Characters.Where(ch => ch.Id == c.CharacterId).Select(ch => ch.Name).Single(),
                Author = db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.UserName!).Single(),
            })
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(r => new ChapterSummary(
            r.Id, r.Title, r.CharacterId, r.Character, r.Author, r.Status, r.CreatedAt, r.PublishedAt, r.EditedAt, Excerpt(r.Start))).ToList());
    }

    private static async Task<IResult> Create(string slug, CreateChapterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.WriteChapters, user, perms, ct);
        if (error is not null) return error;
        var validation = Validate(req.Title, req.Content);
        if (validation is not null) return validation;

        var userId = user.UserId();
        var character = await db.Characters.SingleOrDefaultAsync(
            c => c.Id == req.CharacterId && c.CommunityId == access!.Community.Id && c.OwnerUserId == userId && c.Status == CharacterStatus.Active, ct);
        if (character is null) return Problems.Validation("characterId", "Escolha um dos seus personagens desta comunidade.");

        var now = clock.GetUtcNow();
        var chapter = new Chapter
        {
            CommunityId = access!.Community.Id,
            CharacterId = character.Id,
            AuthorUserId = userId,
            Title = req.Title.Trim(),
            Content = req.Content.Trim(),
        };
        if (req.Publish)
        {
            chapter.Publish(now);
            character.LastActivityAt = now;
        }
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/chapters/{chapter.Id}", await DetailAsync(db, chapter, access, userId, ct));
    }

    private static async Task<IResult> Get(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        return TypedResults.Ok(await DetailAsync(db, chapter!, access!, user.UserId(), ct));
    }

    private static async Task<IResult> Update(Guid id, UpdateChapterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanEdit(chapter!, access!, userId)) return Problems.Forbidden();
        var validation = Validate(req.Title, req.Content);
        if (validation is not null) return validation;

        if (req.Title.Trim() != chapter!.Title || req.Content.Trim() != chapter.Content)
        {
            chapter.Edit(req.Title.Trim(), req.Content.Trim(), clock.GetUtcNow());
            await db.SaveChangesAsync(ct);
        }
        return TypedResults.Ok(await DetailAsync(db, chapter, access!, userId, ct));
    }

    private static async Task<IResult> Publish(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (chapter!.AuthorUserId != userId) return Problems.Forbidden("Só o autor pode publicar.");
        if (chapter.Status != ChapterStatus.Published)
        {
            var now = clock.GetUtcNow();
            chapter.Publish(now);
            await db.Characters.Where(c => c.Id == chapter.CharacterId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.LastActivityAt, now), ct);
            await db.SaveChangesAsync(ct);
        }
        return TypedResults.Ok(await DetailAsync(db, chapter, access!, userId, ct));
    }

    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!CanDelete(chapter!, access!, user.UserId())) return Problems.Forbidden();
        chapter!.DeletedAt = clock.GetUtcNow(); // soft delete: kept for staff auditing
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> Revisions(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!access!.Has(CommunityPermission.ViewRevisionHistory)) return Problems.Forbidden();
        var revisions = await db.ChapterRevisions.Where(r => r.ChapterId == id).OrderBy(r => r.CreatedAt)
            .Select(r => new ChapterRevisionDto(r.Title, r.Content, r.CreatedAt)).ToListAsync(ct);
        revisions.Add(new ChapterRevisionDto(chapter!.Title, chapter.Content, chapter.EditedAt ?? chapter.PublishedAt ?? chapter.CreatedAt));
        return TypedResults.Ok(revisions);
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>Loads a chapter visible to the user: members see published chapters; drafts only their author.</summary>
    private static async Task<(Chapter? Chapter, MemberAccess? Access, IResult? Error)> LoadAsync(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var chapter = await db.Chapters.SingleOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct);
        var userId = user.UserId();
        if (chapter is null || (chapter.Status == ChapterStatus.Draft && chapter.AuthorUserId != userId))
            return (null, null, Problems.NotFound("Capítulo não encontrado."));
        var access = await perms.GetAccessAsync(chapter.CommunityId, userId, ct);
        return access is null ? (null, null, Problems.Forbidden("Você não é membro desta comunidade.")) : (chapter, access, null);
    }

    private static bool CanEdit(Chapter c, MemberAccess access, Guid userId) =>
        c.AuthorUserId == userId || (c.Status == ChapterStatus.Published && access.Has(CommunityPermission.EditOthersChapters));

    private static bool CanDelete(Chapter c, MemberAccess access, Guid userId) =>
        c.AuthorUserId == userId || access.Has(CommunityPermission.ModerateContent);

    private static IResult? Validate(string? title, string? content)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 200) return Problems.Validation("title", "O título precisa ter de 1 a 200 caracteres.");
        if (string.IsNullOrWhiteSpace(content)) return Problems.Validation("content", "Escreva o texto do capítulo.");
        if (content.Length > MaxContentLength) return Problems.Validation("content", "O capítulo pode ter até 200.000 caracteres.");
        return null;
    }

    private static string Excerpt(string start)
    {
        var flat = string.Join(' ', start.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= 160 ? flat : flat[..160].TrimEnd() + "…";
    }

    private static async Task<ChapterDetail> DetailAsync(AppDbContext db, Chapter c, MemberAccess access, Guid userId, CancellationToken ct)
    {
        var characterName = await db.Characters.Where(ch => ch.Id == c.CharacterId).Select(ch => ch.Name).SingleAsync(ct);
        var author = await db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.UserName!).SingleAsync(ct);
        return new ChapterDetail(
            c.Id, c.CommunityId, access.Community.Slug, access.Community.Name, c.CharacterId, characterName,
            c.AuthorUserId, author, c.Title, c.Content, c.Status, c.CreatedAt, c.PublishedAt, c.EditedAt,
            CanEdit(c, access, userId), CanDelete(c, access, userId), access.Has(CommunityPermission.ViewRevisionHistory));
    }
}
