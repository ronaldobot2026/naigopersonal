#!/usr/bin/env node
/**
 * CHAT-5 · prova de navegador: caixa de entrada do personal com os números do aluno ao lado.
 *
 * As DUAS sessões rodam na UI, em contextos separados do Chromium (dois `localStorage`, um token
 * em cada — no mesmo contexto o segundo token sobrescreveria o primeiro): o personal em desktop,
 * na caixa de entrada, e o aluno em viewport de iPhone, na conversa dele. É assim que se prova o
 * realtime nos dois sentidos sem recarregar nenhuma das duas telas.
 *
 * O que o roteiro cobre: lista ordenada com não lidas em destaque, badge global na navegação,
 * abrir a conversa e ler o contexto do aluno na MESMA tela (e os números batendo com o card de
 * aderência da ficha dele), o link do rótulo de contexto voltando para a execução exata, resposta
 * chegando ao aluno em tempo real, mensagem nova do aluno aparecendo na caixa de entrada, e o
 * estado vazio honesto do personal sem conversa.
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
const OUT = path.join(os.homedir(), '.hermes/cache/scratch/chat5')
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
      apikey: ANON,
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

function tokenDe(sessao) {
  return JSON.stringify({
    access_token: sessao.access_token,
    token_type: 'bearer',
    expires_in: sessao.expires_in,
    expires_at: sessao.expires_at,
    refresh_token: sessao.refresh_token,
    user: sessao.user,
  })
}

async function esperarIntro(page) {
  // Overlay de vídeo (~11 s) deixa o body.innerText vazio: sem esperar, toda rota parece quebrada.
  await page.waitForFunction(() => !document.querySelector('video[src="/intro-naigo.mp4"]'), null, {
    timeout: 40000,
  })
}

;(async () => {
  const aluno = await sessao('aluno@naigo.demo')
  const personal = await sessao('personal@naigo.demo')
  const restAluno = rest(aluno.access_token)
  const restAdmin = rest(SERVICE)
  console.log(`sessões: aluno=${aluno.user.id} personal=${personal.user.id}`)

  const [perfilAluno] = await restAdmin(
    'GET',
    `profiles?id=eq.${aluno.user.id}&select=full_name`,
  )
  const nomeAluno = perfilAluno.full_name
  console.log(`aluno demo: ${nomeAluno}`)

  // ── montagem do cenário (REST, com a sessão de cada papel) ──────────────────────────────
  // Ficha publicada: preservada se já existir (o aluno demo é compartilhado entre roteiros).
  const jaPublicada = await restAdmin(
    'GET',
    `workout_plans?student_id=eq.${aluno.user.id}&status=eq.published&select=id,weekly_frequency,divisions`,
  )
  let planoCriado = null
  let ficha = jaPublicada[0] ?? null
  if (!ficha) {
    const exercicios = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'public/data/exercises.json'), 'utf8'),
    )
    const catalogo = Array.isArray(exercicios) ? exercicios : exercicios.exercises
    const exercicio = catalogo.find((e) => e.id === '0025') ?? catalogo[0]
    ficha = (
      await restAdmin('POST', 'workout_plans', {
        student_id: aluno.user.id,
        trainer_id: personal.user.id,
        status: 'published',
        objective: 'CHAT-5 prova da caixa de entrada',
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
    planoCriado = ficha.id
  }
  const divisao = ficha.divisions[0].id
  const frequencia = ficha.weekly_frequency
  console.log(`ficha ${ficha.id}: divisão ${divisao}, frequência ${frequencia}`)

  // Sessão CONCLUÍDA hoje: é o número da semana que o painel de contexto tem de mostrar, contado
  // por `summarizeWeek` (a mesma função da home do aluno e do card de aderência).
  const agora = new Date()
  const log = (
    await restAluno('POST', 'workout_logs', {
      student_id: aluno.user.id,
      workout_plan_id: ficha.id,
      division_key: divisao,
      started_at: new Date(agora.getTime() - 45 * 60000).toISOString(),
      completed_at: agora.toISOString(),
      notes: '',
    })
  )[0]
  await restAluno('POST', 'set_logs', [
    {
      workout_log_id: log.id,
      // `student_id` é obrigatório na policy (`set_logs_all_own_student`: with check student_id =
      // auth.uid()) — sem ele o insert volta 42501 em vez de erro de coluna.
      student_id: aluno.user.id,
      exercise_id: ficha.divisions[0].entries[0].exerciseId,
      // `exercise_name` é not null: o catálogo é um JSON estático, então o nome é congelado na
      // linha (o id do exercício pode sair do catálogo depois).
      exercise_name: 'Supino com barra',
      set_index: 1,
      reps: 10,
      weight_kg: 47.5,
      done: true,
    },
  ])

  /*
   * O número esperado da semana é CONTADO NO BANCO, não fixado: o aluno demo é compartilhado entre
   * roteiros e pode ter outras sessões concluídas nesta semana. A semana começa na SEGUNDA 00:00
   * local — a mesma regra de `startOfTrainingWeek`, que é quem o app usa.
   */
  const inicioSemana = new Date(agora)
  inicioSemana.setHours(0, 0, 0, 0)
  inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7))
  const concluidosNaSemana = await restAdmin(
    'GET',
    `workout_logs?student_id=eq.${aluno.user.id}&completed_at=gte.${inicioSemana.toISOString()}&select=id`,
  )
  const semanaEsperada =
    frequencia === null
      ? `${concluidosNaSemana.length} ${concluidosNaSemana.length === 1 ? 'treino concluído' : 'treinos concluídos'}`
      : `${concluidosNaSemana.length} de ${frequencia} treinos prescritos`
  console.log(`semana corrente no banco: ${concluidosNaSemana.length} concluído(s) -> "${semanaEsperada}"`)

  // Avaliação concluída, com peso e percentual de gordura — os números da coluna de contexto.
  const avaliacao = (
    await restAdmin('POST', 'physical_assessments', {
      student_id: aluno.user.id,
      evaluator_id: personal.user.id,
      status: 'completed',
      general_notes: 'CHAT-5 prova de contexto',
    })
  )[0]
  await restAdmin('POST', 'body_metrics', {
    assessment_id: avaliacao.id,
    student_id: aluno.user.id,
    weight_kg: 80,
    height_cm: 178,
    body_fat_percent: 18,
  })

  // Conversa + duas mensagens do aluno (uma solta e uma AMARRADA à execução de hoje).
  // A conversa é do PAR (unique trainer/student): reaproveita a que existir, em vez de tomar
  // 23505 num reexecute do roteiro.
  const existente = await restAdmin(
    'GET',
    `conversations?trainer_id=eq.${personal.user.id}&student_id=eq.${aluno.user.id}&select=id`,
  )
  const conversa =
    existente[0] ??
    (
      await restAluno('POST', 'conversations', {
        trainer_id: personal.user.id,
        student_id: aluno.user.id,
      })
    )[0]
  await restAdmin('DELETE', `messages?conversation_id=eq.${conversa.id}`)
  const rotuloContexto = `Treino ${divisao} · Supino com barra`
  await restAluno('POST', 'messages', [
    {
      conversation_id: conversa.id,
      sender_id: aluno.user.id,
      body: 'Bom dia! Duvida rapida sobre a semana.',
      // As duas linhas do batch precisam das MESMAS chaves (PostgREST: "All object keys must
      // match"), então a conversa solta declara o contexto `free` explicitamente.
      context_kind: 'free',
      context_id: null,
      context_label: '',
      created_at: new Date(agora.getTime() - 20 * 60000).toISOString(),
    },
    {
      conversation_id: conversa.id,
      sender_id: aluno.user.id,
      body: 'Senti dor no ombro na terceira serie.',
      context_kind: 'exercise',
      context_id: log.id,
      context_label: rotuloContexto,
      created_at: new Date(agora.getTime() - 10 * 60000).toISOString(),
    },
  ])

  const browser = await chromium.launch({ headless: true })
  const ctxPersonal = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctxPersonal.addInitScript(
    ([chave, valor]) => {
      localStorage.setItem(chave, valor)
      localStorage.setItem('windson-wood.role', 'trainer')
    },
    [`sb-${REF}-auth-token`, tokenDe(personal)],
  )
  const ctxAluno = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await ctxAluno.addInitScript(
    ([chave, valor]) => {
      localStorage.setItem(chave, valor)
      localStorage.setItem('windson-wood.role', 'student')
    },
    [`sb-${REF}-auth-token`, tokenDe(aluno)],
  )

  const pagePersonal = await ctxPersonal.newPage()
  const pageAluno = await ctxAluno.newPage()

  try {
    // ── 1. badge global de não lidas na navegação do personal (fora do chat) ───────────────
    await pagePersonal.goto(`${BASE}/personal/dashboard`)
    await esperarIntro(pagePersonal)
    await pagePersonal.waitForFunction(
      () =>
        [...document.querySelectorAll('a[aria-label]')].some((a) =>
          /Chat, \d+ não lidas/.test(a.getAttribute('aria-label')),
        ),
      null,
      { timeout: 25000 },
    )
    const badge = await pagePersonal.evaluate(() => {
      const link = [...document.querySelectorAll('a[aria-label]')].find((a) =>
        /Chat, \d+ não lidas/.test(a.getAttribute('aria-label')),
      )
      return link.getAttribute('aria-label')
    })
    ok('badge de não lidas na navegação do personal, em outra tela', /Chat, 2 não lidas/.test(badge), badge)
    await pagePersonal.screenshot({ path: `${OUT}/01-badge-na-navegacao.png` })

    // ── 2. caixa de entrada: a conversa do aluno, com não lidas em destaque ───────────────
    await pagePersonal.goto(`${BASE}/personal/chat`)
    await pagePersonal.waitForSelector('nav[aria-label="Conversas dos alunos"]', { timeout: 25000 })
    const linha = await pagePersonal.evaluate(() => {
      const botao = document.querySelector('nav[aria-label="Conversas dos alunos"] button')
      const marcador = botao.querySelector('span[aria-hidden="true"]')
      const nome = botao.querySelector('p')
      return {
        rotulo: botao.getAttribute('aria-label'),
        texto: botao.innerText,
        naoLidas: marcador ? marcador.innerText : null,
        pesoDoNome: getComputedStyle(nome).fontWeight,
      }
    })
    ok('a conversa do aluno aparece na lista com o nome dele', linha.texto.includes(nomeAluno), linha.texto.replace(/\n/g, ' | '))
    ok(
      'prévia traz o rótulo do contexto antes do texto',
      linha.texto.toLowerCase().includes(rotuloContexto.toLowerCase()) &&
        /dor no ombro/i.test(linha.texto),
      linha.texto.replace(/\n/g, ' | '),
    )
    ok('não lidas em destaque: contador visível e nome em negrito', linha.naoLidas === '2' && Number(linha.pesoDoNome) >= 700, JSON.stringify(linha))
    ok('contador também no rótulo acessível', /2 não lidas/.test(linha.rotulo), linha.rotulo)
    await pagePersonal.screenshot({ path: `${OUT}/02-caixa-de-entrada.png` })

    // ── 3. abrir a conversa: histórico + contexto do aluno na MESMA tela ─────────────────
    await pagePersonal.click('nav[aria-label="Conversas dos alunos"] button')
    await pagePersonal.waitForSelector(`aside[aria-label="Contexto de ${nomeAluno}"]`, {
      timeout: 20000,
    })
    await pagePersonal.waitForFunction(
      () => /dor no ombro/i.test(document.body.innerText),
      null,
      { timeout: 20000 },
    )
    // O painel faz consulta própria (aderência + avaliação): esperar o fim do carregamento, não
    // ler a tela no meio dele.
    await pagePersonal.waitForFunction(
      (nome) => {
        const texto = document.querySelector(`aside[aria-label="Contexto de ${nome}"]`).innerText
        return !/Carregando/.test(texto)
      },
      nomeAluno,
      { timeout: 30000 },
    )
    const contexto = await pagePersonal.evaluate(
      (nome) => document.querySelector(`aside[aria-label="Contexto de ${nome}"]`).innerText,
      nomeAluno,
    )
    ok('conversa e contexto do aluno na mesma tela', /dor no ombro/i.test(await pagePersonal.locator('body').innerText()))
    ok(
      'aderência da semana no painel, com o prescrito da ficha',
      contexto.includes(semanaEsperada),
      `esperado "${semanaEsperada}" em: ${contexto.replace(/\n/g, ' | ')}`,
    )
    ok(
      'última avaliação com data, peso e percentual de gordura',
      /80 kg/.test(contexto) && /18 % de gordura/.test(contexto),
      contexto.replace(/\n/g, ' | '),
    )
    await pagePersonal.screenshot({ path: `${OUT}/03-conversa-com-contexto-do-aluno.png` })

    // Os dois lados contam a MESMA semana: o painel e o card de aderência da ficha do aluno.
    const outraAba = await ctxPersonal.newPage()
    await outraAba.goto(`${BASE}/personal/alunos/${aluno.user.id}`)
    await esperarIntro(outraAba)
    await outraAba.waitForFunction(
      // `Esta semana` é uppercase por CSS, então o innerText vem maiúsculo: comparação
      // case-insensitive (mesma armadilha anotada no roteiro da CHAT-4).
      () => /esta semana/i.test(document.body.innerText),
      null,
      { timeout: 30000 },
    )
    const naFicha = await outraAba.locator('body').innerText()
    ok(
      'card de aderência da ficha conta a mesma semana que o painel da conversa',
      naFicha.includes(semanaEsperada),
      `esperado "${semanaEsperada}" em: ${(naFicha.match(/esta semana[\s\S]{0,80}/i) ?? [''])[0].replace(/\n/g, ' | ')}`,
    )
    await outraAba.close()

    // Abrir a conversa marcou as mensagens do aluno como lidas (é quem recebeu que marca).
    await pagePersonal.waitForTimeout(1500)
    const lidas = await restAdmin(
      'GET',
      `messages?conversation_id=eq.${conversa.id}&select=read_at,sender_id`,
    )
    ok(
      'abrir a conversa marcou como lidas as mensagens do aluno',
      lidas.every((m) => (m.sender_id === aluno.user.id ? m.read_at !== null : true)),
      JSON.stringify(lidas),
    )

    // ── 4. o rótulo de contexto é link e volta para a execução exata ─────────────────────
    const link = await pagePersonal.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((n) =>
        /Treino .+ ·/.test(n.innerText.replace(/\n/g, ' ')),
      )
      return a ? a.getAttribute('href') : null
    })
    ok(
      'rótulo de contexto virou link para a sessão na aderência',
      link === `/personal/alunos/${aluno.user.id}?sessao=${log.id}`,
      String(link),
    )

    await pagePersonal.click(`a[href="/personal/alunos/${aluno.user.id}?sessao=${log.id}"]`)
    await pagePersonal.waitForURL(`**/personal/alunos/${aluno.user.id}?sessao=${log.id}`, {
      timeout: 20000,
    })
    await pagePersonal.waitForFunction(
      () =>
        [...document.querySelectorAll('button[aria-expanded="true"]')].some((b) =>
          /Treino /.test(b.innerText),
        ),
      null,
      { timeout: 25000 },
    )
    const sessaoAberta = await pagePersonal.evaluate(() => {
      const botao = [...document.querySelectorAll('button[aria-expanded="true"]')].find((b) =>
        /Treino /.test(b.innerText),
      )
      const item = botao.closest('li')
      return {
        titulo: botao.innerText.replace(/\n/g, ' | '),
        detalhe: item.innerText.replace(/\n/g, ' | '),
        destacado: getComputedStyle(item).borderColor,
      }
    })
    ok(
      'a sessão apontada pelo link abre expandida, com as séries daquela execução',
      /47,5 kg|47.5 kg/.test(sessaoAberta.detalhe),
      sessaoAberta.detalhe.slice(0, 160),
    )
    await pagePersonal.screenshot({ path: `${OUT}/04-sessao-aberta-pelo-link.png` })

    // ── 5. o personal responde e o ALUNO recebe sem recarregar ──────────────────────────
    await pageAluno.goto(`${BASE}/aluno/chat`)
    await esperarIntro(pageAluno)
    await pageAluno.waitForFunction(() => /dor no ombro/i.test(document.body.innerText), null, {
      timeout: 25000,
    })

    await pagePersonal.goto(`${BASE}/personal/chat?conversa=${conversa.id}`)
    await pagePersonal.waitForSelector('input[aria-label="Mensagem"]', { timeout: 25000 })
    const resposta = 'Reduz para 40 kg e me avisa amanha.'
    await pagePersonal.fill('input[aria-label="Mensagem"]', resposta)
    await pagePersonal.click('button[aria-label="Enviar mensagem"]')

    await pageAluno.waitForFunction(
      (texto) => document.body.innerText.includes(texto),
      resposta,
      { timeout: 25000 },
    )
    ok('resposta do personal chega ao aluno em tempo real (sem recarregar)', true)
    await pagePersonal.screenshot({ path: `${OUT}/05-personal-respondeu.png` })
    await pageAluno.screenshot({ path: `${OUT}/06-aluno-recebeu.png` })

    // ── 6. mensagem nova do aluno aparece na caixa de entrada sem recarregar ────────────
    // O personal volta para a LISTA (conversa fechada) e não toca em mais nada.
    await pagePersonal.click('button[aria-label="Voltar para a caixa de entrada"]').catch(() => {})
    await pagePersonal.goto(`${BASE}/personal/chat`)
    await pagePersonal.waitForSelector('nav[aria-label="Conversas dos alunos"]', { timeout: 25000 })

    const nova = 'Ok! E o agachamento, posso trocar?'
    await pageAluno.fill('input[aria-label="Mensagem"]', nova)
    await pageAluno.click('button[aria-label="Enviar mensagem"]')

    await pagePersonal.waitForFunction(
      (texto) =>
        document
          .querySelector('nav[aria-label="Conversas dos alunos"]')
          .innerText.includes(texto),
      nova,
      { timeout: 25000 },
    )
    const depois = await pagePersonal.evaluate(() => {
      const botao = document.querySelector('nav[aria-label="Conversas dos alunos"] button')
      const marcador = botao.querySelector('span[aria-hidden="true"]')
      return { rotulo: botao.getAttribute('aria-label'), naoLidas: marcador ? marcador.innerText : null }
    })
    ok('mensagem nova do aluno aparece na caixa de entrada sem recarregar', true)
    ok('e ela sobe o contador de não lidas da linha', depois.naoLidas === '1', JSON.stringify(depois))
    await pagePersonal.screenshot({ path: `${OUT}/07-chegou-na-caixa-de-entrada.png` })

    // ── 7. estado vazio honesto: personal sem conversa ──────────────────────────────────
    await restAdmin('DELETE', `messages?conversation_id=eq.${conversa.id}`)
    await restAdmin('DELETE', `conversations?id=eq.${conversa.id}`)
    await pagePersonal.goto(`${BASE}/personal/chat`)
    await pagePersonal.waitForFunction(
      () => /Nenhuma conversa ainda/.test(document.body.innerText),
      null,
      { timeout: 25000 },
    )
    const vazio = await pagePersonal.locator('body').innerText()
    ok(
      'personal sem conversa vê estado vazio honesto (sem conversa de exemplo)',
      /Nenhuma conversa ainda/.test(vazio) && !/Lorem|exemplo/i.test(vazio),
    )
    await pagePersonal.screenshot({ path: `${OUT}/08-estado-vazio.png` })
  } finally {
    await browser.close()
    // Limpeza: dado de teste não fica no banco.
    await restAdmin('DELETE', `messages?conversation_id=eq.${conversa.id}`)
    await restAdmin('DELETE', `conversations?id=eq.${conversa.id}`)
    await restAdmin('DELETE', `set_logs?workout_log_id=eq.${log.id}`)
    await restAdmin('DELETE', `workout_logs?id=eq.${log.id}`)
    await restAdmin('DELETE', `body_metrics?assessment_id=eq.${avaliacao.id}`)
    await restAdmin('DELETE', `physical_assessments?id=eq.${avaliacao.id}`)
    if (planoCriado) await restAdmin('DELETE', `workout_plans?id=eq.${planoCriado}`)
    console.log('limpeza: conversa, mensagens, sessão de treino, avaliação e ficha de teste apagadas')
  }

  console.log(falhas.length === 0 ? '\nTODOS OS ASSERTS PASSARAM' : `\nFALHAS: ${falhas.join(', ')}`)
  process.exit(falhas.length === 0 ? 0 : 1)
})()
