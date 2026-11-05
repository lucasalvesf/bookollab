using System.Collections.Concurrent;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Scenes;

/// <summary>Events the server pushes to clients watching a scene.</summary>
public static class SceneEvents
{
    public const string ActionCreated = "ActionCreated";
    public const string ActionUpdated = "ActionUpdated";
    public const string ActionDeleted = "ActionDeleted";
    public const string ParticipantJoined = "ParticipantJoined";
    public const string SceneClosed = "SceneClosed";
    public const string SceneUpdated = "SceneUpdated";
    public const string Presence = "Presence";
    public const string Typing = "Typing";

    public static string Group(Guid sceneId) => $"scene:{sceneId}";
}

/// <summary>In-memory presence (single API instance; a Redis backplane will be needed to scale out).</summary>
public sealed class ScenePresence
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, PresenceDto>> _scenes = new();
    private readonly ConcurrentDictionary<string, HashSet<Guid>> _byConnection = new();

    public IReadOnlyList<PresenceDto> Join(Guid sceneId, string connectionId, PresenceDto who)
    {
        _scenes.GetOrAdd(sceneId, _ => new())[connectionId] = who;
        lock (_byConnection) _byConnection.GetOrAdd(connectionId, _ => []).Add(sceneId);
        return Online(sceneId);
    }

    public IReadOnlyList<PresenceDto> Leave(Guid sceneId, string connectionId)
    {
        if (_scenes.TryGetValue(sceneId, out var conns)) conns.TryRemove(connectionId, out _);
        lock (_byConnection) if (_byConnection.TryGetValue(connectionId, out var set)) set.Remove(sceneId);
        return Online(sceneId);
    }

    /// <summary>Removes a dropped connection from every scene; returns the affected scenes.</summary>
    public IReadOnlyList<Guid> Disconnect(string connectionId)
    {
        HashSet<Guid>? scenes;
        lock (_byConnection) _byConnection.TryRemove(connectionId, out scenes);
        foreach (var id in scenes ?? []) if (_scenes.TryGetValue(id, out var conns)) conns.TryRemove(connectionId, out _);
        return scenes?.ToList() ?? [];
    }

    public IReadOnlyList<PresenceDto> Online(Guid sceneId) =>
        _scenes.TryGetValue(sceneId, out var conns) ? conns.Values.DistinctBy(p => p.UserId).ToList() : [];
}

/// <summary>
/// Realtime channel of a scene: subscribe to its events, presence and "typing".
/// Sending/editing/deleting actions goes through the REST endpoints, which broadcast here.
/// </summary>
[Authorize]
public sealed class SceneHub(AppDbContext db, PermissionService perms, ScenePresence presence) : Hub
{
    public async Task JoinScene(Guid sceneId)
    {
        var scene = await db.Scenes.AsNoTracking().SingleOrDefaultAsync(s => s.Id == sceneId)
            ?? throw new HubException("Cena nÃ£o encontrada.");
        var userId = Context.User!.UserId();
        if (await perms.GetAccessAsync(scene.CommunityId, userId, Context.ConnectionAborted) is null)
            throw new HubException("VocÃª nÃ£o Ã© membro desta comunidade.");

        await Groups.AddToGroupAsync(Context.ConnectionId, SceneEvents.Group(sceneId));
        var online = presence.Join(sceneId, Context.ConnectionId, new PresenceDto(userId, Context.User!.Identity!.Name!));
        await Clients.Group(SceneEvents.Group(sceneId)).SendAsync(SceneEvents.Presence, sceneId, online);
    }

    public async Task LeaveScene(Guid sceneId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, SceneEvents.Group(sceneId));
        await Clients.Group(SceneEvents.Group(sceneId)).SendAsync(SceneEvents.Presence, sceneId, presence.Leave(sceneId, Context.ConnectionId));
    }

    /// <summary>Notifies the others that the user is typing as one of their characters in this scene.</summary>
    public async Task Typing(Guid sceneId, Guid characterId)
    {
        var userId = Context.User!.UserId();
        var name = await db.SceneParticipants
            .Where(p => p.SceneId == sceneId && p.CharacterId == characterId)
            .Join(db.Characters.Where(c => c.OwnerUserId == userId), p => p.CharacterId, c => c.Id, (p, c) => c.Name)
            .SingleOrDefaultAsync();
        if (name is null) return;
        await Clients.OthersInGroup(SceneEvents.Group(sceneId)).SendAsync(SceneEvents.Typing, new TypingDto(sceneId, userId, name));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var sceneId in presence.Disconnect(Context.ConnectionId))
            await Clients.Group(SceneEvents.Group(sceneId)).SendAsync(SceneEvents.Presence, sceneId, presence.Online(sceneId));
        await base.OnDisconnectedAsync(exception);
    }
}
