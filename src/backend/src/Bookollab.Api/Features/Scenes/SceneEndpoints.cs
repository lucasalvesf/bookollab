using System.Security.Claims;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Scenes;

public static partial class SceneEndpoints
{
    public const int MaxActionLength = 20_000;
    public const int MaxTurnMinutes = 60 * 24 * 30;

    public static void MapSceneEndpoints(this IEndpointRouteBuilder app)
    {
        var inCommunity = app.MapGroup("/communities/{slug}/scenes").WithTags("Scenes").RequireAuthorization();
        inCommunity.MapGet("/", List).WithName("ListScenes").Produces<List<SceneSummary>>();
        inCommunity.MapPost("/", Create).WithName("CreateScene").Produces<SceneDetail>(StatusCodes.Status201Created);

        var scenes = app.MapGroup("/scenes").WithTags("Scenes").RequireAuthorization();
        scenes.MapGet("/{id:guid}", Get).WithName("GetScene").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/join", Join).WithName("JoinScene").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/close", Close).WithName("CloseScene").Produces<SceneDetail>();
        scenes.MapPut("/{id:guid}/background", UpdateBackground).WithName("UpdateSceneBackground").Produces<SceneDetail>();
        scenes.MapPut("/{id:guid}/settings", UpdateSettings).WithName("UpdateSceneSettings").Produces<SceneDetail>();
        scenes.MapPut("/{id:guid}/turn-order", UpdateTurnOrder).WithName("UpdateSceneTurnOrder").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/skip-turn", SkipTurn).WithName("SkipSceneTurn").Produces<SceneDetail>();
        scenes.MapPost("/{id:guid}/invites", Invite).WithName("InviteToScene").Produces<SceneDetail>();
        scenes.MapGet("/{id:guid}/join-requests", ListJoinRequests).WithName("ListSceneJoinRequests").Produces<List<SceneJoinRequestDto>>();
        scenes.MapGet("/{id:guid}/actions", ListActions).WithName("ListSceneActions").Produces<List<SceneActionDto>>();
        scenes.MapPost("/{id:guid}/actions", SendAction).WithName("SendSceneAction").Produces<SceneActionDto>(StatusCodes.Status201Created);

        var requests = app.MapGroup("/scene-join-requests").WithTags("Scenes").RequireAuthorization();
        requests.MapPost("/{id:guid}/approve", (Guid id, ClaimsPrincipal u, AppDbContext db, PermissionService p, IHubContext<SceneHub> h, NotificationService n, TimeProvider c, CancellationToken ct) => Decide(id, true, u, db, p, h, n, c, ct))
            .WithName("ApproveSceneJoinRequest").Produces(StatusCodes.Status204NoContent);
        requests.MapPost("/{id:guid}/reject", (Guid id, ClaimsPrincipal u, AppDbContext db, PermissionService p, IHubContext<SceneHub> h, NotificationService n, TimeProvider c, CancellationToken ct) => Decide(id, false, u, db, p, h, n, c, ct))
            .WithName("RejectSceneJoinRequest").Produces(StatusCodes.Status204NoContent);

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
        var userId = user.UserId();
        var isStaff = IsStaff(access!);
        var myCharacters = db.Characters.Where(c => c.OwnerUserId == userId).Select(c => c.Id);
        var list = await db.Scenes
            .Where(s => s.CommunityId == access!.Community.Id)
            // Closed scenes visible only to participants stay hidden from everyone else (staff always sees).
            .Where(s => s.Status == SceneStatus.Open || s.ArchiveVisibility == SceneArchiveVisibility.Community || isStaff
                || s.OpenedByUserId == userId || s.Participants.Any(p => myCharacters.Contains(p.CharacterId)))
            .OrderBy(s => s.Status == SceneStatus.Open ? 0 : 1).ThenByDescending(s => s.CreatedAt)
            .Take(100)
            .Select(s => new SceneSummary(
                s.Id, s.Title, s.Description, s.Status, s.WritingMode, s.Participation,
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
        if (req.TurnTimeLimitMinutes is < 1 or > MaxTurnMinutes) return Problems.Validation("turnTimeLimitMinutes", "Use de 1 minuto a 30 dias.");

        var scene = new Scene
        {
            CommunityId = access!.Community.Id,
            Title = title,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            OpenedByUserId = user.UserId(),
            Participation = req.Participation,
            WritingMode = req.WritingMode,
            TurnTimeLimitMinutes = req.TurnTimeLimitMinutes,
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

    /// <summary>
    /// Joins with one of the user's characters. Public: direct. Invite-only: the character must be invited.
    /// Request: creates a pending request (202). The opener and the staff can always join.
    /// </summary>
    private static async Task<IResult> Join(Guid id, JoinSceneRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!access!.Has(CommunityPermission.JoinScenes)) return Problems.Forbidden();
        if (scene!.Status != SceneStatus.Open) return Problems.Conflict("Esta cena já foi encerrada.", "scene_closed");

        var userId = user.UserId();
        var character = await db.Characters.SingleOrDefaultAsync(
            c => c.Id == req.CharacterId && c.CommunityId == scene.CommunityId && c.OwnerUserId == userId && c.Status == CharacterStatus.Active, ct);
        if (character is null) return Problems.Validation("characterId", "Escolha um dos seus personagens desta comunidade.");
        if (await db.SceneParticipants.AnyAsync(p => p.SceneId == id && p.CharacterId == character.Id, ct))
            return TypedResults.Ok(await DetailAsync(db, scene, access, userId, ct));

        var manager = CanManage(scene, access, userId);
        if (scene.Participation == SceneParticipation.InviteOnly && !manager
            && !await db.SceneInvites.AnyAsync(i => i.SceneId == id && i.CharacterId == character.Id, ct))
            return Problems.Forbidden("Esta cena é só para personagens convidados.");

        if (scene.Participation == SceneParticipation.Request && !manager)
        {
            if (!await db.SceneJoinRequests.AnyAsync(r => r.SceneId == id && r.CharacterId == character.Id && r.Status == SceneJoinRequestStatus.Pending, ct))
            {
                db.SceneJoinRequests.Add(new SceneJoinRequest { SceneId = id, CharacterId = character.Id, UserId = userId });
                await db.SaveChangesAsync(ct);
                await notifications.NotifyAsync(scene.OpenedByUserId, NotificationType.SceneJoinRequest,
                    $"Pedido para entrar em \"{scene.Title}\"", $"{character.Name} quer participar da cena.", $"/cenas/{id}", scene.CommunityId, userId, ct);
            }
            return TypedResults.Accepted($"/scenes/{id}", await DetailAsync(db, scene, access, userId, ct));
        }

        await AddParticipantAsync(db, hub, notifications, clock, scene, character, userId, user.Identity!.Name!, ct);
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
            scene.CurrentTurnCharacterId = null;
            scene.TurnStartedAt = null;
            await db.SaveChangesAsync(ct);
            await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.SceneClosed, id, ct);
        }
        return TypedResults.Ok(await DetailAsync(db, scene, access!, user.UserId(), ct));
    }

    private static async Task<IResult> UpdateBackground(Guid id, UpdateSceneBackgroundRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanManage(scene!, access!, userId)) return Problems.Forbidden("Só quem abriu a cena ou a staff muda o fundo.");

        var background = string.IsNullOrWhiteSpace(req.Background) ? null : req.Background.Trim();
        if (background is not null)
        {
            if (background.StartsWith("preset:", StringComparison.Ordinal))
            {
                if (!BackgroundPresetRegex().IsMatch(background[7..])) return Problems.Validation("background", "Fundo inválido.");
            }
            else if (background.StartsWith("image:", StringComparison.Ordinal))
            {
                if (!await UploadEndpoints.OwnsAsync(db, background[6..], userId, ct)) return Problems.Validation("background", "Imagem inválida. Envie novamente.");
            }
            else return Problems.Validation("background", "Fundo inválido.");
        }

        scene!.Background = background;
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.SceneUpdated, id, ct);
        return TypedResults.Ok(await DetailAsync(db, scene, access!, userId, ct));
    }

    [System.Text.RegularExpressions.GeneratedRegex("^[a-z0-9-]{1,32}$")]
    private static partial System.Text.RegularExpressions.Regex BackgroundPresetRegex();

    // ------------------------------------------------------------------ settings, turns, participation

    /// <summary>Chat settings: turns on/off (+ time limit), participation and who reads the scene after it closes.</summary>
    private static async Task<IResult> UpdateSettings(Guid id, UpdateSceneSettingsRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanManage(scene!, access!, userId)) return Problems.Forbidden("Só quem abriu a cena ou a staff muda as configurações.");
        if (req.TurnTimeLimitMinutes is < 1 or > MaxTurnMinutes) return Problems.Validation("turnTimeLimitMinutes", "Use de 1 minuto a 30 dias.");

        var turnsTurnedOn = scene!.WritingMode != SceneWritingMode.Turns && req.WritingMode == SceneWritingMode.Turns;
        scene.WritingMode = req.WritingMode;
        scene.TurnTimeLimitMinutes = req.TurnTimeLimitMinutes;
        scene.Participation = req.Participation;
        scene.ArchiveVisibility = req.ArchiveVisibility;
        await db.Entry(scene).Collection(s => s.Participants).LoadAsync(ct);
        if (req.WritingMode == SceneWritingMode.Free)
        {
            scene.CurrentTurnCharacterId = null;
            scene.TurnStartedAt = null;
        }
        else if (turnsTurnedOn && scene.Status == SceneStatus.Open)
        {
            scene.CurrentTurnCharacterId = null;
            scene.AdvanceTurn(clock.GetUtcNow());
        }
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.SceneUpdated, id, ct);
        if (turnsTurnedOn) await NotifyTurnAsync(db, notifications, scene, userId, ct);
        return TypedResults.Ok(await DetailAsync(db, scene, access!, userId, ct));
    }

    private static async Task<IResult> UpdateTurnOrder(Guid id, TurnOrderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!CanManage(scene!, access!, user.UserId())) return Problems.Forbidden("Só quem abriu a cena ou a staff reorganiza a ordem.");
        await db.Entry(scene!).Collection(s => s.Participants).LoadAsync(ct);
        var current = scene!.Participants.Select(p => p.CharacterId).ToHashSet();
        if (req.CharacterIds.Count != current.Count || !req.CharacterIds.ToHashSet().SetEquals(current))
            return Problems.Validation("characterIds", "Envie todos os participantes da cena, cada um uma vez.");

        for (var i = 0; i < req.CharacterIds.Count; i++)
            scene.Participants.Single(p => p.CharacterId == req.CharacterIds[i]).Position = i;
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.SceneUpdated, id, ct);
        return TypedResults.Ok(await DetailAsync(db, scene, access!, user.UserId(), ct));
    }

    private static async Task<IResult> SkipTurn(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanSkip(scene!, access!, userId)) return Problems.Forbidden("Só o narrador, quem abriu a cena ou a staff pula a vez.");
        if (scene!.WritingMode != SceneWritingMode.Turns || scene.Status != SceneStatus.Open)
            return Problems.Conflict("Esta cena não está em turnos.", "not_turns");
        await db.Entry(scene).Collection(s => s.Participants).LoadAsync(ct);
        scene.AdvanceTurn(clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
        await TurnChangedAsync(db, hub, notifications, scene, userId, ct);
        return TypedResults.Ok(await DetailAsync(db, scene, access!, userId, ct));
    }

    private static async Task<IResult> Invite(Guid id, InviteCharacterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, NotificationService notifications, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanManage(scene!, access!, userId)) return Problems.Forbidden("Só quem abriu a cena ou a staff convida.");
        var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == req.CharacterId && c.CommunityId == scene!.CommunityId && c.Status == CharacterStatus.Active, ct);
        if (character is null) return Problems.Validation("characterId", "Personagem inválido.");

        if (!await db.SceneInvites.AnyAsync(i => i.SceneId == id && i.CharacterId == character.Id, ct))
        {
            db.SceneInvites.Add(new SceneInvite { SceneId = id, CharacterId = character.Id, InvitedByUserId = userId });
            await db.SaveChangesAsync(ct);
            await notifications.NotifyAsync(character.OwnerUserId, NotificationType.SceneInvite,
                $"{character.Name} foi convidado para uma cena", $"Cena: {scene!.Title}", $"/cenas/{id}", scene.CommunityId, userId, ct);
        }
        return TypedResults.Ok(await DetailAsync(db, scene!, access!, userId, ct));
    }

    private static async Task<IResult> ListJoinRequests(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (scene, access, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (!CanManage(scene!, access!, user.UserId())) return Problems.Forbidden();
        var list = await db.SceneJoinRequests
            .Where(r => r.SceneId == id && r.Status == SceneJoinRequestStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .Join(db.Characters, r => r.CharacterId, c => c.Id, (r, c) => new { r, c })
            .Join(db.Users, x => x.r.UserId, u => u.Id, (x, u) => new SceneJoinRequestDto(x.r.Id, x.c.Id, x.c.Name, x.c.AvatarKey, u.UserName!, x.r.CreatedAt))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> Decide(Guid requestId, bool approve, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var request = await db.SceneJoinRequests.SingleOrDefaultAsync(r => r.Id == requestId && r.Status == SceneJoinRequestStatus.Pending, ct);
        if (request is null) return Problems.NotFound("Pedido não encontrado.");
        var (scene, access, error) = await LoadAsync(request.SceneId, user, db, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        if (!CanManage(scene!, access!, userId)) return Problems.Forbidden();

        request.Status = approve ? SceneJoinRequestStatus.Approved : SceneJoinRequestStatus.Rejected;
        request.DecidedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        var character = await db.Characters.SingleAsync(c => c.Id == request.CharacterId, ct);
        if (approve && scene!.Status == SceneStatus.Open && !await db.SceneParticipants.AnyAsync(p => p.SceneId == scene.Id && p.CharacterId == character.Id, ct))
        {
            var ownerName = await db.Users.Where(u => u.Id == character.OwnerUserId).Select(u => u.UserName!).SingleAsync(ct);
            await AddParticipantAsync(db, hub, notifications, clock, scene, character, character.OwnerUserId, ownerName, ct);
        }
        await notifications.NotifyAsync(request.UserId, NotificationType.SceneJoinDecision,
            approve ? $"{character.Name} entrou na cena \"{scene!.Title}\"" : $"Pedido recusado: \"{scene!.Title}\"",
            approve ? "Seu pedido foi aprovado." : "Seu pedido para entrar na cena foi recusado.",
            $"/cenas/{scene.Id}", scene.CommunityId, userId, ct);
        return TypedResults.NoContent();
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
            .Join(db.Characters, a => a.CharacterId, c => c.Id, (a, c) => new { a, c.Name, c.AvatarKey })
            .ToListAsync(ct);
        return TypedResults.Ok(page.OrderBy(x => x.a.CreatedAt).Select(x => ToDto(x.a, x.Name, x.AvatarKey)).ToList());
    }

    private static async Task<IResult> SendAction(Guid id, SendActionRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, CancellationToken ct)
    {
        var (scene, _, error) = await LoadAsync(id, user, db, perms, ct);
        if (error is not null) return error;
        if (scene!.Status != SceneStatus.Open) return Problems.Conflict("Esta cena já foi encerrada.", "scene_closed");
        var content = req.Content?.Trim() ?? "";
        var attachment = string.IsNullOrWhiteSpace(req.AttachmentKey) ? null : req.AttachmentKey;
        if (content.Length > MaxActionLength || (content.Length == 0 && attachment is null))
            return Problems.Validation("content", "Escreva a ação (até 20.000 caracteres) ou anexe uma imagem.");

        var userId = user.UserId();
        if (attachment is not null && !await UploadEndpoints.OwnsAsync(db, attachment, userId, ct))
            return Problems.Validation("attachmentKey", "Anexo inválido. Envie a imagem novamente.");
        var character = await db.SceneParticipants
            .Where(p => p.SceneId == id && p.CharacterId == req.CharacterId)
            .Join(db.Characters.Where(c => c.OwnerUserId == userId), p => p.CharacterId, c => c.Id, (p, c) => c)
            .SingleOrDefaultAsync(ct);
        if (character is null) return Problems.Forbidden("Entre na cena com este personagem antes de enviar ações.");
        if (scene.WritingMode == SceneWritingMode.Turns && scene.CurrentTurnCharacterId != character.Id)
            return Problems.Conflict("Ainda não é a vez deste personagem.", "not_your_turn");

        var now = clock.GetUtcNow();
        var action = new SceneAction { SceneId = id, CharacterId = character.Id, AuthorUserId = userId, Content = content, AttachmentKey = attachment };
        character.LastActivityAt = now;
        db.SceneActions.Add(action);
        if (scene.WritingMode == SceneWritingMode.Turns)
        {
            await db.Entry(scene).Collection(s => s.Participants).LoadAsync(ct);
            scene.AdvanceTurn(now);
        }
        await db.SaveChangesAsync(ct);

        var dto = ToDto(action, character.Name, character.AvatarKey);
        await hub.Clients.Group(SceneEvents.Group(id)).SendAsync(SceneEvents.ActionCreated, dto, ct);
        if (scene.WritingMode == SceneWritingMode.Turns) await TurnChangedAsync(db, hub, notifications, scene, userId, ct);
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
        if (content.Length > MaxActionLength || (content.Length == 0 && action.AttachmentKey is null))
            return Problems.Validation("content", "A ação precisa ter de 1 a 20.000 caracteres.");
        var (name, avatar) = await CharacterInfo(db, action.CharacterId, ct);
        if (content == action.Content) return TypedResults.Ok(ToDto(action, name, avatar));

        action.Edit(content, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
        var dto = ToDto(action, name, avatar);
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

    // ------------------------------------------------------------------ shared rules

    /// <summary>Loads a scene the user may see: members of the community; closed private scenes only for participants, opener and staff.</summary>
    public static async Task<(Scene? Scene, MemberAccess? Access, IResult? Error)> LoadAsync(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var scene = await db.Scenes.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (scene is null) return (null, null, Problems.NotFound("Cena não encontrada."));
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(scene.CommunityId, userId, ct);
        if (access is null) return (null, null, Problems.Forbidden("Você não é membro desta comunidade."));
        if (!await CanViewAsync(db, scene, access, userId, ct)) return (null, null, Problems.Forbidden("Esta cena encerrada é visível só para os participantes."));
        return (scene, access, null);
    }

    public static async Task<bool> CanViewAsync(AppDbContext db, Scene scene, MemberAccess access, Guid userId, CancellationToken ct) =>
        scene.Status == SceneStatus.Open || scene.ArchiveVisibility == SceneArchiveVisibility.Community || IsStaff(access)
        || scene.OpenedByUserId == userId
        || await db.SceneParticipants.AnyAsync(p => p.SceneId == scene.Id && db.Characters.Any(c => c.Id == p.CharacterId && c.OwnerUserId == userId), ct);

    private static bool IsStaff(MemberAccess access) =>
        access.Has(CommunityPermission.ManageCommunity) || access.Has(CommunityPermission.ModerateContent);

    /// <summary>Scene settings, background, invites and join requests: the opener or the community staff.</summary>
    private static bool CanManage(Scene scene, MemberAccess access, Guid userId) =>
        scene.OpenedByUserId == userId || access.Has(CommunityPermission.ManageCommunity);

    /// <summary>Skipping a turn: narrators (CloseAnyScene), the opener and the staff.</summary>
    private static bool CanSkip(Scene scene, MemberAccess access, Guid userId) =>
        CanManage(scene, access, userId) || access.Has(CommunityPermission.CloseAnyScene);

    private static bool CanClose(Scene scene, MemberAccess access, Guid userId) =>
        scene.OpenedByUserId == userId || access.Has(CommunityPermission.CloseAnyScene);

    private static async Task AddParticipantAsync(AppDbContext db, IHubContext<SceneHub> hub, NotificationService notifications, TimeProvider clock, Scene scene, Character character, Guid ownerId, string ownerUserName, CancellationToken ct)
    {
        await db.Entry(scene).Collection(s => s.Participants).LoadAsync(ct);
        var position = scene.Participants.Count == 0 ? 0 : scene.Participants.Max(p => p.Position) + 1;
        scene.Participants.Add(new SceneParticipant { SceneId = scene.Id, CharacterId = character.Id, Position = position });
        var startsTurn = scene.WritingMode == SceneWritingMode.Turns && scene.CurrentTurnCharacterId is null && scene.Status == SceneStatus.Open;
        if (startsTurn)
        {
            scene.CurrentTurnCharacterId = character.Id;
            scene.TurnStartedAt = clock.GetUtcNow();
        }
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(SceneEvents.Group(scene.Id)).SendAsync(SceneEvents.ParticipantJoined,
            new SceneParticipantDto(character.Id, character.Name, character.AvatarKey, ownerId, ownerUserName), ct);
        if (startsTurn) await NotifyTurnAsync(db, notifications, scene, null, ct);
    }

    /// <summary>Broadcasts the new turn and notifies the owner of the character whose turn it is.</summary>
    public static async Task TurnChangedAsync(AppDbContext db, IHubContext<SceneHub> hub, NotificationService notifications, Scene scene, Guid? actorId, CancellationToken ct)
    {
        await hub.Clients.Group(SceneEvents.Group(scene.Id)).SendAsync(SceneEvents.TurnChanged, scene.Id, scene.CurrentTurnCharacterId, ct);
        await NotifyTurnAsync(db, notifications, scene, actorId, ct);
    }

    private static async Task NotifyTurnAsync(AppDbContext db, NotificationService notifications, Scene scene, Guid? actorId, CancellationToken ct)
    {
        if (scene.CurrentTurnCharacterId is not { } characterId) return;
        var character = await db.Characters.Where(c => c.Id == characterId).Select(c => new { c.Name, c.OwnerUserId }).SingleAsync(ct);
        await notifications.NotifyAsync(character.OwnerUserId, NotificationType.YourTurn,
            $"Sua vez em \"{scene.Title}\"", $"É a vez de {character.Name}.", $"/cenas/{scene.Id}", scene.CommunityId, actorId, ct);
    }

    private static async Task<SceneDetail> DetailAsync(AppDbContext db, Scene scene, MemberAccess access, Guid userId, CancellationToken ct)
    {
        var participants = await db.SceneParticipants
            .Where(p => p.SceneId == scene.Id)
            .OrderBy(p => p.Position).ThenBy(p => p.JoinedAt)
            .Join(db.Characters, p => p.CharacterId, c => c.Id, (p, c) => c)
            .Join(db.Users, c => c.OwnerUserId, u => u.Id, (c, u) => new SceneParticipantDto(c.Id, c.Name, c.AvatarKey, u.Id, u.UserName!))
            .ToListAsync(ct);
        var invited = await db.SceneInvites.Where(i => i.SceneId == scene.Id).Select(i => i.CharacterId).ToListAsync(ct);
        var myPending = await db.SceneJoinRequests
            .Where(r => r.SceneId == scene.Id && r.UserId == userId && r.Status == SceneJoinRequestStatus.Pending)
            .Select(r => r.CharacterId).ToListAsync(ct);
        var manager = CanManage(scene, access, userId);
        var pendingCount = manager ? await db.SceneJoinRequests.CountAsync(r => r.SceneId == scene.Id && r.Status == SceneJoinRequestStatus.Pending, ct) : 0;
        var open = scene.Status == SceneStatus.Open;
        return new SceneDetail(
            scene.Id, scene.CommunityId, access.Community.Slug, access.Community.Name, scene.Title, scene.Description,
            scene.Status, scene.WritingMode, scene.OpenedByUserId, scene.CreatedAt, scene.ClosedAt, scene.Background, participants,
            CanJoin: open && access.Has(CommunityPermission.JoinScenes),
            CanClose: open && CanClose(scene, access, userId),
            CanModerate: access.Has(CommunityPermission.ModerateContent),
            CanViewRevisions: access.Has(CommunityPermission.ViewRevisionHistory),
            CanEditBackground: manager,
            scene.Participation, scene.ArchiveVisibility,
            scene.TurnTimeLimitMinutes, scene.CurrentTurnCharacterId, scene.TurnDeadline(),
            CanManage: manager,
            CanSkipTurn: open && scene.WritingMode == SceneWritingMode.Turns && CanSkip(scene, access, userId),
            invited, myPending, pendingCount);
    }

    private static async Task<(string Name, string? AvatarKey)> CharacterInfo(AppDbContext db, Guid characterId, CancellationToken ct)
    {
        var c = await db.Characters.Where(x => x.Id == characterId).Select(x => new { x.Name, x.AvatarKey }).SingleAsync(ct);
        return (c.Name, c.AvatarKey);
    }

    private static SceneActionDto ToDto(SceneAction a, string characterName, string? characterAvatarKey) => new(
        a.Id, a.SceneId, a.CharacterId, characterName, characterAvatarKey, a.AuthorUserId,
        a.DeletedAt is null ? a.Content : null, a.DeletedAt is null ? a.AttachmentKey : null,
        a.CreatedAt, a.EditedAt, a.DeletedAt is not null);
}
