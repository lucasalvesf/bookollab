using System.Security.Claims;
using System.Text.RegularExpressions;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Encyclopedia;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Communities;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Encyclopedia;

/// <summary>
/// Encyclopedia of a community (rules in docs/visao-produto.md → Enciclopédia):
/// sheets of any kind, staff folders, staff templates, free sheets toggle and template rigidity.
/// </summary>
public static partial class EncyclopediaEndpoints
{
    public const int MaxFields = 50;

    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex FieldKeyRegex();

    public static void MapEncyclopediaEndpoints(this IEndpointRouteBuilder app)
    {
        var c = app.MapGroup("/communities/{slug}").WithTags("Encyclopedia").RequireAuthorization();
        c.MapGet("/encyclopedia", Get).WithName("GetEncyclopedia").Produces<EncyclopediaDto>();
        c.MapPut("/encyclopedia/settings", UpdateSettings).WithName("UpdateEncyclopediaSettings").Produces<EncyclopediaSettingsDto>();
        c.MapPost("/sheet-templates", CreateTemplate).WithName("CreateSheetTemplate").Produces<TemplateDto>(StatusCodes.Status201Created);
        c.MapPost("/folders", CreateFolder).WithName("CreateEncyclopediaFolder").Produces<FolderDto>(StatusCodes.Status201Created);
        c.MapPost("/sheets", CreateSheet).WithName("CreateSheet").Produces<SheetDto>(StatusCodes.Status201Created);

        var t = app.MapGroup("/sheet-templates").WithTags("Encyclopedia").RequireAuthorization();
        t.MapPut("/{id:guid}", UpdateTemplate).WithName("UpdateSheetTemplate").Produces<TemplateDto>();
        t.MapDelete("/{id:guid}", DeleteTemplate).WithName("DeleteSheetTemplate").Produces(StatusCodes.Status204NoContent);

        var f = app.MapGroup("/folders").WithTags("Encyclopedia").RequireAuthorization();
        f.MapPut("/{id:guid}", UpdateFolder).WithName("UpdateEncyclopediaFolder").Produces<FolderDto>();
        f.MapDelete("/{id:guid}", DeleteFolder).WithName("DeleteEncyclopediaFolder").Produces(StatusCodes.Status204NoContent);

        var s = app.MapGroup("/sheets").WithTags("Encyclopedia").RequireAuthorization();
        s.MapGet("/{id:guid}", GetSheet).WithName("GetSheet").Produces<SheetDto>();
        s.MapPut("/{id:guid}", UpdateSheet).WithName("UpdateSheet").Produces<SheetDto>();
        s.MapDelete("/{id:guid}", DeleteSheet).WithName("DeleteSheet").Produces(StatusCodes.Status204NoContent);
        s.MapPut("/{id:guid}/folder", MoveSheet).WithName("MoveSheetToFolder").Produces(StatusCodes.Status204NoContent);

        app.MapPut("/characters/{id:guid}/folder", MoveCharacter).WithTags("Encyclopedia").WithName("MoveCharacterToFolder")
            .RequireAuthorization().Produces(StatusCodes.Status204NoContent);
    }

    // ------------------------------------------------------------------ overview & settings

    private static async Task<IResult> Get(string slug, Guid? folderId, string? search, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var communityId = access!.Community.Id;
        var term = string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim()}%";

        var characters = db.Characters.Where(x => x.CommunityId == communityId && x.Status == CharacterStatus.Active);
        var sheets = db.EncyclopediaSheets.Where(x => x.CommunityId == communityId);
        if (folderId is not null)
        {
            characters = characters.Where(x => x.FolderId == folderId);
            sheets = sheets.Where(x => x.FolderId == folderId);
        }
        if (term is not null)
        {
            characters = characters.Where(x => EF.Functions.ILike(x.Name, term));
            sheets = sheets.Where(x => EF.Functions.ILike(x.Name, term) || EF.Functions.ILike(x.Kind ?? "", term));
        }

        var items = await characters
            .Join(db.Users, x => x.OwnerUserId, u => u.Id, (x, u) => new EncyclopediaItemDto(x.Id, EncyclopediaItemType.Character, x.Name, "Personagem", x.AvatarKey, u.Id, u.UserName!, x.FolderId))
            .ToListAsync(ct);
        items.AddRange(await sheets
            .Join(db.Users, x => x.OwnerUserId, u => u.Id, (x, u) => new EncyclopediaItemDto(x.Id, EncyclopediaItemType.Sheet, x.Name, x.Kind ?? "Ficha", x.ImageKey, u.Id, u.UserName!, x.FolderId))
            .ToListAsync(ct));

        var folders = await db.EncyclopediaFolders.Where(x => x.CommunityId == communityId)
            .OrderBy(x => x.Position).ThenBy(x => x.Name)
            .Select(x => new FolderDto(x.Id, x.Name, x.Position,
                db.Characters.Count(ch => ch.FolderId == x.Id && ch.Status == CharacterStatus.Active) + db.EncyclopediaSheets.Count(sh => sh.FolderId == x.Id)))
            .ToListAsync(ct);
        var templates = await db.SheetTemplates.Where(x => x.CommunityId == communityId).OrderBy(x => x.Name).ToListAsync(ct);

        return TypedResults.Ok(new EncyclopediaDto(
            Settings(access.Community), folders, templates.Select(ToDto).ToList(),
            items.OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase).ToList(),
            CanManage: access.Has(CommunityPermission.ManageCommunity),
            CanCreate: access.Has(CommunityPermission.CreateCharacters)));
    }

    private static async Task<IResult> UpdateSettings(string slug, EncyclopediaSettingsDto req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        access!.Community.FreeSheetsEnabled = req.FreeSheetsEnabled;
        access.Community.TemplateMode = req.TemplateMode;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(Settings(access.Community));
    }

    // ------------------------------------------------------------------ templates

    private static async Task<IResult> CreateTemplate(string slug, SaveTemplateRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        var (fields, validation) = ValidateTemplate(req);
        if (validation is not null) return validation;

        var template = new SheetTemplate
        {
            CommunityId = access!.Community.Id,
            Name = req.Name.Trim(),
            Description = Clean(req.Description),
            Kind = Clean(req.Kind),
            Fields = fields,
            CreatedByUserId = user.UserId(),
        };
        db.SheetTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/sheet-templates/{template.Id}", ToDto(template));
    }

    private static async Task<IResult> UpdateTemplate(Guid id, SaveTemplateRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var template = await db.SheetTemplates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (template is null) return Problems.NotFound("Modelo não encontrado.");
        var access = await perms.GetAccessAsync(template.CommunityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ManageCommunity)) return Problems.Forbidden();
        var (fields, validation) = ValidateTemplate(req);
        if (validation is not null) return validation;

        // Existing sheets keep their own copy of the fields; the new template applies to new sheets.
        template.Name = req.Name.Trim();
        template.Description = Clean(req.Description);
        template.Kind = Clean(req.Kind);
        template.Fields = fields;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDto(template));
    }

    private static async Task<IResult> DeleteTemplate(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var template = await db.SheetTemplates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (template is null) return Problems.NotFound("Modelo não encontrado.");
        var access = await perms.GetAccessAsync(template.CommunityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ManageCommunity)) return Problems.Forbidden();
        db.SheetTemplates.Remove(template); // sheets keep their fields; TemplateId becomes null
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    // ------------------------------------------------------------------ folders

    private static async Task<IResult> CreateFolder(string slug, SaveFolderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 100) return Problems.Validation("name", "O nome da pasta precisa ter de 1 a 100 caracteres.");
        if (await db.EncyclopediaFolders.AnyAsync(x => x.CommunityId == access!.Community.Id && x.Name == name, ct))
            return Problems.Validation("name", "Já existe uma pasta com esse nome.");
        var position = req.Position ?? await db.EncyclopediaFolders.CountAsync(x => x.CommunityId == access!.Community.Id, ct);
        var folder = new EncyclopediaFolder { CommunityId = access!.Community.Id, Name = name, Position = position };
        db.EncyclopediaFolders.Add(folder);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/folders/{folder.Id}", new FolderDto(folder.Id, folder.Name, folder.Position, 0));
    }

    private static async Task<IResult> UpdateFolder(Guid id, SaveFolderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var folder = await db.EncyclopediaFolders.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (folder is null) return Problems.NotFound("Pasta não encontrada.");
        var access = await perms.GetAccessAsync(folder.CommunityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ManageCommunity)) return Problems.Forbidden();
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 100) return Problems.Validation("name", "O nome da pasta precisa ter de 1 a 100 caracteres.");
        if (await db.EncyclopediaFolders.AnyAsync(x => x.CommunityId == folder.CommunityId && x.Name == name && x.Id != id, ct))
            return Problems.Validation("name", "Já existe uma pasta com esse nome.");
        folder.Name = name;
        if (req.Position is not null) folder.Position = req.Position.Value;
        await db.SaveChangesAsync(ct);
        var count = await db.Characters.CountAsync(c => c.FolderId == id, ct) + await db.EncyclopediaSheets.CountAsync(s => s.FolderId == id, ct);
        return TypedResults.Ok(new FolderDto(folder.Id, folder.Name, folder.Position, count));
    }

    private static async Task<IResult> DeleteFolder(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var folder = await db.EncyclopediaFolders.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (folder is null) return Problems.NotFound("Pasta não encontrada.");
        var access = await perms.GetAccessAsync(folder.CommunityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ManageCommunity)) return Problems.Forbidden();
        db.EncyclopediaFolders.Remove(folder); // items stay, without folder
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> MoveSheet(Guid id, MoveToFolderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var error = await CheckFolderMoveAsync(sheet.CommunityId, req.FolderId, user, db, perms, ct);
        if (error is not null) return error;
        sheet.FolderId = req.FolderId;
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> MoveCharacter(Guid id, MoveToFolderRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var character = await db.Characters.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (character is null) return Problems.NotFound("Personagem não encontrado.");
        var error = await CheckFolderMoveAsync(character.CommunityId, req.FolderId, user, db, perms, ct);
        if (error is not null) return error;
        character.FolderId = req.FolderId;
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    /// <summary>Only the staff organizes folders; the folder must belong to the same community.</summary>
    private static async Task<IResult?> CheckFolderMoveAsync(Guid communityId, Guid? folderId, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var access = await perms.GetAccessAsync(communityId, user.UserId(), ct);
        if (access is null || !access.Has(CommunityPermission.ManageCommunity)) return Problems.Forbidden("Só a staff organiza as pastas.");
        if (folderId is not null && !await db.EncyclopediaFolders.AnyAsync(x => x.Id == folderId && x.CommunityId == communityId, ct))
            return Problems.Validation("folderId", "Pasta inválida.");
        return null;
    }

    // ------------------------------------------------------------------ sheets

    private static async Task<IResult> CreateSheet(string slug, CreateSheetRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await CommunityEndpoints.RequireAsync(slug, CommunityPermission.CreateCharacters, user, perms, ct);
        if (error is not null) return error;
        var community = access!.Community;
        var userId = user.UserId();

        SheetTemplate? template = null;
        if (req.TemplateId is not null)
        {
            template = await db.SheetTemplates.SingleOrDefaultAsync(x => x.Id == req.TemplateId && x.CommunityId == community.Id, ct);
            if (template is null) return Problems.Validation("templateId", "Modelo inválido.");
        }
        else if (!community.FreeSheetsEnabled)
        {
            return Problems.Validation("templateId", "Nesta comunidade, as fichas precisam seguir um modelo.");
        }

        var baseFields = template?.Fields.Select(fl => new SheetEntryField { Key = fl.Key, Label = fl.Label, Type = fl.Type, Required = fl.Required, FromTemplate = true }).ToList() ?? [];
        var canAdd = template is null || community.TemplateMode == TemplateMode.Base;
        var (fields, validation) = BuildFields(baseFields, req.Fields, canAdd);
        if (validation is not null) return validation;
        var common = await ValidateCommonAsync(req.Name, req.Kind, req.ImageKey, null, userId, db, ct);
        if (common is not null) return common;

        var sheet = new EncyclopediaSheet
        {
            CommunityId = community.Id,
            OwnerUserId = userId,
            Name = req.Name.Trim(),
            Kind = Clean(req.Kind) ?? template?.Kind,
            ImageKey = Clean(req.ImageKey),
            TemplateId = template?.Id,
            Fields = fields,
        };
        db.EncyclopediaSheets.Add(sheet);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/sheets/{sheet.Id}", await ToDtoAsync(db, sheet, access, userId, ct));
    }

    private static async Task<IResult> GetSheet(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var access = await perms.GetAccessAsync(sheet.CommunityId, user.UserId(), ct);
        if (access is null) return Problems.Forbidden("Você não é membro desta comunidade.");
        return TypedResults.Ok(await ToDtoAsync(db, sheet, access, user.UserId(), ct));
    }

    private static async Task<IResult> UpdateSheet(Guid id, UpdateSheetRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(sheet.CommunityId, userId, ct);
        if (access is null || !CanEdit(sheet, access, userId)) return Problems.Forbidden();

        // The sheet's template fields are its own copy (the template may have changed or been deleted).
        var baseFields = sheet.Fields.Where(fl => fl.FromTemplate)
            .Select(fl => new SheetEntryField { Key = fl.Key, Label = fl.Label, Type = fl.Type, Required = fl.Required, FromTemplate = true }).ToList();
        var canAdd = CanAddFields(sheet, access.Community);
        var (fields, validation) = BuildFields(baseFields, req.Fields, canAdd);
        if (validation is not null) return validation;
        var common = await ValidateCommonAsync(req.Name, req.Kind, req.ImageKey, sheet.ImageKey, userId, db, ct);
        if (common is not null) return common;

        sheet.Name = req.Name.Trim();
        sheet.Kind = Clean(req.Kind);
        sheet.ImageKey = Clean(req.ImageKey);
        sheet.Fields = fields;
        sheet.UpdatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ToDtoAsync(db, sheet, access, userId, ct));
    }

    private static async Task<IResult> DeleteSheet(Guid id, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var sheet = await db.EncyclopediaSheets.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (sheet is null) return Problems.NotFound("Ficha não encontrada.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(sheet.CommunityId, userId, ct);
        if (access is null || !(CanEdit(sheet, access, userId) || access.Has(CommunityPermission.ModerateContent))) return Problems.Forbidden();
        db.EncyclopediaSheets.Remove(sheet);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    // ------------------------------------------------------------------ rules

    private static bool CanEdit(EncyclopediaSheet s, MemberAccess access, Guid userId) =>
        s.OwnerUserId == userId || access.Has(CommunityPermission.ManageCharacters);

    /// <summary>Free sheets can always add fields; template sheets only in "Base" mode.</summary>
    private static bool CanAddFields(EncyclopediaSheet s, Community community) =>
        (s.TemplateId is null && !s.Fields.Any(f => f.FromTemplate)) || community.TemplateMode == TemplateMode.Base;

    /// <summary>
    /// Merges the template fields (values from the input) with extra fields from the input.
    /// Extra fields are rejected when the sheet cannot add fields (strict template).
    /// </summary>
    public static (List<SheetEntryField> Fields, IResult? Error) BuildFields(List<SheetEntryField> templateFields, List<SheetFieldInput>? input, bool canAddFields)
    {
        input ??= [];
        if (input.Count > MaxFields) return ([], Problems.Validation("fields", $"A ficha pode ter até {MaxFields} campos."));
        if (input.Select(i => i.Key).Distinct().Count() != input.Count) return ([], Problems.Validation("fields", "Há campos repetidos."));

        var byKey = input.ToDictionary(i => i.Key);
        var errors = new Dictionary<string, string[]>();
        var result = new List<SheetEntryField>();

        foreach (var field in templateFields)
        {
            var value = byKey.TryGetValue(field.Key, out var i) ? i.Value?.Trim() : null;
            CheckValue(field, value, errors);
            result.Add(new SheetEntryField { Key = field.Key, Label = field.Label, Type = field.Type, Required = field.Required, FromTemplate = true, Value = Clean(value) });
        }

        var extras = input.Where(i => templateFields.All(t => t.Key != i.Key)).ToList();
        if (extras.Count > 0 && !canAddFields)
            return ([], Problems.Validation("fields", "Nesta comunidade, fichas de modelo usam somente os campos do modelo."));
        foreach (var extra in extras)
        {
            if (!FieldKeyRegex().IsMatch(extra.Key)) { errors[$"fields.{extra.Key}"] = ["Chave de campo inválida."]; continue; }
            var label = extra.Label?.Trim() ?? "";
            if (label.Length is < 1 or > 100) { errors[$"fields.{extra.Key}"] = ["Todo campo precisa de um nome (até 100 caracteres)."]; continue; }
            var field = new SheetEntryField { Key = extra.Key, Label = label, Type = extra.Type ?? SheetFieldType.Text, FromTemplate = false };
            CheckValue(field, extra.Value?.Trim(), errors);
            field.Value = Clean(extra.Value);
            result.Add(field);
        }

        return errors.Count > 0 ? ([], TypedResults.ValidationProblem(errors)) : (result, null);
    }

    private static void CheckValue(SheetEntryField field, string? value, Dictionary<string, string[]> errors)
    {
        if (field.Required && string.IsNullOrWhiteSpace(value)) errors[$"fields.{field.Key}"] = [$"\"{field.Label}\" é obrigatório."];
        else if (field.Type == SheetFieldType.Number && !string.IsNullOrWhiteSpace(value) && !decimal.TryParse(value, out _))
            errors[$"fields.{field.Key}"] = [$"\"{field.Label}\" precisa ser um número."];
        else if (value?.Length > (field.Type == SheetFieldType.LongText ? 5000 : 200))
            errors[$"fields.{field.Key}"] = [$"\"{field.Label}\" está longo demais."];
    }

    private static async Task<IResult?> ValidateCommonAsync(string? name, string? kind, string? imageKey, string? currentImage, Guid userId, AppDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 100) return Problems.Validation("name", "O nome precisa ter de 1 a 100 caracteres.");
        if (kind?.Trim().Length > 50) return Problems.Validation("kind", "O tipo pode ter até 50 caracteres.");
        var image = Clean(imageKey);
        if (image is not null && image != currentImage && !await UploadEndpoints.OwnsAsync(db, image, userId, ct))
            return Problems.Validation("imageKey", "Imagem inválida. Envie novamente.");
        return null;
    }

    private static (List<SheetField> Fields, IResult? Error) ValidateTemplate(SaveTemplateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100) return ([], Problems.Validation("name", "O nome do modelo precisa ter de 1 a 100 caracteres."));
        var fields = req.Fields ?? [];
        if (fields.Count > MaxFields) return ([], Problems.Validation("fields", $"O modelo pode ter até {MaxFields} campos."));
        foreach (var f in fields)
        {
            if (!FieldKeyRegex().IsMatch(f.Key)) return ([], Problems.Validation("fields", $"Chave inválida: \"{f.Key}\"."));
            if (string.IsNullOrWhiteSpace(f.Label) || f.Label.Length > 100) return ([], Problems.Validation("fields", "Todo campo precisa de um nome com até 100 caracteres."));
        }
        if (fields.Select(f => f.Key).Distinct().Count() != fields.Count) return ([], Problems.Validation("fields", "Há campos com a mesma chave."));
        return (fields.Select(f => new SheetField { Key = f.Key, Label = f.Label.Trim(), Type = f.Type, Required = f.Required }).ToList(), null);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static EncyclopediaSettingsDto Settings(Community c) => new(c.FreeSheetsEnabled, c.TemplateMode);

    private static TemplateDto ToDto(SheetTemplate t) => new(t.Id, t.Name, t.Description, t.Kind, t.Fields.Select(CommunityEndpoints.ToDto).ToList());

    private static async Task<SheetDto> ToDtoAsync(AppDbContext db, EncyclopediaSheet s, MemberAccess access, Guid userId, CancellationToken ct)
    {
        var owner = await db.Users.Where(u => u.Id == s.OwnerUserId).Select(u => u.UserName!).SingleAsync(ct);
        var templateName = s.TemplateId is null ? null : await db.SheetTemplates.Where(t => t.Id == s.TemplateId).Select(t => t.Name).SingleOrDefaultAsync(ct);
        return new SheetDto(
            s.Id, access.Community.Slug, access.Community.Name, s.OwnerUserId, owner, s.Name, s.Kind, s.ImageKey,
            s.TemplateId, templateName, s.FolderId,
            s.Fields.Select(f => new SheetFieldValueDto(f.Key, f.Label, f.Type, f.Required, f.FromTemplate, f.Value)).ToList(),
            s.CreatedAt, s.UpdatedAt,
            CanEdit: CanEdit(s, access, userId),
            CanManage: access.Has(CommunityPermission.ManageCommunity),
            CanAddFields: CanAddFields(s, access.Community));
    }
}
