using System.Security.Claims;
using Bookollab.Api.Domain.Uploads;
using Bookollab.Api.Features.Common;
using Bookollab.Api.Infrastructure;
using Bookollab.Api.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

namespace Bookollab.Api.Features.Uploads;

public sealed record UploadResponse(string Key, string ContentType, long Size);

public static class UploadEndpoints
{
    public const long MaxBytes = 5 * 1024 * 1024;

    public static void MapUploadEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/uploads", Upload).WithTags("Uploads").WithName("UploadImage")
            .RequireAuthorization().DisableAntiforgery()
            .Accepts<IFormFile>("multipart/form-data").Produces<UploadResponse>(StatusCodes.Status201Created);

        // Public by unguessable key so <img> tags can load them without auth headers.
        app.MapGet("/files/{**key}", Download).WithTags("Uploads").WithName("GetFile").ExcludeFromDescription();
    }

    private static async Task<IResult> Upload(IFormFile file, ClaimsPrincipal user, AppDbContext db, IFileStorage storage, TimeProvider clock, CancellationToken ct)
    {
        if (file.Length is 0) return Problems.Validation("file", "Envie um arquivo.");
        if (file.Length > MaxBytes) return Problems.Validation("file", "A imagem pode ter até 5 MB.");

        await using var stream = file.OpenReadStream();
        var header = new byte[12];
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        var type = DetectImage(header.AsSpan(0, read));
        if (type is null) return Problems.Validation("file", "Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
        stream.Position = 0;

        var now = clock.GetUtcNow();
        var key = $"{now:yyyy}/{now:MM}/{Guid.CreateVersion7():N}.{type.Value.Extension}";
        await storage.SaveAsync(key, stream, ct);
        db.Add(new Upload { Key = key, OwnerUserId = user.UserId(), ContentType = type.Value.ContentType, Size = file.Length });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/files/{key}", new UploadResponse(key, type.Value.ContentType, file.Length));
    }

    private static async Task<IResult> Download(string key, HttpContext http, AppDbContext db, IFileStorage storage, CancellationToken ct)
    {
        var upload = await db.Set<Upload>().AsNoTracking().SingleOrDefaultAsync(u => u.Key == key, ct);
        if (upload is null) return TypedResults.NotFound();
        var stream = await storage.OpenAsync(key, ct);
        if (stream is null) return TypedResults.NotFound();
        // Keys are unique and files never change: cache for a year.
        http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        http.Response.Headers.XContentTypeOptions = "nosniff";
        return TypedResults.Stream(stream, upload.ContentType);
    }

    /// <summary>Checks the file's magic bytes; the client's declared content type is not trusted.</summary>
    public static (string ContentType, string Extension)? DetectImage(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ("image/jpeg", "jpg");
        if (h.Length >= 8 && h[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ("image/png", "png");
        if (h.Length >= 6 && (h[..6].SequenceEqual("GIF87a"u8) || h[..6].SequenceEqual("GIF89a"u8))) return ("image/gif", "gif");
        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8)) return ("image/webp", "webp");
        return null;
    }

    /// <summary>True if the key exists and was uploaded by this user (prevents attaching someone else's file).</summary>
    public static Task<bool> OwnsAsync(AppDbContext db, string key, Guid userId, CancellationToken ct) =>
        db.Set<Upload>().AnyAsync(u => u.Key == key && u.OwnerUserId == userId, ct);
}
