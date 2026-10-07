# Como testar o app — inclusive a área do aluno — sem e-mail e sem OAuth

Hoje o projeto **não tem provedor de e-mail transacional configurado** (sem Resend/SMTP) e
**não tem login social** (sem Google OAuth). Isso quebra exatamente dois caminhos:

- o botão **"Adicionar aluno"** (`/personal/alunos`, Edge Function `invite-student`) usa
  `auth.admin.inviteUserByEmail`, que **dispara um e-mail** e ainda **rejeita domínio `.demo`**
  com `"Email address is invalid"`;
- qualquer fluxo de "confirme seu e-mail" / "recuperar senha" não chega a lugar nenhum.

**Nada disso impede testar o produto.** O Supabase expõe a Admin API com a `service_role`, e por
ela criamos usuários **já confirmados**, sem enviar um único e-mail. Abaixo os quatro caminhos,
do mais simples ao mais automatizável.

> ⚠️ A `service_role` key é chave de administrador: **nunca** no repositório, nunca no front,
> nunca em log. Ela vive em `~/.config/naigo/service_role.key` (`chmod 600`) e pode ser relida com
> `supabase projects api-keys --project-ref midftshifkvweehrtyte --reveal`.
> Em `.env.local`/Vercel só entram `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## Caminho 1 — contas demo que já existem (o mais rápido)

| conta | papel | senha |
|---|---|---|
| `personal@naigo.demo` | trainer (`f807b560-5803-4123-afe9-a83c7124c674`) | `Naigo2026!` |
| `aluno@naigo.demo` | student (`867d018a-bec2-412b-a1db-c875f7bc4edd`, "Aluno Demo") | `Naigo2026!` |

Login normal pela tela `/login`. Funcionam porque foram criados via **Admin API `createUser`**
(que não valida domínio nem manda e-mail), não via convite.

Use isso para olhar tela. **Não** use para testar "o aluno novo recebe a ficha certa": a conta
demo já tem histórico sujo de testes anteriores.

## Caminho 2 — criar um aluno novo em um comando

Script local (não versionado): `~/.local/bin/naigo-aluno`

```sh
naigo-aluno maria@naigo.demo "Maria Silva"          # senha default Naigo2026!
naigo-aluno joao@naigo.demo "João Souza" OutraSenha1!
```

O que ele faz, nessa ordem:

1. `POST /auth/v1/admin/users` com `email_confirm: true` → usuário **já ativo**, zero e-mail
   enviado. O trigger `handle_new_user()` cria o `profiles` com `role='student'` e o `full_name`.
2. `POST /rest/v1/students` com `{id: <user_id>, trainer_id: <personal>}` → vincula o aluno ao
   personal (sem esse vínculo a RLS esconde tudo e a tela do aluno parece quebrada).

Domínio `.demo` é aceito aqui justamente porque não há envio de e-mail. Use `@naigo.demo` em todo
dado de teste — fica trivial achar e apagar depois (`@example.com` já causou sobra de usuário em
teste de integração; evite).

## Caminho 3 — entrar sem digitar senha (magiclink trocado por sessão)

Serve para automação e para quando a senha de uma conta é desconhecida. Troca-se um magiclink
por um par de tokens **sem abrir e-mail nenhum**:

```sh
K=$(tr -d '\n' < ~/.config/naigo/service_role.key); REF=midftshifkvweehrtyte

# 1. gera o link e pega o hashed_token (não sai e-mail)
curl -s -X POST "https://$REF.supabase.co/auth/v1/admin/generate_link" \
  -H "apikey: $K" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"type":"magiclink","email":"aluno@naigo.demo"}'

# 2. troca o hash por access_token/refresh_token
curl -s -X POST "https://$REF.supabase.co/auth/v1/verify" -H "apikey: $K" \
  -H 'Content-Type: application/json' \
  -d '{"type":"magiclink","token_hash":"<HASHED_TOKEN>"}'
```

No navegador, injete a sessão **antes** da primeira navegação (mesmo shape do supabase-js v2):

```js
localStorage.setItem('sb-midftshifkvweehrtyte-auth-token', JSON.stringify({
  access_token, token_type: 'bearer', expires_in, expires_at, refresh_token, user,
}));
// para a área do aluno, o app também lê:
localStorage.setItem('windson-wood.role', 'student');
```

Com isso a RLS responde como aquele usuário — é a prova real de que o aluno vê (ou não vê) o dado.

## Caminho 4 — e quando o convite por e-mail precisar funcionar de verdade?

Aí sim é preciso ligar um provedor. Duas opções, em ordem de esforço:

1. **SMTP custom no Supabase Auth** (Project Settings → Auth → SMTP): resolve convite, recuperação
   de senha e confirmação de uma vez. Qualquer provedor serve (Resend, Postmark, SES, até Gmail
   com senha de app para teste).
2. **Google OAuth** (Auth → Providers): tira a senha do caminho, mas **não** substitui o SMTP —
   convite de aluno continua precisando enviar e-mail.

Até lá, o convite só funciona com **domínio real** (`gmail.com` etc.), e o e-mail não chega —
ou seja: use os caminhos 1–3.

---

## Roteiro mínimo de teste da área do aluno

1. Suba o dev server: `npm run dev -- --port 5173 --strictPort` e confira `http://localhost:5173`
   (200, título "Windson Wood Personal"). Produção: <https://windsonwoodpersonal.com.br>.
2. Crie um aluno limpo: `naigo-aluno teste1@naigo.demo "Teste Um"`.
3. Entre como **personal** e monte o dado: nova avaliação → aba *Avaliação postural* → consentimento
   → *Continuar* → subir as 4 fotos (frente / lateral esq / lateral dir / costas) → aba *Revisão* →
   **Concluir avaliação**. Depois, construtor de treino → **Publicar**.
4. Entre como **aluno** e confira as 5 abas: Ficha, Treino, Alimentação, Correção, Avaliação.
5. Prove o negativo também: com a ficha em `draft` (só *Salvar rascunho*), o aluno **não** pode ver
   o treino — a RLS só libera `published`, e avaliação só em `status = completed`.

### Pegadinhas que custam tempo

- **Vídeo de intro (~11 s):** o app monta um `video[src="/intro-naigo.mp4"]` em tela cheia. Com ele
  na tela, `document.body.innerText` vem **vazio** e toda rota parece quebrada. Espere o vídeo sair.
- **`/` sempre redireciona para `/login`** — é `<Navigate>` fixo, não é falta de sessão.
- **Abrir `/personal/alunos/<id>/avaliacoes/nova` cria um registro `draft` a cada abertura.**
  Script que abre a tela N vezes deixa N rascunhos no histórico do aluno. Limpe depois.
- **Contadores animados (CountUp) na home do aluno:** ler o número antes de ~4 s devolve um valor
  no meio da contagem (138 em vez de 150). Espere, ou leia do estado/aria em vez do texto.
- **Fotos posturais ficam no IndexedDB do navegador** (`lib/storage/photoStorage.ts`), não no
  Supabase — só as métricas/landmarks sobem (`postural_assessment` jsonb). As fotos tiradas de um
  lado **não** aparecem do outro lado. O upload para Storage (`assessment_photos`) é o passo
  *Registro visual*, outro ponto do wizard.
- **Testes de integração rodam contra o projeto real:**
  `SUPABASE_SERVICE_ROLE_KEY=$(cat ~/.config/naigo/service_role.key) npx vitest run integration`.
  No teardown, apague os **alunos antes** do personal (FK), e confira que não sobrou usuário de teste.
- `handle_new_user` **ignora** `role`/`trainer_id` vindos do metadata (hardening de 21/09): para
  criar um trainer é preciso `profiles.update(role='trainer')` + `students.insert` via service_role.

## Limpeza depois do teste

```sh
K=$(tr -d '\n' < ~/.config/naigo/service_role.key); REF=midftshifkvweehrtyte
# lista quem é de teste antes de apagar
curl -s "https://$REF.supabase.co/auth/v1/admin/users" \
  -H "apikey: $K" -H "Authorization: Bearer $K" | grep -o '"email":"[^"]*naigo.demo"'
# apagar: DELETE /auth/v1/admin/users/<user_id>  (o profile/student cai por cascade)
```

Regra de ouro: **todo dado de teste nasce com e-mail `@naigo.demo`** e morre no fim do teste.
