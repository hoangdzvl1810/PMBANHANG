using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PMBANHANG;

public partial class Form1 : Form
{
    private WebView2 webView = null!;
    private string dbPath;
    private bool dataInjected = false;

    public Form1()
    {
        this.Text = "Kho Điện Gia Dụng - Quản Lý Kho & Bán Hàng";
        this.Width = 1300;
        this.Height = 850;
        this.MinimumSize = new Size(1000, 700);
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
        try
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
        catch (Exception ex)
        {
            MessageBox.Show($"Không thể khởi tạo cơ sở dữ liệu tại:\n{dbPath}\n\nChi tiết: {ex.Message}",
                            "Lỗi cơ sở dữ liệu", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async void InitWebView()
    {
        webView = new WebView2 { Dock = DockStyle.Fill };
        this.Controls.Add(webView);

        try
        {
            // Đặt thư mục dữ liệu WebView2 vào AppData để tránh lỗi quyền ghi
            string appFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "PMBANHANG", "webview2");
            Directory.CreateDirectory(appFolder);
            var env = await CoreWebView2Environment.CreateAsync(null, appFolder);

            // Khởi tạo runtime WebView2
            await webView.EnsureCoreWebView2Async(env);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Không thể khởi tạo WebView2.\n\n" +
                "Vui lòng cài đặt 'Microsoft Edge WebView2 Runtime' rồi mở lại ứng dụng.\n\n" +
                $"Chi tiết: {ex.Message}",
                "Thiếu WebView2 Runtime", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // Xác định thư mục chứa file wwwroot: ưu tiên thư mục gốc dự án khi đang code/debug, nếu không thì dùng cạnh file exe
        string baseDir = AppContext.BaseDirectory;
        string projectWwwroot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "wwwroot"));
        string wwwrootDir = Directory.Exists(projectWwwroot) ? projectWwwroot : Path.Combine(baseDir, "wwwroot");

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

        webView.NavigationCompleted += async (s, e) =>
        {
            // Chỉ nạp dữ liệu từ SQLite một lần duy nhất, tránh ghi đè thay đổi khi trang tự tải lại
            if (dataInjected) return;

            string savedJson = LoadDataFromDb();
            if (string.IsNullOrWhiteSpace(savedJson)) return;

            try
            {
                // Truyền an toàn: serialize chuỗi JSON thành literal JS rồi parse ở phía JS,
                // không nội suy chuỗi thô để tránh lỗi cú pháp / hỏng dữ liệu.
                string script = "applySavedData(JSON.parse(" + JsonSerializer.Serialize(savedJson) + "));";
                await webView.CoreWebView2.ExecuteScriptAsync(script);
                dataInjected = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Không thể nạp dữ liệu đã lưu:\n{ex.Message}",
                                "Lỗi nạp dữ liệu", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        };

        // Điều hướng vào domain ảo vừa map
        webView.CoreWebView2.Navigate("https://app.local/index.html");
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
        try
        {
            using var conn = new SqliteConnection($"Data Source={dbPath}");
            conn.Open();
            string sql = "INSERT OR REPLACE INTO AppState (Key, JsonData) VALUES ('current_db', @json);";
            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@json", json);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("Lỗi lưu dữ liệu: " + ex.Message);
        }
    }

    private string LoadDataFromDb()
    {
        try
        {
            using var conn = new SqliteConnection($"Data Source={dbPath}");
            conn.Open();
            string sql = "SELECT JsonData FROM AppState WHERE Key = 'current_db';";
            using var cmd = new SqliteCommand(sql, conn);
            var result = cmd.ExecuteScalar();
            return result != null ? result.ToString()! : "";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("Lỗi đọc dữ liệu: " + ex.Message);
            return "";
        }
    }
}
