# Ambiente de desenvolvimento — preparar um computador novo

> Passo a passo para deixar um computador (Windows) pronto para trabalhar no Bookollab com o Claude Code.
> Estado do projeto: [`docs/estado-do-projeto.md`](../docs/estado-do-projeto.md).

## 1. Programas
Instale pelo PowerShell (o `winget` já vem no Windows 10/11):

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Microsoft.DotNet.SDK.10 -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
winget install --id Microsoft.VisualStudioCode -e      # opcional
winget install --id Notepad++.Notepad++ -e             # opcional
wsl --install --no-distribution                        # necessário para o Docker
```

**Reinicie o computador** depois (por causa do WSL2). Em seguida:
1. Abra o **Docker Desktop** uma vez e aceite os termos. Espere aparecer "Engine running".
2. Instale a ferramenta de migrations do EF Core:
   ```powershell
   dotnet tool install --global dotnet-ef
   ```

## 2. GitHub e o repositório
```powershell
gh auth login --web --git-protocol https     # autoriza no navegador
gh auth refresh -h github.com -s workflow    # necessário para enviar arquivos de CI
gh auth setup-git
git clone https://github.com/lucasalvesf/bookollab.git C:\bookollab
cd C:\bookollab
git config core.autocrlf true
git config user.name "Lucas Alves"
git config user.email "francolucas1404@gmail.com"
```

## 3. Subir o projeto
```powershell
cd C:\bookollab\src
docker compose up -d                                          # Postgres, Mailpit, pgAdmin
dotnet ef database update --project backend/src/Bookollab.Api # cria as tabelas
dotnet test backend                                           # deve dar 54/54 aprovados
```

Em dois terminais separados:
```powershell
# Terminal 1: API (http://localhost:5087)
cd C:\bookollab\src
dotnet run --project backend/src/Bookollab.Api
```
```powershell
# Terminal 2: app web (http://localhost:8081)
cd C:\bookollab\src\apps\app
npm ci
npx expo start --web
```

| Endereço | O que é |
|---|---|
| http://localhost:8081 | App (crie uma conta) |
| http://localhost:8025 | Mailpit: e-mails de confirmação e de senha |
| http://localhost:5050 | pgAdmin: ver o banco (senha do servidor: `bookollab`) |
| http://localhost:5087/openapi/v1.json | Documento da API |

## 4. Claude Code
1. Instale o Claude Code e abra-o em `C:\bookollab`. Os arquivos `CLAUDE.md` do repositório são lidos sozinhos.
2. **Regras pessoais globais** (valem em todos os projetos). Elas ficam fora do repositório, em `C:\Users\<você>\.claude\CLAUDE.md`. Copie o conteúdo de [`claude/CLAUDE-global.md`](claude/CLAUDE-global.md) para esse arquivo.
3. **Figma (MCP)**, para editar o diagrama do banco:
   ```powershell
   claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user
   ```
   Depois reinicie o Claude Code, digite `/mcp`, escolha **figma** → **Authenticate** e autorize no navegador.
4. **Claude no Chrome** (opcional, para o Claude testar as telas): instale a extensão "Claude" no Chrome e mantenha o Chrome aberto.
5. Para retomar o trabalho, peça ao Claude: *"leia `docs/estado-do-projeto.md` e continue de onde paramos"*.

## 5. Claude Desktop / claude.ai
O projeto do claude.ai lê este repositório pelo GitHub. Depois de cada push, sincronize o repo no projeto do claude.ai.
