using Bookollab.Api.Domain.Users;

namespace Bookollab.Api.Domain.Communities;

public enum JoinPolicy
{
    Open,
    Request,
    InviteOnly,
}

public enum ContentRating
{
    Free,
    Sixteen,
    Eighteen,
}

public enum BaseRoleKind
{
    Owner,
    Staff,
    Narrator,
    Player,
    Custom,
}

public enum JoinRequestStatus
{
    Pending,
    Approved,
    Rejected,
}

public enum SheetFieldType
{
    Text,
    LongText,
    Number,
}

public sealed class Community
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public JoinPolicy JoinPolicy { get; set; } = JoinPolicy.Open;
    public ContentRating ContentRating { get; set; } = ContentRating.Free;

    /// <summary>Character sheet fields defined by the staff (stored as jsonb).</summary>
    public List<SheetField> SheetFields { get; set; } = [];

    /// <summary>Encyclopedia: may players create sheets from scratch (without a template)?</summary>
    public bool FreeSheetsEnabled { get; set; } = true;

    /// <summary>Encyclopedia: whether template-based sheets may add fields.</summary>
    public Encyclopedia.TemplateMode TemplateMode { get; set; } = Encyclopedia.TemplateMode.Base;

    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public List<CommunityRole> Roles { get; init; } = [];
    public List<Membership> Memberships { get; init; } = [];

    /// <summary>Creates a community with the four base roles and the creator as Owner.</summary>
    public static Community Create(string slug, string name, Guid ownerId)
    {
        var community = new Community { Slug = slug, Name = name, OwnerId = ownerId };
        BaseRoleKind[] kinds = [BaseRoleKind.Owner, BaseRoleKind.Staff, BaseRoleKind.Narrator, BaseRoleKind.Player];
        for (var i = 0; i < kinds.Length; i++)
        {
            community.Roles.Add(new CommunityRole
            {
                CommunityId = community.Id,
                Name = DefaultRoleName(kinds[i]),
                BaseKind = kinds[i],
                Permissions = DefaultRolePermissions.For(kinds[i]),
                Position = i,
            });
        }

        community.Memberships.Add(new Membership
        {
            CommunityId = community.Id,
            UserId = ownerId,
            RoleId = community.Roles[0].Id,
        });
        return community;
    }

    private static string DefaultRoleName(BaseRoleKind kind) => kind switch
    {
        BaseRoleKind.Owner => "Dono",
        BaseRoleKind.Staff => "Staff",
        BaseRoleKind.Narrator => "Narrador",
        _ => "Jogador",
    };
}

public sealed class SheetField
{
    public required string Key { get; set; }
    public required string Label { get; set; }
    public SheetFieldType Type { get; set; } = SheetFieldType.Text;
    public bool Required { get; set; }
}

public sealed class CommunityRole
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public required string Name { get; set; }
    public BaseRoleKind BaseKind { get; set; } = BaseRoleKind.Custom;
    public CommunityPermission Permissions { get; set; }

    /// <summary>Lower = higher in the hierarchy (Owner = 0).</summary>
    public int Position { get; set; }
}

public sealed class Membership
{
    public Guid CommunityId { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid RoleId { get; set; }
    public CommunityRole Role { get; set; } = null!;
    public DateTimeOffset JoinedAt { get; init; } = DateTimeOffset.UtcNow;

    // Community profile (OffGame). Null fields inherit from the global profile.
    public string? Nickname { get; set; }
    public string? Bio { get; set; }
    public string? AvatarKey { get; set; }
    public string? CoverKey { get; set; }
}

public sealed class JoinRequest
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public Guid UserId { get; set; }
    public JoinRequestStatus Status { get; set; } = JoinRequestStatus.Pending;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public Guid? DecidedByUserId { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}

public sealed class Invite
{
    public required string Code { get; init; }
    public Guid CommunityId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpiresAt { get; set; }
    public int? MaxUses { get; set; }
    public int Uses { get; set; }

    public bool IsUsable(DateTimeOffset now) =>
        (ExpiresAt is null || ExpiresAt > now) && (MaxUses is null || Uses < MaxUses);
}
