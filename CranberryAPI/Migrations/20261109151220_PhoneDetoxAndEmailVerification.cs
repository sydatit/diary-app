using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CranberryAPI.Migrations
{
    public partial class PhoneDetoxAndEmailVerification : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The app switched from quit-smoking to phone detox: old journal data is discarded.
            migrationBuilder.Sql("DELETE FROM `Journals`;");

            // ---- Journals ----
            migrationBuilder.DropColumn(name: "Notes", table: "Journals");
            migrationBuilder.DropColumn(name: "CravingIntensity", table: "Journals");
            migrationBuilder.DropColumn(name: "CigsSmoked", table: "Journals");

            migrationBuilder.AlterColumn<string>(
                name: "Date",
                table: "Journals",
                type: "varchar(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(name: "Mood", table: "Journals", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "UrgeLevel", table: "Journals", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "Pickups", table: "Journals", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string>(name: "DayReflection", table: "Journals", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<string>(name: "Gratitude", table: "Journals", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<string>(name: "Win", table: "Journals", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<string>(name: "Improvement", table: "Journals", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");

            // Create the (UserId, Date) index first so the UserId foreign key always has an index.
            migrationBuilder.CreateIndex(
                name: "IX_Journals_UserId_Date",
                table: "Journals",
                columns: new[] { "UserId", "Date" },
                unique: true);
            migrationBuilder.DropIndex(name: "IX_Journals_UserId", table: "Journals");

            // ---- Users ----
            migrationBuilder.DropColumn(name: "QuitDate", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "AvgSmokedDaily", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "PricePerPack", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "CigsPerPack", table: "AspNetUsers");

            migrationBuilder.AddColumn<string>(name: "DetoxStartDate", table: "AspNetUsers", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<int>(name: "BaselinePickups", table: "AspNetUsers", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "DailyPickupGoal", table: "AspNetUsers", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string>(name: "EmailCodeHash", table: "AspNetUsers", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<DateTime>(name: "EmailCodeExpiresAt", table: "AspNetUsers", type: "datetime(6)", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "EmailCodeSentAt", table: "AspNetUsers", type: "datetime(6)", nullable: true);
            migrationBuilder.AddColumn<int>(name: "EmailCodeAttempts", table: "AspNetUsers", type: "int", nullable: false, defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DetoxStartDate", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "BaselinePickups", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "DailyPickupGoal", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "EmailCodeHash", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "EmailCodeExpiresAt", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "EmailCodeSentAt", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "EmailCodeAttempts", table: "AspNetUsers");

            migrationBuilder.AddColumn<string>(name: "QuitDate", table: "AspNetUsers", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<int>(name: "AvgSmokedDaily", table: "AspNetUsers", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<float>(name: "PricePerPack", table: "AspNetUsers", type: "float", nullable: false, defaultValue: 0f);
            migrationBuilder.AddColumn<int>(name: "CigsPerPack", table: "AspNetUsers", type: "int", nullable: false, defaultValue: 0);

            migrationBuilder.CreateIndex(name: "IX_Journals_UserId", table: "Journals", column: "UserId");
            migrationBuilder.DropIndex(name: "IX_Journals_UserId_Date", table: "Journals");

            migrationBuilder.DropColumn(name: "Mood", table: "Journals");
            migrationBuilder.DropColumn(name: "UrgeLevel", table: "Journals");
            migrationBuilder.DropColumn(name: "Pickups", table: "Journals");
            migrationBuilder.DropColumn(name: "DayReflection", table: "Journals");
            migrationBuilder.DropColumn(name: "Gratitude", table: "Journals");
            migrationBuilder.DropColumn(name: "Win", table: "Journals");
            migrationBuilder.DropColumn(name: "Improvement", table: "Journals");

            migrationBuilder.AlterColumn<string>(
                name: "Date",
                table: "Journals",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(10)",
                oldMaxLength: 10)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(name: "Notes", table: "Journals", type: "longtext", nullable: true).Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<int>(name: "CravingIntensity", table: "Journals", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "CigsSmoked", table: "Journals", type: "int", nullable: false, defaultValue: 0);
        }
    }
}
