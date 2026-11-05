using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace Bookollab.Api.Infrastructure.Email;

public sealed record EmailMessage(string To, string Subject, string HtmlBody);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    public required string Host { get; init; }
    public int Port { get; init; } = 25;
    public bool EnableSsl { get; init; }
    public string? UserName { get; init; }
    public string? Password { get; init; }
    public required string From { get; init; }
}

/// <summary>SMTP sender. In development it points to Mailpit (http://localhost:8025).</summary>
public sealed class SmtpEmailSender(IOptions<SmtpOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var o = options.Value;
        using var client = new SmtpClient(o.Host, o.Port) { EnableSsl = o.EnableSsl };
        if (o.UserName is not null) client.Credentials = new System.Net.NetworkCredential(o.UserName, o.Password);

        using var mail = new MailMessage(o.From, message.To, message.Subject, message.HtmlBody) { IsBodyHtml = true };
        await client.SendMailAsync(mail, ct);
    }
}
