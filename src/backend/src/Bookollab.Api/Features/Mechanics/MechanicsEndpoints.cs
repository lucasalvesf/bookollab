using System.Security.Claims;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Mechanics;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Mechanics;

public sealed record MechanicsDto(bool DiceEnabled, bool AttributesEnabled, bool InventoryEnabled);

public sealed record AttributeDto(string Key, string Label, string? Value);

public sealed record InventoryItemDto(Guid Id, string Name, int Quantity, string? Description, DateTimeOffset CreatedAt);

public sealed record SaveInventoryItemRequest(string Name, int Quantity, string? Description);

public sealed record CharacterMechanicsDto(MechanicsDto Mechanics, IReadOnlyList<AttributeDto> Attributes, IReadOnlyList<InventoryItemDto> Inventory, bool CanManageInventory);

/// <summary>Optional RPG mechanics (dice, attributes, inventory), each toggled by the staff.</summary>
public static class MechanicsEndpoints
{
    public static void MapMechanicsEndpoints(this IEndpointRouteBuilder app)
    {
        var c = app.MapGroup("/communities/{slug}/mechanics").WithTags("Mechanics").RequireAuthorization();
        c.MapGet("/", Get).WithName("GetMechanics").Produces<MechanicsDto>();
        c.MapPut("/", Update).WithName("UpdateMechanics").Produces<MechanicsDto>();

        app.MapGet("/characters/{id:guid}/mechanics", CharacterMechanics).WithTags("Mechanics").WithName("GetCharacterMechanics")
            .RequireAuthorization().Produces<CharacterMechanicsDto>();
        app.MapPost("/characters/{id:guid}/inventory", AddItem).WithTags("Mechanics").WithName("AddInventoryItem")
            .RequireAuthorization().Produces<InventoryItemDto>(StatusCodes.Status201Created);
        app.MapPut("/inventory-items/{id:guid}", UpdateItem).WithTags("Mechanics").WithName("UpdateInventoryItem")
            .RequireAuthorization().Produces<InventoryItemDto>();
        app.MapDelete("/inventory-items/{id:guid}", RemoveItem).WithTags("Mechanics").WithName("RemoveInventoryItem")
            .RequireAuthorization().Produces(StatusCodes.Status204NoContent);
    }

    public static MechanicsDto ToDto(Community c) => new(c.DiceEnabled, c.AttributesEnabled, c.InventoryEnabled);

    private static async Task<IResult> Get(string slug, ClaimsPrincipal user, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        return error ?? TypedResults.Ok(ToDto(access!.Community));
    }

    private static async Task<IResult> Update(string slug, MechanicsDto req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        access!.Community.DiceEnabled = req.DiceEnabled;
        access.Community.AttributesEnabled = req.AttributesEnabled;
        access.Community.InventoryEnabled = req.InventoryEnabled;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDto(access.Community));
    }

    /// <summary>Attributes (numeric sheet fields) and inventory of a character, according to the community toggles.</summary>
    private static async Task<IResult> CharacterMechanics(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (character is null) return Problems.NotFound("Personagem não encontrado.");
        var access = await perms.GetAccessAsync(character.CommunityId, user.UserId(), ct);
        if (access is null) return Problems.Forbidden("Você não é membro desta comunidade.");
        var community = access.Community;

        var attributes = community.AttributesEnabled
            ? community.SheetFields.Where(f => f.Type == SheetFieldType.Number)
                .Select(f => new AttributeDto(f.Key, f.Label, character.Sheet.FirstOrDefault(v => v.Key == f.Key)?.Value)).ToList()
            : [];
        var inventory = community.InventoryEnabled
            ? await db.InventoryItems.Where(i => i.CharacterId == id).OrderBy(i => i.Name)
                .Select(i => new InventoryItemDto(i.Id, i.Name, i.Quantity, i.Description, i.CreatedAt)).ToListAsync(ct)
            : [];
        return TypedResults.Ok(new CharacterMechanicsDto(ToDto(community), attributes, inventory,
            community.InventoryEnabled && access.Has(CommunityPermission.ManageCharacters)));
    }

    private static async Task<IResult> AddItem(Guid id, SaveInventoryItemRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (character is null) return Problems.NotFound("Personagem não encontrado.");
        var (_, error) = await RequireInventoryManagerAsync(character.CommunityId, user, perms, ct);
        if (error is not null) return error;
        var validation = Validate(req);
        if (validation is not null) return validation;

        var item = new InventoryItem
        {
            CharacterId = id,
            Name = req.Name.Trim(),
            Quantity = req.Quantity,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            GivenByUserId = user.UserId(),
        };
        db.InventoryItems.Add(item);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/inventory-items/{item.Id}", new InventoryItemDto(item.Id, item.Name, item.Quantity, item.Description, item.CreatedAt));
    }

    private static async Task<IResult> UpdateItem(Guid id, SaveInventoryItemRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var item = await db.InventoryItems.SingleOrDefaultAsync(i => i.Id == id, ct);
        if (item is null) return Problems.NotFound("Item não encontrado.");
        var communityId = await db.Characters.Where(c => c.Id == item.CharacterId).Select(c => c.CommunityId).SingleAsync(ct);
        var (_, error) = await RequireInventoryManagerAsync(communityId, user, perms, ct);
        if (error is not null) return error;
        var validation = Validate(req);
        if (validation is not null) return validation;

        item.Name = req.Name.Trim();
        item.Quantity = req.Quantity;
        item.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new InventoryItemDto(item.Id, item.Name, item.Quantity, item.Description, item.CreatedAt));
    }

    private static async Task<IResult> RemoveItem(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var item = await db.InventoryItems.SingleOrDefaultAsync(i => i.Id == id, ct);
        if (item is null) return Problems.NotFound("Item não encontrado.");
        var communityId = await db.Characters.Where(c => c.Id == item.CharacterId).Select(c => c.CommunityId).SingleAsync(ct);
        var (_, error) = await RequireInventoryManagerAsync(communityId, user, perms, ct);
        if (error is not null) return error;
        db.InventoryItems.Remove(item);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    /// <summary>The inventory is given and taken by the staff (ManageCharacters), only when enabled.</summary>
    private static async Task<(MemberAccess? Access, IResult? Error)> RequireInventoryManagerAsync(Guid communityId, ClaimsPrincipal user, PermissionService perms, CancellationToken ct)
    {
        var access = await perms.GetAccessAsync(communityId, user.UserId(), ct);
        if (access is null) return (null, Problems.Forbidden("Você não é membro desta comunidade."));
        if (!access.Community.InventoryEnabled) return (null, Problems.Validation("inventory", "O inventário está desligado nesta comunidade."));
        if (!access.Has(CommunityPermission.ManageCharacters)) return (null, Problems.Forbidden("Só a staff dá ou tira itens."));
        return (access, null);
    }

    private static IResult? Validate(SaveInventoryItemRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100) return Problems.Validation("name", "O item precisa de um nome com até 100 caracteres.");
        if (req.Quantity is < 1 or > 9999) return Problems.Validation("quantity", "Quantidade de 1 a 9.999.");
        if (req.Description?.Length > 1000) return Problems.Validation("description", "A descrição pode ter até 1.000 caracteres.");
        return null;
    }
}
