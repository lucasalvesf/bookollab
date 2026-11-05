namespace Bookollab.Api.Domain.Communities;

/// <summary>
/// Permission flags of a community role, grouped by category (see docs/visao-produto.md).
/// Stored as a 64-bit mask. Bit ranges are reserved per category so new flags never collide.
/// </summary>
[Flags]
public enum CommunityPermission : long
{
    None = 0,

    // Community (bits 0-9)
    ManageCommunity = 1L << 0,
    ManageRoles = 1L << 1,
    ManageMembers = 1L << 2,
    CreateInvites = 1L << 3,

    // Characters (bits 10-19)
    CreateCharacters = 1L << 10,
    ManageCharacters = 1L << 11,

    // Scenes (bits 20-29)
    JoinScenes = 1L << 20,
    OpenScenes = 1L << 21,
    CloseAnyScene = 1L << 22,

    // Chapters (bits 30-39)
    WriteChapters = 1L << 30,
    EditOthersChapters = 1L << 31,

    // Moderation (bits 40-49)
    ModerateContent = 1L << 40,
    ViewRevisionHistory = 1L << 41,

    All = ~0L,
}

/// <summary>Initial permission set of each base role when a community is created.</summary>
public static class DefaultRolePermissions
{
    public const CommunityPermission Player =
        CommunityPermission.CreateCharacters
        | CommunityPermission.JoinScenes
        | CommunityPermission.WriteChapters;

    public const CommunityPermission Narrator =
        Player
        | CommunityPermission.OpenScenes
        | CommunityPermission.CloseAnyScene;

    public const CommunityPermission Staff =
        Narrator
        | CommunityPermission.ManageCommunity
        | CommunityPermission.ManageMembers
        | CommunityPermission.CreateInvites
        | CommunityPermission.ManageCharacters
        | CommunityPermission.ModerateContent
        | CommunityPermission.ViewRevisionHistory;

    public const CommunityPermission Owner = CommunityPermission.All;

    public static CommunityPermission For(BaseRoleKind kind) => kind switch
    {
        BaseRoleKind.Owner => Owner,
        BaseRoleKind.Staff => Staff,
        BaseRoleKind.Narrator => Narrator,
        BaseRoleKind.Player => Player,
        _ => CommunityPermission.None,
    };
}
