using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CommunityAppearanceSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cover_key",
                table: "communities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "icon_key",
                table: "communities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "sections",
                table: "communities",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY['scenes','chapters','encyclopedia','characters','members']::text[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cover_key",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "icon_key",
                table: "communities");

            migrationBuilder.DropColumn(
                name: "sections",
                table: "communities");
        }
    }
}
