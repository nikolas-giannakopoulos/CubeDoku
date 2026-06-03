using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text;
using CubeDoku.Server.Data;

namespace CubeDoku.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController(ApplicationDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory) : ControllerBase
    {
        // GET /api/analytics/metrics
        // Pulls aggregated gameplay statistics and correlations
        [HttpGet("metrics")]
        public async Task<IActionResult> GetMetrics()
        {
            var results = await db.GameResults.ToListAsync();
            if (results.Count == 0)
            {
                return Ok(new
                {
                    TotalGames = 0,
                    Classic = new { Games = 0, AvgTime = 0.0, AvgMistakes = 0.0, AvgHints = 0.0 },
                    BrainTerror = new { Games = 0, AvgTime = 0.0, AvgMistakes = 0.0, AvgHints = 0.0 },
                    ScatterData = new List<object>()
                });
            }

            var classic = results.Where(r => r.Difficulty == "Classic").ToList();
            var brainTerror = results.Where(r => r.Difficulty == "BrainTerror").ToList();

            var scatter = results.Select(r => new
            {
                x = r.DurationSeconds,
                y = r.Mistakes,
                difficulty = r.Difficulty
            }).ToList();

            return Ok(new
            {
                TotalGames = results.Count,
                Classic = new
                {
                    Games = classic.Count,
                    AvgTime = classic.Any() ? Math.Round(classic.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes = classic.Any() ? Math.Round(classic.Average(r => r.Mistakes), 1) : 0,
                    AvgHints = classic.Any() ? Math.Round(classic.Average(r => r.HintsUsed), 1) : 0
                },
                BrainTerror = new
                {
                    Games = brainTerror.Count,
                    AvgTime = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.Mistakes), 1) : 0,
                    AvgHints = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.HintsUsed), 1) : 0
                },
                ScatterData = scatter
            });
        }

        // GET /api/analytics/audit
        // Returns basic gameplay audit rows for study
        [HttpGet("audit")]
        public async Task<IActionResult> GetAuditLogs()
        {
            var logs = await db.GameResults
                .Include(r => r.User)
                .OrderByDescending(r => r.CompletedAt)
                .Take(100)
                .Select(r => new
                {
                    r.Id,
                    Username = r.User != null ? r.User.Username : "Guest",
                    r.Difficulty,
                    r.PuzzleDate,
                    r.Score,
                    r.DurationSeconds,
                    r.Mistakes,
                    r.HintsUsed,
                    CompletedAt = r.CompletedAt.ToString("yyyy-MM-dd HH:mm:ss")
                })
                .ToListAsync();

            return Ok(logs);
        }

        // POST /api/analytics/ai-report
        // Feeds structured gameplay stats to Gemini API and generates an academic abstract
        [HttpPost("ai-report")]
        public async Task<IActionResult> GenerateAiReport()
        {
            var apiKey = config["Gemini:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                return Ok(new { content = "Gemini API key is not configured. Please add \"Gemini:ApiKey\" to your appsettings configurations to activate this academic report." });
            }

            var results = await db.GameResults.ToListAsync();
            var totalCount = results.Count;
            var classic = results.Where(r => r.Difficulty == "Classic").ToList();
            var brainTerror = results.Where(r => r.Difficulty == "BrainTerror").ToList();

            var classicAvgTime = classic.Any() ? Math.Round(classic.Average(r => r.DurationSeconds), 1) : 0;
            var classicAvgMistakes = classic.Any() ? Math.Round(classic.Average(r => r.Mistakes), 1) : 0;
            var brainAvgTime = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.DurationSeconds), 1) : 0;
            var brainAvgMistakes = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.Mistakes), 1) : 0;

            var statsJson = $"{{\"total_games\": {totalCount}, \"classic\": {{\"avg_time_sec\": {classicAvgTime}, \"avg_mistakes\": {classicAvgMistakes}}}, \"brain_terror\": {{\"avg_time_sec\": {brainAvgTime}, \"avg_mistakes\": {brainAvgMistakes}}}}}";

            var prompt = $"You are an expert academic researcher in Human-Computer Interaction (HCI) and cognitive loading. Analyze these anonymized statistics of gameplay sessions from our 3D Sudoku (CubeDoku) project: {statsJson}. Generate a structured, formal academic paper abstract (in Greek) summarizing player performance, cognitive differences between 'Classic' and 'BrainTerror' difficulties, and general scientific observations.";

            var geminiResponse = await CallGeminiApi(apiKey, prompt);
            return Ok(new { content = geminiResponse });
        }

        // POST /api/analytics/ai-chat
        // Handles interactive Q&A regarding database gameplay trends
        [HttpPost("ai-chat")]
        public async Task<IActionResult> ChatWithAi([FromBody] ChatRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("Message cannot be empty.");
            }

            var apiKey = config["Gemini:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                return Ok(new { reply = "Gemini API key is not configured. Chat is inactive." });
            }

            var results = await db.GameResults.ToListAsync();
            var totalCount = results.Count;
            var classic = results.Where(r => r.Difficulty == "Classic").ToList();
            var brainTerror = results.Where(r => r.Difficulty == "BrainTerror").ToList();

            var statsSummary = $"Database has {totalCount} total games completed. Classic has {classic.Count} games, average solve time {(classic.Any() ? classic.Average(r => r.DurationSeconds) : 0):F1} seconds, average mistakes {(classic.Any() ? classic.Average(r => r.Mistakes) : 0):F1}. BrainTerror has {brainTerror.Count} games, average solve time {(brainTerror.Any() ? brainTerror.Average(r => r.DurationSeconds) : 0):F1} seconds, average mistakes {(brainTerror.Any() ? brainTerror.Average(r => r.Mistakes) : 0):F1}.";

            var prompt = $"You are a helpful assistant for our 3D Sudoku game 'CubeDoku'. Based ONLY on these database aggregates: {statsSummary}, answer the user's question (in Greek): \"{request.Message}\". Give a short, clear, simple answer — no academic jargon, no unnecessary details. Use plain conversational Greek. Keep it under 4 sentences.";

            var reply = await CallGeminiApi(apiKey, prompt);
            return Ok(new { reply = reply });
        }

        private async Task<string> CallGeminiApi(string apiKey, string prompt)
        {
            try
            {
                var client = httpClientFactory.CreateClient();
                var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={apiKey}";

                var payload = new
                {
                    contents = new[]
                    {
                        new { parts = new[] { new { text = prompt } } }
                    }
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errBody = await response.Content.ReadAsStringAsync();
                    return $"Gemini API Error: {response.StatusCode} - {errBody}";
                }

                var resBody = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(resBody);
                var root = doc.RootElement;
                
                if (root.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var contentElem) &&
                    contentElem.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textElem))
                {
                    return textElem.GetString() ?? "Empty response from Gemini.";
                }

                return "Could not parse Gemini API response.";
            }
            catch (Exception ex)
            {
                return $"Error contacting Gemini API: {ex.Message}";
            }
        }

        public class ChatRequest
        {
            public string Message { get; set; } = string.Empty;
        }
    }
}
