using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CranberryAPI.Migrations
{
    public partial class SleepLogs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bedtime is now logged with one tap, whether or not that day has a journal entry, so it gets
            // its own table: one row per user per night.
            migrationBuilder.CreateTable(
                name: "SleepLogs",
                columns: table => new
                {
                    SleepLogId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Date = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Bedtime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UserId = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SleepLogs", x => x.SleepLogId);
                    table.ForeignKey(
                        name: "FK_SleepLogs_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SleepLogs_UserId_Date",
                table: "SleepLogs",
                columns: new[] { "UserId", "Date" },
                unique: true);

            // Journals.Bedtime held the bedtime of the night BEFORE the entry's date; a sleep log is dated
            // by the day its night closes, so the existing values move back one day.
            migrationBuilder.Sql(@"
                INSERT IGNORE INTO `SleepLogs` (`UserId`, `Date`, `Bedtime`)
                SELECT `UserId`, DATE_FORMAT(DATE_SUB(`Date`, INTERVAL 1 DAY), '%Y-%m-%d'), `Bedtime`
                FROM `Journals`
                WHERE `UserId` IS NOT NULL
                  AND `Bedtime` REGEXP '^[0-9]{2}:[0-9]{2}$'
                  AND `Date` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';");

            migrationBuilder.DropColumn(name: "Bedtime", table: "Journals");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "Bedtime", table: "Journals", type: "varchar(5)", maxLength: 5, nullable: true).Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(@"
                UPDATE `Journals` j
                JOIN `SleepLogs` s
                  ON s.`UserId` = j.`UserId`
                 AND s.`Date` = DATE_FORMAT(DATE_SUB(j.`Date`, INTERVAL 1 DAY), '%Y-%m-%d')
                SET j.`Bedtime` = s.`Bedtime`
                WHERE j.`Date` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';");

            migrationBuilder.DropTable(name: "SleepLogs");
        }
    }
}
