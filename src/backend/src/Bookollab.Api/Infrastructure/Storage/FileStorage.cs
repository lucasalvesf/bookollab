using Microsoft.Extensions.Options;

namespace Bookollab.Api.Infrastructure.Storage;

public interface IFileStorage
{
    Task SaveAsync(string key, Stream content, CancellationToken ct);
    Task<Stream?> OpenAsync(string key, CancellationToken ct);
}

public sealed class StorageOptions
{
    public const string Section = "Storage";

    /// <summary>Folder for local storage (development). Relative paths are resolved from the content root.</summary>
    public string LocalPath { get; init; } = ".data/uploads";
}

/// <summary>
/// Stores files on the local disk. Used in development; production will use Cloudflare R2 (S3 API) behind the same interface.
/// </summary>
public sealed class LocalFileStorage(IOptions<StorageOptions> options, IWebHostEnvironment env) : IFileStorage
{
    private string Root => Path.GetFullPath(Path.Combine(env.ContentRootPath, options.Value.LocalPath));

    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        var path = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        var path = Resolve(key);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    /// <summary>Maps a key to a path inside the root, rejecting path traversal.</summary>
    private string Resolve(string key)
    {
        var path = Path.GetFullPath(Path.Combine(Root, key));
        if (!path.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new ArgumentException("Invalid storage key.", nameof(key));
        return path;
    }
}
