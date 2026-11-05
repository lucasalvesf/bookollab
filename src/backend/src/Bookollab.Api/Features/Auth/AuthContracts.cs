namespace Bookollab.Api.Features.Auth;

public sealed record RegisterRequest(string Email, string Password, string UserName, string DisplayName, DateOnly BirthDate);

public sealed record ConfirmEmailRequest(Guid UserId, string Token);

public sealed record EmailRequest(string Email);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);

public sealed record TokenResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken);

public sealed record MeResponse(Guid Id, string UserName, string Email, string DisplayName, DateOnly BirthDate, string? Bio, string? AvatarKey, IReadOnlyList<string> Roles);
