using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CranberryAPI.Migrations
{
    public partial class AddStressLevel : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Daily stress level (1..10). Nullable so entries written before this stay valid.
            migrationBuilder.AddColumn<int>(name: "StressLevel", table: "Journals", type: "int", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "StressLevel", table: "Journals");
        }
    }
}
