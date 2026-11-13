using System.Security.Claims;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Characters;

public sealed record SheetValueDto(string Key, string? Value);

public sealed record SaveCharacterRequest(string Name, List<SheetValueDto>? Sheet, bool ShowOnGlobalProfile, bool ShowCommunityOnProfile, string? AvatarKey = null);

public sealed record CharacterDto(
    Guid Id, Guid CommunityId, string CommunitySlug, Guid OwnerUserId, string OwnerUserName, string Name, string? AvatarKey,
    IReadOnlyList<SheetValueDto> Sheet, bool ShowOnGlobalProfile, bool ShowCommunityOnProfile, CharacterStatus Status,
    DateTimeOffset CreatedAt, bool CanEdit, Guid? FolderId = null);

public static class CharacterEndpoints
{
    public static void MapCharacterEndpoints(this IEndpointRouteBuilder app)
    {
        var inCommunity = app.MapGroup("/communities/{slug}/characters").WithTags("Characters").RequireAuthorization();
        inCommunity.MapGet("/", List).WithName("ListCharacters").Produces<List<CharacterDto>>();
        inCommunity.MapPost("/", Create).WithName("CreateCharacter").Produces<CharacterDto>(StatusCodes.Status201Created);

        var byId = app.MapGroup("/characters").WithTags("Characters").RequireAuthorization();
        byId.MapGet("/{id:guid}", Get).WithName("GetCharacter").Produces<CharacterDto>();
        byId.MapPut("/{id:guid}", Update).WithName("UpdateCharacter").Produces<CharacterDto>();
    }

    private static async Task<IResult> List(string slug, bool? mine, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var userId = user.UserId();
        var query = db.Characters.Where(c => c.CommunityId == access!.Community.Id && c.Status == CharacterStatus.Active);
        if (mine == true) query = query.Where(c => c.OwnerUserId == userId);
        var rows = await query.OrderBy(c => c.Name)
            .Join(db.Users, c => c.OwnerUserId, u => u.Id, (c, u) => new { c, u.UserName })
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(r => ToDto(r.c, slug, r.UserName!, CanEdit(r.c, userId, access!))).ToList());
    }

    private static async Task<IResult> Create(string slug, SaveCharacterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.CreateCharacters, user, perms, ct);
        if (error is not null) return error;
        var (sheet, validation) = Validate(req, access!.Community);
        if (validation is not null) return validation;
        var avatar = string.IsNullOrWhiteSpace(req.AvatarKey) ? null : req.AvatarKey;
        if (avatar is not null && !await UploadEndpoints.OwnsAsync(db, avatar, user.UserId(), ct))
            return Problems.Validation("avatarKey", "Imagem inválida. Envie novamente.");

        var character = new Character
        {
            CommunityId = access.Community.Id,
            OwnerUserId = user.UserId(),
            Name = req.Name.Trim(),
            AvatarKey = avatar,
            Sheet = sheet,
            ShowOnGlobalProfile = req.ShowOnGlobalProfile,
            ShowCommunityOnProfile = req.ShowCommunityOnProfile,
        };
        db.Characters.Add(character);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/characters/{character.Id}", ToDto(character, slug, user.Identity!.Name!, true));
    }

    private static async Task<IResult> Get(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (character is null) return Problems.NotFound("Personagem não encontrado.");
        var access = await perms.GetAccessAsync(character.CommunityId, user.UserId(), ct);
        if (access is null) return Problems.Forbidden("Você não é membro desta comunidade.");
        var owner = await db.Users.Where(u => u.Id == character.OwnerUserId).Select(u => u.UserName).SingleAsync(ct);
        return TypedResults.Ok(ToDto(character, access.Community.Slug, owner!, CanEdit(character, user.UserId(), access)));
    }

    private static async Task<IResult> Update(Guid id, SaveCharacterRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var character = await db.Characters.SingleOrDefaultAsync(c => c.Id == id, ct);
        if (character is null) return Problems.NotFound("Personagem não encontrado.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(character.CommunityId, userId, ct);
        if (access is null || !CanEdit(character, userId, access)) return Problems.Forbidden();

        var (sheet, validation) = Validate(req, access.Community);
        if (validation is not null) return validation;
        var avatar = string.IsNullOrWhiteSpace(req.AvatarKey) ? null : req.AvatarKey;
        if (avatar is not null && avatar != character.AvatarKey && !await UploadEndpoints.OwnsAsync(db, avatar, userId, ct))
            return Problems.Validation("avatarKey", "Imagem inválida. Envie novamente.");
        character.AvatarKey = avatar;
        character.Name = req.Name.Trim();
        character.Sheet = sheet;
        character.ShowOnGlobalProfile = req.ShowOnGlobalProfile;
        character.ShowCommunityOnProfile = req.ShowCommunityOnProfile;
        await db.SaveChangesAsync(ct);

        var owner = await db.Users.Where(u => u.Id == character.OwnerUserId).Select(u => u.UserName).SingleAsync(ct);
        return TypedResults.Ok(ToDto(character, access.Community.Slug, owner!, true));
    }

    public static bool CanEdit(Character c, Guid userId, MemberAccess access) =>
        c.OwnerUserId == userId || access.Has(CommunityPermission.ManageCharacters);

    /// <summary>Validates the name and the sheet against the community's fields; unknown keys are rejected.</summary>
    private static (List<SheetValue> Sheet, IResult? Error) Validate(SaveCharacterRequest req, Community community)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 100) return ([], Problems.Validation("name", "O nome precisa ter de 1 a 100 caracteres."));

        var values = (req.Sheet ?? []).ToDictionary(v => v.Key, v => v.Value?.Trim());
        var known = community.SheetFields.ToDictionary(f => f.Key);
        var unknown = values.Keys.FirstOrDefault(k => !known.ContainsKey(k));
        if (unknown is not null) return ([], Problems.Validation($"sheet.{unknown}", "Este campo não existe na ficha da comunidade."));

        var errors = new Dictionary<string, string[]>();
        foreach (var field in community.SheetFields)
        {
            values.TryGetValue(field.Key, out var value);
            if (field.Required && string.IsNullOrWhiteSpace(value)) errors[$"sheet.{field.Key}"] = [$"\"{field.Label}\" é obrigatório."];
            else if (field.Type == SheetFieldType.Number && !string.IsNullOrWhiteSpace(value) && !decimal.TryParse(value, out _))
                errors[$"sheet.{field.Key}"] = [$"\"{field.Label}\" precisa ser um número."];
            else if (value?.Length > (field.Type == SheetFieldType.LongText ? 5000 : 200))
                errors[$"sheet.{field.Key}"] = [$"\"{field.Label}\" está longo demais."];
        }
        if (errors.Count > 0) return ([], TypedResults.ValidationProblem(errors));

        var sheet = community.SheetFields
            .Where(f => !string.IsNullOrWhiteSpace(values.GetValueOrDefault(f.Key)))
            .Select(f => new SheetValue { Key = f.Key, Value = values[f.Key] })
            .ToList();
        return (sheet, null);
    }

    private static CharacterDto ToDto(Character c, string slug, string ownerUserName, bool canEdit) => new(
        c.Id, c.CommunityId, slug, c.OwnerUserId, ownerUserName, c.Name, c.AvatarKey,
        c.Sheet.Select(v => new SheetValueDto(v.Key, v.Value)).ToList(),
        c.ShowOnGlobalProfile, c.ShowCommunityOnProfile, c.Status, c.CreatedAt, canEdit, c.FolderId);
}
