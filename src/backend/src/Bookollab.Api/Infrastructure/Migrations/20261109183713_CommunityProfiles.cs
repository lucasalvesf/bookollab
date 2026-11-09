using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookollab.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CommunityProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_key",
                table: "memberships",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bio",
                table: "memberships",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cover_key",
                table: "memberships",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nickname",
                table: "memberships",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatar_key",
                table: "memberships");

            migrationBuilder.DropColumn(
                name: "bio",
                table: "memberships");

            migrationBuilder.DropColumn(
                name: "cover_key",
                table: "memberships");

            migrationBuilder.DropColumn(
                name: "nickname",
                table: "memberships");
        }
    }
}
