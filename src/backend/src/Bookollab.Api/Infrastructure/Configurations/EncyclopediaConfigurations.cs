using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Encyclopedia;
using Bookollab.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookollab.Api.Infrastructure.Configurations;

internal sealed class SheetTemplateConfiguration : IEntityTypeConfiguration<SheetTemplate>
{
    public void Configure(EntityTypeBuilder<SheetTemplate> b)
    {
        b.Property(t => t.Name).HasMaxLength(100);
        b.Property(t => t.Description).HasMaxLength(1000);
        b.Property(t => t.Kind).HasMaxLength(50);
        b.OwnsMany(t => t.Fields, f =>
        {
            f.ToJson();
            f.Property(x => x.Key).HasMaxLength(64);
            f.Property(x => x.Label).HasMaxLength(100);
        });
        b.HasIndex(t => t.CommunityId);
        b.HasOne<Community>().WithMany().HasForeignKey(t => t.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(t => t.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class EncyclopediaFolderConfiguration : IEntityTypeConfiguration<EncyclopediaFolder>
{
    public void Configure(EntityTypeBuilder<EncyclopediaFolder> b)
    {
        b.Property(f => f.Name).HasMaxLength(100);
        b.HasIndex(f => new { f.CommunityId, f.Name }).IsUnique();
        b.HasOne<Community>().WithMany().HasForeignKey(f => f.CommunityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class EncyclopediaSheetConfiguration : IEntityTypeConfiguration<EncyclopediaSheet>
{
    public void Configure(EntityTypeBuilder<EncyclopediaSheet> b)
    {
        b.Property(s => s.Name).HasMaxLength(100);
        b.Property(s => s.Kind).HasMaxLength(50);
        b.Property(s => s.ImageKey).HasMaxLength(256);
        b.OwnsMany(s => s.Fields, f =>
        {
            f.ToJson();
            f.Property(x => x.Key).HasMaxLength(64);
            f.Property(x => x.Label).HasMaxLength(100);
        });
        b.HasIndex(s => new { s.CommunityId, s.FolderId });
        b.HasIndex(s => new { s.CommunityId, s.OwnerUserId });
        b.HasOne<Community>().WithMany().HasForeignKey(s => s.CommunityId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(s => s.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<SheetTemplate>().WithMany().HasForeignKey(s => s.TemplateId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<EncyclopediaFolder>().WithMany().HasForeignKey(s => s.FolderId).OnDelete(DeleteBehavior.SetNull);
    }
}

/// <summary>Characters can also live in an encyclopedia folder.</summary>
internal sealed class CharacterFolderConfiguration : IEntityTypeConfiguration<Character>
{
    public void Configure(EntityTypeBuilder<Character> b) =>
        b.HasOne<EncyclopediaFolder>().WithMany().HasForeignKey(c => c.FolderId).OnDelete(DeleteBehavior.SetNull);
}
