using System.Security.Claims;
using System.Text;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Features.Scenes;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Chapters;

public sealed record CreateChapterRequest(
    Guid CharacterId, string Title, string Content, bool Publish,
    Guid? SourceSceneId = null, List<Guid>? CoauthorCharacterIds = null,
    List<Guid>? MentionedCharacterIds = null, List<Guid>? MentionedUserIds = null,
    Guid? ReplyToChapterId = null);

public sealed record UpdateChapterRequest(string Title, string Content);

public sealed record RejectChapterRequest(string Reason);

public sealed record ChapterApprovalSettingsDto(ChapterApprovalMode Mode, IReadOnlyList<Guid> RoleIds);

public sealed record RoleOptionDto(Guid Id, string Name, BaseRoleKind BaseKind);

public sealed record ChapterApprovalConfigDto(ChapterApprovalMode Mode, IReadOnlyList<Guid> RoleIds, IReadOnlyList<RoleOptionDto> Roles);

public sealed record ChapterPersonDto(Guid Id, string Name, string? AvatarKey);

public sealed record SceneChapterDraftDto(Guid SceneId, string SceneTitle, string Title, string Content, IReadOnlyList<ChapterPersonDto> Coauthors);

public sealed record ChapterSummary(
    Guid Id, string Title, Guid CharacterId, string CharacterName, string AuthorUserName, ChapterStatus Status,
    DateTimeOffset CreatedAt, DateTimeOffset? PublishedAt, DateTimeOffset? EditedAt, string Excerpt);

public sealed record ChapterDetail(
    Guid Id, Guid CommunityId, string CommunitySlug, string CommunityName, Guid CharacterId, string CharacterName,
    Guid AuthorUserId, string AuthorUserName, string Title, string Content, ChapterStatus Status,
    DateTimeOffset CreatedAt, DateTimeOffset? PublishedAt, DateTimeOffset? EditedAt,
    bool CanEdit, bool CanDelete, bool CanViewRevisions,
    string? RejectionReason, bool CanModerate,
    Guid? SourceSceneId, string? SourceSceneTitle,
    Guid? ReplyToChapterId, string? ReplyToChapterTitle,
    IReadOnlyList<ChapterPersonDto> Coauthors, IReadOnlyList<ChapterPersonDto> MentionedCharacters, IReadOnlyList<ChapterPersonDto> MentionedUsers,
    bool MentionsMe);

public sealed record ChapterRevisionDto(string Title, string Content, DateTimeOffset CreatedAt);

public static class ChapterEndpoints
{
    public const int MaxContentLength = 200_000;
    public const int MaxMentions = 20;

    public static void MapChapterEndpoints(this IEndpointRouteBuilder app)
    {
        var inCommunity = app.MapGroup("/communities/{slug}").WithTags("Chapters").RequireAuthorization();
        inCommunity.MapGet("/chapters", List).WithName("ListChapters").Produces<List<ChapterSummary>>();
        inCommunity.MapPost("/chapters", Create).WithName("CreateChapter").Produces<ChapterDetail>(StatusCodes.Status201Created);
        inCommunity.MapGet("/chapter-approvals", ApprovalQueue).WithName("ListChapterApprovals").Produces<List<ChapterSummary>>();
        inCommunity.MapGet("/chapter-approval", GetApprovalConfig).WithName("GetChapterApprovalConfig").Produces<ChapterApprovalConfigDto>();
        inCommunity.MapPut("/chapter-approval", UpdateApprovalConfig).WithName("UpdateChapterApprovalConfig").Produces<ChapterApprovalConfigDto>();

        app.MapGet("/scenes/{id:guid}/chapter-draft", SceneDraft).WithTags("Chapters").WithName("GetSceneChapterDraft")
            .RequireAuthorization().Produces<SceneChapterDraftDto>();

        var chapters = app.MapGroup("/chapters").WithTags("Chapters").RequireAuthorization();
        chapters.MapGet("/{id:guid}", Get).WithName("GetChapter").Produces<ChapterDetail>();
        chapters.MapPut("/{id:guid}", Update).WithName("UpdateChapter").Produces<ChapterDetail>();
        chapters.MapPost("/{id:guid}/publish", Publish).WithName("PublishChapter").Produces<ChapterDetail>();
        chapters.MapPost("/{id:guid}/approve", Approve).WithName("ApproveChapter").Produces<ChapterDetail>();
        chapters.MapPost("/{id:guid}/reject", Reject).WithName("RejectChapter").Produces<ChapterDetail>();
        chapters.MapDelete("/{id:guid}", Delete).WithName("DeleteChapter").Produces(StatusCodes.Status204NoContent);
        chapters.MapGet("/{id:guid}/revisions", Revisions).WithName("ListChapterRevisions").Produces<List<ChapterRevisionDto>>();
    }

    // ------------------------------------------------------------------ listing

    /// <summary>Published chapters, the user's own chapters in any state, and (for moderators) the pending ones.</summary>
    private static async Task<IResult> List(string slug, Guid? characterId, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        var moderator = access!.Has(CommunityPermission.ModerateContent);
        var query = db.Chapters.Where(c => c.CommunityId == access.Community.Id && c.DeletedAt == null
            && (c.Status == ChapterStatus.Published || c.AuthorUserId == userId || (moderator && c.Status == ChapterStatus.Pending)));
        if (characterId is not null) query = query.Where(c => c.CharacterId == characterId);
        return TypedResults.Ok(await SummariesAsync(db, query, ct));
    }

    private static async Task<IResult> ApprovalQueue(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ModerateContent, user, perms, ct);
        if (error is not null) return error;
        var query = db.Chapters.Where(c => c.CommunityId == access!.Community.Id && c.DeletedAt == null && c.Status == ChapterStatus.Pending);
        return TypedResults.Ok(await SummariesAsync(db, query, ct, oldestFirst: true));
    }

    private static async Task<List<ChapterSummary>> SummariesAsync(AppDbContext db, IQueryable<Chapter> query, CancellationToken ct, bool oldestFirst = false)
    {
        var ordered = oldestFirst ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.PublishedAt ?? c.CreatedAt);
        var rows = await ordered.Take(100)
            .Select(c => new
            {
                c.Id, c.Title, c.CharacterId, c.Status, c.CreatedAt, c.PublishedAt, c.EditedAt,
                Start = c.Content.Substring(0, Math.Min(c.Content.Length, 200)),
                Character = db.Characters.Where(ch => ch.Id == c.CharacterId).Select(ch => ch.Name).Single(),
                Author = db.Users.Where(u => u.Id == c.AuthorUserId).Select(u => u.UserName!).Single(),
            })
            .ToListAsync(ct);
        return rows.Select(r => new ChapterSummary(r.Id, r.Title, r.CharacterId, r.Character, r.Author, r.Status, r.CreatedAt, r.PublishedAt, r.EditedAt, Excerpt(r.Start))).ToList();
    }

    // ------------------------------------------------------------------ approval settings

    private static async Task<IResult> GetApprovalConfig(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        return TypedResults.Ok(await ConfigAsync(db, access!.Community, ct));
    }

    private static async Task<IResult> UpdateApprovalConfig(string slug, ChapterApprovalSettingsDto req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        var community = access!.Community;
        var validRoles = await db.CommunityRoles.Where(r => r.CommunityId == community.Id).Select(r => r.Id).ToListAsync(ct);
        if (req.RoleIds.Any(id => !validRoles.Contains(id))) return Problems.Validation("roleIds", "Cargo inválido.");
        community.ChapterApprovalMode = req.Mode;
        community.ChapterApprovalRoleIds = req.Mode == ChapterApprovalMode.Roles ? req.RoleIds.Distinct().ToList() : [];
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ConfigAsync(db, community, ct));
    }

    private static async Task<ChapterApprovalConfigDto> ConfigAsync(AppDbContext db, Community community, CancellationToken ct)
    {
        var roles = await db.CommunityRoles.Where(r => r.CommunityId == community.Id).OrderBy(r => r.Position)
            .Select(r => new RoleOptionDto(r.Id, r.Name, r.BaseKind)).ToListAsync(ct);
        return new ChapterApprovalConfigDto(community.ChapterApprovalMode, community.ChapterApprovalRoleIds, roles);
    }

    /// <summary>
    /// Whether this author's chapters go through the staff queue. Moderators never need approval:
    /// they are the ones who run the queue.
    /// </summary>
    private static bool NeedsApproval(MemberAccess access) =>
        !access.Has(CommunityPermission.ModerateContent) && access.Community.ChapterApprovalMode switch
        {
            ChapterApprovalMode.All => true,
            ChapterApprovalMode.Roles => access.Community.ChapterApprovalRoleIds.Contains(access.Role.Id),
            _ => false,
        };

    // ------------------------------------------------------------------ scene → chapter

    /// <summary>Automatic draft from a closed scene: its actions in order, with the scene's characters as co-authors.</summary>
    private static async Task<IResult> SceneDraft(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (scene, _, error) = await SceneEndpoints.LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (scene!.Status != SceneStatus.Closed) return Problems.Conflict("O capítulo é escrito ao final da cena: encerre a cena primeiro.", "scene_open");
        var userId = user.UserId();
        if (!await ParticipatedAsync(db, scene.Id, userId, ct)) return Problems.Forbidden("Só quem participou da cena escreve o capítulo dela.");

        var actions = await db.SceneActions
            .Where(a => a.SceneId == id && a.DeletedAt == null && a.Content != "")
            .OrderBy(a => a.CreatedAt)
            .Join(db.Characters, a => a.CharacterId, c => c.Id, (a, c) => new { c.Name, a.Content })
            .ToListAsync(ct);
        var text = new StringBuilder();
        foreach (var a in actions) text.Append("**").Append(a.Name).Append(":** ").Append(a.Content).Append("\n\n");

        var coauthors = await db.SceneParticipants.Where(p => p.SceneId == id).OrderBy(p => p.Position)
            .Join(db.Characters, p => p.CharacterId, c => c.Id, (p, c) => new ChapterPersonDto(c.Id, c.Name, c.AvatarKey))
            .ToListAsync(ct);
        return TypedResults.Ok(new SceneChapterDraftDto(scene.Id, scene.Title, scene.Title, text.ToString().TrimEnd(), coauthors));
    }

    private static Task<bool> ParticipatedAsync(AppDbContext db, Guid sceneId, Guid userId, CancellationToken ct) =>
        db.SceneParticipants.AnyAsync(p => p.SceneId == sceneId && db.Characters.Any(c => c.Id == p.CharacterId && c.OwnerUserId == userId), ct);

    // ------------------------------------------------------------------ chapters

    private static async Task<IResult> Create(string slug, CreateChapterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.WriteChapters, user, perms, ct);
        if (error is not null) return error;
        var validation = Validate(req.Title, req.Content);
        if (validation is not null) return validation;
        var communityId = access!.Community.Id;

        var userId = user.UserId();
        var character = await db.Characters.SingleOrDefaultAsync(
            c => c.Id == req.CharacterId && c.CommunityId == communityId && c.OwnerUserId == userId && c.Status == CharacterStatus.Active, ct);
        if (character is null) return Problems.Validation("characterId", "Escolha um dos seus personagens desta comunidade.");

        var coauthorIds = (req.CoauthorCharacterIds ?? []).Distinct().Where(x => x != character.Id).ToList();
        if (req.SourceSceneId is { } sceneId)
        {
            var scene = await db.Scenes.SingleOrDefaultAsync(s => s.Id == sceneId && s.CommunityId == communityId, ct);
            if (scene is null) return Problems.Validation("sourceSceneId", "Cena inválida.");
            if (!await ParticipatedAsync(db, sceneId, userId, ct)) return Problems.Forbidden("Só quem participou da cena escreve o capítulo dela.");
            var participants = await db.SceneParticipants.Where(p => p.SceneId == sceneId).Select(p => p.CharacterId).ToListAsync(ct);
            if (coauthorIds.Any(x => !participants.Contains(x))) return Problems.Validation("coauthorCharacterIds", "Coautores precisam ser personagens da cena.");
        }
        else if (coauthorIds.Count > 0)
        {
            return Problems.Validation("coauthorCharacterIds", "Coautores vêm de uma cena de origem.");
        }

        var mentionedCharacters = (req.MentionedCharacterIds ?? []).Distinct().ToList();
        var mentionedUsers = (req.MentionedUserIds ?? []).Distinct().ToList();
        if (mentionedCharacters.Count + mentionedUsers.Count > MaxMentions) return Problems.Validation("mentions", $"Marque até {MaxMentions} pessoas ou personagens.");
        if (mentionedCharacters.Count > 0 && await db.Characters.CountAsync(c => mentionedCharacters.Contains(c.Id) && c.CommunityId == communityId, ct) != mentionedCharacters.Count)
            return Problems.Validation("mentionedCharacterIds", "Só é possível marcar personagens desta comunidade.");
        if (mentionedUsers.Count > 0 && await db.Memberships.CountAsync(m => mentionedUsers.Contains(m.UserId) && m.CommunityId == communityId, ct) != mentionedUsers.Count)
            return Problems.Validation("mentionedUserIds", "Só é possível marcar membros desta comunidade.");
        if (req.ReplyToChapterId is { } replyTo && !await db.Chapters.AnyAsync(c => c.Id == replyTo && c.CommunityId == communityId && c.Status == ChapterStatus.Published && c.DeletedAt == null, ct))
            return Problems.Validation("replyToChapterId", "Capítulo respondido inválido.");

        var chapter = new Chapter
        {
            CommunityId = communityId,
            CharacterId = character.Id,
            AuthorUserId = userId,
            Title = req.Title.Trim(),
            Content = req.Content.Trim(),
            SourceSceneId = req.SourceSceneId,
            ReplyToChapterId = req.ReplyToChapterId,
        };
        chapter.Coauthors.AddRange(coauthorIds.Select(id => new ChapterCoauthor { ChapterId = chapter.Id, CharacterId = id }));
        chapter.Mentions.AddRange(mentionedCharacters.Select(id => new ChapterMention { ChapterId = chapter.Id, CharacterId = id }));
        chapter.Mentions.AddRange(mentionedUsers.Select(id => new ChapterMention { ChapterId = chapter.Id, UserId = id }));
        db.Chapters.Add(chapter);
        await db.SaveChangesAsync(ct);

        if (req.Publish) await SubmitOrPublishAsync(db, notifications, chapter, character, access, userId, clock, ct);
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

    /// <summary>Publishes a draft (or resubmits a rejected chapter). Goes to the staff queue when approval applies.</summary>
    private static async Task<IResult> Publish(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (chapter!.AuthorUserId != userId) return Problems.Forbidden("Só o autor pode publicar.");
        if (chapter.Status is ChapterStatus.Draft or ChapterStatus.Rejected)
        {
            var character = await db.Characters.SingleAsync(c => c.Id == chapter.CharacterId, ct);
            await SubmitOrPublishAsync(db, notifications, chapter, character, access!, userId, clock, ct);
        }
        return TypedResults.Ok(await DetailAsync(db, chapter, access!, userId, ct));
    }

    private static async Task<IResult> Approve(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!access!.Has(CommunityPermission.ModerateContent)) return Problems.Forbidden();
        if (chapter!.Status != ChapterStatus.Pending) return Problems.Conflict("Este capítulo não está aguardando aprovação.", "not_pending");

        var character = await db.Characters.SingleAsync(c => c.Id == chapter.CharacterId, ct);
        await PublishNowAsync(db, notifications, chapter, character, userId, clock, ct);
        await notifications.NotifyAsync(chapter.AuthorUserId, NotificationType.ChapterDecision,
            $"Capítulo aprovado: \"{chapter.Title}\"", "Ele já está visível para a comunidade.", $"/capitulos/{chapter.Id}", chapter.CommunityId, userId, ct);
        return TypedResults.Ok(await DetailAsync(db, chapter, access, userId, ct));
    }

    private static async Task<IResult> Reject(Guid id, RejectChapterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, NotificationService notifications, CancellationToken ct)
    {
        var (chapter, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!access!.Has(CommunityPermission.ModerateContent)) return Problems.Forbidden();
        if (chapter!.Status != ChapterStatus.Pending) return Problems.Conflict("Este capítulo não está aguardando aprovação.", "not_pending");
        var reason = req.Reason?.Trim() ?? "";
        if (reason.Length is < 1 or > 1000) return Problems.Validation("reason", "Explique o motivo (até 1.000 caracteres).");

        chapter.Reject(reason);
        await db.SaveChangesAsync(ct);
        await notifications.NotifyAsync(chapter.AuthorUserId, NotificationType.ChapterDecision,
            $"Capítulo recusado: \"{chapter.Title}\"", reason, $"/capitulos/{chapter.Id}", chapter.CommunityId, userId, ct);
        return TypedResults.Ok(await DetailAsync(db, chapter, access, userId, ct));
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

    // ------------------------------------------------------------------ publishing

    private static async Task SubmitOrPublishAsync(AppDbContext db, NotificationService notifications, Chapter chapter, Character character, MemberAccess access, Guid userId, TimeProvider clock, CancellationToken ct)
    {
        if (!NeedsApproval(access))
        {
            await PublishNowAsync(db, notifications, chapter, character, userId, clock, ct);
            return;
        }
        chapter.SubmitForApproval();
        await db.SaveChangesAsync(ct);
        var moderators = await ModeratorIdsAsync(db, chapter.CommunityId, ct);
        await notifications.NotifyAsync(moderators, NotificationType.ChapterApproval,
            $"Capítulo aguardando aprovação: \"{chapter.Title}\"", $"De {character.Name}.", $"/capitulos/{chapter.Id}", chapter.CommunityId, userId, ct);
    }

    /// <summary>Publishes and notifies everyone tagged with "@" (they are expected to answer).</summary>
    private static async Task PublishNowAsync(AppDbContext db, NotificationService notifications, Chapter chapter, Character character, Guid actorId, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        chapter.Publish(now);
        character.LastActivityAt = now;
        await db.SaveChangesAsync(ct);

        var mentions = await db.Set<ChapterMention>().Where(m => m.ChapterId == chapter.Id).ToListAsync(ct);
        var characterIds = mentions.Where(m => m.CharacterId != null).Select(m => m.CharacterId!.Value).ToList();
        var owners = await db.Characters.Where(c => characterIds.Contains(c.Id)).Select(c => c.OwnerUserId).ToListAsync(ct);
        var targets = owners.Concat(mentions.Where(m => m.UserId != null).Select(m => m.UserId!.Value));
        await notifications.NotifyAsync(targets, NotificationType.Mention,
            $"{character.Name} marcou você em \"{chapter.Title}\"", "Responda para a história avançar.", $"/capitulos/{chapter.Id}", chapter.CommunityId, chapter.AuthorUserId, ct);
    }

    private static async Task<List<Guid>> ModeratorIdsAsync(AppDbContext db, Guid communityId, CancellationToken ct)
    {
        var members = await db.Memberships.Include(m => m.Role).Where(m => m.CommunityId == communityId).ToListAsync(ct);
        return members.Where(m => m.Role.Permissions.HasFlag(CommunityPermission.ModerateContent)).Select(m => m.UserId).ToList();
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>
    /// Members see published chapters. Drafts and rejected chapters: only the author. Pending: the author and moderators.
    /// </summary>
    private static async Task<(Chapter? Chapter, MemberAccess? Access, IResult? Error)> LoadAsync(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var chapter = await db.Chapters.SingleOrDefaultAsync(c => c.Id == id && c.DeletedAt == null, ct);
        if (chapter is null) return (null, null, Problems.NotFound("Capítulo não encontrado."));
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(chapter.CommunityId, userId, ct);
        if (access is null) return (null, null, Problems.Forbidden("Você não é membro desta comunidade."));
        var visible = chapter.Status == ChapterStatus.Published || chapter.AuthorUserId == userId
            || (chapter.Status == ChapterStatus.Pending && access.Has(CommunityPermission.ModerateContent));
        return visible ? (chapter, access, null) : (null, null, Problems.NotFound("Capítulo não encontrado."));
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
        var sceneTitle = c.SourceSceneId is null ? null : await db.Scenes.Where(s => s.Id == c.SourceSceneId).Select(s => s.Title).SingleOrDefaultAsync(ct);
        var replyTitle = c.ReplyToChapterId is null ? null : await db.Chapters.Where(x => x.Id == c.ReplyToChapterId).Select(x => x.Title).SingleOrDefaultAsync(ct);
        var coauthors = await db.Set<ChapterCoauthor>().Where(x => x.ChapterId == c.Id)
            .Join(db.Characters, x => x.CharacterId, ch => ch.Id, (x, ch) => new ChapterPersonDto(ch.Id, ch.Name, ch.AvatarKey)).ToListAsync(ct);
        var mentions = await db.Set<ChapterMention>().Where(m => m.ChapterId == c.Id).ToListAsync(ct);
        var mentionedCharacterIds = mentions.Where(m => m.CharacterId != null).Select(m => m.CharacterId!.Value).ToList();
        var mentionedUserIds = mentions.Where(m => m.UserId != null).Select(m => m.UserId!.Value).ToList();
        var mentionedCharacters = await db.Characters.Where(ch => mentionedCharacterIds.Contains(ch.Id))
            .Select(ch => new { Dto = new ChapterPersonDto(ch.Id, ch.Name, ch.AvatarKey), ch.OwnerUserId }).ToListAsync(ct);
        var mentionedUsers = await db.Users.Where(u => mentionedUserIds.Contains(u.Id))
            .Select(u => new ChapterPersonDto(u.Id, u.DisplayName, u.AvatarKey)).ToListAsync(ct);
        var mentionsMe = mentionedUserIds.Contains(userId) || mentionedCharacters.Any(x => x.OwnerUserId == userId);

        return new ChapterDetail(
            c.Id, c.CommunityId, access.Community.Slug, access.Community.Name, c.CharacterId, characterName,
            c.AuthorUserId, author, c.Title, c.Content, c.Status, c.CreatedAt, c.PublishedAt, c.EditedAt,
            CanEdit(c, access, userId), CanDelete(c, access, userId), access.Has(CommunityPermission.ViewRevisionHistory),
            c.AuthorUserId == userId || access.Has(CommunityPermission.ModerateContent) ? c.RejectionReason : null,
            CanModerate: access.Has(CommunityPermission.ModerateContent),
            c.SourceSceneId, sceneTitle, c.ReplyToChapterId, replyTitle,
            coauthors, mentionedCharacters.Select(x => x.Dto).ToList(), mentionedUsers, mentionsMe);
    }
}
