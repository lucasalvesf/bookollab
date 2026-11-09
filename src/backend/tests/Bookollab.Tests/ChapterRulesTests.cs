using System.Net;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Notifications;
using Bookollab.Api.Features.Scenes;

namespace Bookollab.Tests;

/// <summary>Milestone 2 chapter rules: scene → chapter, letters with "@", staff approval.</summary>
public sealed class ChapterRulesTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Player(HttpClient Client, Guid UserId, CharacterDto Character);

    private sealed record World(HttpClient Owner, Player A, Player B, string Slug);

    private async Task<World> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Cap {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        async Task<Player> PlayerAsync(string name)
        {
            var (client, user) = await TestUsers.CreateClientAsync(factory);
            await client.PostAsync($"/communities/{community.Slug}/join", null);
            var character = await (await client.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest(name, [], false, true))).ReadAsync<CharacterDto>();
            return new Player(client, user.Id, character);
        }
        return new World(owner, await PlayerAsync("Ayla"), await PlayerAsync("John Blackwood"), community.Slug);
    }

    private static async Task<ChapterDetail> WriteAsync(Player p, string slug, string title, bool publish = true, List<Guid>? mentionCharacters = null, Guid? replyTo = null) =>
        await (await p.Client.PostJsonAsync($"/communities/{slug}/chapters",
            new CreateChapterRequest(p.Character.Id, title, "Texto do capítulo.", publish, MentionedCharacterIds: mentionCharacters, ReplyToChapterId: replyTo))).ReadAsync<ChapterDetail>();

    // ------------------------------------------------------------------ scene → chapter

    [Fact]
    public async Task Closed_scene_produces_a_draft_with_actions_and_coauthors()
    {
        var w = await WorldAsync();
        var scene = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/scenes/", new CreateSceneRequest("Taverna", null))).ReadAsync<SceneDetail>();
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.A.Character.Id));
        await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(w.B.Character.Id));
        await w.A.Client.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.A.Character.Id, "Entra na taverna."));
        await w.B.Client.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(w.B.Character.Id, "Levanta o copo."));

        Assert.Equal(HttpStatusCode.Conflict, (await w.A.Client.GetAsync($"/scenes/{scene.Id}/chapter-draft")).StatusCode); // still open
        await w.Owner.PostAsync($"/scenes/{scene.Id}/close", null);

        var draft = await (await w.A.Client.GetAsync($"/scenes/{scene.Id}/chapter-draft")).ReadAsync<SceneChapterDraftDto>();
        Assert.Contains("**Ayla:** Entra na taverna.", draft.Content);
        Assert.Contains("**John Blackwood:** Levanta o copo.", draft.Content);
        Assert.Equal(2, draft.Coauthors.Count);

        var (outsider, _) = await TestUsers.CreateClientAsync(factory);
        await outsider.PostAsync($"/communities/{w.Slug}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/scenes/{scene.Id}/chapter-draft")).StatusCode);

        var chapter = await (await w.A.Client.PostJsonAsync($"/communities/{w.Slug}/chapters",
            new CreateChapterRequest(w.A.Character.Id, draft.Title, draft.Content, true, scene.Id, [w.B.Character.Id]))).ReadAsync<ChapterDetail>();
        Assert.Equal(scene.Id, chapter.SourceSceneId);
        Assert.Equal("Taverna", chapter.SourceSceneTitle);
        Assert.Equal("John Blackwood", Assert.Single(chapter.Coauthors).Name);
    }

    [Fact]
    public async Task Coauthors_must_come_from_the_source_scene()
    {
        var w = await WorldAsync();
        var noScene = await w.A.Client.PostJsonAsync($"/communities/{w.Slug}/chapters", new CreateChapterRequest(w.A.Character.Id, "X", "Y", true, null, [w.B.Character.Id]));
        Assert.Equal(HttpStatusCode.BadRequest, noScene.StatusCode);
    }

    // ------------------------------------------------------------------ letters with @

    [Fact]
    public async Task Mentioned_character_owner_is_notified_and_can_reply()
    {
        var w = await WorldAsync();
        var letter = await WriteAsync(w.A, w.Slug, "Carta para John", mentionCharacters: [w.B.Character.Id]);
        Assert.Equal("John Blackwood", Assert.Single(letter.MentionedCharacters).Name);

        var notifications = await (await w.B.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>();
        var mention = Assert.Single(notifications.Items, n => n.Type == NotificationType.Mention);
        Assert.Equal($"/capitulos/{letter.Id}", mention.Link);
        Assert.True((await (await w.B.Client.GetAsync($"/chapters/{letter.Id}")).ReadAsync<ChapterDetail>()).MentionsMe);

        var reply = await WriteAsync(w.B, w.Slug, "Resposta a Ayla", mentionCharacters: [w.A.Character.Id], replyTo: letter.Id);
        Assert.Equal(letter.Id, reply.ReplyToChapterId);
        Assert.Equal("Carta para John", reply.ReplyToChapterTitle);
    }

    [Fact]
    public async Task Cannot_mention_characters_from_other_communities()
    {
        var w = await WorldAsync();
        var other = await WorldAsync();
        var response = await w.A.Client.PostJsonAsync($"/communities/{w.Slug}/chapters",
            new CreateChapterRequest(w.A.Character.Id, "X", "Y", true, MentionedCharacterIds: [other.A.Character.Id]));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ------------------------------------------------------------------ approval

    [Fact]
    public async Task Approval_for_everyone_hides_chapter_until_staff_approves()
    {
        var w = await WorldAsync();
        (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.All, []))).EnsureSuccessStatusCode();

        var chapter = await WriteAsync(w.A, w.Slug, "Aguardando", mentionCharacters: [w.B.Character.Id]);
        Assert.Equal(ChapterStatus.Pending, chapter.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await w.B.Client.GetAsync($"/chapters/{chapter.Id}")).StatusCode);
        Assert.DoesNotContain(await (await w.B.Client.GetAsync($"/communities/{w.Slug}/chapters")).ReadAsync<List<ChapterSummary>>(), c => c.Id == chapter.Id);
        // Mentions only notify once the chapter is published.
        Assert.DoesNotContain((await (await w.B.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>()).Items, n => n.Type == NotificationType.Mention);

        var queue = await (await w.Owner.GetAsync($"/communities/{w.Slug}/chapter-approvals")).ReadAsync<List<ChapterSummary>>();
        Assert.Contains(queue, c => c.Id == chapter.Id);
        Assert.Contains((await (await w.Owner.GetAsync("/notifications/")).ReadAsync<NotificationListDto>()).Items, n => n.Type == NotificationType.ChapterApproval);
        // A pending chapter is hidden from non-moderators, so for them it does not exist.
        Assert.Equal(HttpStatusCode.NotFound, (await w.B.Client.PostAsync($"/chapters/{chapter.Id}/approve", null)).StatusCode);

        var approved = await (await w.Owner.PostAsync($"/chapters/{chapter.Id}/approve", null)).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Published, approved.Status);
        Assert.Equal(HttpStatusCode.OK, (await w.B.Client.GetAsync($"/chapters/{chapter.Id}")).StatusCode);
        Assert.Contains((await (await w.B.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>()).Items, n => n.Type == NotificationType.Mention);
        Assert.Contains((await (await w.A.Client.GetAsync("/notifications/")).ReadAsync<NotificationListDto>()).Items, n => n.Type == NotificationType.ChapterDecision);
    }

    [Fact]
    public async Task Rejected_chapter_shows_reason_to_author_and_can_be_resubmitted()
    {
        var w = await WorldAsync();
        await w.Owner.PutJsonAsync($"/communities/{w.Slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.All, []));
        var chapter = await WriteAsync(w.A, w.Slug, "Rascunho fraco");

        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PostJsonAsync($"/chapters/{chapter.Id}/reject", new RejectChapterRequest(""))).StatusCode);
        var rejected = await (await w.Owner.PostJsonAsync($"/chapters/{chapter.Id}/reject", new RejectChapterRequest("Revise a ortografia."))).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Rejected, rejected.Status);

        var asAuthor = await (await w.A.Client.GetAsync($"/chapters/{chapter.Id}")).ReadAsync<ChapterDetail>();
        Assert.Equal("Revise a ortografia.", asAuthor.RejectionReason);
        await w.A.Client.PutJsonAsync($"/chapters/{chapter.Id}", new UpdateChapterRequest("Rascunho revisado", "Texto corrigido."));
        var resubmitted = await (await w.A.Client.PostAsync($"/chapters/{chapter.Id}/publish", null)).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Pending, resubmitted.Status);
        Assert.Null(resubmitted.RejectionReason);
    }

    [Fact]
    public async Task Approval_by_role_only_affects_selected_roles_and_staff_is_exempt()
    {
        var w = await WorldAsync();
        var config = await (await w.Owner.GetAsync($"/communities/{w.Slug}/chapter-approval")).ReadAsync<ChapterApprovalConfigDto>();
        var narrator = config.Roles.Single(r => r.BaseKind == BaseRoleKind.Narrator);
        (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.Roles, [narrator.Id]))).EnsureSuccessStatusCode();

        // Players are not in the selected role: published directly.
        Assert.Equal(ChapterStatus.Published, (await WriteAsync(w.A, w.Slug, "Livre")).Status);

        // The owner (moderator) is never queued, even with approval for everyone.
        await w.Owner.PutJsonAsync($"/communities/{w.Slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.All, []));
        var ownerCharacter = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/characters/", new SaveCharacterRequest("Narradora", [], false, true))).ReadAsync<CharacterDto>();
        var ownerChapter = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/chapters", new CreateChapterRequest(ownerCharacter.Id, "Da staff", "Texto", true))).ReadAsync<ChapterDetail>();
        Assert.Equal(ChapterStatus.Published, ownerChapter.Status);

        Assert.Equal(HttpStatusCode.Forbidden, (await w.A.Client.PutJsonAsync($"/communities/{w.Slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.Off, []))).StatusCode);
    }
}
