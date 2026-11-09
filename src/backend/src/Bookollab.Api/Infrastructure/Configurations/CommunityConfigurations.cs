using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookollab.Api.Infrastructure.Configurations;

internal sealed class CommunityConfiguration : IEntityTypeConfiguration<Community>
{
    public void Configure(EntityTypeBuilder<Community> b)
    {
        b.Property(c => c.Slug).HasMaxLength(64);
        b.HasIndex(c => c.Slug).IsUnique();
        b.Property(c => c.Name).HasMaxLength(100);
        b.Property(c => c.Description).HasMaxLength(2000);
        b.OwnsMany(c => c.SheetFields, f =>
        {
            f.ToJson();
            f.Property(x => x.Key).HasMaxLength(64);
            f.Property(x => x.Label).HasMaxLength(100);
        });
        b.HasOne(c => c.Owner).WithMany().HasForeignKey(c => c.OwnerId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(c => c.Roles).WithOne().HasForeignKey(r => r.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.Memberships).WithOne().HasForeignKey(m => m.CommunityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class CommunityRoleConfiguration : IEntityTypeConfiguration<CommunityRole>
{
    public void Configure(EntityTypeBuilder<CommunityRole> b)
    {
        b.Property(r => r.Name).HasMaxLength(64);
        // Bit mask: must stay numeric (overrides the enum-as-text convention).
        b.Property(r => r.Permissions).HasConversion<long>();
        b.HasIndex(r => new { r.CommunityId, r.Name }).IsUnique();
    }
}

internal sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> b)
    {
        b.HasKey(m => new { m.CommunityId, m.UserId });
        b.HasIndex(m => m.UserId);
        b.Property(m => m.Nickname).HasMaxLength(64);
        b.Property(m => m.Bio).HasMaxLength(1000);
        b.Property(m => m.AvatarKey).HasMaxLength(256);
        b.Property(m => m.CoverKey).HasMaxLength(256);
        b.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(m => m.Role).WithMany().HasForeignKey(m => m.RoleId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class JoinRequestConfiguration : IEntityTypeConfiguration<JoinRequest>
{
    public void Configure(EntityTypeBuilder<JoinRequest> b)
    {
        b.HasOne<Community>().WithMany().HasForeignKey(r => r.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        // At most one pending request per user per community.
        b.HasIndex(r => new { r.CommunityId, r.UserId })
            .IsUnique()
            .HasFilter("status = 'Pending'");
    }
}

internal sealed class InviteConfiguration : IEntityTypeConfiguration<Invite>
{
    public void Configure(EntityTypeBuilder<Invite> b)
    {
        b.HasKey(i => i.Code);
        b.Property(i => i.Code).HasMaxLength(32);
        b.HasOne<Community>().WithMany().HasForeignKey(i => i.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(i => i.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
