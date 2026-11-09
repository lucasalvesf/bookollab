using System.Net;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Encyclopedia;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Encyclopedia;
using Bookollab.Api.Features.Profile;

namespace Bookollab.Tests;

public sealed class EncyclopediaTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record World(HttpClient Owner, HttpClient Player, string PlayerUserName, string Slug);

    private async Task<World> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var (player, playerUser) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Enc {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        return new World(owner, player, playerUser.UserName!, community.Slug);
    }

    private static Task<TemplateDto> PetTemplateAsync(World w) =>
        w.Owner.PostJsonAsync($"/communities/{w.Slug}/sheet-templates", new SaveTemplateRequest("Pet", "Animais de estimação", "Pet",
        [
            new("especie", "Espécie", SheetFieldType.Text, true),
            new("idade", "Idade", SheetFieldType.Number, false),
        ])).ContinueWith(t => t.Result.ReadAsync<TemplateDto>()).Unwrap();

    [Fact]
    public async Task Only_staff_manages_templates_folders_and_settings()
    {
        var w = await WorldAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheet-templates", new SaveTemplateRequest("X", null, null, []))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/communities/{w.Slug}/folders", new SaveFolderRequest("Pasta", null))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PutJsonAsync($"/communities/{w.Slug}/encyclopedia/settings", new EncyclopediaSettingsDto(false, TemplateMode.Strict))).StatusCode);

        var view = await (await w.Player.GetAsync($"/communities/{w.Slug}/encyclopedia")).ReadAsync<EncyclopediaDto>();
        Assert.False(view.CanManage);
        Assert.True(view.CanCreate);
        Assert.True(view.Settings.FreeSheetsEnabled);
        Assert.Equal(TemplateMode.Base, view.Settings.TemplateMode);
    }

    [Fact]
    public async Task Player_creates_sheet_from_template_with_required_fields_and_extra_fields_in_base_mode()
    {
        var w = await WorldAsync();
        var template = await PetTemplateAsync(w);

        var missing = await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Bolinha", null, null, template.Id, []));
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("fields.especie", await missing.Content.ReadAsStringAsync());

        var sheet = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Bolinha", null, null, template.Id,
        [
            new("especie", null, null, "Gato"),
            new("idade", null, null, "3"),
            new("cor", "Cor do pelo", SheetFieldType.Text, "Laranja"), // extra field: allowed in Base mode
        ]))).ReadAsync<SheetDto>();

        Assert.Equal("Pet", sheet.Kind); // inherited from the template
        Assert.Equal("Pet", sheet.TemplateName);
        Assert.Equal(3, sheet.Fields.Count);
        Assert.True(sheet.Fields.Single(f => f.Key == "especie").FromTemplate);
        Assert.False(sheet.Fields.Single(f => f.Key == "cor").FromTemplate);
        Assert.True(sheet.CanAddFields);
    }

    [Fact]
    public async Task Strict_mode_rejects_extra_fields()
    {
        var w = await WorldAsync();
        var template = await PetTemplateAsync(w);
        (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/encyclopedia/settings", new EncyclopediaSettingsDto(true, TemplateMode.Strict))).EnsureSuccessStatusCode();

        var extra = await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Rex", null, null, template.Id,
            [new("especie", null, null, "Cão"), new("cor", "Cor", SheetFieldType.Text, "Preto")]));
        Assert.Equal(HttpStatusCode.BadRequest, extra.StatusCode);

        var ok = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Rex", null, null, template.Id,
            [new("especie", null, null, "Cão")]))).ReadAsync<SheetDto>();
        Assert.False(ok.CanAddFields);
    }

    [Fact]
    public async Task Free_sheets_can_be_disabled_by_the_staff()
    {
        var w = await WorldAsync();
        var free = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Família Blackwood", "Família", null, null,
            [new("lema", "Lema", SheetFieldType.Text, "Sangue e honra")]))).ReadAsync<SheetDto>();
        Assert.Null(free.TemplateId);
        Assert.True(free.CanAddFields);

        (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/encyclopedia/settings", new EncyclopediaSettingsDto(false, TemplateMode.Base))).EnsureSuccessStatusCode();
        var blocked = await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Outra", null, null, null, []));
        Assert.Equal(HttpStatusCode.BadRequest, blocked.StatusCode);
        Assert.Contains("precisam seguir um modelo", await blocked.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Staff_organizes_folders_and_encyclopedia_lists_characters_and_sheets_together()
    {
        var w = await WorldAsync();
        var folder = await (await w.Owner.PostJsonAsync($"/communities/{w.Slug}/folders", new SaveFolderRequest("Bestiário", null))).ReadAsync<FolderDto>();
        var sheet = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Dragão", "Criatura", null, null, []))).ReadAsync<SheetDto>();
        var character = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/characters/", new SaveCharacterRequest("Ayla", [], false, true))).ReadAsync<CharacterDto>();

        // Players cannot move items into folders.
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PutJsonAsync($"/sheets/{sheet.Id}/folder", new MoveToFolderRequest(folder.Id))).StatusCode);
        (await w.Owner.PutJsonAsync($"/sheets/{sheet.Id}/folder", new MoveToFolderRequest(folder.Id))).EnsureSuccessStatusCode();
        (await w.Owner.PutJsonAsync($"/characters/{character.Id}/folder", new MoveToFolderRequest(folder.Id))).EnsureSuccessStatusCode();

        var all = await (await w.Player.GetAsync($"/communities/{w.Slug}/encyclopedia")).ReadAsync<EncyclopediaDto>();
        Assert.Contains(all.Items, i => i.Id == character.Id && i.ItemType == EncyclopediaItemType.Character && i.Kind == "Personagem");
        Assert.Contains(all.Items, i => i.Id == sheet.Id && i.ItemType == EncyclopediaItemType.Sheet && i.Kind == "Criatura");
        Assert.Equal(2, Assert.Single(all.Folders).ItemCount);

        var inFolder = await (await w.Player.GetAsync($"/communities/{w.Slug}/encyclopedia?folderId={folder.Id}")).ReadAsync<EncyclopediaDto>();
        Assert.Equal(2, inFolder.Items.Count);
        var search = await (await w.Player.GetAsync($"/communities/{w.Slug}/encyclopedia?search=drag")).ReadAsync<EncyclopediaDto>();
        Assert.Equal("Dragão", Assert.Single(search.Items).Name);

        // Deleting the folder keeps the items.
        (await w.Owner.DeleteAsync($"/folders/{folder.Id}")).EnsureSuccessStatusCode();
        var after = await (await w.Player.GetAsync($"/communities/{w.Slug}/encyclopedia")).ReadAsync<EncyclopediaDto>();
        Assert.Equal(2, after.Items.Count);
        Assert.All(after.Items, i => Assert.Null(i.FolderId));
    }

    [Fact]
    public async Task Template_changes_do_not_break_existing_sheets_and_sheets_show_on_profile()
    {
        var w = await WorldAsync();
        var template = await PetTemplateAsync(w);
        var sheet = await (await w.Player.PostJsonAsync($"/communities/{w.Slug}/sheets", new CreateSheetRequest("Bolinha", null, null, template.Id,
            [new("especie", null, null, "Gato")]))).ReadAsync<SheetDto>();

        (await w.Owner.DeleteAsync($"/sheet-templates/{template.Id}")).EnsureSuccessStatusCode();
        var kept = await (await w.Player.GetAsync($"/sheets/{sheet.Id}")).ReadAsync<SheetDto>();
        Assert.Null(kept.TemplateId);
        Assert.Equal("Gato", kept.Fields.Single(f => f.Key == "especie").Value);

        // Owner of the sheet edits it; another player cannot.
        var (other, _) = await TestUsers.CreateClientAsync(factory);
        await other.PostAsync($"/communities/{w.Slug}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutJsonAsync($"/sheets/{sheet.Id}", new UpdateSheetRequest("X", null, null, []))).StatusCode);
        var edited = await (await w.Player.PutJsonAsync($"/sheets/{sheet.Id}", new UpdateSheetRequest("Bolinha II", "Pet", null, [new("especie", null, null, "Gato persa")]))).ReadAsync<SheetDto>();
        Assert.Equal("Bolinha II", edited.Name);

        var profile = await (await w.Owner.GetAsync($"/communities/{w.Slug}/members/{w.PlayerUserName}")).ReadAsync<CommunityProfileDto>();
        Assert.Equal("Bolinha II", Assert.Single(profile.Sheets).Name);
    }
}
