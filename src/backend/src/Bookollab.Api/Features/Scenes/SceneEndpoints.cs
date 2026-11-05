using System.Security.Claims;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Scenes;

public static class SceneEndpoints
{
    public const int MaxActionLength = 20_000;

    public static void MapSceneEndpoints(this IEndpointRouteBuilder app)
    {
        var inCommunity = app.MapGroup("/communities/{slug}/scenes").WithTags("Scenes").RequireAuthorization();
        inCommunity.MapGet("/", List).WithName("ListScenes").Produces<List<SceneSummary>>();
        inCommunity.MapPost("/", Create).WithName("CreateScene").Produces<SceneDetail>(StatusCodes.Status201Created);

        var scenes = app.MapGroup("/scenes").WithTags("Scenes").RequireAuthorization();
        scenes.MapGet("/{id:guid}", Get).WithName("GetScene").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/join", Join).WithName("JoinScene").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/close", Close).WithName("CloseScene").Produces<SceneDetail>();
        scenes.MapGet("/{id:guid}/actions", ListActions).WithName("ListSceneActions").Produces<List<SceneActionDto>>();
        scenes.MapPost("/{id:guid}/actions", SendAction).WithName("SendSceneAction").Produces<SceneActionDto>(StatusCodes.Status201Created);

        var actions = app.MapGroup("/actions").WithTags("Scenes").RequireAuthorization();
        actions.MapPut("/{id:guid}", EditAction).WithName("EditSceneAction").Produces<SceneActionDto>();
        actions.MapDelete("/{id:guid}", DeleteAction).WithName("DeleteSceneAction").Produces(StatusCodes.Status204NoContent);
        actions.MapGet("/{id:guid}/revisions", ActionRevisions).WithName("ListSceneActionRevisions").Produces<List<RevisionDto>>();
    }

    // ------------------------------------------------------------------ scenes

    private static async Task<IResult> List(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var list = await db.Scenes
            .Where(s => s.CommunityId == access!.Community.Id)
            .OrderBy(s => s.Status == SceneStatus.Open ? 0 : 1).ThenByDescending(s => s.CreatedAt)
            .Take(100)
            .Select(s => new SceneSummary(
                s.Id, s.Title, s.Description, s.Status, s.WritingMode,
                db.Users.Where(u => u.Id == s.OpenedByUserId).Select(u => u.UserName!).Single(),
                s.Participants.Count, s.CreatedAt,
                db.SceneActions.Where(a => a.SceneId == s.Id).Max(a => (DateTimeOffset?)a.CreatedAt)))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> Create(string slug, CreateSceneRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.OpenScenes, user, perms, ct);
        if (error is not null) return error;
        var title = req.Title?.Trim() ?? "";
        if (title.Length is < 1 or > 150) return Problems.Validation("title", "O título precisa ter de 1 a 150 caracteres.");
        if (req.Description?.Length > 2000) return Problems.Validation("description", "A descrição pode ter até 2.000 caracteres.");

        var scene = new Scene
        {
            CommunityId = access!.Community.Id,
            Title = title,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            OpenedByUserId = user.UserId(),
        };
        db.Scenes.Add(scene);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/scenes/{scene.Id}", await DetailAsync(db, scene, access, user.UserId(), ct));
    }

    private static async Task<IResult> Get(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        return TypedResults.Ok(await DetailAsync(db, scene!, access!, user.UserId(), ct));
    }

    private static async Task<IResult> Join(Guid id, JoinSceneRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!access!.Has(CommunityPermission.JoinScenes)) return Problems.Forbidden();
        if (scene!.Status != SceneStatus.Open) return Problems.Conflict("Esta cena já foi encerrada.", "scene_closed");

        var userId = user.UserId();
        var character = await db.Characters.SingleOrDefaultAsync(
            c => c.Id == req.CharacterId && c.CommunityId == scene.CommunityId && c.OwnerUserId == userId && c.Status == CharacterStatus.Active, ct);
        if (character is null) return Problems.Validation("characterId", "Escolha um dos seus personagens desta comunidade.");

        if (!await db.SceneParticipants.AnyAsync(p => p.SceneId == id && p.CharacterId == character.Id, ct))
        {
            db.SceneParticipants.Add(new SceneParticipant { SceneId = id, CharacterId = character.Id });
            await db.SaveChangesAsync(ct);
            await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.ParticipantJoined,
                new SceneParticipantDto(character.Id, character.Name, userId, user.Identity!.Name!), ct);
        }
        return TypedResults.Ok(await DetailAsync(db, scene, access, userId, ct));
    }

    private static async Task<IResult> Close(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, TimeProvider clock, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!CanClose(scene!, access!, user.UserId())) return Problems.Forbidden();
        if (scene!.Status == SceneStatus.Open)
        {
            scene.Status = SceneStatus.Closed;
            scene.ClosedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);
            await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.SceneClosed, id, ct);
        }
        return TypedResults.Ok(await DetailAsync(db, scene, access!, user.UserId(), ct));
    }

    // ------------------------------------------------------------------ actions

    private static async Task<IResult> ListActions(Guid id, DateTimeOffset? before, int? limit, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (_, _, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var take = Math.Clamp(limit ?? 50, 1, 200);
        var query = db.SceneActions.Where(a => a.SceneId == id);
        if (before is not null) query = query.Where(a => a.CreatedAt < before);
        // Latest page, returned in chronological order.
        var page = await query.OrderByDescending(a => a.CreatedAt).Take(take)
            .Join(db.Characters, a => a.CharacterId, c => c.Id, (a, c) => new { a, c.Name })
            .ToListAsync(ct);
        return TypedResults.Ok(page.OrderBy(x => x.a.CreatedAt).Select(x => ToDto(x.a, x.Name)).ToList());
    }

    private static async Task<IResult> SendAction(Guid id, SendActionRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, TimeProvider clock, CancellationToken ct)
    {
        var (scene, _, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (scene!.Status != SceneStatus.Open) return Problems.Conflict("Esta cena já foi encerrada.", "scene_closed");
        var content = req.Content?.Trim() ?? "";
        if (content.Length is < 1 or > MaxActionLength) return Problems.Validation("content", "A ação precisa ter de 1 a 20.000 caracteres.");

        var userId = user.UserId();
        var character = await db.SceneParticipants
            .Where(p => p.SceneId == id && p.CharacterId == req.CharacterId)
            .Join(db.Characters.Where(c => c.OwnerUserId == userId), p => p.CharacterId, c => c.Id, (p, c) => c)
            .SingleOrDefaultAsync(ct);
        if (character is null) return Problems.Forbidden("Entre na cena com este personagem antes de enviar ações.");

        var action = new SceneAction { SceneId = id, CharacterId = character.Id, AuthorUserId = userId, Content = content };
        character.LastActivityAt = clock.GetUtcNow();
        db.SceneActions.Add(action);
        await db.SaveChangesAsync(ct);

        var dto = ToDto(action, character.Name);
        await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.ActionCreated, dto, ct);
        return TypedResults.Created($"/actions/{action.Id}", dto);
    }

    private static async Task<IResult> EditAction(Guid id, EditActionRequest req, ClaimsPrincipal user, AppDbContext db, IHubContext<SceneHub> hub, TimeProvider clock, CancellationToken ct)
    {
        var action = await db.SceneActions.SingleOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, ct);
        if (action is null) return Problems.NotFound("Ação não encontrada.");
        if (action.AuthorUserId != user.UserId()) return Problems.Forbidden("Só o autor pode editar a ação.");
        if (await db.Scenes.AnyAsync(s => s.Id == action.SceneId && s.Status != SceneStatus.Open, ct))
            return Problems.Conflict("Esta cena já foi encerrada.", "scene_closed");
        var content = req.Content?.Trim() ?? "";
        if (content.Length is < 1 or > MaxActionLength) return Problems.Validation("content", "A ação precisa ter de 1 a 20.000 caracteres.");
        if (content == action.Content) return TypedResults.Ok(ToDto(action, await CharacterName(db, action.CharacterId, ct)));

        action.Edit(content, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
        var dto = ToDto(action, await CharacterName(db, action.CharacterId, ct));
        await hub.Clients.Group(SceneEvents.Group(action.SceneId)).SendAsync(SceneEvents.ActionUpdated, dto, ct);
        return TypedResults.Ok(dto);
    }

    private static async Task<IResult> DeleteAction(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, TimeProvider clock, CancellationToken ct)
    {
        var action = await db.SceneActions.SingleOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, ct);
        if (action is null) return Problems.NotFound("Ação não encontrada.");
        var userId = user.UserId();
        if (action.AuthorUserId != userId)
        {
            var scene = await db.Scenes.SingleAsync(s => s.Id == action.SceneId, ct);
            var access = await perms.GetAccessAsync(scene.CommunityId, userId, ct);
            if (access is null || !access.Has(CommunityPermission.ModerateContent)) return Problems.Forbidden();
        }

        action.DeletedAt = clock.GetUtcNow(); // soft delete: content and revisions stay for staff auditing
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(SceneEvents.Group(action.SceneId)).SendAsync(SceneEvents.ActionDeleted, action.Id, ct);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> ActionRevisions(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var action = await db.SceneActions.Include(a => a.Revisions).SingleOrDefaultAsync(a => a.Id == id, ct);
        if (action is null) return Problems.NotFound("Ação não encontrada.");
        var scene = await db.Scenes.SingleAsync(s => s.Id == action.SceneId, ct);
        var access = await perms.GetAccessAsync(scene.CommunityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ViewRevisionHistory)) return Problems.Forbidden();

        var history = action.Revisions.OrderBy(r => r.CreatedAt).Select(r => new RevisionDto(r.Content, r.CreatedAt)).ToList();
        history.Add(new RevisionDto(action.Content, action.EditedAt ?? action.CreatedAt));
        return TypedResults.Ok(history);
    }

    // ------------------------------------------------------------------ helpers

    private static async Task<(Scene? Scene, MemberAccess? Access, IResult? Error)> LoadAsync(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var scene = await db.Scenes.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (scene is null) return (null, null, Problems.NotFound("Cena não encontrada."));
        var access = await perms.GetAccessAsync(scene.CommunityId, user.UserId(), ct);
        return access is null ? (null, null, Problems.Forbidden("Você não é membro desta comunidade.")) : (scene, access, null);
    }

    private static bool CanClose(Scene scene, MemberAccess access, Guid userId) =>
        scene.OpenedByUserId == userId || access.Has(CommunityPermission.CloseAnyScene);

    private static async Task<SceneDetail> DetailAsync(AppDbContext db, Scene scene, MemberAccess access, Guid userId, CancellationToken ct)
    {
        var participants = await db.SceneParticipants
            .Where(p => p.SceneId == scene.Id)
            .OrderBy(p => p.JoinedAt)
            .Join(db.Characters, p => p.CharacterId, c => c.Id, (p, c) => c)
            .Join(db.Users, c => c.OwnerUserId, u => u.Id, (c, u) => new SceneParticipantDto(c.Id, c.Name, u.Id, u.UserName!))
            .ToListAsync(ct);
        return new SceneDetail(
            scene.Id, scene.CommunityId, access.Community.Slug, access.Community.Name, scene.Title, scene.Description,
            scene.Status, scene.WritingMode, scene.OpenedByUserId, scene.CreatedAt, scene.ClosedAt, participants,
            CanJoin: scene.Status == SceneStatus.Open && access.Has(CommunityPermission.JoinScenes),
            CanClose: scene.Status == SceneStatus.Open && CanClose(scene, access, userId),
            CanModerate: access.Has(CommunityPermission.ModerateContent),
            CanViewRevisions: access.Has(CommunityPermission.ViewRevisionHistory));
    }

    private static Task<string> CharacterName(AppDbContext db, Guid characterId, CancellationToken ct) =>
        db.Characters.Where(c => c.Id == characterId).Select(c => c.Name).SingleAsync(ct);

    private static SceneActionDto ToDto(SceneAction a, string characterName) => new(
        a.Id, a.SceneId, a.CharacterId, characterName, a.AuthorUserId,
        a.DeletedAt is null ? a.Content : null, a.CreatedAt, a.EditedAt, a.DeletedAt is not null);
}
