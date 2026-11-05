using System.Net;
using System.Net.Http.Headers;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Profile;
using Bookollab.Api.Features.Scenes;
using Bookollab.Api.Features.Uploads;

namespace Bookollab.Tests;

public sealed class UploadTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    // Smallest valid PNG (1x1 transparent pixel).
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, byte[] bytes, string fileName = "img.png", string contentType = "image/png")
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        return await client.PostAsync("/uploads", form);
    }

    [Fact]
    public async Task Upload_accepts_images_and_serves_them_publicly()
    {
        var (client, _) = await TestUsers.CreateClientAsync(factory);

        var upload = await (await UploadAsync(client, Png)).ReadAsync<UploadResponse>();
        Assert.Equal("image/png", upload.ContentType);
        Assert.EndsWith(".png", upload.Key);

        var anonymous = factory.CreateClient();
        var file = await anonymous.GetAsync($"/files/{upload.Key}");
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("image/png", file.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Png, await file.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Upload_rejects_non_images_even_with_image_content_type()
    {
        var (client, _) = await TestUsers.CreateClientAsync(factory);
        var response = await UploadAsync(client, "<script>alert(1)</script>"u8.ToArray(), "x.png", "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_requires_login_and_unknown_files_are_404()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await UploadAsync(factory.CreateClient(), Png)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync("/files/2026/01/nao-existe.png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync("/files/..%2F..%2Fappsettings.json")).StatusCode);
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "image/jpeg")]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 }, "image/gif")]
    [InlineData(new byte[] { 0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50 }, "image/webp")]
    public void DetectImage_recognizes_magic_bytes(byte[] header, string expected) =>
        Assert.Equal(expected, UploadEndpoints.DetectImage(header)!.Value.ContentType);

    [Fact]
    public async Task Avatars_and_attachments_must_belong_to_the_user()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Arte {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        await player.PostAsync($"/communities/{community.Slug}/join", null);

        var ownersImage = await (await UploadAsync(owner, Png)).ReadAsync<UploadResponse>();
        var playersImage = await (await UploadAsync(player, Png)).ReadAsync<UploadResponse>();

        // Profile avatar
        var me = await (await player.PutJsonAsync("/me", new UpdateProfileRequest("Novo Nome", "Bio", playersImage.Key))).ReadAsync<Bookollab.Api.Features.Auth.MeResponse>();
        Assert.Equal(playersImage.Key, me.AvatarKey);
        Assert.Equal(HttpStatusCode.BadRequest, (await player.PutJsonAsync("/me", new UpdateProfileRequest("Nome", null, ownersImage.Key))).StatusCode);

        // Character avatar
        Assert.Equal(HttpStatusCode.BadRequest, (await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Ladra", [], false, true, ownersImage.Key))).StatusCode);
        var character = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/", new SaveCharacterRequest("Ladra", [], false, true, playersImage.Key))).ReadAsync<CharacterDto>();
        Assert.Equal(playersImage.Key, character.AvatarKey);

        // Image-only action, with avatar, broadcast shape
        var scene = await (await owner.PostJsonAsync($"/communities/{community.Slug}/scenes/", new CreateSceneRequest("Galeria", null))).ReadAsync<SceneDetail>();
        await player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(character.Id));
        Assert.Equal(HttpStatusCode.BadRequest, (await player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(character.Id, "", null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(character.Id, "", ownersImage.Key))).StatusCode);
        var action = await (await player.PostJsonAsync($"/scenes/{scene.Id}/actions", new SendActionRequest(character.Id, "", playersImage.Key))).ReadAsync<SceneActionDto>();
        Assert.Equal(playersImage.Key, action.AttachmentKey);
        Assert.Equal(playersImage.Key, action.CharacterAvatarKey);
        Assert.Equal("", action.Content);
    }

    [Fact]
    public async Task Scene_background_is_set_by_opener_or_staff()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Fundo {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        var scene = await (await owner.PostJsonAsync($"/communities/{community.Slug}/scenes/", new CreateSceneRequest("Noite", null))).ReadAsync<SceneDetail>();

        var asPlayer = await (await player.GetAsync($"/scenes/{scene.Id}")).ReadAsync<SceneDetail>();
        Assert.False(asPlayer.CanEditBackground);
        Assert.Equal(HttpStatusCode.Forbidden, (await player.PutJsonAsync($"/scenes/{scene.Id}/background", new UpdateSceneBackgroundRequest("preset:night"))).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutJsonAsync($"/scenes/{scene.Id}/background", new UpdateSceneBackgroundRequest("url:http://evil"))).StatusCode);
        var preset = await (await owner.PutJsonAsync($"/scenes/{scene.Id}/background", new UpdateSceneBackgroundRequest("preset:night"))).ReadAsync<SceneDetail>();
        Assert.Equal("preset:night", preset.Background);

        var image = await (await UploadAsync(owner, Png)).ReadAsync<UploadResponse>();
        var withImage = await (await owner.PutJsonAsync($"/scenes/{scene.Id}/background", new UpdateSceneBackgroundRequest($"image:{image.Key}"))).ReadAsync<SceneDetail>();
        Assert.Equal($"image:{image.Key}", withImage.Background);
        Assert.Null((await (await owner.PutJsonAsync($"/scenes/{scene.Id}/background", new UpdateSceneBackgroundRequest(null))).ReadAsync<SceneDetail>()).Background);
    }
}
