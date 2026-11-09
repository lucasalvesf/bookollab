using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Communities;

public static partial class CommunityEndpoints
{
    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$")]
    private static partial Regex SlugRegex();

    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex FieldKeyRegex();

    public static void MapCommunityEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/communities").WithTags("Communities").RequireAuthorization();
        g.MapPost("/", Create).WithName("CreateCommunity").Produces<CommunityDetail>(StatusCodes.Status201Created);
        g.MapGet("/", Discover).WithName("DiscoverCommunities").Produces<List<CommunitySummary>>();
        g.MapGet("/{slug}", Get).WithName("GetCommunity").Produces<CommunityDetail>();
        g.MapPost("/{slug}/join", Join).WithName("JoinCommunity").Produces<JoinResponse>();
        g.MapGet("/{slug}/members", Members).WithName("ListMembers").Produces<List<MemberDto>>();
        g.MapPost("/{slug}/members/{userId:guid}/remove", RemoveMember).WithName("RemoveMember").Produces(StatusCodes.Status204NoContent);
        g.MapGet("/{slug}/join-requests", ListRequests).WithName("ListJoinRequests").Produces<List<JoinRequestDto>>();
        g.MapPost("/{slug}/join-requests/{id:guid}/approve", (string slug, Guid id, ClaimsPrincipal u, AppDbContext db, PermissionService p, TimeProvider c, CancellationToken ct) => Decide(slug, id, true, u, db, p, c, ct))
            .WithName("ApproveJoinRequest").Produces(StatusCodes.Status204NoContent);
        g.MapPost("/{slug}/join-requests/{id:guid}/reject", (string slug, Guid id, ClaimsPrincipal u, AppDbContext db, PermissionService p, TimeProvider c, CancellationToken ct) => Decide(slug, id, false, u, db, p, c, ct))
            .WithName("RejectJoinRequest").Produces(StatusCodes.Status204NoContent);
        g.MapGet("/{slug}/invites", ListInvites).WithName("ListInvites").Produces<List<InviteDto>>();
        g.MapPost("/{slug}/invites", CreateInvite).WithName("CreateInvite").Produces<InviteDto>(StatusCodes.Status201Created);
        g.MapPut("/{slug}/sheet-fields", UpdateSheetFields).WithName("UpdateSheetFields").Produces<List<SheetFieldDto>>();

        app.MapGet("/me/communities", Mine).WithTags("Communities").WithName("MyCommunities")
            .RequireAuthorization().Produces<List<CommunitySummary>>();

        var invites = app.MapGroup("/invites").WithTags("Communities").RequireAuthorization();
        invites.MapGet("/{code}", PreviewInvite).WithName("PreviewInvite").Produces<InvitePreview>();
        invites.MapPost("/{code}/accept", AcceptInvite).WithName("AcceptInvite").Produces<JoinResponse>();
    }

    // ------------------------------------------------------------------ community

    private static async Task<IResult> Create(CreateCommunityRequest req, ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 3 or > 100) return Problems.Validation("name", "O nome precisa ter de 3 a 100 caracteres.");
        if (req.Description?.Length > 2000) return Problems.Validation("description", "A descrição pode ter até 2.000 caracteres.");

        string slug;
        if (string.IsNullOrWhiteSpace(req.Slug))
        {
            var baseSlug = Slugify(name);
            slug = baseSlug;
            for (var i = 2; await db.Communities.AnyAsync(c => c.Slug == slug, ct); i++) slug = $"{baseSlug}-{i}";
        }
        else
        {
            slug = req.Slug.Trim().ToLowerInvariant();
            if (!SlugRegex().IsMatch(slug))
                return Problems.Validation("slug", "Use de 3 a 48 caracteres: letras minúsculas, números e hífen.");
            if (await db.Communities.AnyAsync(c => c.Slug == slug, ct))
                return Problems.Validation("slug", "Este endereço já está em uso.");
        }

        var community = Community.Create(slug, name, user.UserId());
        community.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        community.JoinPolicy = req.JoinPolicy;
        db.Communities.Add(community);
        await db.SaveChangesAsync(ct);

        var owner = community.Roles.Single(r => r.BaseKind == BaseRoleKind.Owner);
        return TypedResults.Created($"/communities/{slug}", ToDetail(community, 1, owner, false));
    }

    private static async Task<IResult> Discover(string? search, AppDbContext db, CancellationToken ct)
    {
        var query = db.Communities.Where(c => c.JoinPolicy == JoinPolicy.Open);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(c => EF.Functions.ILike(c.Name, term) || EF.Functions.ILike(c.Description ?? "", term));
        }
        var list = await query
            .OrderByDescending(c => c.Memberships.Count).ThenBy(c => c.Name)
            .Take(50)
            .Select(c => new CommunitySummary(c.Id, c.Slug, c.Name, c.Description, c.JoinPolicy, c.Memberships.Count))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> Mine(ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.UserId();
        var list = await db.Communities
            .Where(c => c.Memberships.Any(m => m.UserId == userId))
            .OrderBy(c => c.Name)
            .Select(c => new CommunitySummary(c.Id, c.Slug, c.Name, c.Description, c.JoinPolicy, c.Memberships.Count))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> Get(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var community = await perms.FindCommunityAsync(slug, ct);
        if (community is null) return Problems.NotFound("Comunidade não encontrada.");
        var userId = user.UserId();
        var access = await perms.GetAccessAsync(community, userId, ct);
        var memberCount = await db.Memberships.CountAsync(m => m.CommunityId == community.Id, ct);
        var pending = access is null && await db.JoinRequests.AnyAsync(
            r => r.CommunityId == community.Id && r.UserId == userId && r.Status == JoinRequestStatus.Pending, ct);
        return TypedResults.Ok(ToDetail(community, memberCount, access?.Role, pending));
    }

    private static async Task<IResult> Join(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var community = await perms.FindCommunityAsync(slug, ct);
        if (community is null) return Problems.NotFound("Comunidade não encontrada.");
        var userId = user.UserId();
        if (await perms.GetAccessAsync(community, userId, ct) is not null) return TypedResults.Ok(new JoinResponse("member"));

        switch (community.JoinPolicy)
        {
            case JoinPolicy.Open:
                await AddMemberAsync(db, community.Id, userId, ct);
                return TypedResults.Ok(new JoinResponse("member"));
            case JoinPolicy.Request:
                var pending = await db.JoinRequests.AnyAsync(
                    r => r.CommunityId == community.Id && r.UserId == userId && r.Status == JoinRequestStatus.Pending, ct);
                if (!pending)
                {
                    db.JoinRequests.Add(new JoinRequest { CommunityId = community.Id, UserId = userId });
                    await db.SaveChangesAsync(ct);
                }
                return TypedResults.Ok(new JoinResponse("pending"));
            default:
                return Problems.Forbidden("Esta comunidade só aceita membros por convite.");
        }
    }

    private static async Task<IResult> Members(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return error;
        var list = await db.Memberships
            .Where(m => m.CommunityId == access!.Community.Id)
            .OrderBy(m => m.Role.Position).ThenBy(m => m.User.DisplayName)
            .Select(m => new MemberDto(m.UserId, m.User.UserName!, m.Nickname ?? m.User.DisplayName, m.AvatarKey ?? m.User.AvatarKey, m.Role.Name, m.Role.BaseKind, m.JoinedAt))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    /// <summary>
    /// Removes ("expels") a member. Needs ManageMembers; nobody removes the Owner, and only someone higher in the
    /// hierarchy (lower role position) can remove a member. The member's content stays.
    /// </summary>
    private static async Task<IResult> RemoveMember(string slug, Guid userId, ClaimsPrincipal user, AppDbContext db, PermissionService perms, Notifications.NotificationService notifications, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.ManageMembers, user, perms, ct);
        if (error is not null) return error;
        var target = await db.Memberships.Include(m => m.Role)
            .SingleOrDefaultAsync(m => m.CommunityId == access!.Community.Id && m.UserId == userId, ct);
        if (target is null) return Problems.NotFound("Membro não encontrado.");
        if (target.Role.BaseKind == BaseRoleKind.Owner) return Problems.Forbidden("O Dono não pode ser removido.");
        if (target.Role.Position <= access!.Role.Position) return Problems.Forbidden("Você só pode remover membros com cargo abaixo do seu.");

        db.Memberships.Remove(target);
        await db.SaveChangesAsync(ct);
        await notifications.NotifyAsync(userId, Domain.Notifications.NotificationType.RemovedFromCommunity,
            $"Você foi removido de \"{access.Community.Name}\"", null, null, null, user.UserId(), ct);
        return TypedResults.NoContent();
    }

    // ------------------------------------------------------------------ join requests

    private static async Task<IResult> ListRequests(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.ManageMembers, user, perms, ct);
        if (error is not null) return error;
        var list = await db.JoinRequests
            .Where(r => r.CommunityId == access!.Community.Id && r.Status == JoinRequestStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .Join(db.Users, r => r.UserId, u => u.Id, (r, u) => new JoinRequestDto(r.Id, u.Id, u.UserName!, u.DisplayName, r.CreatedAt))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static async Task<IResult> Decide(string slug, Guid id, bool approve, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.ManageMembers, user, perms, ct);
        if (error is not null) return error;
        var request = await db.JoinRequests.SingleOrDefaultAsync(
            r => r.Id == id && r.CommunityId == access!.Community.Id && r.Status == JoinRequestStatus.Pending, ct);
        if (request is null) return Problems.NotFound("Pedido não encontrado.");

        request.Status = approve ? JoinRequestStatus.Approved : JoinRequestStatus.Rejected;
        request.DecidedByUserId = user.UserId();
        request.DecidedAt = clock.GetUtcNow();
        if (approve && !await db.Memberships.AnyAsync(m => m.CommunityId == request.CommunityId && m.UserId == request.UserId, ct))
            await AddMemberAsync(db, request.CommunityId, request.UserId, ct, save: false);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    // ------------------------------------------------------------------ invites

    private static async Task<IResult> ListInvites(string slug, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.CreateInvites, user, perms, ct);
        if (error is not null) return error;
        var now = clock.GetUtcNow();
        var invites = await db.Invites.Where(i => i.CommunityId == access!.Community.Id).OrderByDescending(i => i.CreatedAt).ToListAsync(ct);
        return TypedResults.Ok(invites.Where(i => i.IsUsable(now)).Select(i => new InviteDto(i.Code, i.ExpiresAt, i.MaxUses, i.Uses)).ToList());
    }

    private static async Task<IResult> CreateInvite(string slug, CreateInviteRequest req, ClaimsPrincipal user, AppDbContext db, PermissionService perms, TimeProvider clock, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.CreateInvites, user, perms, ct);
        if (error is not null) return error;
        if (req.ExpiresInDays is < 1 or > 365) return Problems.Validation("expiresInDays", "Use de 1 a 365 dias.");
        if (req.MaxUses is < 1 or > 1000) return Problems.Validation("maxUses", "Use de 1 a 1.000 usos.");

        var invite = new Invite
        {
            Code = NewInviteCode(),
            CommunityId = access!.Community.Id,
            CreatedByUserId = user.UserId(),
            ExpiresAt = req.ExpiresInDays is { } days ? clock.GetUtcNow().AddDays(days) : null,
            MaxUses = req.MaxUses,
        };
        db.Invites.Add(invite);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/invites/{invite.Code}", new InviteDto(invite.Code, invite.ExpiresAt, invite.MaxUses, invite.Uses));
    }

    private static async Task<IResult> PreviewInvite(string code, ClaimsPrincipal user, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var invite = await db.Invites.SingleOrDefaultAsync(i => i.Code == code, ct);
        if (invite is null) return Problems.NotFound("Convite não encontrado.");
        var community = await db.Communities.SingleAsync(c => c.Id == invite.CommunityId, ct);
        var userId = user.UserId();
        var member = await db.Memberships.AnyAsync(m => m.CommunityId == community.Id && m.UserId == userId, ct);
        return TypedResults.Ok(new InvitePreview(code, community.Slug, community.Name, community.Description, invite.IsUsable(clock.GetUtcNow()), member));
    }

    private static async Task<IResult> AcceptInvite(string code, ClaimsPrincipal user, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var invite = await db.Invites.SingleOrDefaultAsync(i => i.Code == code, ct);
        if (invite is null) return Problems.NotFound("Convite não encontrado.");
        var userId = user.UserId();
        if (await db.Memberships.AnyAsync(m => m.CommunityId == invite.CommunityId && m.UserId == userId, ct))
            return TypedResults.Ok(new JoinResponse("member"));
        if (!invite.IsUsable(clock.GetUtcNow())) return Problems.Conflict("Este convite expirou ou atingiu o limite de usos.", "invite_unusable");

        invite.Uses++;
        await AddMemberAsync(db, invite.CommunityId, userId, ct, save: false);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new JoinResponse("member"));
    }

    // ------------------------------------------------------------------ sheet fields

    private static async Task<IResult> UpdateSheetFields(string slug, List<SheetFieldDto> fields, ClaimsPrincipal user, AppDbContext db, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await RequireAsync(slug, CommunityPermission.ManageCommunity, user, perms, ct);
        if (error is not null) return error;
        if (fields.Count > 30) return Problems.Validation("fields", "A ficha pode ter até 30 campos.");
        foreach (var f in fields)
        {
            if (!FieldKeyRegex().IsMatch(f.Key)) return Problems.Validation("fields", $"Chave inválida: \"{f.Key}\". Use letras minúsculas, números e _.");
            if (string.IsNullOrWhiteSpace(f.Label) || f.Label.Length > 100) return Problems.Validation("fields", "Todo campo precisa de um rótulo com até 100 caracteres.");
        }
        if (fields.Select(f => f.Key).Distinct().Count() != fields.Count) return Problems.Validation("fields", "Há campos com a mesma chave.");

        access!.Community.SheetFields = fields.Select(f => new SheetField { Key = f.Key, Label = f.Label.Trim(), Type = f.Type, Required = f.Required }).ToList();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(access.Community.SheetFields.Select(ToDto).ToList());
    }

    // ------------------------------------------------------------------ helpers

    public static async Task<(MemberAccess? Access, IResult? Error)> RequireMemberAsync(string slug, ClaimsPrincipal user, PermissionService perms, CancellationToken ct)
    {
        var community = await perms.FindCommunityAsync(slug, ct);
        if (community is null) return (null, Problems.NotFound("Comunidade não encontrada."));
        var access = await perms.GetAccessAsync(community, user.UserId(), ct);
        return access is null ? (null, Problems.Forbidden("Você não é membro desta comunidade.")) : (access, null);
    }

    public static async Task<(MemberAccess? Access, IResult? Error)> RequireAsync(string slug, CommunityPermission permission, ClaimsPrincipal user, PermissionService perms, CancellationToken ct)
    {
        var (access, error) = await RequireMemberAsync(slug, user, perms, ct);
        if (error is not null) return (null, error);
        return access!.Has(permission) ? (access, null) : (null, Problems.Forbidden());
    }

    private static async Task AddMemberAsync(AppDbContext db, Guid communityId, Guid userId, CancellationToken ct, bool save = true)
    {
        var playerRoleId = await db.CommunityRoles
            .Where(r => r.CommunityId == communityId && r.BaseKind == BaseRoleKind.Player)
            .Select(r => r.Id).SingleAsync(ct);
        db.Memberships.Add(new Membership { CommunityId = communityId, UserId = userId, RoleId = playerRoleId });
        if (save) await db.SaveChangesAsync(ct);
    }

    public static SheetFieldDto ToDto(SheetField f) => new(f.Key, f.Label, f.Type, f.Required);

    private static CommunityDetail ToDetail(Community c, int memberCount, CommunityRole? role, bool pending) => new(
        c.Id, c.Slug, c.Name, c.Description, c.JoinPolicy, c.ContentRating, memberCount,
        c.SheetFields.Select(ToDto).ToList(),
        role is null ? null : new MyAccess(role.Name, role.BaseKind, PermissionNames(role.Permissions)),
        pending, Mechanics.MechanicsEndpoints.ToDto(c));

    public static IReadOnlyList<string> PermissionNames(CommunityPermission permissions) =>
        Enum.GetValues<CommunityPermission>()
            .Where(p => p is not CommunityPermission.None and not CommunityPermission.All && permissions.HasFlag(p))
            .Select(p => p.ToString())
            .ToList();

    public static string Slugify(string name)
    {
        var normalized = name.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            var lower = char.ToLowerInvariant(ch);
            sb.Append(lower is (>= 'a' and <= 'z') or (>= '0' and <= '9') ? lower : '-');
        }
        var slug = Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
        if (slug.Length > 48) slug = slug[..48].Trim('-');
        return slug.Length >= 3 ? slug : $"comunidade-{slug}".Trim('-');
    }

    private static string NewInviteCode()
    {
        const string alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alike characters
        return string.Create(10, alphabet, static (span, a) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = a[RandomNumberGenerator.GetInt32(a.Length)];
        });
    }
}
