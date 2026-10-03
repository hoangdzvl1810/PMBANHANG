using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PMBANHANG;

public partial class Form1 : Form
{
    private WebView2 webView;
    private string dbPath;

    public Form1()
    {
        this.Text = "Kho Điện Gia Dụng - Quản Lý Kho & Bán Hàng";
        this.Width = 1300;
        this.Height = 850;
        this.StartPosition = FormStartPosition.CenterScreen;

        // Lưu database vào AppData để tránh lỗi quyền ghi trên máy ở nhà
        string appFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PMBANHANG");
        Directory.CreateDirectory(appFolder);
        dbPath = Path.Combine(appFolder, "app_data.db");

        InitDatabase();
        InitWebView();
    }

    private void InitDatabase()
    {
        using var conn = new SqliteConnection($"Data Source={dbPath}");
        conn.Open();
        string sql = @"
            CREATE TABLE IF NOT EXISTS AppState (
                Key TEXT PRIMARY KEY,
                JsonData TEXT
            );";
        using var cmd = new SqliteCommand(sql, conn);
        cmd.ExecuteNonQuery();
    }

    private async void InitWebView()
{
    webView = new WebView2 { Dock = DockStyle.Fill };
    this.Controls.Add(webView);

    // Khởi tạo runtime WebView2
    await webView.EnsureCoreWebView2Async(null);

    // Xác định chính xác thư mục chứa file wwwroot cạnh file exe
    string baseDir = AppContext.BaseDirectory;
    string wwwrootDir = Path.Combine(baseDir, "wwwroot");

    // Nếu không thấy cạnh file exe, thử tìm lùi về thư mục dự án (khi đang code/debug)
    if (!Directory.Exists(wwwrootDir))
    {
        wwwrootDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "wwwroot"));
    }

    if (!Directory.Exists(wwwrootDir))
    {
        MessageBox.Show($"Không tìm thấy thư mục giao diện wwwroot tại:\n{wwwrootDir}\n\nHãy đảm bảo thư mục wwwroot nằm cùng chỗ với file PMBANHANG.exe!", 
                        "Lỗi đường dẫn giao diện", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
    }

    // Map thư mục wwwroot vào domain ảo app.local để WebView2 nạp chuẩn không bao giờ lỗi
    webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
        "app.local",
        wwwrootDir,
        CoreWebView2HostResourceAccessKind.Allow
    );

    webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

    // Điều hướng vào domain ảo vừa map
    webView.CoreWebView2.Navigate("https://app.local/index.html");

    webView.NavigationCompleted += (s, e) =>
    {
        string savedJson = LoadDataFromDb();
        if (!string.IsNullOrEmpty(savedJson))
        {
            webView.CoreWebView2.ExecuteScriptAsync($"applySavedData({savedJson});");
        }
    };
}

    // Nhận dữ liệu do JavaScript lưu để ghi vào SQLite
    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string json = e.TryGetWebMessageAsString();
        if (!string.IsNullOrEmpty(json))
        {
            SaveDataToDb(json);
        }
    }

    private void SaveDataToDb(string json)
    {
        using var conn = new SqliteConnection($"Data Source={dbPath}");
        conn.Open();
        string sql = "INSERT OR REPLACE INTO AppState (Key, JsonData) VALUES ('current_db', @json);";
        using var cmd = new SqliteCommand(sql, conn);
        cmd.Parameters.AddWithValue("@json", json);
        cmd.ExecuteNonQuery();
    }

    private string LoadDataFromDb()
    {
        using var conn = new SqliteConnection($"Data Source={dbPath}");
        conn.Open();
        string sql = "SELECT JsonData FROM AppState WHERE Key = 'current_db';";
        using var cmd = new SqliteCommand(sql, conn);
        var result = cmd.ExecuteScalar();
        return result != null ? result.ToString()! : "";
    }
}