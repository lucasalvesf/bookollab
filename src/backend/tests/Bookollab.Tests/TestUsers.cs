using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bookollab.Api.Domain.Users;
using Bookollab.Api.Features.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Bookollab.Tests;

public static class TestUsers
{
    public const string Password = "senha-forte-123";

    /// <summary>Same JSON settings as the API (enums as text).</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    /// <summary>Creates a confirmed user and returns an HttpClient authenticated as them.</summary>
    public static async Task<(HttpClient Client, User User)> CreateClientAsync(ApiFactory factory, string? displayName = null)
    {
        var user = new User
        {
            UserName = $"u{Guid.NewGuid():N}"[..16],
            Email = $"{Guid.NewGuid():N}@test.local",
            DisplayName = displayName ?? "Tester",
            BirthDate = new DateOnly(2000, 1, 1),
            EmailConfirmed = true,
        };
        using (var scope = factory.Services.CreateScope())
        {
            var result = await scope.ServiceProvider.GetRequiredService<UserManager<User>>().CreateAsync(user, Password);
            if (!result.Succeeded) throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));
        }

        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/auth/login", new LoginRequest(user.Email, Password));
        login.EnsureSuccessStatusCode();
        var tokens = await login.Content.ReadFromJsonAsync<TokenResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);
        return (client, user);
    }

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    public static Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, Json);

    public static Task<HttpResponseMessage> PutJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PutAsJsonAsync(url, body, Json);
}
