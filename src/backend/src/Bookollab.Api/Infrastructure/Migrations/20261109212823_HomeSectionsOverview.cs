using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HomeSectionsOverview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "home_sections",
                table: "users",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "home_sections",
                table: "users");
        }
    }
}
