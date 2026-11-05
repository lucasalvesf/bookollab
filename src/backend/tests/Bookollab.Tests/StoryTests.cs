using System.Net;
using System.Text.Json.Serialization;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Scenes;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace Bookollab.Tests;

public sealed class StoryTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record World(HttpClient Owner, HttpClient Player, HttpClient Other, string Slug, CharacterDto OwnerChar, CharacterDto PlayerChar);

    /// <summary>Open community with an owner, two players, and one character each for owner and player.</summary>
    private async Task<World> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var (other, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/",
            new CreateCommunityRequest($"Mundo {Guid.NewGuid():N}"[..14], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        await other.PostAsync($"/communities/{community.Slug}/join", null);
        var ownerChar = await (await owner.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Narradora", [], false, true))).ReadAsync<CharacterDto>();
        var playerChar = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("John Blackwood", [], false, true))).ReadAsync<CharacterDto>();
        return new World(owner, player, other, community.Slug, ownerChar, playerChar);
    }

    private HubConnection Hub(HttpClient client)
    {
        var token = client.DefaultRequestHeaders.Authorization!.Parameter!;
        return new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, "/hubs/scenes"), o =>
            {
                o.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .Build();
    }

    // ------------------------------------------------------------------ scenes

    [Fact]
    public async Task Only_staff_and_narrators_open_scenes_by_default()
    {
        var w = await WorldAsync();
        var denied = await w.Player.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Taverna", null));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Taverna", "Noite de chuva"))).ReadAsync<SceneDetail>();
        Assert.Equal(SceneStatus.Open, scene.Status);
        Assert.Equal(SceneWritingMode.Free, scene.WritingMode);
        var list = await (await w.Player.GetAsync($"/communities/{w.Slug}/scenes/")).ReadAsync<List<SceneSummary>>();
        Assert.Contains(list, s => s.Id == scene.Id);
    }

    [Fact]
    public async Task Players_join_with_own_character_and_actions_are_broadcast_live()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Taverna", null))).ReadAsync<SceneDetail>();

        // Cannot join with someone else's character, nor send before joining.
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.OwnerChar.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.PlayerChar.Id, "Oi"))).StatusCode);

        // The owner watches the scene in realtime.
        await using var watcher = Hub(w.Owner);
        var received = new TaskCompletionSource<SceneActionDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        var presence = new TaskCompletionSource<List<PresenceDto>>(TaskCreationOptions.RunContinuationsAsynchronously);
        watcher.On<SceneActionDto>(SceneEvents.ActionCreated, a => received.TrySetResult(a));
        watcher.On<Guid, List<PresenceDto>>(SceneEvents.Presence, (_, online) => presence.TrySetResult(online));
        await watcher.StartAsync();
        await watcher.InvokeAsync("JoinScene", scene.Id);
        Assert.Single(await presence.Task.WaitAsync(TimeSpan.FromSeconds(10)));

        var joined = await (await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.PlayerChar.Id))).ReadAsync<SceneDetail>();
        Assert.Contains(joined.Participants, p => p.CharacterId == w.PlayerChar.Id);
        var sent = await (await w.Player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.PlayerChar.Id, "  Entra na taverna, encharcado.  "))).ReadAsync<SceneActionDto>();

        var live = await received.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(sent.Id, live.Id);
        Assert.Equal("Entra na taverna, encharcado.", live.Content);
        Assert.Equal("John Blackwood", live.CharacterName);
    }

    [Fact]
    public async Task Typing_is_sent_to_others_and_non_members_cannot_subscribe()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Floresta", null))).ReadAsync<SceneDetail>();
        await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.PlayerChar.Id));

        await using var ownerHub = Hub(w.Owner);
        await using var playerHub = Hub(w.Player);
        var typing = new TaskCompletionSource<TypingDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        ownerHub.On<TypingDto>(SceneEvents.Typing, t => typing.TrySetResult(t));
        await ownerHub.StartAsync();
        await playerHub.StartAsync();
        await ownerHub.InvokeAsync("JoinScene", scene.Id);
        await playerHub.InvokeAsync("JoinScene", scene.Id);
        await playerHub.InvokeAsync("Typing", scene.Id, w.PlayerChar.Id);
        Assert.Equal("John Blackwood", (await typing.Task.WaitAsync(TimeSpan.FromSeconds(10))).CharacterName);

        var (outsider, _) = await TestUsers.CreateClientAsync(factory);
        await using var outsiderHub = Hub(outsider);
        await outsiderHub.StartAsync();
        await Assert.ThrowsAsync<HubException>(() => outsiderHub.InvokeAsync("JoinScene", scene.Id));
    }

    [Fact]
    public async Task Editing_keeps_history_for_staff_and_delete_is_soft()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Porto", null))).ReadAsync<SceneDetail>();
        await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.PlayerChar.Id));
        var action = await (await w.Player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.PlayerChar.Id, "v1"))).ReadAsync<SceneActionDto>();

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Owner.PutJsonAsync($"/actions/{action.Id}", new EditActionRequest("hack"))).StatusCode);
        var edited = await (await w.Player.PutJsonAsync($"/actions/{action.Id}", new EditActionRequest("v2"))).ReadAsync<SceneActionDto>();
        Assert.NotNull(edited.EditedAt);

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.GetAsync($"/actions/{action.Id}/revisions")).StatusCode);
        var history = await (await w.Owner.GetAsync($"/actions/{action.Id}/revisions")).ReadAsync<List<RevisionDto>>();
        Assert.Equal(["v1", "v2"], history.Select(h => h.Content));

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Other.DeleteAsync($"/actions/{action.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await w.Owner.DeleteAsync($"/actions/{action.Id}")).StatusCode); // moderator
        var actions = await (await w.Player.GetAsync($"/scenes/{scene.Id}/actions")).ReadAsync<List<SceneActionDto>>();
        var deleted = Assert.Single(actions);
        Assert.True(deleted.Deleted);
        Assert.Null(deleted.Content);
    }

    [Fact]
    public async Task Closing_is_limited_and_closed_scene_rejects_actions()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Castelo", null))).ReadAsync<SceneDetail>();
        await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.PlayerChar.Id));

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostAsync($"/scenes/{scene.Id}/close", null)).StatusCode);
        var closed = await (await w.Owner.PostAsync($"/scenes/{scene.Id}/close", null)).ReadAsync<SceneDetail>();
        Assert.Equal(SceneStatus.Closed, closed.Status);
        Assert.NotNull(closed.ClosedAt);

        var late = await w.Player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.PlayerChar.Id, "Tarde demais"));
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
    }

    [Fact]
    public async Task Action_pages_are_chronological()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Mercado", null))).ReadAsync<SceneDetail>();
        await w.Player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.PlayerChar.Id));
        for (var i = 1; i <= 5; i++)
            await w.Player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.PlayerChar.Id, $"ação {i}"));

        var latest = await (await w.Player.GetAsync($"/scenes/{scene.Id}/actions?limit=3")).ReadAsync<List<SceneActionDto>>();
        Assert.Equal(["ação 3", "ação 4", "ação 5"], latest.Select(a => a.Content));
        var older = await (await w.Player.GetAsync($"/scenes/{scene.Id}/actions?limit=3&before={Uri.EscapeDataString(latest[0].CreatedAt.ToString("O"))}")).ReadAsync<List<SceneActionDto>>();
        Assert.Equal(["ação 1", "ação 2"], older.Select(a => a.Content));
    }

    // ------------------------------------------------------------------ chapters

    [Fact]
    public async Task Drafts_are_private_until_published()
    {
        var w = await WorldAsync();
        var draft = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters/",
            new CreateChapterRequest(w.PlayerChar.Id, "Carta para casa", "Querida mãe...", false))).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Draft, draft.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await w.Other.GetAsync($"/chapters/{draft.Id}")).StatusCode);
        Assert.DoesNotContain(await (await w.Other.GetAsync($"/communities/{w.Slug}/chapters/")).ReadAsync<List<ChapterSummary>>(), c => c.Id == draft.Id);

        var published = await (await w.Player.PostAsync($"/chapters/{draft.Id}/publish", null)).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Published, published.Status);
        var list = await (await w.Other.GetAsync($"/communities/{w.Slug}/chapters/")).ReadAsync<List<ChapterSummary>>();
        Assert.Contains(list, c => c.Id == draft.Id && c.CharacterName == "John Blackwood");
    }

    [Fact]
    public async Task Cannot_write_with_someone_elses_character()
    {
        var w = await WorldAsync();
        var response = await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters/",
            new CreateChapterRequest(w.OwnerChar.Id, "Falso", "Texto", true));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Editing_published_chapter_marks_edited_and_keeps_history()
    {
        var w = await WorldAsync();
        var chapter = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters/",
            new CreateChapterRequest(w.PlayerChar.Id, "Capítulo 1", "Era uma vez.", true))).ReadAsync<ChapterDetail>();

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Other.PutJsonAsync($"/chapters/{chapter.Id}", new UpdateChapterRequest("x", "y"))).StatusCode);
        var edited = await (await w.Player.PutJsonAsync($"/chapters/{chapter.Id}", new UpdateChapterRequest("Capítulo 1", "Era uma vez, num reino distante."))).ReadAsync<ChapterDetail>();
        Assert.NotNull(edited.EditedAt);

        // The owner has EditOthersChapters by default; staff see the history.
        Assert.True((await (await w.Owner.GetAsync($"/chapters/{chapter.Id}")).ReadAsync<ChapterDetail>()).CanEdit);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Other.GetAsync($"/chapters/{chapter.Id}/revisions")).StatusCode);
        var history = await (await w.Owner.GetAsync($"/chapters/{chapter.Id}/revisions")).ReadAsync<List<ChapterRevisionDto>>();
        Assert.Equal(["Era uma vez.", "Era uma vez, num reino distante."], history.Select(h => h.Content));
    }

    [Fact]
    public async Task Deleted_chapter_disappears_but_only_author_or_moderator_can_delete()
    {
        var w = await WorldAsync();
        var chapter = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters/",
            new CreateChapterRequest(w.PlayerChar.Id, "Para apagar", "Texto", true))).ReadAsync<ChapterDetail>();

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Other.DeleteAsync($"/chapters/{chapter.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await w.Player.DeleteAsync($"/chapters/{chapter.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await w.Owner.GetAsync($"/chapters/{chapter.Id}")).StatusCode);
    }
}
