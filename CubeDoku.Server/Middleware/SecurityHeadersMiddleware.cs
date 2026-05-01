// SecurityHeadersMiddleware.cs
// Adds HTTP security headers to every response
//
// I learned about these headers from the OWASP Secure Headers Project:
// https://owasp.org/www-project-secure-headers/
//
// Most of these are one-liners that protect against specific attack classes:
//   X-Content-Type-Options: prevents MIME sniffing (browsers guessing content types)
//   X-Frame-Options: prevents clickjacking via iframes
//   Referrer-Policy: limits information sent in the Referer header
//   Permissions-Policy: disables browser features the app doesn't need
//   Content-Security-Policy: probably the most complex one - restricts where resources load from
//
// The CSP was tricky to get right because React needs 'unsafe-inline' for styles
// (React's className system injects styles at runtime). If I had more time I'd investigate
// adding a nonce-based approach to avoid 'unsafe-inline' but that requires server-side rendering.
//
// Also removes server identification headers that Kestrel/ASP.NET add by default
// (no need to advertise exactly what software the server runs)

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
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https:; " +
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

