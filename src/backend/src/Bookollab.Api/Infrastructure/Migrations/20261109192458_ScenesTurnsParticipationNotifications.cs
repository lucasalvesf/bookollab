using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ScenesTurnsParticipationNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "archive_visibility",
                table: "scenes",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Community");

            migrationBuilder.AddColumn<Guid>(
                name: "current_turn_character_id",
                table: "scenes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "participation",
                table: "scenes",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Public");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "turn_started_at",
                table: "scenes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "turn_time_limit_minutes",
                table: "scenes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "position",
                table: "scene_participants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    link = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_notifications_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_notifications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "scene_invites",
                columns: table => new
                {
                    scene_id = table.Column<Guid>(type: "uuid", nullable: false),
                    character_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invited_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scene_invites", x => new { x.scene_id, x.character_id });
                    table.ForeignKey(
                        name: "fk_scene_invites_characters_character_id",
                        column: x => x.character_id,
                        principalTable: "characters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_scene_invites_scenes_scene_id",
                        column: x => x.scene_id,
                        principalTable: "scenes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_scene_invites_users_invited_by_user_id",
                        column: x => x.invited_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "scene_join_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    scene_id = table.Column<Guid>(type: "uuid", nullable: false),
                    character_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    decided_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scene_join_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_scene_join_requests_characters_character_id",
                        column: x => x.character_id,
                        principalTable: "characters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_scene_join_requests_scenes_scene_id",
                        column: x => x.scene_id,
                        principalTable: "scenes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_scene_join_requests_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_community_id",
                table: "notifications",
                column: "community_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_created_at",
                table: "notifications",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_scene_invites_character_id",
                table: "scene_invites",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "ix_scene_invites_invited_by_user_id",
                table: "scene_invites",
                column: "invited_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_scene_join_requests_character_id",
                table: "scene_join_requests",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "ix_scene_join_requests_scene_id_character_id",
                table: "scene_join_requests",
                columns: new[] { "scene_id", "character_id" },
                unique: true,
                filter: "status = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "ix_scene_join_requests_user_id",
                table: "scene_join_requests",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "scene_invites");

            migrationBuilder.DropTable(
                name: "scene_join_requests");

            migrationBuilder.DropColumn(
                name: "archive_visibility",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "current_turn_character_id",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "participation",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "turn_started_at",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "turn_time_limit_minutes",
                table: "scenes");

            migrationBuilder.DropColumn(
                name: "position",
                table: "scene_participants");
        }
    }
}
