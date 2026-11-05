using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace Bookollab.Api.Features.Auth;

public static partial class AuthEndpoints
{
    public const int MinimumAge = 13;

    [GeneratedRegex("^[a-z0-9_]{3,30}$")]
    private static partial Regex HandleRegex();

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth").WithTags("Auth");
        auth.MapPost("/register", Register).WithName("Register");
        auth.MapPost("/confirm-email", ConfirmEmail).WithName("ConfirmEmail");
        auth.MapPost("/resend-confirmation", ResendConfirmation).WithName("ResendConfirmation");
        auth.MapPost("/login", Login).WithName("Login");
        auth.MapPost("/refresh", Refresh).WithName("Refresh");
        auth.MapPost("/logout", Logout).WithName("Logout");
        auth.MapPost("/forgot-password", ForgotPassword).WithName("ForgotPassword");
        auth.MapPost("/reset-password", ResetPassword).WithName("ResetPassword");

        app.MapGet("/me", Me).WithTags("Auth").WithName("GetMe").RequireAuthorization();
    }

    private static async Task<Results<Created, ValidationProblem>> Register(
        RegisterRequest req, UserManager<User> users, IEmailSender email, IOptions<AppLinkOptions> links,
        TimeProvider clock, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var handle = req.UserName.Trim().ToLowerInvariant();
        if (!HandleRegex().IsMatch(handle))
            errors["userName"] = ["Use de 3 a 30 caracteres: letras minúsculas, números ou _."];
        if (string.IsNullOrWhiteSpace(req.DisplayName) || req.DisplayName.Trim().Length > 64)
            errors["displayName"] = ["Informe um nome de exibição com até 64 caracteres."];
        if (AgeOn(req.BirthDate, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)) < MinimumAge)
            errors["birthDate"] = [$"É preciso ter pelo menos {MinimumAge} anos para criar uma conta."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var user = new User
        {
            UserName = handle,
            Email = req.Email.Trim(),
            DisplayName = req.DisplayName.Trim(),
            BirthDate = req.BirthDate,
        };
        var result = await users.CreateAsync(user, req.Password);
        if (!result.Succeeded) return TypedResults.ValidationProblem(ToErrors(result));

        await SendConfirmationAsync(user, users, email, links.Value, ct);
        return TypedResults.Created();
    }

    private static async Task<Results<NoContent, ValidationProblem>> ConfirmEmail(
        ConfirmEmailRequest req, UserManager<User> users)
    {
        var user = await users.FindByIdAsync(req.UserId.ToString());
        var token = DecodeToken(req.Token);
        if (user is null || token is null) return InvalidToken();

        var result = await users.ConfirmEmailAsync(user, token);
        return result.Succeeded ? TypedResults.NoContent() : InvalidToken();
    }

    /// <summary>Always 202, so the endpoint does not reveal which emails are registered.</summary>
    private static async Task<Accepted> ResendConfirmation(
        EmailRequest req, UserManager<User> users, IEmailSender email, IOptions<AppLinkOptions> links, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email.Trim());
        if (user is not null && !user.EmailConfirmed)
            await SendConfirmationAsync(user, users, email, links.Value, ct);
        return TypedResults.Accepted((string?)null);
    }

    private static async Task<Results<Ok<TokenResponse>, ProblemHttpResult>> Login(
        LoginRequest req, UserManager<User> users, TokenService tokens, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email.Trim());
        if (user is null) return InvalidCredentials();
        if (await users.IsLockedOutAsync(user))
            return Problem(StatusCodes.Status423Locked, "locked_out", "Muitas tentativas. Tente novamente em alguns minutos.");

        if (!await users.CheckPasswordAsync(user, req.Password))
        {
            await users.AccessFailedAsync(user);
            return InvalidCredentials();
        }
        if (!user.EmailConfirmed)
            return Problem(StatusCodes.Status403Forbidden, "email_not_confirmed", "Confirme seu e-mail antes de entrar.");

        await users.ResetAccessFailedCountAsync(user);
        return TypedResults.Ok(await tokens.IssueAsync(user, await users.GetRolesAsync(user), ct));
    }

    private static async Task<Results<Ok<TokenResponse>, ProblemHttpResult>> Refresh(
        RefreshRequest req, UserManager<User> users, TokenService tokens, CancellationToken ct)
    {
        var consumed = await tokens.ConsumeAsync(req.RefreshToken, ct);
        var user = consumed is null ? null : await users.FindByIdAsync(consumed.UserId.ToString());
        if (user is null || await users.IsLockedOutAsync(user))
            return Problem(StatusCodes.Status401Unauthorized, "invalid_refresh_token", "Sessão expirada. Entre novamente.");

        return TypedResults.Ok(await tokens.IssueAsync(user, await users.GetRolesAsync(user), ct));
    }

    private static async Task<NoContent> Logout(RefreshRequest req, TokenService tokens, CancellationToken ct)
    {
        await tokens.ConsumeAsync(req.RefreshToken, ct);
        return TypedResults.NoContent();
    }

    /// <summary>Always 202, so the endpoint does not reveal which emails are registered.</summary>
    private static async Task<Accepted> ForgotPassword(
        EmailRequest req, UserManager<User> users, IEmailSender email, IOptions<AppLinkOptions> links, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email.Trim());
        if (user is not null)
        {
            var token = EncodeToken(await users.GeneratePasswordResetTokenAsync(user));
            var url = $"{links.Value.BaseUrl}/redefinir-senha?email={Uri.EscapeDataString(user.Email!)}&token={token}";
            await email.SendAsync(new EmailMessage(user.Email!, "Bookollab · redefinir sua senha",
                Template(user.DisplayName, "Recebemos um pedido para redefinir sua senha.", "Redefinir senha", url,
                    "Se não foi você, ignore este e-mail: sua senha continua a mesma.")), ct);
        }
        return TypedResults.Accepted((string?)null);
    }

    private static async Task<Results<NoContent, ValidationProblem>> ResetPassword(
        ResetPasswordRequest req, UserManager<User> users, TokenService tokens, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email.Trim());
        var token = DecodeToken(req.Token);
        if (user is null || token is null) return InvalidToken();

        var result = await users.ResetPasswordAsync(user, token, req.NewPassword);
        if (!result.Succeeded) return TypedResults.ValidationProblem(ToErrors(result));

        // A password reset ends every open session.
        await tokens.RevokeAllAsync(user.Id, ct);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<MeResponse>, UnauthorizedHttpResult>> Me(ClaimsPrincipal principal, UserManager<User> users)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null) return TypedResults.Unauthorized();
        var roles = await users.GetRolesAsync(user);
        return TypedResults.Ok(new MeResponse(user.Id, user.UserName!, user.Email!, user.DisplayName, user.BirthDate, user.Bio, [.. roles]));
    }

    // ------------------------------------------------------------------ helpers

    public static int AgeOn(DateOnly birthDate, DateOnly today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate > today.AddYears(-age)) age--;
        return age;
    }

    private static async Task SendConfirmationAsync(User user, UserManager<User> users, IEmailSender email, AppLinkOptions links, CancellationToken ct)
    {
        var token = EncodeToken(await users.GenerateEmailConfirmationTokenAsync(user));
        var url = $"{links.BaseUrl}/confirmar-email?userId={user.Id}&token={token}";
        await email.SendAsync(new EmailMessage(user.Email!, "Bookollab · confirme seu e-mail",
            Template(user.DisplayName, "Falta pouco para começar a jogar. Confirme seu e-mail:", "Confirmar e-mail", url,
                "Se você não criou uma conta no Bookollab, ignore este e-mail.")), ct);
    }

    private static string Template(string name, string intro, string action, string url, string footer) =>
        $"""
        <p>Olá, {WebUtility.HtmlEncode(name)}!</p>
        <p>{intro}</p>
        <p><a href="{url}">{action}</a></p>
        <p style="color:#6B7472">{footer}</p>
        """;

    private static string EncodeToken(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    private static string? DecodeToken(string encoded)
    {
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encoded)); }
        catch (FormatException) { return null; }
    }

    private static Dictionary<string, string[]> ToErrors(IdentityResult result) =>
        result.Errors
            .GroupBy(e => e.Code switch
            {
                var c when c.Contains("Password") => "password",
                var c when c.Contains("Email") => "email",
                var c when c.Contains("UserName") => "userName",
                _ => "general",
            })
            .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

    private static ValidationProblem InvalidToken() =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["token"] = ["Link inválido ou expirado."] });

    private static ProblemHttpResult InvalidCredentials() =>
        Problem(StatusCodes.Status401Unauthorized, "invalid_credentials", "E-mail ou senha incorretos.");

    private static ProblemHttpResult Problem(int status, string code, string detail) =>
        TypedResults.Problem(detail: detail, statusCode: status, extensions: new Dictionary<string, object?> { ["code"] = code });
}
