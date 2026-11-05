using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookollab.Api.Infrastructure.Configurations;

internal sealed class CharacterConfiguration : IEntityTypeConfiguration<Character>
{
    public void Configure(EntityTypeBuilder<Character> b)
    {
        b.Property(c => c.Name).HasMaxLength(100);
        b.Property(c => c.AvatarKey).HasMaxLength(256);
        b.OwnsMany(c => c.Sheet, s =>
        {
            s.ToJson();
            s.Property(x => x.Key).HasMaxLength(64);
        });
        b.HasIndex(c => new { c.CommunityId, c.OwnerUserId });
        b.HasOne<Community>().WithMany().HasForeignKey(c => c.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(c => c.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SceneConfiguration : IEntityTypeConfiguration<Scene>
{
    public void Configure(EntityTypeBuilder<Scene> b)
    {
        b.Property(s => s.Title).HasMaxLength(150);
        b.Property(s => s.Description).HasMaxLength(2000);
        b.HasIndex(s => new { s.CommunityId, s.Status });
        b.HasOne<Community>().WithMany().HasForeignKey(s => s.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(s => s.OpenedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(s => s.Participants).WithOne().HasForeignKey(p => p.SceneId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SceneParticipantConfiguration : IEntityTypeConfiguration<SceneParticipant>
{
    public void Configure(EntityTypeBuilder<SceneParticipant> b)
    {
        b.HasKey(p => new { p.SceneId, p.CharacterId });
        b.HasOne<Character>().WithMany().HasForeignKey(p => p.CharacterId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SceneActionConfiguration : IEntityTypeConfiguration<SceneAction>
{
    public void Configure(EntityTypeBuilder<SceneAction> b)
    {
        b.Property(a => a.Content).HasMaxLength(20_000);
        b.HasIndex(a => new { a.SceneId, a.CreatedAt });
        b.HasOne<Scene>().WithMany().HasForeignKey(a => a.SceneId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Character>().WithMany().HasForeignKey(a => a.CharacterId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(a => a.AuthorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(a => a.Revisions).WithOne().HasForeignKey(r => r.ActionId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> b)
    {
        b.Property(c => c.Title).HasMaxLength(200);
        b.Property(c => c.Content).HasMaxLength(200_000);
        b.HasIndex(c => new { c.CommunityId, c.Status, c.PublishedAt });
        b.HasIndex(c => c.CharacterId);
        b.HasOne<Community>().WithMany().HasForeignKey(c => c.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Character>().WithMany().HasForeignKey(c => c.CharacterId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(c => c.AuthorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(c => c.Revisions).WithOne().HasForeignKey(r => r.ChapterId).OnDelete(DeleteBehavior.Cascade);
    }
}
