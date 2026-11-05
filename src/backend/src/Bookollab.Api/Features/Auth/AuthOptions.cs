namespace Bookollab.Api.Features.Auth;

public sealed class JwtOptions
{
    public const string Section = "Jwt";

    public required string Issuer { get; init; }
    public required string Audience { get; init; }

    /// <summary>HMAC-SHA256 key; at least 32 characters. Never commit a production key.</summary>
    public required string SigningKey { get; init; }

    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 30;
}

public sealed class AppLinkOptions
{
    public const string Section = "App";

    /// <summary>Public URL of the app, used to build links sent by email (e.g. http://localhost:8081).</summary>
    public required string BaseUrl { get; init; }
}
