using System.Net;
using System.Net.Http.Headers;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Profile;
using Bookollab.Api.Features.Uploads;

namespace Bookollab.Tests;

public sealed class ProfileTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

    private static async Task<string> UploadAsync(HttpClient client)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Png);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", "a.png");
        return (await (await client.PostAsync("/uploads", form)).ReadAsync<UploadResponse>()).Key;
    }

    private static async Task<CommunityDetail> CommunityAsync(HttpClient owner) =>
        await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Perfis {Guid.NewGuid():N}"[..14], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();

    [Fact]
    public async Task Global_profile_shows_only_showcased_characters_and_respects_community_visibility()
    {
        var (owner, ownerUser) = await TestUsers.CreateClientAsync(factory, "Lucas");
        var (viewer, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CommunityAsync(owner);
        await owner.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Visível", [], true, true));
        await owner.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Sem origem", [], true, false));
        await owner.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Oculto", [], false, true));

        // A user outside the community can see the global profile.
        var profile = await (await viewer.GetAsync($"/users/{ownerUser.UserName}")).ReadAsync<GlobalProfileDto>();

        Assert.Equal("Lucas", profile.DisplayName);
        Assert.False(profile.IsMe);
        Assert.Equal(["Sem origem", "Visível"], profile.Showcase.Select(c => c.Name));
        Assert.Equal(community.Slug, profile.Showcase.Single(c => c.Name == "Visível").CommunitySlug);
        Assert.Null(profile.Showcase.Single(c => c.Name == "Sem origem").CommunityName);
        Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync("/users/ninguem_existe_aqui")).StatusCode);
    }

    [Fact]
    public async Task Community_profile_inherits_global_until_overridden_and_does_not_leak_to_other_communities()
    {
        var (owner, ownerUser) = await TestUsers.CreateClientAsync(factory, "Nome Global");
        var first = await CommunityAsync(owner);
        var second = await CommunityAsync(owner);

        var inherited = await (await owner.GetAsync($"/communities/{first.Slug}/members/{ownerUser.UserName}")).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Nome Global", inherited.Nickname);
        Assert.Null(inherited.OwnNickname);
        Assert.True(inherited.IsMe);
        Assert.Equal("Dono", inherited.RoleName);

        var avatar = await UploadAsync(owner);
        var cover = await UploadAsync(owner);
        var updated = await (await owner.PutJsonAsync($"/communities/{first.Slug}/me/profile",
            new UpdateCommunityProfileRequest("Rei Sombrio", "Bio desta comunidade", avatar, cover))).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Rei Sombrio", updated.Nickname);
        Assert.Equal(avatar, updated.AvatarKey);
        Assert.Equal(cover, updated.CoverKey);

        // The other community and the global profile stay unchanged.
        var other = await (await owner.GetAsync($"/communities/{second.Slug}/members/{ownerUser.UserName}")).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Nome Global", other.Nickname);
        var global = await (await owner.GetAsync($"/users/{ownerUser.UserName}")).ReadAsync<GlobalProfileDto>();
        Assert.Equal("Nome Global", global.DisplayName);

        // Members list shows the community nickname.
        var members = await (await owner.GetAsync($"/communities/{first.Slug}/members")).ReadAsync<List<MemberDto>>();
        Assert.Equal("Rei Sombrio", Assert.Single(members).DisplayName);

        // Clearing the nickname goes back to inheriting.
        var cleared = await (await owner.PutJsonAsync($"/communities/{first.Slug}/me/profile", new UpdateCommunityProfileRequest(null, null, null, null))).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Nome Global", cleared.Nickname);
    }

    [Fact]
    public async Task Community_profile_lists_characters_and_activity_and_is_members_only()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, playerUser) = await TestUsers.CreateClientAsync(factory);
        var (outsider, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CommunityAsync(owner);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        var character = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Ayla", [], false, true))).ReadAsync<CharacterDto>();
        await player.PostJsonAsync($"/communities/{community.Slug}/chapters/", new Bookollab.Api.Features.Chapters.CreateChapterRequest(character.Id, "Diário", "Hoje…", true));
        var scene = await (await owner.PostJsonAsync($"/communities/{community.Slug}/scenes/", new Bookollab.Api.Features.Scenes.CreateSceneRequest("Feira", null))).ReadAsync<Bookollab.Api.Features.Scenes.SceneDetail>();
        await player.PostJsonAsync($"/scenes/{scene.Id}/join", new Bookollab.Api.Features.Scenes.JoinSceneRequest(character.Id));

        var profile = await (await owner.GetAsync($"/communities/{community.Slug}/members/{playerUser.UserName}")).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Jogador", profile.RoleName);
        Assert.Equal("Ayla", Assert.Single(profile.Characters).Name);
        Assert.Equal("Diário", Assert.Single(profile.Chapters).Title);
        Assert.Equal("Feira", Assert.Single(profile.Scenes).Title);
        Assert.False(profile.IsMe);

        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/communities/{community.Slug}/members/{playerUser.UserName}")).StatusCode);
    }

    [Fact]
    public async Task Community_profile_images_must_belong_to_the_user()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CommunityAsync(owner);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        var ownersImage = await UploadAsync(owner);

        var response = await player.PutJsonAsync($"/communities/{community.Slug}/me/profile", new UpdateCommunityProfileRequest("X", null, ownersImage, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
