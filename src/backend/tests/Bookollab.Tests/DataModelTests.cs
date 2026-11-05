using Bookollab.Api.Domain.Chapters;
using Bookollab.Api.Domain.Characters;
using Bookollab.Api.Domain.Communities;
using Bookollab.Api.Domain.Scenes;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bookollab.Tests;

public sealed class DataModelTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private AppDbContext NewDb() => factory.Services.CreateScope().ServiceProvider.GetRequiredService<AppDbContext>();

    private static User NewUser() => new()
    {
        Id = Guid.CreateVersion7(),
        UserName = $"user{Guid.NewGuid():N}"[..20],
        Email = $"{Guid.NewGuid():N}@test.local",
        DisplayName = "Tester",
        BirthDate = new DateOnly(2000, 1, 1),
    };

    private async Task<(User Owner, Community Community)> SeedCommunityAsync()
    {
        await using var db = NewDb();
        var owner = NewUser();
        db.Users.Add(owner);
        var community = Community.Create($"c-{Guid.NewGuid():N}"[..20], "Reino de Teste", owner.Id);
        community.SheetFields.Add(new SheetField { Key = "race", Label = "Raça", Required = true });
        db.Communities.Add(community);
        await db.SaveChangesAsync();
        return (owner, community);
    }

    [Fact]
    public async Task New_community_gets_four_base_roles_and_owner_membership()
    {
        var (owner, community) = await SeedCommunityAsync();

        await using var db = NewDb();
        var roles = await db.CommunityRoles.Where(r => r.CommunityId == community.Id).OrderBy(r => r.Position).ToListAsync();
        var membership = await db.Memberships.Include(m => m.Role).SingleAsync(m => m.CommunityId == community.Id);

        Assert.Equal(["Dono", "Staff", "Narrador", "Jogador"], roles.Select(r => r.Name));
        Assert.Equal(owner.Id, membership.UserId);
        Assert.Equal(BaseRoleKind.Owner, membership.Role.BaseKind);
        Assert.Equal(CommunityPermission.All, membership.Role.Permissions);
    }

    [Fact]
    public async Task Base_role_defaults_follow_product_rules()
    {
        var (_, community) = await SeedCommunityAsync();

        await using var db = NewDb();
        var roles = await db.CommunityRoles.Where(r => r.CommunityId == community.Id).ToDictionaryAsync(r => r.BaseKind);

        // docs/visao-produto.md: by default only Staff and Narrator open scenes.
        Assert.False(roles[BaseRoleKind.Player].Permissions.HasFlag(CommunityPermission.OpenScenes));
        Assert.True(roles[BaseRoleKind.Narrator].Permissions.HasFlag(CommunityPermission.OpenScenes));
        Assert.True(roles[BaseRoleKind.Staff].Permissions.HasFlag(CommunityPermission.OpenScenes));
        // Narrator editing others' chapters depends on a flag that is off by default.
        Assert.False(roles[BaseRoleKind.Narrator].Permissions.HasFlag(CommunityPermission.EditOthersChapters));
        // Staff sees revision history.
        Assert.True(roles[BaseRoleKind.Staff].Permissions.HasFlag(CommunityPermission.ViewRevisionHistory));
    }

    [Fact]
    public async Task Sheet_fields_and_values_round_trip_as_json()
    {
        var (owner, community) = await SeedCommunityAsync();
        await using (var db = NewDb())
        {
            db.Characters.Add(new Character
            {
                CommunityId = community.Id,
                OwnerUserId = owner.Id,
                Name = "John Blackwood",
                Sheet = [new SheetValue { Key = "race", Value = "Humano" }],
            });
            await db.SaveChangesAsync();
        }

        await using var read = NewDb();
        var loaded = await read.Communities.SingleAsync(c => c.Id == community.Id);
        var character = await read.Characters.SingleAsync(c => c.CommunityId == community.Id);

        Assert.Equal("Raça", Assert.Single(loaded.SheetFields).Label);
        Assert.Equal("Humano", Assert.Single(character.Sheet).Value);
    }

    [Fact]
    public async Task Editing_a_published_chapter_keeps_previous_version()
    {
        var (owner, community) = await SeedCommunityAsync();
        var character = new Character { CommunityId = community.Id, OwnerUserId = owner.Id, Name = "Ayla" };
        var chapter = new Chapter
        {
            CommunityId = community.Id,
            CharacterId = character.Id,
            AuthorUserId = owner.Id,
            Title = "Rascunho",
            Content = "v0",
        };

        chapter.Edit("Carta", "v1", DateTimeOffset.UtcNow); // draft: no revision
        chapter.Publish(DateTimeOffset.UtcNow);
        chapter.Edit("Carta", "v2", DateTimeOffset.UtcNow); // published: keeps v1

        await using (var db = NewDb())
        {
            db.Characters.Add(character);
            db.Chapters.Add(chapter);
            await db.SaveChangesAsync();
        }

        await using var read = NewDb();
        var loaded = await read.Chapters.Include(c => c.Revisions).SingleAsync(c => c.Id == chapter.Id);
        Assert.Equal("v2", loaded.Content);
        Assert.NotNull(loaded.EditedAt);
        Assert.Equal("v1", Assert.Single(loaded.Revisions).Content);
    }

    [Fact]
    public async Task Editing_a_scene_action_keeps_previous_version()
    {
        var (owner, community) = await SeedCommunityAsync();
        var character = new Character { CommunityId = community.Id, OwnerUserId = owner.Id, Name = "Ayla" };
        var scene = new Scene { CommunityId = community.Id, Title = "Taverna", OpenedByUserId = owner.Id };
        var action = new SceneAction { SceneId = scene.Id, CharacterId = character.Id, AuthorUserId = owner.Id, Content = "Entra na taverna." };
        action.Edit("Entra na taverna, encharcada.", DateTimeOffset.UtcNow);

        await using (var db = NewDb())
        {
            db.AddRange(character, scene, action);
            await db.SaveChangesAsync();
        }

        await using var read = NewDb();
        var loaded = await read.SceneActions.Include(a => a.Revisions).SingleAsync(a => a.Id == action.Id);
        Assert.Equal("Entra na taverna.", Assert.Single(loaded.Revisions).Content);
        Assert.NotNull(loaded.EditedAt);
    }

    [Fact]
    public async Task Only_one_pending_join_request_per_user_and_community()
    {
        var (_, community) = await SeedCommunityAsync();
        var applicant = NewUser();
        await using var db = NewDb();
        db.Users.Add(applicant);
        db.JoinRequests.Add(new JoinRequest { CommunityId = community.Id, UserId = applicant.Id });
        await db.SaveChangesAsync();

        db.JoinRequests.Add(new JoinRequest { CommunityId = community.Id, UserId = applicant.Id });

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public void Invite_usability_respects_expiry_and_max_uses()
    {
        var now = DateTimeOffset.UtcNow;
        Assert.True(new Invite { Code = "a" }.IsUsable(now));
        Assert.False(new Invite { Code = "b", ExpiresAt = now.AddMinutes(-1) }.IsUsable(now));
        Assert.False(new Invite { Code = "c", MaxUses = 2, Uses = 2 }.IsUsable(now));
    }
}
