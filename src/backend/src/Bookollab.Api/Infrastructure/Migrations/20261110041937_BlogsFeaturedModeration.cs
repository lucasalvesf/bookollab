using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BlogsFeaturedModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Terminology change (2026-11-10): the base role "Staff" is now called "Moderador".
            migrationBuilder.Sql("UPDATE community_roles SET name = 'Moderador' WHERE base_kind = 'Staff' AND name = 'Staff';");

            migrationBuilder.AddColumn<string>(
                name: "feed_layout",
                table: "communities",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Highlight");

            migrationBuilder.AlterColumn<Guid>(
                name: "character_id",
                table: "chapters",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "background_key",
                table: "chapters",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cover_key",
                table: "chapters",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "chapters",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Chapter");

            migrationBuilder.AddColumn<string>(
                name: "music_url",
                table: "chapters",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "featured_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    featured_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_featured_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_featured_items_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_featured_items_users_featured_by_user_id",
                        column: x => x.featured_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_featured_items_community_id_item_type_item_id",
                table: "featured_items",
                columns: new[] { "community_id", "item_type", "item_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_featured_items_featured_by_user_id",
                table: "featured_items",
                column: "featured_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "featured_items");

            migrationBuilder.DropColumn(
                name: "feed_layout",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "background_key",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "cover_key",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "music_url",
                table: "chapters");

            migrationBuilder.AlterColumn<Guid>(
                name: "character_id",
                table: "chapters",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
