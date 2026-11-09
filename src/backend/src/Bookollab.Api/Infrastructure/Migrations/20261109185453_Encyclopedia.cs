using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Encyclopedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "free_sheets_enabled",
                table: "communities",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "template_mode",
                table: "communities",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Base");

            migrationBuilder.AddColumn<Guid>(
                name: "folder_id",
                table: "characters",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "encyclopedia_folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_encyclopedia_folders", x => x.id);
                    table.ForeignKey(
                        name: "fk_encyclopedia_folders_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sheet_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    kind = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    fields = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sheet_templates", x => x.id);
                    table.ForeignKey(
                        name: "fk_sheet_templates_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_sheet_templates_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "encyclopedia_sheets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    kind = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    image_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    folder_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    fields = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_encyclopedia_sheets", x => x.id);
                    table.ForeignKey(
                        name: "fk_encyclopedia_sheets_communities_community_id",
                        column: x => x.community_id,
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_encyclopedia_sheets_encyclopedia_folders_folder_id",
                        column: x => x.folder_id,
                        principalTable: "encyclopedia_folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_encyclopedia_sheets_sheet_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "sheet_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_encyclopedia_sheets_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_characters_folder_id",
                table: "characters",
                column: "folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_folders_community_id_name",
                table: "encyclopedia_folders",
                columns: new[] { "community_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_sheets_community_id_folder_id",
                table: "encyclopedia_sheets",
                columns: new[] { "community_id", "folder_id" });

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_sheets_community_id_owner_user_id",
                table: "encyclopedia_sheets",
                columns: new[] { "community_id", "owner_user_id" });

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_sheets_folder_id",
                table: "encyclopedia_sheets",
                column: "folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_sheets_owner_user_id",
                table: "encyclopedia_sheets",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_encyclopedia_sheets_template_id",
                table: "encyclopedia_sheets",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "ix_sheet_templates_community_id",
                table: "sheet_templates",
                column: "community_id");

            migrationBuilder.CreateIndex(
                name: "ix_sheet_templates_created_by_user_id",
                table: "sheet_templates",
                column: "created_by_user_id");

            migrationBuilder.AddForeignKey(
                name: "fk_characters_encyclopedia_folders_folder_id",
                table: "characters",
                column: "folder_id",
                principalTable: "encyclopedia_folders",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_characters_encyclopedia_folders_folder_id",
                table: "characters");

            migrationBuilder.DropTable(
                name: "encyclopedia_sheets");

            migrationBuilder.DropTable(
                name: "encyclopedia_folders");

            migrationBuilder.DropTable(
                name: "sheet_templates");

            migrationBuilder.DropIndex(
                name: "ix_characters_folder_id",
                table: "characters");

            migrationBuilder.DropColumn(
                name: "free_sheets_enabled",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "template_mode",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "folder_id",
                table: "characters");
        }
    }
}
