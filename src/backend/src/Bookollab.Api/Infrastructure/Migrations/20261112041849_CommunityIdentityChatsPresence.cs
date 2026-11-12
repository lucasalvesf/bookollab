using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CommunityIdentityChatsPresence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_seen_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_seen_visibility",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Everyone");

            migrationBuilder.AddColumn<string>(
                name: "online_visibility",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Everyone");

            migrationBuilder.AddColumn<string>(
                name: "cover_key",
                table: "scenes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "scenes",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Scene");

            migrationBuilder.AlterColumn<Guid>(
                name: "character_id",
                table: "scene_actions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "accent_color",
                table: "communities",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "home_layout",
                table: "communities",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Stacked");

            migrationBuilder.AddColumn<string>(
                name: "section_titles",
                table: "communities",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<string>(
                name: "side_menu",
                table: "communities",
                type: "jsonb",
                nullable: true);

            migrationBuilder.Sql("UPDATE communities SET side_menu = '[]' WHERE side_menu IS NULL;");

            // Moderators of existing communities get the new "pin posts" permission (bit 42), like new communities.
            migrationBuilder.Sql("UPDATE community_roles SET permissions = permissions | 4398046511104 WHERE base_kind = 'Staff';");

            migrationBuilder.CreateTable(
                name: "pinned_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chapter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    pinned_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pinned_posts", x => x.id);
                    table.ForeignKey(
                        name: "fk_pinned_posts_chapters_chapter_id",
                        column: x => x.chapter_id,
                        principalTable: "chapters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pinned_posts_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pinned_posts_users_pinned_by_user_id",
                        column: x => x.pinned_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_pinned_posts_chapter_id",
                table: "pinned_posts",
                column: "chapter_id");

            migrationBuilder.CreateIndex(
                name: "ix_pinned_posts_community_id_chapter_id",
                table: "pinned_posts",
                columns: new[] { "community_id", "chapter_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pinned_posts_pinned_by_user_id",
                table: "pinned_posts",
                column: "pinned_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pinned_posts");

            migrationBuilder.DropColumn(
                name: "last_seen_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_seen_visibility",
                table: "users");

            migrationBuilder.DropColumn(
                name: "online_visibility",
                table: "users");

            migrationBuilder.DropColumn(
                name: "cover_key",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "accent_color",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "home_layout",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "section_titles",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "side_menu",
                table: "communities");

            migrationBuilder.AlterColumn<Guid>(
                name: "character_id",
                table: "scene_actions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
