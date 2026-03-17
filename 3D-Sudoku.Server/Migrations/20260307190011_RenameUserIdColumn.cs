using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace _3D_Sudoku.Server.Migrations
{
    /// <inheritdoc />
    public partial class RenameUserIdColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GameResults_Users_UserID",
                table: "GameResults");

            migrationBuilder.RenameColumn(
                name: "UserID",
                table: "GameResults",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_GameResults_UserID",
                table: "GameResults",
                newName: "IX_GameResults_UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_GameResults_Users_UserId",
                table: "GameResults",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GameResults_Users_UserId",
                table: "GameResults");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "GameResults",
                newName: "UserID");

            migrationBuilder.RenameIndex(
                name: "IX_GameResults_UserId",
                table: "GameResults",
                newName: "IX_GameResults_UserID");

            migrationBuilder.AddForeignKey(
                name: "FK_GameResults_Users_UserID",
                table: "GameResults",
                column: "UserID",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
