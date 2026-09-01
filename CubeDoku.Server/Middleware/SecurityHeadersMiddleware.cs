// SecurityHeadersMiddleware.cs
// Adds HTTP security headers to every response

namespace CubeDoku.Server.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // prevent browsers from guessing the content type - just trust what the server says
        headers["X-Content-Type-Options"] = "nosniff";

        // prevent the page from being embedded in an iframe (stops clickjacking attacks)
        headers["X-Frame-Options"] = "DENY";

        // only send origin information to same-site requests
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // disable browser APIs the app doesn't use (camera, mic, location, payment)
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";

        // Content Security Policy
        // default-src 'self': only load resources from the same origin by default
        // script-src 'self': only execute scripts from same origin (no CDN scripts)
        // style-src 'unsafe-inline': needed for React's styled components / class injection
        // Google fonts: allowed because we use them for typography
        // connect-src: API calls go to 'self', Google OAuth goes to accounts.google.com
        headers["Content-Security-Policy"] =
            "default-src 'self'; " +
            // 'unsafe-eval' is required by Three.js for GLSL shader compilation at runtime.
            // blob: is required by Vite for dynamic code-split chunks and by Three.js for WebWorkers.
            "script-src 'self' 'unsafe-eval' blob:; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: blob: https:; " +
            // Three.js / @react-three/fiber spawns workers from blob: URLs
            "worker-src blob:; " +
            "connect-src 'self' https://accounts.google.com https://www.googleapis.com; " +
            "frame-ancestors 'none';";

        // remove headers that reveal what software/framework is running
        // security through obscurity isn't the main defense but still good practice
        headers.Remove("Server");
        headers.Remove("X-Powered-By");
        headers.Remove("X-AspNet-Version");

        await next(context);
    }
}

// extension method to register the middleware cleanly in Program.cs
public static class SecurityHeadersMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        => app.UseMiddleware<SecurityHeadersMiddleware>();
}

