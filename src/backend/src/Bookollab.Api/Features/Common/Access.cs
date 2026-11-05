using System.Security.Claims;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Bookollab.Api.Features.Common;

public static class ClaimsPrincipalExtensions
{
    public static Guid UserId(this ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? throw new InvalidOperationException("Authenticated user without 'sub' claim."));
}

/// <summary>The current user's membership in a community, with the resolved permissions.</summary>
public sealed record MemberAccess(Community Community, Membership Membership, CommunityRole Role)
{
    public bool Has(CommunityPermission permission) => Role.Permissions.HasFlag(permission);
}

/// <summary>Central place for community permission checks (used by endpoints and, later, the scene hub).</summary>
public sealed class PermissionService(AppDbContext db)
{
    public Task<Community?> FindCommunityAsync(string slug, CancellationToken ct) =>
        db.Communities.SingleOrDefaultAsync(c => c.Slug == slug, ct);

    public async Task<MemberAccess?> GetAccessAsync(Community community, Guid userId, CancellationToken ct)
    {
        var membership = await db.Memberships
            .Include(m => m.Role)
            .SingleOrDefaultAsync(m => m.CommunityId == community.Id && m.UserId == userId, ct);
        return membership is null ? null : new MemberAccess(community, membership, membership.Role);
    }

    public async Task<MemberAccess?> GetAccessAsync(Guid communityId, Guid userId, CancellationToken ct)
    {
        var community = await db.Communities.FindAsync([communityId], ct);
        return community is null ? null : await GetAccessAsync(community, userId, ct);
    }
}

public static class Problems
{
    public static IResult NotFound(string detail = "Não encontrado.") =>
        TypedResults.Problem(detail: detail, statusCode: StatusCodes.Status404NotFound);

    public static IResult Forbidden(string detail = "Você não tem permissão para isso.") =>
        TypedResults.Problem(detail: detail, statusCode: StatusCodes.Status403Forbidden);

    public static IResult Conflict(string detail, string code) =>
        TypedResults.Problem(detail: detail, statusCode: StatusCodes.Status409Conflict,
            extensions: new Dictionary<string, object?> { ["code"] = code });

    public static IResult Validation(string field, string message) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
