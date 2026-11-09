using System.Net;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Home;
using Bookollab.Api.Features.Scenes;

namespace Bookollab.Tests;

/// <summary>Start screen (latest chapters, live scenes, encyclopedia highlights), its layout, and leaving a community.</summary>
public sealed class HomeTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Home_shows_content_only_from_my_communities()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var mine = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Home {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        var character = await (await owner.PostJsonAsync($"/communities/{mine.Slug}/characters/", new SaveCharacterRequest("Ayla", [], false, true))).ReadAsync<CharacterDto>();
        await owner.PostJsonAsync($"/communities/{mine.Slug}/chapters", new CreateChapterRequest(character.Id, "Publicado", "Texto do capítulo.", true));
        await owner.PostJsonAsync($"/communities/{mine.Slug}/chapters", new CreateChapterRequest(character.Id, "Rascunho", "Texto.", false));
        var scene = await (await owner.PostJsonAsync($"/communities/{mine.Slug}/scenes/", new CreateSceneRequest("Ao vivo", null))).ReadAsync<SceneDetail>();

        var (stranger, _) = await TestUsers.CreateClientAsync(factory);
        var other = await (await stranger.PostJsonAsync("/communities/", new CreateCommunityRequest($"Outra {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        var otherCharacter = await (await stranger.PostJsonAsync($"/communities/{other.Slug}/characters/", new SaveCharacterRequest("Fora", [], false, true))).ReadAsync<CharacterDto>();
        await stranger.PostJsonAsync($"/communities/{other.Slug}/chapters", new CreateChapterRequest(otherCharacter.Id, "De fora", "Texto.", true));

        var home = await (await owner.GetAsync("/me/home")).ReadAsync<HomeDto>();
        Assert.Equal(HomeEndpoints.AllSections, home.Sections);
        Assert.Equal("Publicado", Assert.Single(home.Chapters).Title);
        Assert.Equal(scene.Id, Assert.Single(home.Scenes).Id);
        Assert.Contains(home.Entries, e => e.IsCharacter && e.Name == "Ayla");
        Assert.DoesNotContain(home.Entries, e => e.Name == "Fora");
    }

    [Fact]
    public async Task User_chooses_home_sections_and_order()
    {
        var (client, _) = await TestUsers.CreateClientAsync(factory);
        var saved = await (await client.PutJsonAsync("/me/home-sections", new UpdateHomeSectionsRequest(["encyclopedia", "chapters"]))).ReadAsync<List<string>>();
        Assert.Equal(["encyclopedia", "chapters"], saved);
        Assert.Equal(["encyclopedia", "chapters"], (await (await client.GetAsync("/me/home")).ReadAsync<HomeDto>()).Sections);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutJsonAsync("/me/home-sections", new UpdateHomeSectionsRequest([]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutJsonAsync("/me/home-sections", new UpdateHomeSectionsRequest(["ads"]))).StatusCode);
    }

    [Fact]
    public async Task Members_can_leave_but_owner_cannot_and_my_communities_carry_permissions()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Sair {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        await player.PostAsync($"/communities/{community.Slug}/join", null);

        var ownerList = await (await owner.GetAsync("/me/communities")).ReadAsync<List<CommunitySummary>>();
        Assert.Contains("ManageCommunity", ownerList.Single(c => c.Slug == community.Slug).MyPermissions!);
        var playerList = await (await player.GetAsync("/me/communities")).ReadAsync<List<CommunitySummary>>();
        Assert.DoesNotContain("ManageCommunity", playerList.Single(c => c.Slug == community.Slug).MyPermissions!);

        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/communities/{community.Slug}/leave", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await player.PostAsync($"/communities/{community.Slug}/leave", null)).StatusCode);
        Assert.DoesNotContain(await (await player.GetAsync("/me/communities")).ReadAsync<List<CommunitySummary>>(), c => c.Slug == community.Slug);
    }
}
