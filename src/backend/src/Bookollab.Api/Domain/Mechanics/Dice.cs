using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Bookollab.Api.Domain.Mechanics;

public sealed record DiceTerm(string Label, int Sign, IReadOnlyList<int> Rolls, int Value);

public sealed record DiceRoll(string Expression, IReadOnlyList<DiceTerm> Terms, int Total);

/// <summary>
/// Parses and rolls expressions like "1d20+3", "2d6-1", "1d20+força". Attribute names are resolved by the caller
/// (character sheet numeric fields). Rolls use a cryptographic RNG on the server, so results cannot be forged.
/// </summary>
public static partial class Dice
{
    public const int MaxTerms = 10;
    public const int MaxDice = 50;
    public const int MaxSides = 1000;

    [GeneratedRegex(@"^(?<count>\d{0,2})d(?<sides>\d{1,4})$", RegexOptions.IgnoreCase)]
    private static partial Regex DiceTermRegex();

    [GeneratedRegex(@"^\d{1,4}$")]
    private static partial Regex NumberRegex();

    [GeneratedRegex(@"^[\p{L}_][\p{L}\p{N}_ ]{0,40}$")]
    private static partial Regex AttributeRegex();

    /// <summary>Recognizes the command: "/rolar 1d20+3" or "/roll 1d20+3". Returns the expression or null.</summary>
    public static string? ParseCommand(string content)
    {
        var text = content.Trim();
        foreach (var prefix in new[] { "/rolar ", "/roll " })
            if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return text[prefix.Length..].Trim();
        return null;
    }

    /// <summary>Rolls the expression. <paramref name="attributes"/> maps normalized attribute names to values.</summary>
    public static (DiceRoll? Roll, string? Error) Roll(string expression, IReadOnlyDictionary<string, int> attributes, Func<int, int>? random = null)
    {
        random ??= sides => RandomNumberGenerator.GetInt32(1, sides + 1);
        var compact = expression.Trim();
        if (compact.Length is 0 or > 200) return (null, "Escreva a rolagem, ex.: /rolar 1d20+3.");

        var terms = new List<DiceTerm>();
        var sign = 1;
        var buffer = new StringBuilder();
        var hasDice = false;

        bool Flush(out string? error)
        {
            error = null;
            var raw = buffer.ToString().Trim();
            buffer.Clear();
            if (raw.Length == 0) { error = "Rolagem incompleta."; return false; }
            if (terms.Count >= MaxTerms) { error = $"Use no máximo {MaxTerms} termos."; return false; }

            var dice = DiceTermRegex().Match(raw.Replace(" ", ""));
            if (dice.Success)
            {
                var count = dice.Groups["count"].Value.Length == 0 ? 1 : int.Parse(dice.Groups["count"].Value, CultureInfo.InvariantCulture);
                var sides = int.Parse(dice.Groups["sides"].Value, CultureInfo.InvariantCulture);
                if (count is < 1 or > MaxDice || sides is < 2 or > MaxSides) { error = $"Use de 1 a {MaxDice} dados de 2 a {MaxSides} lados."; return false; }
                var rolls = Enumerable.Range(0, count).Select(_ => random(sides)).ToList();
                terms.Add(new DiceTerm($"{count}d{sides}", sign, rolls, rolls.Sum()));
                hasDice = true;
                return true;
            }
            if (NumberRegex().IsMatch(raw))
            {
                terms.Add(new DiceTerm(raw, sign, [], int.Parse(raw, CultureInfo.InvariantCulture)));
                return true;
            }
            if (AttributeRegex().IsMatch(raw))
            {
                if (!attributes.TryGetValue(Normalize(raw), out var value)) { error = $"Atributo \"{raw}\" não encontrado na ficha."; return false; }
                terms.Add(new DiceTerm(raw, sign, [], value));
                return true;
            }
            error = $"Não entendi \"{raw}\". Exemplos: 1d20+3, 2d6-1, 1d20+força.";
            return false;
        }

        foreach (var ch in compact)
        {
            if (ch is '+' or '-')
            {
                if (buffer.ToString().Trim().Length == 0 && terms.Count == 0 && ch == '-') { sign = -1; continue; }
                if (!Flush(out var error)) return (null, error);
                sign = ch == '+' ? 1 : -1;
            }
            else buffer.Append(ch);
        }
        if (!Flush(out var last)) return (null, last);
        if (!hasDice) return (null, "A rolagem precisa de pelo menos um dado, ex.: 1d20.");

        return (new DiceRoll(compact, terms, terms.Sum(t => t.Sign * t.Value)), null);
    }

    /// <summary>Attribute names are matched case- and accent-insensitively ("Força" == "forca").</summary>
    public static string Normalize(string name)
    {
        var decomposed = name.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && !char.IsWhiteSpace(c)) sb.Append(c);
        return sb.ToString();
    }
}

/// <summary>Item in a character's inventory. Given and taken by the staff.</summary>
public sealed class InventoryItem
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CharacterId { get; set; }
    public required string Name { get; set; }
    public int Quantity { get; set; } = 1;
    public string? Description { get; set; }
    public Guid GivenByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
