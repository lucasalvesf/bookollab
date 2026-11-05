using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;
using Bookollab.Api.Features.Auth;

namespace Bookollab.Tests;

public sealed partial class AuthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "senha-forte-123";
    private readonly HttpClient _client = factory.CreateClient();

    [GeneratedRegex("href=\"(?<url>[^\"]+)\"")]
    private static partial Regex LinkRegex();

    private static string NewEmail() => $"{Guid.NewGuid():N}@test.local";
    private static string NewHandle() => $"u{Guid.NewGuid():N}"[..16];

    private Task<HttpResponseMessage> RegisterAsync(string email, string? handle = null, DateOnly? birth = null) =>
        _client.PostAsJsonAsync("/auth/register",
            new RegisterRequest(email, Password, handle ?? NewHandle(), "Tester", birth ?? new DateOnly(2000, 5, 10)));

    private System.Collections.Specialized.NameValueCollection LinkQuery(string email)
    {
        var url = LinkRegex().Match(factory.Emails.LastTo(email).HtmlBody).Groups["url"].Value;
        return HttpUtility.ParseQueryString(new Uri(url).Query);
    }

    private async Task<TokenResponse> RegisterConfirmAndLoginAsync(string email)
    {
        (await RegisterAsync(email)).EnsureSuccessStatusCode();
        var q = LinkQuery(email);
        (await _client.PostAsJsonAsync("/auth/confirm-email", new ConfirmEmailRequest(Guid.Parse(q["userId"]!), q["token"]!))).EnsureSuccessStatusCode();
        var login = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, Password));
        login.EnsureSuccessStatusCode();
        return (await login.Content.ReadFromJsonAsync<TokenResponse>())!;
    }

    private static async Task<string?> ProblemCode(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    [Fact]
    public async Task Register_rejects_users_younger_than_13()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var response = await RegisterAsync(NewEmail(), birth: today.AddYears(-13).AddDays(1));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("birthDate", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Register_accepts_user_who_turns_13_today()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var response = await RegisterAsync(NewEmail(), birth: today.AddYears(-13));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Register_rejects_invalid_handle_and_duplicate_email()
    {
        var invalid = await RegisterAsync(NewEmail(), handle: "Nome Com Espaço");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var email = NewEmail();
        (await RegisterAsync(email)).EnsureSuccessStatusCode();
        var duplicate = await RegisterAsync(email);
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Contains("Este e-mail já está em uso.", await duplicate.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Login_requires_confirmed_email()
    {
        var email = NewEmail();
        (await RegisterAsync(email)).EnsureSuccessStatusCode();

        var response = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, Password));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("email_not_confirmed", await ProblemCode(response));
    }

    [Fact]
    public async Task Full_flow_register_confirm_login_and_me()
    {
        var email = NewEmail();
        var tokens = await RegisterConfirmAndLoginAsync(email);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var me = await _client.SendAsync(request);

        me.EnsureSuccessStatusCode();
        var body = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.Equal(email, body!.Email);
        Assert.Equal("Tester", body.DisplayName);
    }

    [Fact]
    public async Task Me_requires_authentication()
    {
        var response = await _client.GetAsync("/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Wrong_password_returns_invalid_credentials_and_locks_after_five_attempts()
    {
        var email = NewEmail();
        await RegisterConfirmAndLoginAsync(email);

        for (var i = 0; i < 5; i++)
        {
            var wrong = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, "senha-errada-000"));
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        }
        var locked = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, Password));

        Assert.Equal((HttpStatusCode)423, locked.StatusCode);
    }

    [Fact]
    public async Task Refresh_rotates_token_and_old_token_stops_working()
    {
        var tokens = await RegisterConfirmAndLoginAsync(NewEmail());

        var first = await _client.PostAsJsonAsync("/auth/refresh", new RefreshRequest(tokens.RefreshToken));
        first.EnsureSuccessStatusCode();
        var reused = await _client.PostAsJsonAsync("/auth/refresh", new RefreshRequest(tokens.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_refresh_token()
    {
        var tokens = await RegisterConfirmAndLoginAsync(NewEmail());

        (await _client.PostAsJsonAsync("/auth/logout", new RefreshRequest(tokens.RefreshToken))).EnsureSuccessStatusCode();
        var refresh = await _client.PostAsJsonAsync("/auth/refresh", new RefreshRequest(tokens.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Password_reset_changes_password_and_ends_sessions()
    {
        var email = NewEmail();
        var tokens = await RegisterConfirmAndLoginAsync(email);

        (await _client.PostAsJsonAsync("/auth/forgot-password", new EmailRequest(email))).EnsureSuccessStatusCode();
        var q = LinkQuery(email);
        var reset = await _client.PostAsJsonAsync("/auth/reset-password", new ResetPasswordRequest(email, q["token"]!, "nova-senha-456"));
        reset.EnsureSuccessStatusCode();

        var oldLogin = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, Password));
        var newLogin = await _client.PostAsJsonAsync("/auth/login", new LoginRequest(email, "nova-senha-456"));
        var oldRefresh = await _client.PostAsJsonAsync("/auth/refresh", new RefreshRequest(tokens.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, oldRefresh.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_does_not_reveal_unknown_emails()
    {
        var response = await _client.PostAsJsonAsync("/auth/forgot-password", new EmailRequest(NewEmail()));
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    [Fact]
    public async Task Confirm_email_rejects_tampered_token()
    {
        var email = NewEmail();
        (await RegisterAsync(email)).EnsureSuccessStatusCode();
        var q = LinkQuery(email);

        var response = await _client.PostAsJsonAsync("/auth/confirm-email", new ConfirmEmailRequest(Guid.Parse(q["userId"]!), "dG9rZW4tZmFsc28"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("2000-05-10", "2013-05-09", 12)]
    [InlineData("2000-05-10", "2013-05-10", 13)]
    [InlineData("2004-02-29", "2017-02-28", 12)]
    [InlineData("2004-02-29", "2017-03-01", 13)]
    public void AgeOn_counts_whole_years(string birth, string today, int expected) =>
        Assert.Equal(expected, AuthEndpoints.AgeOn(DateOnly.Parse(birth), DateOnly.Parse(today)));
}
