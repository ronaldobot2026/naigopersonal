# Deploy — Windson Wood Personal

Deploy automático na Vercel (projeto `naigopersonal`) a cada push em `master`. Domínio de
produção: https://windsonwoodpersonal.com.br. Comando de build da Vercel: `npm run build`, que
é `tsc -b && vite build`.

## O incidente de 25/09/2026 (a lição)

O commit `2c1c541` tornou a prop `onRemovePhoto` obrigatória em `PosturalPhotoUpload`, mas não
atualizou `src/features/assessments/postural/tests/posturalPhotoUpload.test.tsx`, que instancia
o componente sem ela.

Na hora, validou-se com `npx tsc --noEmit` — e passou. Mas o build real usa `tsc -b`, que
compila o projeto **inteiro, testes incluídos**, e falhou com `TS2322`.

Consequência: todos os deploys da Vercel falharam a partir dali, **em silêncio**. Quatro commits
seguintes (`42c288f`, `f63653e`, `a6458a8` e o próprio `2c1c541`) nunca chegaram em produção
enquanto o site continuava servindo o HTML antigo do cache de borda — foi observado o header
`age: 9341` (~2h36). Do lado do usuário, a impressão correta era "não ajeita as coisas".
Corrigido em `b7a8b39`.

Três regras que saem daí:

1. **`tsc --noEmit` não substitui `npm run build`.** Só `npm run build` reproduz a Vercel.
2. **Deploy que falha não avisa.** O site continua no ar com a versão velha; é preciso
   verificar ativamente que a versão nova subiu.
3. **Erro em arquivo de teste quebra o deploy.** `src/**/tests/*` não é "código de segunda".

## Como confirmar que um deploy realmente publicou

### Passo 1 — hash do bundle ANTES do push

O `index.html` referencia `/assets/index-<hash>.js`, e o hash muda quando o conteúdo muda.
Sempre com cache busting, porque a borda da Vercel serve HTML cacheado:

```sh
curl -s "https://windsonwoodpersonal.com.br/?cb=$RANDOM" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'
```

Anote o resultado. Exemplo real, executado em 25/09/2026 após o fix:

```
/assets/index-mnML5Gu6.js
```

### Passo 2 — depois do push, o hash tem que MUDAR

Repita o comando do passo 1. Se o hash for o mesmo alguns minutos depois, o deploy **não
publicou** — vá ao painel da Vercel ver o log de build.

Para saber se você está olhando cache ou origem:

```sh
curl -sI "https://windsonwoodpersonal.com.br/?cb=$RANDOM" | grep -iE '^(age|x-vercel-cache|date)'
```

`age` alto com hash inalterado é exatamente o sintoma do incidente acima.

### Passo 3 — verificação por CONTEÚDO (a confiável)

**Não compare o hash do build local com o de produção.** Eles não batem: as variáveis `VITE_*`
são embutidas no bundle e as da Vercel são diferentes das do `.env.local`. Comparar hash
local × produção gera falso negativo garantido.

A verificação correta é procurar um texto-marcador do seu fix dentro do bundle de produção.
Concatene o domínio com o caminho obtido no passo 1:

```sh
HASH=$(curl -s "https://windsonwoodpersonal.com.br/?cb=$RANDOM" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js')
curl -s "https://windsonwoodpersonal.com.br$HASH" | grep -c "Remover foto"
```

Saída real obtida em 25/09/2026, com `HASH=/assets/index-mnML5Gu6.js`:

```
2
```

Duas ocorrências de `"Remover foto"` (o `aria-label`/`title` da lixeira introduzida em
`2c1c541`) — prova de que o fix `b7a8b39` está de fato em produção, e não só no painel.

Escolha do marcador: use um texto literal e específico do que você acabou de mudar (label,
mensagem de erro, rótulo de botão). Nomes de variáveis não servem — o minificador os renomeia.

## Guardas automáticas

| Guarda | Onde | O que faz |
|---|---|---|
| `.github/workflows/ci.yml` | GitHub Actions (push + PR) | `npm ci`, `npm run build`, `npx vitest run`, `npx eslint .` |
| `scripts/git-hooks/pre-push` | máquina local | roda `npm run build` e **barra o push** se falhar |
| `npm run verify` | manual | build + testes + lint, o mesmo do CI |

### Instalar o hook

```sh
npm run hooks:install
```

Isso configura `core.hooksPath = scripts/git-hooks` (hook versionado, sem husky nem qualquer
dependência nova). Precisa ser rodado **uma vez por clone** — o git não ativa hooks do
repositório sozinho, por segurança.

Emergência (pular o hook conscientemente):

```sh
git push --no-verify
```

No CI, as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são **placeholders**
inofensivos declarados no próprio workflow. A chave real vive em `.env.local` (gitignored) e nas
env vars do projeto na Vercel — nunca no repositório. Nota verificada: o build passa mesmo sem
essas variáveis (elas só são lidas em runtime), mas ficam declaradas no CI para o bundle de CI
se parecer com o de produção.

## Checklist de pré-push

- [ ] `npm run verify` verde (build + testes + lint).
- [ ] Hook instalado (`git config core.hooksPath` → `scripts/git-hooks`).
- [ ] Mudou uma prop/tipo de componente? Confira os testes que o instanciam.
- [ ] Anote o hash atual de produção (passo 1) antes de empurrar.

## Checklist de pós-deploy

- [ ] CI verde no GitHub Actions para o commit.
- [ ] Deploy `Ready` no painel da Vercel (não `Error`).
- [ ] Hash de `/assets/index-*.js` em produção **mudou** em relação ao anotado.
- [ ] `grep -c "<marcador do fix>"` no bundle de produção retorna > 0.
- [ ] Só depois disso peça para alguém testar no celular.
