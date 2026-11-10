using System.Net;
using System.Net.Http.Json;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;

namespace Bookollab.Tests;

public sealed class CommunityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static string Unique(string prefix) => $"{prefix} {Guid.NewGuid().ToString("N")[..6]}";

    private static async Task<CommunityDetail> CreateCommunityAsync(HttpClient owner, JoinPolicy policy, string? name = null) =>
        await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest(name ?? Unique("Reino"), null, "Uma terra distante", policy)))
            .ReadAsync<CommunityDetail>();

    [Fact]
    public async Task Creator_becomes_owner_with_all_permissions()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);

        var community = await CreateCommunityAsync(owner, JoinPolicy.Open, "Crônicas de Âmbar");

        Assert.StartsWith("cronicas-de-ambar", community.Slug);
        Assert.Equal(BaseRoleKind.Owner, community.Me!.BaseKind);
        Assert.Contains(nameof(CommunityPermission.ManageRoles), community.Me.Permissions);
        Assert.Equal(1, community.MemberCount);
    }

    [Fact]
    public async Task Duplicate_custom_slug_is_rejected_and_auto_slug_gets_suffix()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var name = Unique("Mesmo Nome");
        var first = await CreateCommunityAsync(owner, JoinPolicy.Open, name);
        var second = await CreateCommunityAsync(owner, JoinPolicy.Open, name);

        Assert.Equal($"{first.Slug}-2", second.Slug);
        var dup = await owner.PostJsonAsync("/communities/", new CreateCommunityRequest(Unique("Outro"), first.Slug, null, JoinPolicy.Open));
        Assert.Equal(HttpStatusCode.BadRequest, dup.StatusCode);
    }

    [Fact]
    public async Task Open_community_join_makes_player_and_appears_in_discovery()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Open);

        var discovered = await (await player.GetAsync($"/communities/?search={Uri.EscapeDataString(community.Name)}")).ReadAsync<List<CommunitySummary>>();
        Assert.Contains(discovered, c => c.Slug == community.Slug);

        var join = await (await player.PostAsync($"/communities/{community.Slug}/join", null)).ReadAsync<JoinResponse>();
        Assert.Equal("member", join.Status);

        var detail = await (await player.GetAsync($"/communities/{community.Slug}")).ReadAsync<CommunityDetail>();
        Assert.Equal(BaseRoleKind.Player, detail.Me!.BaseKind);
        Assert.DoesNotContain(nameof(CommunityPermission.OpenScenes), detail.Me.Permissions);
        var mine = await (await player.GetAsync("/me/communities")).ReadAsync<List<CommunitySummary>>();
        Assert.Contains(mine, c => c.Slug == community.Slug);
    }

    [Fact]
    public async Task Request_community_needs_staff_approval()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (applicant, applicantUser) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Request);

        var join = await (await applicant.PostAsync($"/communities/{community.Slug}/join", null)).ReadAsync<JoinResponse>();
        Assert.Equal("pending", join.Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.GetAsync($"/communities/{community.Slug}/members")).StatusCode);
        Assert.True((await (await applicant.GetAsync($"/communities/{community.Slug}")).ReadAsync<CommunityDetail>()).HasPendingRequest);

        // Players cannot see the queue; the owner can approve.
        var requests = await (await owner.GetAsync($"/communities/{community.Slug}/join-requests")).ReadAsync<List<JoinRequestDto>>();
        var request = Assert.Single(requests);
        Assert.Equal(applicantUser.Id, request.UserId);
        (await owner.PostAsync($"/communities/{community.Slug}/join-requests/{request.Id}/approve", null)).EnsureSuccessStatusCode();

        var members = await (await applicant.GetAsync($"/communities/{community.Slug}/members")).ReadAsync<List<MemberDto>>();
        Assert.Equal(2, members.Count);
        Assert.Equal(HttpStatusCode.Forbidden, (await applicant.GetAsync($"/communities/{community.Slug}/join-requests")).StatusCode);
    }

    [Fact]
    public async Task Owner_reorders_sections_and_others_need_the_flag()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Open);
        Assert.Equal(CommunitySections.Default, community.Sections);

        var (staff, staffUser) = await TestUsers.CreateClientAsync(factory);
        await staff.PostAsync($"/communities/{community.Slug}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutJsonAsync($"/communities/{community.Slug}/sections", new UpdateSectionsRequest(["members"]))).StatusCode);

        var updated = await (await owner.PutJsonAsync($"/communities/{community.Slug}/sections", new UpdateSectionsRequest(["encyclopedia", "scenes"]))).ReadAsync<CommunityDetail>();
        Assert.Equal(["overview", "encyclopedia", "scenes", "chapters", "characters", "members"], updated.Sections); // overview stays first when omitted; missing ones go to the end
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutJsonAsync($"/communities/{community.Slug}/sections", new UpdateSectionsRequest(["shop"]))).StatusCode);

        var seen = await (await staff.GetAsync($"/communities/{community.Slug}")).ReadAsync<CommunityDetail>();
        Assert.Equal("encyclopedia", seen.Sections![1]);
    }

    [Fact]
    public async Task Discover_lists_open_and_request_communities_but_not_invite_only()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var tag = Unique("Busca");
        var open = await CreateCommunityAsync(owner, JoinPolicy.Open, $"{tag} A");
        var request = await CreateCommunityAsync(owner, JoinPolicy.Request, $"{tag} B");
        var invite = await CreateCommunityAsync(owner, JoinPolicy.InviteOnly, $"{tag} C");
        var (visitor, _) = await TestUsers.CreateClientAsync(factory);

        var found = await (await visitor.GetAsync($"/communities/?search={Uri.EscapeDataString(tag)}")).ReadAsync<List<CommunitySummary>>();
        Assert.Contains(found, c => c.Slug == open.Slug);
        Assert.Contains(found, c => c.Slug == request.Slug && c.JoinPolicy == JoinPolicy.Request);
        Assert.DoesNotContain(found, c => c.Slug == invite.Slug);
    }

    [Fact]
    public async Task Invite_only_community_rejects_join_and_accepts_invite_until_max_uses()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.InviteOnly);
        var (first, _) = await TestUsers.CreateClientAsync(factory);
        var (second, _) = await TestUsers.CreateClientAsync(factory);

        Assert.Equal(HttpStatusCode.Forbidden, (await first.PostAsync($"/communities/{community.Slug}/join", null)).StatusCode);
        Assert.DoesNotContain(await (await first.GetAsync("/communities/")).ReadAsync<List<CommunitySummary>>(), c => c.Slug == community.Slug);

        var invite = await (await owner.PostJsonAsync($"/communities/{community.Slug}/invites", new CreateInviteRequest(7, 1))).ReadAsync<InviteDto>();
        var preview = await (await first.GetAsync($"/invites/{invite.Code}")).ReadAsync<InvitePreview>();
        Assert.True(preview.Usable);
        Assert.Equal(community.Name, preview.CommunityName);

        Assert.Equal("member", (await (await first.PostAsync($"/invites/{invite.Code}/accept", null)).ReadAsync<JoinResponse>()).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await second.PostAsync($"/invites/{invite.Code}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task Players_cannot_create_invites_or_edit_sheet()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Open);
        await player.PostAsync($"/communities/{community.Slug}/join", null);

        Assert.Equal(HttpStatusCode.Forbidden, (await player.PostJsonAsync($"/communities/{community.Slug}/invites", new CreateInviteRequest(null, null))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await player.PutJsonAsync($"/communities/{community.Slug}/sheet-fields", new List<SheetFieldDto>())).StatusCode);
    }

    [Fact]
    public async Task Characters_follow_the_community_sheet()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Open);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        (await owner.PutJsonAsync($"/communities/{community.Slug}/sheet-fields", new List<SheetFieldDto>
        {
            new("race", "Raça", SheetFieldType.Text, true),
            new("age", "Idade", SheetFieldType.Number, false),
        })).EnsureSuccessStatusCode();

        var missing = await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("John Blackwood", [], true, true));
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("sheet.race", await missing.Content.ReadAsStringAsync());

        var notNumber = await player.PostJsonAsync($"/communities/{community.Slug}/characters/",
            new SaveCharacterRequest("John Blackwood", [new("race", "Humano"), new("age", "velho")], true, true));
        Assert.Equal(HttpStatusCode.BadRequest, notNumber.StatusCode);

        var created = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/",
            new SaveCharacterRequest("John Blackwood", [new("race", "Humano"), new("age", "34")], true, false))).ReadAsync<CharacterDto>();
        Assert.True(created.CanEdit);
        Assert.Equal(2, created.Sheet.Count);

        // The owner (ManageCharacters) can edit; another player cannot.
        var (other, _) = await TestUsers.CreateClientAsync(factory);
        await other.PostAsync($"/communities/{community.Slug}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutJsonAsync($"/characters/{created.Id}",
            new SaveCharacterRequest("Hackeado", [new("race", "Orc")], false, false))).StatusCode);
        var edited = await (await owner.PutJsonAsync($"/characters/{created.Id}",
            new SaveCharacterRequest("John B.", [new("race", "Humano")], true, true))).ReadAsync<CharacterDto>();
        Assert.Equal("John B.", edited.Name);

        var list = await (await other.GetAsync($"/communities/{community.Slug}/characters/")).ReadAsync<List<CharacterDto>>();
        Assert.Contains(list, c => c.Id == created.Id && !c.CanEdit);
    }

    [Fact]
    public async Task Non_members_cannot_see_characters()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (outsider, _) = await TestUsers.CreateClientAsync(factory);
        var community = await CreateCommunityAsync(owner, JoinPolicy.Open);

        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/communities/{community.Slug}/characters/")).StatusCode);
    }

    [Theory]
    [InlineData("Crônicas de Âmbar", "cronicas-de-ambar")]
    [InlineData("  RPG -- Medieval!! ", "rpg-medieval")]
    [InlineData("Ω", "comunidade")]
    public void Slugify_produces_url_safe_slugs(string name, string expected) =>
        Assert.Equal(expected, CommunityEndpoints.Slugify(name));
}
