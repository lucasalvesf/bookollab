using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChapterCollaborationApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "chapter_approval_mode",
                table: "communities",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Off");

            migrationBuilder.AddColumn<List<Guid>>(
                name: "chapter_approval_role_ids",
                table: "communities",
                type: "uuid[]",
                nullable: false,
                defaultValueSql: "'{}'::uuid[]");

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason",
                table: "chapters",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "reply_to_chapter_id",
                table: "chapters",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "source_scene_id",
                table: "chapters",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "chapter_coauthor",
                columns: table => new
                {
                    chapter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    character_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_chapter_coauthor", x => new { x.chapter_id, x.character_id });
                    table.ForeignKey(
                        name: "fk_chapter_coauthor_chapters_chapter_id",
                        column: x => x.chapter_id,
                        principalTable: "chapters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_chapter_coauthor_characters_character_id",
                        column: x => x.character_id,
                        principalTable: "characters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chapter_mention",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    chapter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    character_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_chapter_mention", x => x.id);
                    table.ForeignKey(
                        name: "fk_chapter_mention_chapters_chapter_id",
                        column: x => x.chapter_id,
                        principalTable: "chapters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_chapter_mention_characters_character_id",
                        column: x => x.character_id,
                        principalTable: "characters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_chapter_mention_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_chapters_reply_to_chapter_id",
                table: "chapters",
                column: "reply_to_chapter_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapters_source_scene_id",
                table: "chapters",
                column: "source_scene_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapter_coauthor_character_id",
                table: "chapter_coauthor",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapter_mention_chapter_id",
                table: "chapter_mention",
                column: "chapter_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapter_mention_character_id",
                table: "chapter_mention",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "ix_chapter_mention_user_id",
                table: "chapter_mention",
                column: "user_id");

            migrationBuilder.AddForeignKey(
                name: "fk_chapters_chapters_reply_to_chapter_id",
                table: "chapters",
                column: "reply_to_chapter_id",
                principalTable: "chapters",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_chapters_scenes_source_scene_id",
                table: "chapters",
                column: "source_scene_id",
                principalTable: "scenes",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_chapters_chapters_reply_to_chapter_id",
                table: "chapters");

            migrationBuilder.DropForeignKey(
                name: "fk_chapters_scenes_source_scene_id",
                table: "chapters");

            migrationBuilder.DropTable(
                name: "chapter_coauthor");

            migrationBuilder.DropTable(
                name: "chapter_mention");

            migrationBuilder.DropIndex(
                name: "ix_chapters_reply_to_chapter_id",
                table: "chapters");

            migrationBuilder.DropIndex(
                name: "ix_chapters_source_scene_id",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "chapter_approval_mode",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "chapter_approval_role_ids",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "rejection_reason",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "reply_to_chapter_id",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "source_scene_id",
                table: "chapters");
        }
    }
}
