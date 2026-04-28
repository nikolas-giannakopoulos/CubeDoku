using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CubeDoku.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddHintsUsedToGameResult : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HintsUsed",
                table: "GameResults",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HintsUsed",
                table: "GameResults");
        }
    }
}
