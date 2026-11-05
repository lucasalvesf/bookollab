using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Domain.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<User, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Community> Communities => Set<Community>();
    public DbSet<CommunityRole> CommunityRoles => Set<CommunityRole>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<JoinRequest> JoinRequests => Set<JoinRequest>();
    public DbSet<Invite> Invites => Set<Invite>();
    public DbSet<Character> Characters => Set<Character>();
    public DbSet<Scene> Scenes => Set<Scene>();
    public DbSet<SceneParticipant> SceneParticipants => Set<SceneParticipant>();
    public DbSet<SceneAction> SceneActions => Set<SceneAction>();
    public DbSet<SceneActionRevision> SceneActionRevisions => Set<SceneActionRevision>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<ChapterRevision> ChapterRevisions => Set<ChapterRevision>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configuration)
    {
        // Enums are stored as readable text (e.g. "InviteOnly") instead of numbers.
        configuration.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Identity tables follow the same snake_case naming as the rest of the schema.
        builder.Entity<User>().ToTable("users");
        builder.Entity<IdentityRole<Guid>>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");

        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
