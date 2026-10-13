#!/usr/bin/env node
/**
 * CHAT-6 · prova de ponta a ponta da Fase 12 (chat), do zero, com alunos LIMPOS.
 *
 * Diferença dos roteiros anteriores (que reaproveitam o aluno demo): aqui os dois alunos são
 * CRIADOS pelo `naigo-aluno` no início e APAGADOS no fim — nada de estado herdado, e a prova do
 * negativo (um segundo aluno não vê a conversa do primeiro) só é honesta com um aluno de verdade,
 * vinculado ao mesmo personal, e não com um id inventado.
 *
 * As três sessões rodam na UI, em contextos separados do Chromium (um `localStorage` por token —
 * no mesmo contexto o segundo token sobrescreveria o primeiro): aluno A em viewport de iPhone,
 * personal em desktop, aluno B em iPhone.
 *
 * Roteiro: personal publica a ficha → aluno A inicia o treino e fala com o personal DE DENTRO do
 * exercício → o personal vê na caixa de entrada com o rótulo de contexto certo e responde → o
 * aluno A recebe sem recarregar (badge sobe na aba Chat enquanto ele está no treino) e o badge
 * zera ao abrir a conversa → o aluno B não vê nada disso → o treino do aluno A seguiu intacto.
 * No fim, apaga tudo e confere que o banco não guardou nada.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(path.join(os.homedir(), '.hermes/hermes-agent/node_modules/playwright'))

const REF = 'midftshifkvweehrtyte'
const SUPA = `https://${REF}.supabase.co`
const SERVICE = fs
  .readFileSync(path.join(os.homedir(), '.config/naigo/service_role.key'), 'utf8')
  .trim()
const ANON = fs
  .readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY='))
  .split('=')[1]
  .trim()
const OUT = path.join(os.homedir(), '.hermes/cache/scratch/chat6')
const BASE = 'http://localhost:5173'
const NAIGO_ALUNO = path.join(os.homedir(), '.local/bin/naigo-aluno')

fs.mkdirSync(OUT, { recursive: true })

const falhas = []
function ok(nome, cond, extra = '') {
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (!cond) falhas.push(nome)
}

function criarAluno(email, nome) {
  const saida = execFileSync(NAIGO_ALUNO, [email, nome], { encoding: 'utf8' })
  const id = (/id:\s+([0-9a-f-]{36})/.exec(saida) ?? [])[1]
  if (!id) throw new Error(`naigo-aluno não devolveu id para ${email}: ${saida}`)
  console.log(`aluno criado: ${nome} <${email}> ${id}`)
  return id
}

async function sessao(email) {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json())
  const verificado = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
  }).then((r) => r.json())
  if (!verificado.access_token)
    throw new Error(`sem sessão para ${email}: ${JSON.stringify(verificado)}`)
  return verificado
}

function rest(token) {
  return async (metodo, caminho, corpo) => {
    const resposta = await fetch(`${SUPA}/rest/v1/${caminho}`, {
      method: metodo,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
    const texto = await resposta.text()
    if (!resposta.ok) throw new Error(`${metodo} ${caminho} -> ${resposta.status} ${texto}`)
    return texto ? JSON.parse(texto) : null
  }
}

async function apagarUsuario(id) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  if (!r.ok) throw new Error(`DELETE auth user ${id} -> ${r.status} ${await r.text()}`)
}

function tokenDe(s) {
  return JSON.stringify({
    access_token: s.access_token,
    token_type: 'bearer',
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
    user: s.user,
  })
}

const ABA = (href) => `nav[aria-label="Navegação principal"] a[href="${href}"]`
const BOTAO_FALAR = 'button:has-text("Falar com o personal")'

async function esperarIntro(page) {
  // Overlay de vídeo (~11 s) deixa o body.innerText vazio: sem esperar, toda rota parece quebrada.
  await page.waitForFunction(() => !document.querySelector('video[src="/intro-naigo.mp4"]'), null, {
    timeout: 40000,
  })
}

const IPHONE = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}
const DESKTOP = { viewport: { width: 1440, height: 900 } }

/*
 * Cada papel tem o SEU user-data-dir no scratch: `launchPersistentContext` não abre contextos
 * irmãos (é o próprio contexto), e dois tokens no mesmo perfil se sobrescreveriam no
 * `localStorage`. Três perfis = três sessões simultâneas de verdade.
 */
async function sessaoNoNavegador(nome, s, papel, opcoes) {
  const dir = path.join(os.homedir(), `.hermes/cache/scratch/chat6-perfil-${nome}`)
  fs.rmSync(dir, { recursive: true, force: true })
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, ...opcoes })
  await ctx.addInitScript(
    ([chave, valor, role]) => {
      localStorage.setItem(chave, valor)
      localStorage.setItem('windson-wood.role', role)
    },
    [`sb-${REF}-auth-token`, tokenDe(s), papel],
  )
  return ctx
}

;(async () => {
  const marca = Date.now().toString(36)
  const emailA = `chat6a-${marca}@naigo.demo`
  const emailB = `chat6b-${marca}@naigo.demo`
  const nomeA = `Aluno A CHAT6 ${marca}`
  const nomeB = `Aluno B CHAT6 ${marca}`

  const idA = criarAluno(emailA, nomeA)
  const idB = criarAluno(emailB, nomeB)

  const restAdmin = rest(SERVICE)
  const alunoA = await sessao(emailA)
  const alunoB = await sessao(emailB)
  const personal = await sessao('personal@naigo.demo')
  const restAlunoA = rest(alunoA.access_token)
  const restAlunoB = rest(alunoB.access_token)
  const restPersonal = rest(personal.access_token)
  console.log(`sessões: A=${idA} B=${idB} personal=${personal.user.id}`)

  let ficha = null
  let conversaA = null
  let conversaB = null
  let logId = null
  let contextos = []

  try {
    // ── 0. o PERSONAL publica a ficha do aluno A (sessão dele, não service_role) ──────────
    const exercicios = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'public/data/exercises.json'), 'utf8'),
    )
    const catalogo = Array.isArray(exercicios) ? exercicios : exercicios.exercises
    const exercicio = catalogo.find((e) => e.id === '0025') ?? catalogo[0]
    ficha = (
      await restPersonal('POST', 'workout_plans', {
        student_id: idA,
        trainer_id: personal.user.id,
        status: 'published',
        objective: 'CHAT-6 prova de ponta a ponta',
        weekly_frequency: 3,
        notes: '',
        divisions: [
          {
            id: 'A',
            label: 'Superior',
            entries: [{ exerciseId: exercicio.id, sets: 2, reps: '10', restSeconds: 60 }],
          },
        ],
        published_at: new Date().toISOString(),
      })
    )[0]
    ok('personal publica a ficha do aluno novo', ficha.status === 'published', ficha.id)

    const ctxA = await sessaoNoNavegador('aluno-a', alunoA, 'student', IPHONE)
    const ctxB = await sessaoNoNavegador('aluno-b', alunoB, 'student', IPHONE)
    const ctxP = await sessaoNoNavegador('personal', personal, 'trainer', DESKTOP)
    contextos = [ctxA, ctxB, ctxP]

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const pageP = await ctxP.newPage()

    // ── 1. aluno A inicia o treino e fala de DENTRO do exercício ─────────────────────────
    await pageA.goto(`${BASE}/aluno/treinos/A`)
    await esperarIntro(pageA)
    await pageA.waitForSelector('button:has-text("Iniciar treino")', { timeout: 30000 })
    await pageA.click('button:has-text("Iniciar treino")')
    await pageA.waitForSelector('input[aria-label*="Carga em quilos"]', { timeout: 20000 })

    const logs = await restAlunoA(
      'GET',
      `workout_logs?student_id=eq.${idA}&division_key=eq.A&completed_at=is.null&select=id`,
    )
    ok('aluno limpo inicia o treino da ficha publicada', logs.length === 1, JSON.stringify(logs))
    logId = logs[0].id

    const nomeExercicio = await pageA.evaluate(() => {
      const campo = document.querySelector('input[aria-label*="Carga em quilos"]')
      const m = campo && /—\s(.+),\ssérie/.exec(campo.getAttribute('aria-label'))
      return m ? m[1] : null
    })
    const rotuloEsperado = `Treino A · ${nomeExercicio}`
    const campoCarga = pageA.locator('input[aria-label*="Carga em quilos"]').first()
    await campoCarga.fill('47.5')
    await pageA.locator(BOTAO_FALAR).first().click()
    await pageA.waitForSelector('textarea[aria-label*="Mensagem para o personal"]', {
      timeout: 10000,
    })
    const perguntaA = 'Senti dor no ombro na 3a serie, posso reduzir a carga?'
    await pageA.fill('textarea[aria-label*="Mensagem para o personal"]', perguntaA)
    await pageA.click('button:has-text("Enviar ao personal")')
    await pageA.waitForFunction(
      () => /Mensagem enviada ao personal/.test(document.body.innerText),
      null,
      { timeout: 20000 },
    )
    ok('mensagem enviada de dentro do exercício em execução', true)
    await pageA.screenshot({ path: `${OUT}/01-aluno-falou-no-exercicio.png` })

    const [msgA] = await restAlunoA(
      'GET',
      `messages?sender_id=eq.${idA}&select=conversation_id,context_kind,context_id,context_label`,
    )
    conversaA = msgA.conversation_id
    ok('contexto congelado aponta para a execução', msgA.context_kind === 'exercise' && msgA.context_id === logId, `${msgA.context_kind}/${msgA.context_id}`)
    ok('rótulo de contexto montado no envio', msgA.context_label === rotuloEsperado, msgA.context_label)

    // ── 2. o personal vê na caixa de entrada com o rótulo certo e responde ──────────────
    await pageP.goto(`${BASE}/personal/chat`)
    await esperarIntro(pageP)
    await pageP.waitForSelector('nav[aria-label="Conversas dos alunos"]', { timeout: 30000 })
    await pageP.waitForFunction(
      (nome) =>
        document.querySelector('nav[aria-label="Conversas dos alunos"]').innerText.includes(nome),
      nomeA,
      { timeout: 25000 },
    )
    const linha = await pageP.evaluate((nome) => {
      const botao = [...document.querySelectorAll('nav[aria-label="Conversas dos alunos"] button')].find(
        (b) => b.innerText.includes(nome),
      )
      const marcador = botao.querySelector('span[aria-hidden="true"]')
      return {
        rotulo: botao.getAttribute('aria-label'),
        texto: botao.innerText.replace(/\n/g, ' | '),
        naoLidas: marcador ? marcador.innerText : null,
      }
    }, nomeA)
    ok('conversa do aluno novo na caixa de entrada, com 1 não lida', linha.naoLidas === '1', JSON.stringify(linha))
    ok(
      'prévia traz o rótulo do contexto do exercício',
      linha.texto.toLowerCase().includes(rotuloEsperado.toLowerCase()),
      linha.texto,
    )
    await pageP.screenshot({ path: `${OUT}/02-caixa-de-entrada-do-personal.png` })

    await pageP.evaluate((nome) => {
      const botao = [...document.querySelectorAll('nav[aria-label="Conversas dos alunos"] button')].find(
        (b) => b.innerText.includes(nome),
      )
      botao.click()
    }, nomeA)
    await pageP.waitForSelector('input[aria-label="Mensagem"]', { timeout: 25000 })
    await pageP.waitForFunction(
      (texto) => document.body.innerText.includes(texto),
      perguntaA,
      { timeout: 20000 },
    )
    const naConversaDoPersonal = await pageP.locator('body').innerText()
    ok(
      'mensagem aberta mostra o rótulo de contexto da execução',
      naConversaDoPersonal.toLowerCase().includes(rotuloEsperado.toLowerCase()),
      (naConversaDoPersonal.match(/Treino A[\s\S]{0,60}/i) ?? [''])[0].replace(/\n/g, ' | '),
    )
    // O rótulo é `uppercase` por CSS, então o innerText vem maiúsculo: comparação
    // case-insensitive (a mesma armadilha dos roteiros das CHAT-3/4).
    const linkContexto = await pageP.evaluate((rotulo) => {
      const a = [...document.querySelectorAll('a')].find((n) =>
        n.innerText.replace(/\n/g, ' ').toLowerCase().includes(rotulo.toLowerCase()),
      )
      return a ? a.getAttribute('href') : null
    }, rotuloEsperado)
    ok(
      'rótulo é link de volta para a execução exata',
      linkContexto === `/personal/alunos/${idA}?sessao=${logId}`,
      String(linkContexto),
    )

    const respostaP = 'Reduz para 40 kg e me avisa amanha.'
    await pageP.fill('input[aria-label="Mensagem"]', respostaP)
    await pageP.click('button[aria-label="Enviar mensagem"]')
    await pageP.waitForFunction((t) => document.body.innerText.includes(t), respostaP, {
      timeout: 20000,
    })
    await pageP.screenshot({ path: `${OUT}/03-personal-respondeu.png` })

    // ── 3. aluno A recebe SEM recarregar: badge sobe na aba Chat, ainda dentro do treino ──
    // A tela do aluno continua a MESMA desde a etapa 1 (nenhum reload, nenhuma navegação).
    await pageA.waitForFunction(
      () => {
        const aba = document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]')
        return aba && /1/.test(aba.innerText)
      },
      null,
      { timeout: 25000 },
    )
    ok('badge de não lidas subiu a 1 sem recarregar, com o aluno no treino', true)
    const rotuloAba = await pageA.evaluate(
      () =>
        document
          .querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]')
          .getAttribute('aria-label'),
    )
    ok('badge do aluno é acessível', /1 não lidas/.test(rotuloAba || ''), rotuloAba)

    // Antes de sair do treino: a sessão não foi interrompida pelo envio nem pela chegada.
    const corpoTreino = await pageA.locator('body').innerText()
    ok('treino segue em andamento depois da conversa', /Treino em andamento/.test(corpoTreino))
    ok('não voltou para "Iniciar treino"', !/Iniciar treino/.test(corpoTreino))
    ok('carga digitada continua na tela', (await campoCarga.inputValue()) === '47.5')
    await pageA.screenshot({ path: `${OUT}/04-badge-durante-o-treino.png` })

    await pageA.click(ABA('/aluno/chat'))
    await pageA.waitForURL('**/aluno/chat', { timeout: 15000 })
    await pageA.waitForFunction((t) => document.body.innerText.includes(t), respostaP, {
      timeout: 20000,
    })
    ok('aluno abre a conversa e lê a resposta do personal', true)
    // Duplicação otimista: a bolha própria entra na tela antes do servidor e o Realtime devolve o
    // INSERT dela em seguida. `includes` passaria igual com a mensagem duplicada — então o assert
    // é de CONTAGEM, na tela e no banco.
    const vezes = await pageA.evaluate(
      ([pergunta, resposta]) => {
        const texto = document.body.innerText
        const conta = (t) => texto.split(t).length - 1
        return { pergunta: conta(pergunta), resposta: conta(resposta) }
      },
      [perguntaA, respostaP],
    )
    const naConversa = await restAlunoA(
      'GET',
      `messages?conversation_id=eq.${conversaA}&select=id`,
    )
    ok(
      'nenhuma mensagem duplicada: uma bolha de cada na tela e 2 linhas no banco',
      vezes.pergunta === 1 && vezes.resposta === 1 && naConversa.length === 2,
      `${JSON.stringify(vezes)} banco=${naConversa.length}`,
    )
    await pageA.waitForFunction(
      () => {
        const aba = document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]')
        return aba && !/\d/.test(aba.innerText)
      },
      null,
      { timeout: 20000 },
    )
    ok('badge zerou ao abrir a conversa', true)
    const lidas = await restAlunoA(
      'GET',
      `messages?conversation_id=eq.${conversaA}&sender_id=eq.${personal.user.id}&select=read_at`,
    )
    ok('read_at preenchido no banco', lidas.length === 1 && lidas[0].read_at !== null, JSON.stringify(lidas))
    await pageA.screenshot({ path: `${OUT}/05-aluno-leu.png` })

    // ── 4. prova do negativo: o aluno B não vê NADA dessa conversa ──────────────────────
    await pageB.goto(`${BASE}/aluno/chat`)
    await esperarIntro(pageB)
    await pageB.waitForSelector('input[aria-label="Mensagem"]', { timeout: 30000 })
    await pageB.waitForFunction(() => !/Carregando/i.test(document.body.innerText), null, {
      timeout: 20000,
    })
    const corpoB = await pageB.locator('body').innerText()
    ok(
      'aluno B não vê a pergunta nem a resposta da conversa do aluno A',
      !corpoB.includes(perguntaA) && !corpoB.includes(respostaP),
      corpoB.replace(/\n/g, ' | ').slice(0, 160),
    )
    ok('aluno B vê a própria conversa vazia', /Nenhuma mensagem ainda/i.test(corpoB))
    const msgsB = await restAlunoB('GET', 'messages?select=id,body')
    ok('RLS: a sessão do aluno B não lê mensagem nenhuma', msgsB.length === 0, JSON.stringify(msgsB))
    const convsB = await restAlunoB('GET', 'conversations?select=id,student_id')
    conversaB = (convsB[0] ?? {}).id ?? null
    ok(
      'RLS: aluno B só alcança a conversa dele',
      convsB.every((c) => c.student_id === idB) && !convsB.some((c) => c.id === conversaA),
      JSON.stringify(convsB),
    )
    await pageB.screenshot({ path: `${OUT}/06-aluno-b-nao-ve-nada.png` })

    // ── 5. o treino do aluno A continua intacto depois de tudo ──────────────────────────
    await pageA.goto(`${BASE}/aluno/treinos/A`)
    await pageA.waitForFunction(() => /Treino em andamento/.test(document.body.innerText), null, {
      timeout: 25000,
    })
    const cargaDepois = await pageA
      .locator('input[aria-label*="Carga em quilos"]')
      .first()
      .inputValue()
    ok('ao voltar, o treino segue em andamento com a carga salva', cargaDepois === '47.5', cargaDepois)
    const series = await restAlunoA('GET', `set_logs?workout_log_id=eq.${logId}&select=weight_kg`)
    ok(
      'a série digitada está no banco',
      series.some((s) => Number(s.weight_kg) === 47.5),
      JSON.stringify(series),
    )
    await pageA.screenshot({ path: `${OUT}/07-treino-intacto.png` })
  } finally {
    for (const ctx of contextos) await ctx.close()

    // ── 6. limpeza: nada de dado de teste no banco ─────────────────────────────────────
    for (const id of [idA, idB]) {
      const convs = await restAdmin(
        'GET',
        `conversations?or=(student_id.eq.${id},trainer_id.eq.${id})&select=id`,
      )
      for (const c of convs) {
        await restAdmin('DELETE', `messages?conversation_id=eq.${c.id}`)
        await restAdmin('DELETE', `conversations?id=eq.${c.id}`)
      }
      const logsDoAluno = await restAdmin('GET', `workout_logs?student_id=eq.${id}&select=id`)
      for (const l of logsDoAluno) {
        await restAdmin('DELETE', `set_logs?workout_log_id=eq.${l.id}`)
        await restAdmin('DELETE', `workout_logs?id=eq.${l.id}`)
      }
      await restAdmin('DELETE', `set_logs?student_id=eq.${id}`)
      await restAdmin('DELETE', `workout_plans?student_id=eq.${id}`)
      await restAdmin('DELETE', `students?id=eq.${id}`)
      await restAdmin('DELETE', `profiles?id=eq.${id}`)
      await apagarUsuario(id)
    }

    const sobrou = {
      conversas: await restAdmin(
        'GET',
        `conversations?or=(student_id.eq.${idA},student_id.eq.${idB})&select=id`,
      ),
      mensagens: conversaA
        ? await restAdmin(
            'GET',
            `messages?or=(conversation_id.eq.${conversaA}${conversaB ? `,conversation_id.eq.${conversaB}` : ''})&select=id`,
          )
        : [],
      execucoes: await restAdmin(
        'GET',
        `workout_logs?or=(student_id.eq.${idA},student_id.eq.${idB})&select=id`,
      ),
      series: logId ? await restAdmin('GET', `set_logs?workout_log_id=eq.${logId}&select=id`) : [],
      fichas: await restAdmin(
        'GET',
        `workout_plans?or=(student_id.eq.${idA},student_id.eq.${idB})&select=id`,
      ),
      vinculos: await restAdmin('GET', `students?or=(id.eq.${idA},id.eq.${idB})&select=id`),
      perfis: await restAdmin('GET', `profiles?or=(id.eq.${idA},id.eq.${idB})&select=id`),
    }
    const usuarios = await fetch(`${SUPA}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    })
      .then((r) => r.json())
      .then((j) => (j.users ?? []).filter((u) => u.id === idA || u.id === idB))
    ok(
      'limpeza: nada do teste sobrou no banco',
      Object.values(sobrou).every((v) => v.length === 0) && usuarios.length === 0,
      JSON.stringify({ ...Object.fromEntries(Object.entries(sobrou).map(([k, v]) => [k, v.length])), usuarios: usuarios.length }),
    )
  }

  console.log(falhas.length === 0 ? '\nTODOS OS ASSERTS PASSARAM' : `\nFALHAS: ${falhas.join(', ')}`)
  process.exit(falhas.length === 0 ? 0 : 1)
})()
