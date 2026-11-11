using System.Net;
using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Chapters;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Featured;

namespace Bookollab.Tests;

/// <summary>Blogs (OFF posts in the blog format) and the Amino-like highlights of the community home.</summary>
public sealed class BlogFeaturedTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(HttpClient Owner, HttpClient Player, string Slug)> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Blog {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        return (owner, player, community.Slug);
    }

    [Fact]
    public async Task Blog_is_written_as_the_player_and_skips_chapter_approval()
    {
        var (owner, player, slug) = await WorldAsync();
        await owner.PutJsonAsync($"/communities/{slug}/chapter-approval", new ChapterApprovalSettingsDto(ChapterApprovalMode.All, []));

        var blog = await (await player.PostJsonAsync($"/communities/{slug}/chapters",
            new CreateChapterRequest(null, "Aviso OFF", "Volto semana que vem!\n\n![](foto)", true, Kind: PostKind.Blog, MusicUrl: "https://www.youtube.com/watch?v=abc"))).ReadAsync<ChapterDetail>();
        Assert.Equal(PostKind.Blog, blog.Kind);
        Assert.Equal(ChapterStatus.Published, blog.Status); // approval is for chapters only
        Assert.Null(blog.CharacterId);
        Assert.Equal("https://www.youtube.com/watch?v=abc", blog.MusicUrl);

        var list = await (await owner.GetAsync($"/communities/{slug}/chapters?kind=Blog")).ReadAsync<List<ChapterSummary>>();
        var summary = Assert.Single(list);
        Assert.Equal("Volto semana que vem!", summary.Excerpt); // image markup is not part of the excerpt

        Assert.Equal(HttpStatusCode.BadRequest, (await player.PostJsonAsync($"/communities/{slug}/chapters",
            new CreateChapterRequest(null, "Sem personagem", "Texto", true))).StatusCode); // a chapter still needs a character
        Assert.Equal(HttpStatusCode.BadRequest, (await player.PostJsonAsync($"/communities/{slug}/chapters",
            new CreateChapterRequest(null, "Música", "Texto", true, Kind: PostKind.Blog, MusicUrl: "https://example.com/song.mp3"))).StatusCode);
    }

    [Fact]
    public async Task Moderation_features_posts_and_sheets_in_chosen_order()
    {
        var (owner, player, slug) = await WorldAsync();
        var character = await (await player.PostJsonAsync($"/communities/{slug}/characters/", new SaveCharacterRequest("Ayla", [], false, true))).ReadAsync<CharacterDto>();
        var chapter = await (await player.PostJsonAsync($"/communities/{slug}/chapters", new CreateChapterRequest(character.Id, "Capítulo", "Texto.", true))).ReadAsync<ChapterDetail>();
        var draft = await (await player.PostJsonAsync($"/communities/{slug}/chapters", new CreateChapterRequest(character.Id, "Rascunho", "Texto.", false))).ReadAsync<ChapterDetail>();

        Assert.Equal(HttpStatusCode.Forbidden, (await player.PostJsonAsync($"/communities/{slug}/featured", new FeatureRequest(FeaturedItemType.Post, chapter.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostJsonAsync($"/communities/{slug}/featured", new FeatureRequest(FeaturedItemType.Post, draft.Id))).StatusCode);

        await owner.PostJsonAsync($"/communities/{slug}/featured", new FeatureRequest(FeaturedItemType.Post, chapter.Id));
        var featured = await (await owner.PostJsonAsync($"/communities/{slug}/featured", new FeatureRequest(FeaturedItemType.Character, character.Id))).ReadAsync<List<FeaturedDto>>();
        Assert.Equal(["Ayla", "Capítulo"], featured.Select(f => f.Title)); // newest highlight first

        var reordered = await (await owner.PutJsonAsync($"/communities/{slug}/featured/order", new FeaturedOrderRequest([featured[1].Id, featured[0].Id]))).ReadAsync<List<FeaturedDto>>();
        Assert.Equal(["Capítulo", "Ayla"], reordered.Select(f => f.Title));
        Assert.True((await (await owner.GetAsync($"/chapters/{chapter.Id}")).ReadAsync<ChapterDetail>()).IsFeatured);

        var afterRemove = await (await owner.DeleteAsync($"/communities/{slug}/featured/{reordered[0].Id}")).ReadAsync<List<FeaturedDto>>();
        Assert.Equal("Ayla", Assert.Single(afterRemove).Title);
        Assert.Equal("Ayla", Assert.Single(await (await player.GetAsync($"/communities/{slug}/featured")).ReadAsync<List<FeaturedDto>>()).Title);
    }

    [Fact]
    public async Task Owner_chooses_the_feed_layout()
    {
        var (owner, player, slug) = await WorldAsync();
        Assert.Equal(FeedLayout.Highlight, (await (await owner.GetAsync($"/communities/{slug}")).ReadAsync<CommunityDetail>()).FeedLayout);
        Assert.Equal(HttpStatusCode.Forbidden, (await player.PutJsonAsync($"/communities/{slug}/feed-layout", new FeedLayoutRequest(FeedLayout.Gallery))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.PutJsonAsync($"/communities/{slug}/feed-layout", new FeedLayoutRequest(FeedLayout.Gallery))).StatusCode);
        Assert.Equal(FeedLayout.Gallery, (await (await player.GetAsync($"/communities/{slug}")).ReadAsync<CommunityDetail>()).FeedLayout);
    }
}
