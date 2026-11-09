using System.Net;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Features.Scenes;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bookollab.Tests;

/// <summary>Milestone 2 scene rules: turns, participation, archive visibility, notifications, member removal.</summary>
public sealed class SceneRulesTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Player(HttpClient Client, Guid UserId, CharacterDto Character);

    private sealed record World(HttpClient Owner, Player A, Player B, Player Outsider, string Slug);

    private async Task<World> WorldAsync(JoinPolicy policy = JoinPolicy.Open)
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Regras {Guid.NewGuid():N}"[..14], null, null, policy))).ReadAsync<CommunityDetail>();
        async Task<Player> JoinedPlayerAsync(string name)
        {
            var (client, user) = await TestUsers.CreateClientAsync(factory);
            await client.PostAsync($"/communities/{community.Slug}/join", null);
            var character = await (await client.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest(name, [], false, true))).ReadAsync<CharacterDto>();
            return new Player(client, user.Id, character);
        }
        var a = await JoinedPlayerAsync("Ayla");
        var b = await JoinedPlayerAsync("Bran");
        var outsider = await JoinedPlayerAsync("Cora");
        return new World(owner, a, b, outsider, community.Slug);
    }

    private static async Task<SceneDetail> SceneAsync(World w, CreateSceneRequest? req = null) =>
        await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", req ?? new CreateSceneRequest("Taverna", null))).ReadAsync<SceneDetail>();

    private static Task<HttpResponseMessage> SendAsync(Player p, Guid sceneId, string text) =>
        p.Client.PostJsonAsync($"/scenes/{sceneId}/actions", new SendActionRequest(p.Character.Id, text));

    // ------------------------------------------------------------------ turns

    [Fact]
    public async Task Turns_follow_join_order_and_only_current_character_may_post()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w, new CreateSceneRequest("Duelo", null, SceneParticipation.Public, SceneWritingMode.Turns));
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.B.Character.Id));

        var detail = await (await w.A.Client.GetAsync($"/scenes/{scene.Id}")).ReadAsync<SceneDetail>();
        Assert.Equal(w.A.Character.Id, detail.CurrentTurnCharacterId); // first to join starts

        var outOfTurn = await SendAsync(w.B, scene.Id, "Ataco!");
        Assert.Equal(HttpStatusCode.Conflict, outOfTurn.StatusCode);
        (await SendAsync(w.A, scene.Id, "Saco a espada.")).EnsureSuccessStatusCode();
        (await SendAsync(w.B, scene.Id, "Defendo.")).EnsureSuccessStatusCode(); // now B's turn
        var back = await (await w.A.Client.GetAsync($"/scenes/{scene.Id}")).ReadAsync<SceneDetail>();
        Assert.Equal(w.A.Character.Id, back.CurrentTurnCharacterId); // wraps around

        // B was notified that it was their turn.
        var bNotifications = await (await w.B.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Contains(bNotifications.Items, n => n.Type == NotificationType.YourTurn && n.Link == $"/cenas/{scene.Id}");
    }

    [Fact]
    public async Task Turns_are_a_chat_setting_and_order_can_be_reorganized_and_skipped()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w);
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.B.Character.Id));

        // Players cannot change the chat settings.
        Assert.Equal(HttpStatusCode.Forbidden, (await w.A.Client.PutJsonAsync($"/scenes/{scene.Id}/settings",
            new UpdateSceneSettingsRequest(SceneWritingMode.Turns, null, SceneParticipation.Public, SceneArchiveVisibility.Community))).StatusCode);

        var turns = await (await w.Owner.PutJsonAsync($"/scenes/{scene.Id}/settings",
            new UpdateSceneSettingsRequest(SceneWritingMode.Turns, 60, SceneParticipation.Public, SceneArchiveVisibility.Community))).ReadAsync<SceneDetail>();
        Assert.Equal(w.A.Character.Id, turns.CurrentTurnCharacterId);
        Assert.NotNull(turns.TurnDeadline);

        var reordered = await (await w.Owner.PutJsonAsync($"/scenes/{scene.Id}/turn-order", new TurnOrderRequest([w.B.Character.Id, w.A.Character.Id]))).ReadAsync<SceneDetail>();
        Assert.Equal([w.B.Character.Id, w.A.Character.Id], reordered.Participants.Select(p => p.CharacterId));
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PutJsonAsync($"/scenes/{scene.Id}/turn-order", new TurnOrderRequest([w.B.Character.Id]))).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await w.A.Client.PostAsync($"/scenes/{scene.Id}/skip-turn", null)).StatusCode);
        var skipped = await (await w.Owner.PostAsync($"/scenes/{scene.Id}/skip-turn", null)).ReadAsync<SceneDetail>();
        Assert.NotEqual(turns.CurrentTurnCharacterId, skipped.CurrentTurnCharacterId);

        // Turning turns off returns to free writing.
        var free = await (await w.Owner.PutJsonAsync($"/scenes/{scene.Id}/settings",
            new UpdateSceneSettingsRequest(SceneWritingMode.Free, null, SceneParticipation.Public, SceneArchiveVisibility.Community))).ReadAsync<SceneDetail>();
        Assert.Null(free.CurrentTurnCharacterId);
        (await SendAsync(w.B, scene.Id, "Livre de novo")).EnsureSuccessStatusCode();
        (await SendAsync(w.B, scene.Id, "Duas seguidas")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Expired_turn_passes_to_the_next_character()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w, new CreateSceneRequest("Cerco", null, SceneParticipation.Public, SceneWritingMode.Turns, 5));
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.B.Character.Id));

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Scenes.Where(s => s.Id == scene.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.TurnStartedAt, DateTimeOffset.UtcNow.AddMinutes(-10)));
        }
        var advanced = await factory.Services.GetRequiredService<TurnTimeoutService>().RunOnceAsync(CancellationToken.None);

        Assert.True(advanced >= 1);
        var detail = await (await w.A.Client.GetAsync($"/scenes/{scene.Id}")).ReadAsync<SceneDetail>();
        Assert.Equal(w.B.Character.Id, detail.CurrentTurnCharacterId);
    }

    // ------------------------------------------------------------------ participation

    [Fact]
    public async Task Invite_only_scene_accepts_only_invited_characters()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w, new CreateSceneRequest("Conselho secreto", null, SceneParticipation.InviteOnly));

        Assert.Equal(HttpStatusCode.Forbidden, (await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/invites", new InviteCharacterRequest(w.A.Character.Id))).StatusCode);
        var invited = await (await w.Owner.PostJsonAsync($"/scenes/{scene.Id}/invites", new InviteCharacterRequest(w.A.Character.Id))).ReadAsync<SceneDetail>();
        Assert.Contains(w.A.Character.Id, invited.InvitedCharacterIds);

        (await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id))).EnsureSuccessStatusCode();
        var notifications = await (await w.A.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Contains(notifications.Items, n => n.Type == NotificationType.SceneInvite);
    }

    [Fact]
    public async Task Request_scene_creates_pending_request_that_opener_approves()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w, new CreateSceneRequest("Torneio", null, SceneParticipation.Request));

        var pending = await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        Assert.Equal(HttpStatusCode.Accepted, pending.StatusCode);
        Assert.Contains(w.A.Character.Id, (await pending.ReadAsync<SceneDetail>()).MyPendingCharacterIds);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(w.A, scene.Id, "Oi")).StatusCode);

        var requests = await (await w.Owner.GetAsync($"/scenes/{scene.Id}/join-requests")).ReadAsync<List<SceneJoinRequestDto>>();
        var request = Assert.Single(requests);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.B.Client.PostAsync($"/scene-join-requests/{request.Id}/approve", null)).StatusCode);
        (await w.Owner.PostAsync($"/scene-join-requests/{request.Id}/approve", null)).EnsureSuccessStatusCode();

        (await SendAsync(w.A, scene.Id, "Cheguei ao torneio.")).EnsureSuccessStatusCode();
        var aNotifications = await (await w.A.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Contains(aNotifications.Items, n => n.Type == NotificationType.SceneJoinDecision);
        var ownerNotifications = await (await w.Owner.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Contains(ownerNotifications.Items, n => n.Type == NotificationType.SceneJoinRequest);
    }

    [Fact]
    public async Task Closed_scene_visible_only_to_participants_when_configured()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w);
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        await w.Owner.PutJsonAsync($"/scenes/{scene.Id}/settings", new UpdateSceneSettingsRequest(SceneWritingMode.Free, null, SceneParticipation.Public, SceneArchiveVisibility.Participants));

        // While open, every member can read it.
        Assert.Equal(HttpStatusCode.OK, (await w.Outsider.Client.GetAsync($"/scenes/{scene.Id}")).StatusCode);
        await w.Owner.PostAsync($"/scenes/{scene.Id}/close", null);

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Outsider.Client.GetAsync($"/scenes/{scene.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Outsider.Client.GetAsync($"/scenes/{scene.Id}/actions")).StatusCode);
        Assert.DoesNotContain(await (await w.Outsider.Client.GetAsync($"/communities/{w.Slug}/scenes/")).ReadAsync<List<SceneSummary>>(), s => s.Id == scene.Id);
        Assert.Equal(HttpStatusCode.OK, (await w.A.Client.GetAsync($"/scenes/{scene.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await w.Owner.GetAsync($"/scenes/{scene.Id}")).StatusCode);
    }

    // ------------------------------------------------------------------ notifications & moderation

    [Fact]
    public async Task Notifications_can_be_marked_as_read()
    {
        var w = await WorldAsync();
        var scene = await SceneAsync(w, new CreateSceneRequest("Convite", null, SceneParticipation.InviteOnly));
        await w.Owner.PostJsonAsync($"/scenes/{scene.Id}/invites", new InviteCharacterRequest(w.A.Character.Id));

        var before = await (await w.A.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Equal(1, before.UnreadCount);
        (await w.A.Client.PostAsync($"/notifications/{before.Items[0].Id}/read", null)).EnsureSuccessStatusCode();
        var after = await (await w.A.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Equal(0, after.UnreadCount);
        Assert.True(after.Items[0].Read);
    }

    [Fact]
    public async Task Staff_removes_members_below_them_but_never_the_owner()
    {
        var w = await WorldAsync();
        var community = await (await w.Owner.GetAsync($"/communities/{w.Slug}")).ReadAsync<CommunityDetail>();
        var members = await (await w.Owner.GetAsync($"/communities/{w.Slug}/members")).ReadAsync<List<MemberDto>>();
        var ownerId = members.Single(m => m.BaseKind == BaseRoleKind.Owner).UserId;

        Assert.Equal(HttpStatusCode.Forbidden, (await w.A.Client.PostAsync($"/communities/{w.Slug}/members/{w.B.UserId}/remove", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Owner.PostAsync($"/communities/{w.Slug}/members/{ownerId}/remove", null)).StatusCode);
        (await w.Owner.PostAsync($"/communities/{w.Slug}/members/{w.B.UserId}/remove", null)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Forbidden, (await w.B.Client.GetAsync($"/communities/{w.Slug}/members")).StatusCode);
        var notifications = await (await w.B.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        Assert.Contains(notifications.Items, n => n.Type == NotificationType.RemovedFromCommunity && n.Title.Contains(community.Name));
    }
}

/// <summary>Guards against double-encoded UTF-8 ("mojibake") in user-facing strings.</summary>
public sealed class SourceEncodingTests
{
    [Fact]
    public void Api_source_has_no_double_encoded_accents()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "Bookollab.Api"))) dir = dir.Parent;
        Assert.NotNull(dir);

        var bad = Directory.EnumerateFiles(Path.Combine(dir!.FullName, "src", "Bookollab.Api"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"))
            .Where(f => File.ReadAllText(f).Contains('Ã')) // "Ã" is what "á/ã/ç/é…" turn into when double-encoded
            .Select(Path.GetFileName)
            .ToList();
        Assert.Empty(bad);
    }
}
