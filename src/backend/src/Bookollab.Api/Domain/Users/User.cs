using Microsoft.AspNetCore.Identity;

namespace Bookollab.Api.Domain.Users;

/// <summary>
/// Platform account. UserName is the unique public handle.
/// </summary>
public sealed class User : IdentityUser<Guid>
{
    public required string DisplayName { get; set; }

    /// <summary>Set at sign-up; not freely editable (used for the 13+ and +18 rules).</summary>
    public required DateOnly BirthDate { get; init; }

    public string? Bio { get; set; }

    public string? AvatarKey { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
