using Bookollab.Api.Domain.Uploads;
using Bookollab.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookollab.Api.Infrastructure.Configurations;

internal sealed class UploadConfiguration : IEntityTypeConfiguration<Upload>
{
    public void Configure(EntityTypeBuilder<Upload> b)
    {
        b.HasKey(u => u.Key);
        b.Property(u => u.Key).HasMaxLength(256);
        b.Property(u => u.ContentType).HasMaxLength(64);
        b.HasIndex(u => u.OwnerUserId);
        b.HasOne<User>().WithMany().HasForeignKey(u => u.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
    }
}
