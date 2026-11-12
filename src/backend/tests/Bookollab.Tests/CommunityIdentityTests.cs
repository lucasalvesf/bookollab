using System.Net;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.CommunityHome;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Links;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Features.Presence;
using Bookollab.Api.Features.Scenes;

namespace Bookollab.Tests;

/// <summary>Community color and home, pinned posts, side menu, links (@), OffGame chats, notifications per community, presence privacy.</summary>
public sealed class CommunityIdentityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record World(HttpClient Owner, HttpClient Player, Guid PlayerId, CharacterDto Character, string Slug, Guid CommunityId);

    private async Task<World> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Id {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        var (player, user) = await TestUsers.CreateClientAsync(factory);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        var character = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Amberly Hoff", [], false, true))).ReadAsync<CharacterDto>();
        return new World(owner, player, user.Id, character, community.Slug, community.Id);
    }

    [Fact]
    public async Task Moderation_sets_the_community_color_and_home_layout()
    {
        var w = await WorldAsync();
        var theme = await (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/theme", new UpdateCommunityThemeRequest("#0891b2", HomeLayout.FeaturedSide))).ReadAsync<CommunityThemeDto>();
        Assert.Equal("#0891B2", theme.AccentColor);

        var detail = await (await w.Player.GetAsync($"/communities/{w.Slug}")).ReadAsync<CommunityDetail>();
        Assert.Equal("#0891B2", detail.AccentColor);
        Assert.Equal(HomeLayout.FeaturedSide, detail.HomeLayout);

        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/theme", new UpdateCommunityThemeRequest("azul", HomeLayout.Stacked))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PutJsonAsync($"/communities/{w.Slug}/theme", new UpdateCommunityThemeRequest("#000000", HomeLayout.Stacked))).StatusCode);
    }

    [Fact]
    public async Task Moderators_pin_published_posts_and_players_cannot()
    {
        var w = await WorldAsync();
        var post = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters", new CreateChapterRequest(w.Character.Id, "Regras da casa", "Leia antes de jogar.", true))).ReadAsync<ChapterDetail>();
        var draft = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/chapters", new CreateChapterRequest(w.Character.Id, "Rascunho", "Ainda não.", false))).ReadAsync<ChapterDetail>();

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/communities/{w.Slug}/pins", new PinPostRequest(post.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/pins", new PinPostRequest(draft.Id))).StatusCode);

        var pins = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/pins", new PinPostRequest(post.Id))).ReadAsync<List<PinnedPostDto>>();
        Assert.Equal("Regras da casa", Assert.Single(pins).Title);
        Assert.Single(await (await w.Player.GetAsync($"/communities/{w.Slug}/pins")).ReadAsync<List<PinnedPostDto>>());

        Assert.Empty(await (await w.Owner.DeleteAsync($"/communities/{w.Slug}/pins/{post.Id}")).ReadAsync<List<PinnedPostDto>>());
    }

    [Fact]
    public async Task Side_menu_renames_sections_and_links_anything_in_the_community()
    {
        var w = await WorldAsync();
        var menu = new SideMenuDto(
            [CommunitySections.Encyclopedia, CommunitySections.Overview, CommunitySections.Scenes],
            new Dictionary<string, string> { [CommunitySections.Encyclopedia] = "Wiki do reino" },
            [new SideMenuGroupDto("Guias", [new SideMenuLinkDto("Amberly", $"character:{w.Character.Id}"), new SideMenuLinkDto("Discord", "url:https://discord.gg/x")])]);
        var saved = await (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/side-menu", menu)).ReadAsync<SideMenuDto>();
        Assert.Equal(CommunitySections.Encyclopedia, saved.Sections[0]);
        Assert.Equal(2, Assert.Single(saved.Groups).Links.Count);

        var detail = await (await w.Player.GetAsync($"/communities/{w.Slug}")).ReadAsync<CommunityDetail>();
        Assert.Equal("Wiki do reino", detail.SectionTitles![CommunitySections.Encyclopedia]);
        Assert.Equal("Guias", Assert.Single((await (await w.Player.GetAsync($"/communities/{w.Slug}/side-menu")).ReadAsync<SideMenuDto>()).Groups).Title);

        var invalid = menu with { Groups = [new SideMenuGroupDto("X", [new SideMenuLinkDto("Ruim", "javascript:alert(1)")])] };
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/side-menu", invalid)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PutJsonAsync($"/communities/{w.Slug}/side-menu", menu)).StatusCode);
    }

    [Fact]
    public async Task Linkables_search_characters_chats_and_members_by_name()
    {
        var w = await WorldAsync();
        await w.Player.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Astral Chat", null, Kind: SceneKind.Chat));

        var found = await (await w.Player.GetAsync($"/communities/{w.Slug}/linkables?q=a")).ReadAsync<List<LinkableDto>>();
        Assert.Contains(found, l => l.Kind == "character" && l.Label == "Amberly Hoff" && l.Target == $"character:{w.Character.Id}");
        Assert.Contains(found, l => l.Kind == "chat" && l.Label == "Astral Chat" && l.Tag == "Off");

        var (outsider, _) = await TestUsers.CreateClientAsync(factory);
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/communities/{w.Slug}/linkables?q=a")).StatusCode);
    }

    [Fact]
    public async Task Public_chats_are_offgame_any_member_creates_and_writes_as_themselves()
    {
        var w = await WorldAsync();
        // Players can't open scenes (narrators do), but can open public OffGame chats.
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Cena", null))).StatusCode);
        var chat = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Conversa geral", null, SceneParticipation.InviteOnly, Kind: SceneKind.Chat))).ReadAsync<SceneDetail>();
        Assert.Equal(SceneKind.Chat, chat.Kind);
        Assert.Equal(SceneParticipation.Public, chat.Participation); // always open to every member
        Assert.True(chat.CanSend);
        Assert.False(chat.CanJoin);

        var message = await (await w.Owner.PostJsonAsync($"/scenes/{chat.Id}/actions", new SendActionRequest(null, "Bem-vindos!"))).ReadAsync<SceneActionDto>();
        Assert.Null(message.CharacterId);
        Assert.False(string.IsNullOrWhiteSpace(message.CharacterName)); // the author's community name

        var list = await (await w.Player.GetAsync($"/scenes/{chat.Id}/actions")).ReadAsync<List<SceneActionDto>>();
        Assert.Equal("Bem-vindos!", Assert.Single(list).Content);
        var scenes = await (await w.Player.GetAsync($"/communities/{w.Slug}/scenes/")).ReadAsync<List<SceneSummary>>();
        Assert.Equal(SceneKind.Chat, Assert.Single(scenes).Kind);
    }

    [Fact]
    public async Task Notifications_filter_by_community_and_count_unread_per_community()
    {
        var w = await WorldAsync();
        var post = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/characters/", new SaveCharacterRequest("Narrador", [], false, true))).ReadAsync<CharacterDto>();
        await w.Owner.PostJsonAsync($"/communities/{w.Slug}/chapters", new CreateChapterRequest(post.Id, "Carta", "Para você.", true, MentionedCharacterIds: [w.Character.Id]));

        var mine = await (await w.Player.GetAsync($"/notifications/?communityId={w.CommunityId}")).ReadAsync<NotificationListDto>();
        Assert.Equal(1, mine.UnreadCount);
        var other = await (await w.Player.GetAsync($"/notifications/?communityId={Guid.NewGuid()}")).ReadAsync<NotificationListDto>();
        Assert.Empty(other.Items);
        var byCommunity = await (await w.Player.GetAsync("/notifications/unread-by-community")).ReadAsync<List<UnreadByCommunityDto>>();
        Assert.Equal(1, Assert.Single(byCommunity, x => x.CommunityId == w.CommunityId).Count);
    }

    [Fact]
    public async Task Presence_follows_privacy_and_is_reciprocal()
    {
        var w = await WorldAsync();
        var members = await (await w.Owner.GetAsync($"/communities/{w.Slug}/members")).ReadAsync<List<MemberDto>>();
        var player = Assert.Single(members, m => m.UserId == w.PlayerId);
        Assert.NotNull(player.Presence);
        Assert.False(player.Presence!.Online); // no realtime connection in tests

        await w.Player.PutJsonAsync("/me/privacy", new PrivacySettings(PresenceVisibility.Nobody, PresenceVisibility.Nobody));
        player = Assert.Single(await (await w.Owner.GetAsync($"/communities/{w.Slug}/members")).ReadAsync<List<MemberDto>>(), m => m.UserId == w.PlayerId);
        Assert.Null(player.Presence!.Online);
        Assert.Null(player.Presence.LastSeenAt);

        // Reciprocity: the player hid theirs, so they don't see the owner's either.
        var owner = Assert.Single(await (await w.Player.GetAsync($"/communities/{w.Slug}/members")).ReadAsync<List<MemberDto>>(), m => m.UserId != w.PlayerId);
        Assert.Null(owner.Presence!.Online);
        Assert.Equal(PresenceVisibility.Nobody, (await (await w.Player.GetAsync("/me/privacy")).ReadAsync<PrivacySettings>()).OnlineVisibility);
    }
}
