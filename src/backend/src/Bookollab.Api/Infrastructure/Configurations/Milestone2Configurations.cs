using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Notifications;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookollab.Api.Infrastructure.Configurations;

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.Property(n => n.Title).HasMaxLength(200);
        b.Property(n => n.Body).HasMaxLength(1000);
        b.Property(n => n.Link).HasMaxLength(300);
        b.HasIndex(n => new { n.UserId, n.CreatedAt });
        b.HasOne<User>().WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Community>().WithMany().HasForeignKey(n => n.CommunityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class InventoryItemConfiguration : IEntityTypeConfiguration<Domain.Mechanics.InventoryItem>
{
    public void Configure(EntityTypeBuilder<Domain.Mechanics.InventoryItem> b)
    {
        b.Property(i => i.Name).HasMaxLength(100);
        b.Property(i => i.Description).HasMaxLength(1000);
        b.HasIndex(i => i.CharacterId);
        b.HasOne<Character>().WithMany().HasForeignKey(i => i.CharacterId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(i => i.GivenByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class FeaturedItemConfiguration : IEntityTypeConfiguration<FeaturedItem>
{
    public void Configure(EntityTypeBuilder<FeaturedItem> b)
    {
        b.HasIndex(f => new { f.CommunityId, f.ItemType, f.ItemId }).IsUnique();
        b.HasOne<Community>().WithMany().HasForeignKey(f => f.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(f => f.FeaturedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PinnedPostConfiguration : IEntityTypeConfiguration<PinnedPost>
{
    public void Configure(EntityTypeBuilder<PinnedPost> b)
    {
        b.HasIndex(p => new { p.CommunityId, p.ChapterId }).IsUnique();
        b.HasOne<Community>().WithMany().HasForeignKey(p => p.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Domain.Chapters.Chapter>().WithMany().HasForeignKey(p => p.ChapterId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(p => p.PinnedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SceneInviteConfiguration : IEntityTypeConfiguration<SceneInvite>
{
    public void Configure(EntityTypeBuilder<SceneInvite> b)
    {
        b.HasKey(i => new { i.SceneId, i.CharacterId });
        b.HasOne<Scene>().WithMany().HasForeignKey(i => i.SceneId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Character>().WithMany().HasForeignKey(i => i.CharacterId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(i => i.InvitedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SceneJoinRequestConfiguration : IEntityTypeConfiguration<SceneJoinRequest>
{
    public void Configure(EntityTypeBuilder<SceneJoinRequest> b)
    {
        b.HasIndex(r => new { r.SceneId, r.CharacterId }).IsUnique().HasFilter("status = 'Pending'");
        b.HasOne<Scene>().WithMany().HasForeignKey(r => r.SceneId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Character>().WithMany().HasForeignKey(r => r.CharacterId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
