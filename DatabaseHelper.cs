using System;
using System.IO;
using Microsoft.Data.Sqlite;

public static class DatabaseHelper
{
    private static string dbPath;

    public static string ConnectionString
    {
        get
        {
            if (dbPath == null)
            {
                string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PMBANHANG");
                Directory.CreateDirectory(folder);
                dbPath = Path.Combine(folder, "shop.db");
            }
            return $"Data Source={dbPath}";
        }
    }

    public static void InitializeDatabase()
    {
        using (var connection = new SqliteConnection(ConnectionString))
        {
            connection.Open();
            string sql = @"
                CREATE TABLE IF NOT EXISTS SanPham (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    TenSanPham TEXT NOT NULL,
                    GiaBan REAL NOT NULL,
                    SoLuong INTEGER NOT NULL
                );";
            using (var command = new SqliteCommand(sql, connection))
            {
                command.ExecuteNonQuery();
            }
        }
    }
}