using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ThemesPagesActivity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "linked_sheet_id",
                table: "inventory_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "background_blur",
                table: "encyclopedia_sheets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "background_color",
                table: "encyclopedia_sheets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "background_key",
                table: "encyclopedia_sheets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "content",
                table: "encyclopedia_sheets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "background_blur",
                table: "communities",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "background_key",
                table: "communities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "inventory_label",
                table: "communities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "theme_mode",
                table: "communities",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Accent");

            migrationBuilder.AddColumn<string>(
                name: "theme_overrides",
                table: "communities",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<int>(
                name: "background_blur",
                table: "characters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "background_color",
                table: "characters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "background_key",
                table: "characters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "content",
                table: "characters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "background_blur",
                table: "chapters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "background_color",
                table: "chapters",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "linked_sheet_id",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "background_blur",
                table: "encyclopedia_sheets");

            migrationBuilder.DropColumn(
                name: "background_color",
                table: "encyclopedia_sheets");

            migrationBuilder.DropColumn(
                name: "background_key",
                table: "encyclopedia_sheets");

            migrationBuilder.DropColumn(
                name: "content",
                table: "encyclopedia_sheets");

            migrationBuilder.DropColumn(
                name: "background_blur",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "background_key",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "inventory_label",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "theme_mode",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "theme_overrides",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "background_blur",
                table: "characters");

            migrationBuilder.DropColumn(
                name: "background_color",
                table: "characters");

            migrationBuilder.DropColumn(
                name: "background_key",
                table: "characters");

            migrationBuilder.DropColumn(
                name: "content",
                table: "characters");

            migrationBuilder.DropColumn(
                name: "background_blur",
                table: "chapters");

            migrationBuilder.DropColumn(
                name: "background_color",
                table: "chapters");
        }
    }
}
