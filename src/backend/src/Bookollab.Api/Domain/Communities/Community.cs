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

    /// <summary>Chapters: which authors need staff approval before a chapter shows up.</summary>
    public Chapters.ChapterApprovalMode ChapterApprovalMode { get; set; } = Chapters.ChapterApprovalMode.Off;

    /// <summary>Roles whose chapters need approval when the mode is "Roles".</summary>
    public List<Guid> ChapterApprovalRoleIds { get; set; } = [];

    /// <summary>Community icon and cover (upload keys).</summary>
    public string? IconKey { get; set; }
    public string? CoverKey { get; set; }

    /// <summary>Order of the sections members see on the community home (see <see cref="CommunitySections"/>).</summary>
    public List<string> Sections { get; set; } = [.. CommunitySections.Default];

    /// <summary>How the community's latest posts are laid out on its home (chosen by the owner).</summary>
    public FeedLayout FeedLayout { get; set; } = FeedLayout.Highlight;

    /// <summary>Main color of the community ("#RRGGBB"). The app derives the light and dark palettes from it. Null = platform color.</summary>
    public string? AccentColor { get; set; }

    /// <summary>Arrangement of the community home on wide screens.</summary>
    public HomeLayout HomeLayout { get; set; } = HomeLayout.Stacked;

    /// <summary>Accent = only the brand color changes; Full = backgrounds, surfaces and borders also derive from AccentColor.</summary>
    public ThemeMode ThemeMode { get; set; } = ThemeMode.Accent;

    /// <summary>Manual overrides of derived theme tokens (token name → #RRGGBB), set by the moderation.</summary>
    public Dictionary<string, string> ThemeOverrides { get; set; } = [];

    /// <summary>Image behind the whole community (upload key) and its blur in px (0-40).</summary>
    public string? BackgroundKey { get; set; }
    public int BackgroundBlur { get; set; }

    /// <summary>Custom name of the inventory (e.g. Mochila, Baú). Null = Inventário.</summary>
    public string? InventoryLabel { get; set; }

    /// <summary>Custom names of the main sections (section key → title). Missing = default name.</summary>
    public Dictionary<string, string> SectionTitles { get; set; } = [];

    /// <summary>Groups of links of the side menu (Amino-like), written by the moderation.</summary>
    public List<SideMenuGroup> SideMenu { get; set; } = [];

    // RPG mechanics, each optional (off = more free and literary play).
    public bool DiceEnabled { get; set; }
    public bool AttributesEnabled { get; set; }
    public bool InventoryEnabled { get; set; }

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
        BaseRoleKind.Staff => "Moderador",
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

/// <summary>Sections of the community home. The owner (or whoever has ArrangeSections) decides the order.</summary>
public static class CommunitySections
{
    public const string Overview = "overview";
    public const string Scenes = "scenes";
    public const string Chapters = "chapters";
    public const string Encyclopedia = "encyclopedia";
    public const string Characters = "characters";
    public const string Members = "members";
    public const string Activity = "activity";

    public static readonly string[] Default = [Overview, Activity, Scenes, Chapters, Encyclopedia, Characters, Members];

    /// <summary>Known sections in the saved order, plus any section added later at the end.</summary>
    public static List<string> Normalize(IEnumerable<string> saved)
    {
        var known = saved.Where(Default.Contains).Distinct().ToList();
        // "Overview" came later: communities saved before it get it first, like everyone else.
        if (!known.Contains(Overview)) known.Insert(0, Overview);
        known.AddRange(Default.Where(s => !known.Contains(s)));
        return known;
    }
}
/// <summary>Layout of the posts on the community home (Amino-like front page).</summary>
public enum FeedLayout
{
    /// <summary>Swipeable carousel of cards.</summary>
    Carousel,

    /// <summary>One big post on top, the others smaller below.</summary>
    Highlight,

    /// <summary>Grid that puts the cover images first.</summary>
    Gallery,
}

public enum ThemeMode
{
    Accent,
    Full,
}

public enum HomeLayout
{
    /// <summary>Highlights on top, everything else below; sections open in a side panel.</summary>
    Stacked,

    /// <summary>Highlights live in the right-hand panel; sections replace them when opened.</summary>
    FeaturedSide,
}

/// <summary>A named group of links in the community side menu.</summary>
public sealed class SideMenuGroup
{
    public required string Title { get; set; }
    public List<SideMenuLink> Links { get; set; } = [];
}

/// <summary>
/// Link to anything inside the community. <see cref="Target"/> is "kind:id" (see Features/Links), e.g.
/// "sheet:{guid}", "character:{guid}", "chat:{guid}", "post:{guid}", "member:{userName}", "section:{key}".
/// </summary>
public sealed class SideMenuLink
{
    public required string Label { get; set; }
    public required string Target { get; set; }
}

/// <summary>Post pinned by the moderation in the bar under the community header.</summary>
public sealed class PinnedPost
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public Guid ChapterId { get; set; }
    public int Position { get; set; }
    public Guid PinnedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public enum FeaturedItemType
{
    /// <summary>A post (chapter or blog).</summary>
    Post,
    Sheet,
    Character,
}

/// <summary>Content featured by the moderation on the community home (bigger, on top).</summary>
public sealed class FeaturedItem
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CommunityId { get; set; }
    public FeaturedItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public int Position { get; set; }
    public Guid FeaturedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}