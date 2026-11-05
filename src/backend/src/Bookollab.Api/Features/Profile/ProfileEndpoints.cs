using System.Security.Claims;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Features.Auth;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Features.Uploads;
using Bookollab.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;

namespace Bookollab.Api.Features.Profile;

public sealed record UpdateProfileRequest(string DisplayName, string? Bio, string? AvatarKey);

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPut("/me", Update).WithTags("Profile").WithName("UpdateMe").RequireAuthorization().Produces<MeResponse>();
    }

    /// <summary>Updates the editable parts of the global profile (the birth date is not editable).</summary>
    private static async Task<IResult> Update(UpdateProfileRequest req, ClaimsPrincipal principal, UserManager<User> users, AppDbContext db, CancellationToken ct)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null) return TypedResults.Unauthorized();

        var name = req.DisplayName?.Trim() ?? "";
        if (name.Length is < 1 or > 64) return Problems.Validation("displayName", "Informe um nome de exibição com até 64 caracteres.");
        if (req.Bio?.Length > 1000) return Problems.Validation("bio", "A bio pode ter até 1.000 caracteres.");
        var avatar = string.IsNullOrWhiteSpace(req.AvatarKey) ? null : req.AvatarKey;
        if (avatar is not null && avatar != user.AvatarKey && !await UploadEndpoints.OwnsAsync(db, avatar, user.Id, ct))
            return Problems.Validation("avatarKey", "Imagem inválida. Envie novamente.");

        user.DisplayName = name;
        user.Bio = string.IsNullOrWhiteSpace(req.Bio) ? null : req.Bio.Trim();
        user.AvatarKey = avatar;
        await users.UpdateAsync(user);

        var roles = await users.GetRolesAsync(user);
        return TypedResults.Ok(new MeResponse(user.Id, user.UserName!, user.Email!, user.DisplayName, user.BirthDate, user.Bio, user.AvatarKey, [.. roles]));
    }
}
