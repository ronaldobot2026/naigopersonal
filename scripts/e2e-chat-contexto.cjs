#!/usr/bin/env node
/**
 * CHAT-4 · prova de navegador: comentar de dentro do treino e da avaliação.
 *
 * O aluno roda na UI (sessão real, viewport de iPhone) e o PERSONAL entra pela REST com o
 * access_token dele — é assim que se prova que a mensagem chega ao outro lado com o rótulo certo
 * sem depender da tela do personal.
 *
 * O ponto mais importante do roteiro é a etapa 3: a carga é digitada e o painel de mensagem abre
 * DENTRO da janela de debounce de 400ms do auto-save. Se o envio não descarregasse os timers
 * pendentes, a série digitada sumiria — é o cuidado que o "Concluir treino" já tinha.
 */
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
const OUT = path.join(os.homedir(), '.hermes/cache/scratch/chat4')
const BASE = 'http://localhost:5173'

fs.mkdirSync(OUT, { recursive: true })

const falhas = []
function ok(nome, cond, extra = '') {
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (!cond) falhas.push(nome)
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

async function esperarIntro(page) {
  // Overlay de vídeo (~11 s) deixa o body.innerText vazio: sem esperar, toda rota parece quebrada.
  await page.waitForFunction(() => !document.querySelector('video[src="/intro-naigo.mp4"]'), null, {
    timeout: 40000,
  })
}

const BOTAO_FALAR = 'button:has-text("Falar com o personal")'

;(async () => {
  const aluno = await sessao('aluno@naigo.demo')
  const personal = await sessao('personal@naigo.demo')
  const restAluno = rest(aluno.access_token)
  const restPersonal = rest(personal.access_token)
  const restAdmin = rest(SERVICE)
  console.log(`sessões: aluno=${aluno.user.id} personal=${personal.user.id}`)

  // Ficha com UM exercício na divisão A. Se o aluno demo já tiver ficha publicada, ela é
  // preservada (criada só quando não existe) e apagada no fim apenas se foi criada aqui.
  const exercicios = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public/data/exercises.json'), 'utf8'),
  )
  const catalogo = Array.isArray(exercicios) ? exercicios : exercicios.exercises
  const exercicio = catalogo.find((e) => e.id === '0025') ?? catalogo[0]

  const jaPublicada = await restAdmin(
    'GET',
    `workout_plans?student_id=eq.${aluno.user.id}&status=eq.published&select=id`,
  )
  let planoCriado = null
  if (jaPublicada.length === 0) {
    const criado = await restAdmin('POST', 'workout_plans', {
      student_id: aluno.user.id,
      trainer_id: personal.user.id,
      status: 'published',
      objective: 'CHAT-4 prova de contexto',
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
    planoCriado = criado[0].id
    console.log(`ficha de teste publicada: ${planoCriado} (${exercicio.id} ${exercicio.name})`)
  } else {
    console.log('aluno demo já tinha ficha publicada — usando a que existe')
  }

  // Avaliação concluída (o aluno só vê `completed`, por RLS) para a etapa 5.
  const avaliacao = (
    await restAdmin('POST', 'physical_assessments', {
      student_id: aluno.user.id,
      evaluator_id: personal.user.id,
      status: 'completed',
      general_notes: 'CHAT-4 prova de contexto',
    })
  )[0]

  const browser = await chromium.launchPersistentContext(
    path.join(os.homedir(), '.hermes/cache/scratch/chat4-profile'),
    {
      headless: true,
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  )
  const page = await browser.newPage()
  await page.addInitScript(
    ([chave, valor]) => {
      localStorage.setItem(chave, valor)
      localStorage.setItem('windson-wood.role', 'student')
    },
    [
      `sb-${REF}-auth-token`,
      JSON.stringify({
        access_token: aluno.access_token,
        token_type: 'bearer',
        expires_in: aluno.expires_in,
        expires_at: aluno.expires_at,
        refresh_token: aluno.refresh_token,
        user: aluno.user,
      }),
    ],
  )

  let conversaId = null
  let logId = null
  try {
    // ── 1. treino em execução, ação discreta no exercício ─────────────────────────────────
    await page.goto(`${BASE}/aluno/treinos/A`)
    await esperarIntro(page)
    await page.waitForSelector('button:has-text("Iniciar treino")', { timeout: 25000 })
    await page.click('button:has-text("Iniciar treino")')
    await page.waitForSelector('input[aria-label*="Carga em quilos"]', { timeout: 20000 })

    const logs = await restAluno(
      'GET',
      `workout_logs?student_id=eq.${aluno.user.id}&division_key=eq.A&completed_at=is.null&select=id`,
    )
    ok('sessão de treino aberta', logs.length === 1, JSON.stringify(logs))
    logId = logs[0].id

    // O nome é lido do aria-label do campo de carga (`Carga em quilos — <exercício>, série N`):
    // ler o `<p>` em negrito do card pegaria o nome do app no cabeçalho.
    const nomeExercicio = await page.evaluate(() => {
      const campo = document.querySelector('input[aria-label*="Carga em quilos"]')
      const m = campo && /—\s(.+),\ssérie/.exec(campo.getAttribute('aria-label'))
      return m ? m[1] : null
    })
    ok('nome do exercício visível no card', Boolean(nomeExercicio), nomeExercicio)
    const rotuloEsperado = `Treino A · ${nomeExercicio}`

    const botao = page.locator(BOTAO_FALAR).first()
    ok('ação "Falar com o personal" existe no exercício', (await botao.count()) === 1)

    // Discreta: não pode competir com o check de série nem com "Concluir treino".
    const discreta = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((n) =>
        /Falar com o personal/.test(n.innerText),
      )
      const concluir = [...document.querySelectorAll('button')].find((n) =>
        /Concluir treino/.test(n.innerText),
      )
      const e = getComputedStyle(b)
      return {
        fonte: parseFloat(e.fontSize),
        fundo: e.backgroundColor,
        fonteConcluir: parseFloat(getComputedStyle(concluir).fontSize),
        alvo: b.getBoundingClientRect().height,
      }
    })
    ok(
      'ação discreta (sem fundo sólido, fonte menor que o botão primário) e com alvo de 44px',
      discreta.fonte < discreta.fonteConcluir &&
        /rgba\(0, 0, 0, 0\)|transparent/.test(discreta.fundo) &&
        discreta.alvo >= 44,
      JSON.stringify(discreta),
    )
    await page.screenshot({ path: `${OUT}/01-acao-no-exercicio.png` })

    // ── 2. a carga é digitada e o painel abre DENTRO da janela de debounce ────────────────
    await page.fill('input[aria-label*="Carga em quilos"]:nth-of-type(1)', '').catch(() => {})
    const campoCarga = page.locator('input[aria-label*="Carga em quilos"]').first()
    await campoCarga.fill('47.5')
    await botao.click() // < 400ms depois de digitar: o auto-save ainda não rodou

    await page.waitForSelector('textarea[aria-label*="Mensagem para o personal"]', {
      timeout: 10000,
    })
    const rotuloNoPainel = await page
      .locator('textarea[aria-label*="Mensagem para o personal"]')
      .getAttribute('aria-label')
    ok(
      'painel já traz o rótulo montado do contexto',
      rotuloNoPainel.includes(rotuloEsperado),
      rotuloNoPainel,
    )

    await page.fill(
      'textarea[aria-label*="Mensagem para o personal"]',
      'Senti dor no ombro na 3a serie.',
    )
    await page.click('button:has-text("Enviar ao personal")')
    await page.waitForFunction(
      () => /Mensagem enviada ao personal/.test(document.body.innerText),
      null,
      { timeout: 20000 },
    )

    // ── 3. chegou ao personal com o rótulo certo ─────────────────────────────────────────
    const doPersonal = await restPersonal(
      'GET',
      `messages?select=body,context_kind,context_id,context_label,conversation_id&order=created_at.desc&limit=1`,
    )
    const msg = doPersonal[0]
    conversaId = msg.conversation_id
    ok('o personal vê a mensagem do aluno', /dor no ombro/.test(msg.body), msg.body)
    ok('context_kind = exercise', msg.context_kind === 'exercise', msg.context_kind)
    ok('context_id = a execução (workout_log)', msg.context_id === logId, `${msg.context_id}`)
    ok(
      'context_label montado congelado no envio',
      msg.context_label === rotuloEsperado,
      `${msg.context_label} (esperado ${rotuloEsperado})`,
    )

    // ── 4. o treino continua intacto e a carga digitada NÃO se perdeu ────────────────────
    const corpo = await page.locator('body').innerText()
    ok('sessão segue em andamento depois de enviar', /Treino em andamento/.test(corpo))
    ok('não voltou para "Iniciar treino"', !/Iniciar treino/.test(corpo))
    ok('carga digitada continua na tela', (await campoCarga.inputValue()) === '47.5')

    const series = await restAluno(
      'GET',
      `set_logs?workout_log_id=eq.${logId}&select=weight_kg,set_index`,
    )
    ok(
      'a carga dentro do debounce foi gravada antes do envio (auto-save descarregado)',
      series.some((s) => Number(s.weight_kg) === 47.5),
      JSON.stringify(series),
    )

    const confirmacao = await page.evaluate(() => {
      const bloco = [...document.querySelectorAll('[role="status"]')].find((n) =>
        /Mensagem enviada ao personal/.test(n.innerText),
      )
      const link = bloco && bloco.querySelector('a')
      return bloco ? { texto: bloco.innerText, href: link && link.getAttribute('href') } : null
    })
    ok(
      'confirmação com o rótulo e atalho para a conversa',
      confirmacao &&
        confirmacao.href === '/aluno/chat' &&
        // O rótulo é `uppercase` por CSS, então o innerText vem maiúsculo.
        confirmacao.texto.toLowerCase().includes(nomeExercicio.toLowerCase()),
      JSON.stringify(confirmacao),
    )
    await page.screenshot({ path: `${OUT}/02-enviada-no-treino.png` })

    // ── 5. o atalho leva à conversa e a mensagem está lá com o rótulo ────────────────────
    await page.click('[role="status"] a:has-text("Abrir conversa")')
    await page.waitForURL('**/aluno/chat', { timeout: 15000 })
    await page.waitForFunction(() => /dor no ombro/.test(document.body.innerText), null, {
      timeout: 20000,
    })
    const naConversa = await page.locator('body').innerText()
    ok(
      'mensagem aparece na conversa com o rótulo do contexto',
      naConversa.toLowerCase().includes(nomeExercicio.toLowerCase()),
    )
    await page.screenshot({ path: `${OUT}/03-conversa-com-contexto.png` })

    // Voltar ao treino: a sessão não foi fechada por ter mandado mensagem.
    await page.goto(`${BASE}/aluno/treinos/A`)
    await page.waitForFunction(() => /Treino em andamento/.test(document.body.innerText), null, {
      timeout: 25000,
    })
    const cargaDepois = await page
      .locator('input[aria-label*="Carga em quilos"]')
      .first()
      .inputValue()
    ok('depois de voltar, o treino segue em andamento com a carga salva', cargaDepois === '47.5', cargaDepois)

    // ── 6. mesma ação no detalhe da avaliação ───────────────────────────────────────────
    await page.goto(`${BASE}/aluno/avaliacoes/${avaliacao.id}`)
    await page.waitForSelector(BOTAO_FALAR, { timeout: 25000 })
    await page.click(BOTAO_FALAR)
    await page.fill(
      'textarea[aria-label*="Mensagem para o personal"]',
      'O achado de ombro elevado precisa de alongamento?',
    )
    await page.click('button:has-text("Enviar ao personal")')
    await page.waitForFunction(
      () => /Mensagem enviada ao personal/.test(document.body.innerText),
      null,
      { timeout: 20000 },
    )

    const daAvaliacao = await restPersonal(
      'GET',
      `messages?select=body,context_kind,context_id,context_label&order=created_at.desc&limit=1`,
    )
    const m2 = daAvaliacao[0]
    ok('mensagem da avaliação chegou ao personal', /ombro elevado/.test(m2.body), m2.body)
    ok('context_kind = assessment', m2.context_kind === 'assessment', m2.context_kind)
    ok('context_id = a avaliação', m2.context_id === avaliacao.id, `${m2.context_id}`)
    ok(
      'rótulo da avaliação com a data',
      /^Avaliação física · \d{2}\/\d{2}\/\d{4}$/.test(m2.context_label),
      m2.context_label,
    )
    await page.screenshot({ path: `${OUT}/04-enviada-na-avaliacao.png` })
  } finally {
    await browser.close()
    // Limpeza: dado de teste não fica no banco.
    if (conversaId) {
      await restAdmin('DELETE', `messages?conversation_id=eq.${conversaId}`)
      await restAdmin('DELETE', `conversations?id=eq.${conversaId}`)
    }
    if (logId) {
      await restAdmin('DELETE', `set_logs?workout_log_id=eq.${logId}`)
      await restAdmin('DELETE', `workout_logs?id=eq.${logId}`)
    }
    await restAdmin('DELETE', `physical_assessments?id=eq.${avaliacao.id}`)
    if (planoCriado) await restAdmin('DELETE', `workout_plans?id=eq.${planoCriado}`)
    console.log('limpeza: conversa, mensagens, sessão de treino, avaliação e ficha de teste apagadas')
  }

  console.log(falhas.length === 0 ? '\nTODOS OS ASSERTS PASSARAM' : `\nFALHAS: ${falhas.join(', ')}`)
  process.exit(falhas.length === 0 ? 0 : 1)
})()
