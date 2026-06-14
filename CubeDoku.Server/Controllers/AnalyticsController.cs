using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CubeDoku.Server.Data;
using System.Text;
using System.Text.Json;

namespace CubeDoku.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController(ApplicationDbContext db, IHttpClientFactory httpClientFactory, IConfiguration configuration) : ControllerBase
    {
        // POST /api/analytics/ai-chat
        // Proxies a user message to Gemini Flash, with live analytics injected as system context
        [HttpPost("ai-chat")]
        public async Task<IActionResult> AiChat([FromBody] ChatRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Message))
                return BadRequest(new { error = "Message is required." });

            // ── Build context from live DB data ──────────────────────────────
            var results = await db.GameResults.ToListAsync();
            var total   = results.Count;
            var classic = results.Where(r => r.Difficulty == "Classic").ToList();
            var brain   = results.Where(r => r.Difficulty == "BrainTerror").ToList();

            var ctxLines = new List<string>
            {
                $"Total games recorded: {total}",
                $"Classic mode  – games: {classic.Count}, avg time: {(classic.Any() ? Math.Round(classic.Average(r => r.DurationSeconds), 1) : 0)}s, avg mistakes: {(classic.Any() ? Math.Round(classic.Average(r => r.Mistakes), 2) : 0)}, avg hints: {(classic.Any() ? Math.Round(classic.Average(r => r.HintsUsed), 2) : 0)}",
                $"BrainTerror mode – games: {brain.Count}, avg time: {(brain.Any() ? Math.Round(brain.Average(r => r.DurationSeconds), 1) : 0)}s, avg mistakes: {(brain.Any() ? Math.Round(brain.Average(r => r.Mistakes), 2) : 0)}, avg hints: {(brain.Any() ? Math.Round(brain.Average(r => r.HintsUsed), 2) : 0)}",
            };

            // Include last 20 audit rows as mini-dataset
            var recent = results
                .OrderByDescending(r => r.CompletedAt)
                .Take(20)
                .Select(r => $"[{r.Difficulty}] {r.DurationSeconds}s, {r.Mistakes} mistakes, {r.HintsUsed} hints, score {r.Score}")
                .ToList();
            ctxLines.Add("Recent game samples (newest first):");
            ctxLines.AddRange(recent);

            var systemPrompt =
                "You are an AI analytics assistant for CubeDoku, a 3D Sudoku puzzle game. " +
                "Your role is to help the developer understand player behaviour, statistics and trends based on the data below. " +
                "Be concise, insightful and data-driven. Keep your answers very short (1-3 sentences maximum) but ALWAYS complete your sentences. Reply in the same language the user writes in.\n\n" +
                "=== LIVE ANALYTICS CONTEXT ===\n" +
                string.Join("\n", ctxLines);

            // ── Call Gemini 2.5 Flash (lightweight, low token cost) ─────────
            var apiKey     = configuration["Gemini:ApiKey"];
            var geminiUrl  = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

            var payload = new
            {
                systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
                contents = new[]
                {
                    new { role = "user", parts = new[] { new { text = req.Message } } }
                },
                generationConfig = new { temperature = 0.7, maxOutputTokens = 512 }
            };

            var client  = httpClientFactory.CreateClient();
            var json    = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            HttpResponseMessage geminiResp;
            try
            {
                geminiResp = await client.PostAsync(geminiUrl, content);
            }
            catch (Exception ex)
            {
                return StatusCode(502, new { error = $"Could not reach Gemini API: {ex.Message}" });
            }

            if (!geminiResp.IsSuccessStatusCode)
            {
                var errBody = await geminiResp.Content.ReadAsStringAsync();
                // Try to extract the human-readable message from Gemini's JSON error response
                // so the frontend can display a meaningful message instead of raw JSON.
                string friendlyError;
                try
                {
                    using var errDoc = JsonDocument.Parse(errBody);
                    friendlyError = errDoc.RootElement
                        .GetProperty("error")
                        .GetProperty("message")
                        .GetString() ?? errBody;
                }
                catch
                {
                    friendlyError = errBody;
                }
                return StatusCode((int)geminiResp.StatusCode, new { error = friendlyError });
            }

            var responseBody = await geminiResp.Content.ReadAsStringAsync();
            using var doc    = JsonDocument.Parse(responseBody);

            var reply = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString() ?? "No response from Gemini.";

            return Ok(new { reply });
        }

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

            var classic     = results.Where(r => r.Difficulty == "Classic").ToList();
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
                    Games        = classic.Count,
                    AvgTime      = classic.Any() ? Math.Round(classic.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes  = classic.Any() ? Math.Round(classic.Average(r => r.Mistakes), 1) : 0,
                    AvgHints     = classic.Any() ? Math.Round(classic.Average(r => r.HintsUsed), 1) : 0
                },
                BrainTerror = new
                {
                    Games        = brainTerror.Count,
                    AvgTime      = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.DurationSeconds), 1) : 0,
                    AvgMistakes  = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.Mistakes), 1) : 0,
                    AvgHints     = brainTerror.Any() ? Math.Round(brainTerror.Average(r => r.HintsUsed), 1) : 0
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
                    Username    = r.User != null ? r.User.Username : "Guest",
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
    }
}

public record ChatRequest(string Message);
