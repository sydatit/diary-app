using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CranberryAPI.Migrations
{
    public partial class AddBedtime : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "HH:mm" the user went to sleep the night before. Nullable: optional, and absent on older entries.
            migrationBuilder.AddColumn<string>(name: "Bedtime", table: "Journals", type: "varchar(5)", maxLength: 5, nullable: true).Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Bedtime", table: "Journals");
        }
    }
}
