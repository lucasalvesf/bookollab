using System.Net;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Mechanics;
using Bookollab.Api.Features.Characters;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Mechanics;
using Bookollab.Api.Features.Scenes;

namespace Bookollab.Tests;

/// <summary>Milestone 2 RPG mechanics: dice, attributes, inventory (each optional per community).</summary>
public sealed class MechanicsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    // ------------------------------------------------------------------ dice parser

    private static readonly Dictionary<string, int> Attrs = new() { [Dice.Normalize("Força")] = 4 };

    [Theory]
    [InlineData("/rolar 1d20+3", "1d20+3")]
    [InlineData("/roll 2d6", "2d6")]
    [InlineData("  /ROLAR d8 ", "d8")]
    [InlineData("rolar 1d20", null)]
    [InlineData("Ataca com a espada", null)]
    public void Recognizes_roll_command(string content, string? expected) => Assert.Equal(expected, Dice.ParseCommand(content));

    [Fact]
    public void Rolls_dice_with_modifiers_and_attributes()
    {
        var (roll, error) = Dice.Roll("2d6 + forca - 1", Attrs, _ => 5);
        Assert.Null(error);
        Assert.Equal(5 + 5 + 4 - 1, roll!.Total);
        Assert.Equal([5, 5], roll.Terms[0].Rolls);
        Assert.Equal(-1, roll.Terms[2].Sign);
    }

    [Theory]
    [InlineData("3")] // no dice
    [InlineData("1d1")]
    [InlineData("99d6")]
    [InlineData("1d20+sorte")] // unknown attribute
    [InlineData("1d20+")]
    [InlineData("1d20*2")]
    public void Rejects_invalid_expressions(string expression)
    {
        var (roll, error) = Dice.Roll(expression, Attrs);
        Assert.Null(roll);
        Assert.False(string.IsNullOrEmpty(error));
    }

    [Fact]
    public void Real_rolls_stay_within_bounds()
    {
        for (var i = 0; i < 200; i++)
        {
            var (roll, _) = Dice.Roll("1d20", Attrs);
            Assert.InRange(roll!.Total, 1, 20);
        }
    }

    // ------------------------------------------------------------------ integration

    private sealed record World(HttpClient Owner, HttpClient Player, CharacterDto Character, string Slug, Guid SceneId);

    private async Task<World> WorldAsync()
    {
        var (owner, _) = await TestUsers.CreateClientAsync(factory);
        var community = await (await owner.PostJsonAsync("/communities/", new CreateCommunityRequest($"Mec {Guid.NewGuid():N}"[..12], null, null, JoinPolicy.Open))).ReadAsync<CommunityDetail>();
        (await owner.PutJsonAsync($"/communities/{community.Slug}/sheet-fields", new List<SheetFieldDto>
        {
            new("strength", "Força", SheetFieldType.Number, false),
            new("race", "Raça", SheetFieldType.Text, false),
        })).EnsureSuccessStatusCode();

        var (player, _) = await TestUsers.CreateClientAsync(factory);
        await player.PostAsync($"/communities/{community.Slug}/join", null);
        var character = await (await player.PostJsonAsync($"/communities/{community.Slug}/characters/",
            new SaveCharacterRequest("Ayla", [new("strength", "3"), new("race", "Elfa")], false, true))).ReadAsync<CharacterDto>();
        var scene = await (await owner.PostJsonAsync($"/communities/{community.Slug}/scenes/", new CreateSceneRequest("Arena", null))).ReadAsync<SceneDetail>();
        await player.PostJsonAsync($"/scenes/{scene.Id}/join", new JoinSceneRequest(character.Id));
        return new World(owner, player, character, community.Slug, scene.Id);
    }

    private static Task<HttpResponseMessage> RollAsync(World w, string text) =>
        w.Player.PostJsonAsync($"/scenes/{w.SceneId}/actions", new SendActionRequest(w.Character.Id, text));

    [Fact]
    public async Task Mechanics_start_off_and_only_staff_toggles_them()
    {
        var w = await WorldAsync();
        var mechanics = await (await w.Player.GetAsync($"/communities/{w.Slug}/mechanics/")).ReadAsync<MechanicsDto>();
        Assert.False(mechanics.DiceEnabled || mechanics.AttributesEnabled || mechanics.InventoryEnabled);
        Assert.Equal(HttpStatusCode.BadRequest, (await RollAsync(w, "/rolar 1d20")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PutJsonAsync($"/communities/{w.Slug}/mechanics/", new MechanicsDto(true, true, true))).StatusCode);
    }

    [Fact]
    public async Task Roll_uses_sheet_attribute_and_cannot_be_edited_or_deleted_by_author()
    {
        var w = await WorldAsync();
        (await w.Owner.PutJsonAsync($"/communities/{w.Slug}/mechanics/", new MechanicsDto(true, true, false))).EnsureSuccessStatusCode();

        var response = await RollAsync(w, "/rolar 1d20+força");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var action = await response.ReadAsync<SceneActionDto>();
        Assert.NotNull(action.Roll);
        var die = action.Roll!.Terms[0].Rolls.Single();
        Assert.Equal(die + 3, action.Roll.Total);

        Assert.Equal(HttpStatusCode.BadRequest, (await RollAsync(w, "/rolar 1d20+raça")).StatusCode); // text field: not an attribute
        Assert.Equal(HttpStatusCode.Conflict, (await w.Player.PutJsonAsync($"/actions/{action.Id}", new EditActionRequest("/rolar 1d20+99"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.DeleteAsync($"/actions/{action.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await w.Owner.DeleteAsync($"/actions/{action.Id}")).StatusCode); // moderators can
    }

    [Fact]
    public async Task Attributes_off_means_only_plain_dice()
    {
        var w = await WorldAsync();
        await w.Owner.PutJsonAsync($"/communities/{w.Slug}/mechanics/", new MechanicsDto(true, false, false));
        Assert.Equal(HttpStatusCode.Created, (await RollAsync(w, "/rolar 2d6+1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await RollAsync(w, "/rolar 1d20+força")).StatusCode);
    }

    [Fact]
    public async Task Inventory_is_managed_by_staff_and_visible_to_members()
    {
        var w = await WorldAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Owner.PostJsonAsync($"/characters/{w.Character.Id}/inventory", new SaveInventoryItemRequest("Espada", 1, null))).StatusCode); // off
        await w.Owner.PutJsonAsync($"/communities/{w.Slug}/mechanics/", new MechanicsDto(false, true, true));

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.PostJsonAsync($"/characters/{w.Character.Id}/inventory", new SaveInventoryItemRequest("Ouro", 999, null))).StatusCode);
        var item = await (await w.Owner.PostJsonAsync($"/characters/{w.Character.Id}/inventory", new SaveInventoryItemRequest("Poção", 2, "Cura 10 de vida"))).ReadAsync<InventoryItemDto>();
        await w.Owner.PutJsonAsync($"/inventory-items/{item.Id}", new SaveInventoryItemRequest("Poção", 1, "Cura 10 de vida"));

        var view = await (await w.Player.GetAsync($"/characters/{w.Character.Id}/mechanics")).ReadAsync<CharacterMechanicsDto>();
        Assert.False(view.CanManageInventory);
        Assert.Equal(1, Assert.Single(view.Inventory).Quantity);
        Assert.Equal("3", view.Attributes.Single(a => a.Key == "strength").Value);
        Assert.DoesNotContain(view.Attributes, a => a.Key == "race");

        Assert.Equal(HttpStatusCode.Forbidden, (await w.Player.DeleteAsync($"/inventory-items/{item.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await w.Owner.DeleteAsync($"/inventory-items/{item.Id}")).StatusCode);
    }
}
