#!/usr/bin/env node
/**
 * CHAT-3 · prova de navegador: conversa do aluno em tempo real + badge de não lidas.
 *
 * O aluno roda na UI (sessão real do Supabase, viewport de iPhone). O PERSONAL entra pela REST
 * com o access_token DELE (não service_role): é a forma honesta de ter o outro lado da conversa
 * mandando mensagem enquanto o aluno está na tela, sem depender da tela do personal (que é a
 * fatia seguinte da Fase 12).
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(path.join(os.homedir(), '.hermes/hermes-agent/node_modules/playwright'))

const REF = 'midftshifkvweehrtyte'
const SUPA = `https://${REF}.supabase.co`
const SERVICE = fs.readFileSync(path.join(os.homedir(), '.config/naigo/service_role.key'), 'utf8').trim()
const ANON = fs
  .readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY='))
  .split('=')[1]
  .trim()
const OUT = path.join(os.homedir(), '.hermes/cache/scratch/chat3')
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
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json())
  const verificado = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
  }).then((r) => r.json())
  if (!verificado.access_token) throw new Error(`sem sessão para ${email}: ${JSON.stringify(verificado)}`)
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

const ABA = (href) => `nav[aria-label="Navegação principal"] a[href="${href}"]`

async function esperarIntro(page) {
  // Overlay de vídeo (~11 s) deixa o body.innerText vazio: sem esperar, toda rota parece quebrada.
  await page.waitForFunction(
    () => !document.querySelector('video[src="/intro-naigo.mp4"]'),
    null,
    { timeout: 40000 },
  )
}

;(async () => {
  const aluno = await sessao('aluno@naigo.demo')
  const personal = await sessao('personal@naigo.demo')
  const restAluno = rest(aluno.access_token)
  const restPersonal = rest(personal.access_token)
  console.log(`sessões: aluno=${aluno.user.id} personal=${personal.user.id}`)

  const browser = await chromium.launchPersistentContext(
    path.join(os.homedir(), '.hermes/cache/scratch/chat3-profile'),
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
  try {
    // ── 1. conversa vazia, estado honesto ──────────────────────────────────────────────────
    await page.goto(`${BASE}/aluno/chat`)
    await esperarIntro(page)
    await page.waitForSelector('input[aria-label="Mensagem"]', { timeout: 20000 })

    const texto = await page.locator('body').innerText()
    ok('estado vazio honesto', /Nenhuma mensagem ainda/i.test(texto))
    ok('sem conversa de exemplo', !/Lorem|exemplo|mock/i.test(texto))
    await page.screenshot({ path: `${OUT}/01-vazio.png` })

    const conversas = await restAluno('GET', `conversations?student_id=eq.${aluno.user.id}&select=*`)
    ok('conversa criada ao abrir', conversas.length === 1, JSON.stringify(conversas.map((c) => c.id)))
    conversaId = conversas[0].id

    // ── 2. aluno manda pela UI ─────────────────────────────────────────────────────────────
    await page.fill('input[aria-label="Mensagem"]', 'Posso trocar o supino por halteres?')
    const fonte = await page.evaluate(() => {
      const campo = document.querySelector('input[aria-label="Mensagem"]')
      return parseFloat(getComputedStyle(campo).fontSize)
    })
    ok('campo com 16px (iOS não dá zoom)', fonte >= 16, `${fonte}px`)

    await page.click('button[aria-label="Enviar mensagem"]')
    await page.waitForFunction(
      () => /halteres/.test(document.body.innerText) && !/enviando/.test(document.body.innerText),
      null,
      { timeout: 15000 },
    )
    const salvas = await restAluno(
      'GET',
      `messages?conversation_id=eq.${conversaId}&select=body,sender_id`,
    )
    ok('mensagem do aluno persistiu', salvas.length === 1 && /halteres/.test(salvas[0].body))

    // ── 3. personal responde: chega sem recarregar, com rótulo de contexto ─────────────────
    const antes = await page.evaluate(() => document.body.innerText)
    await restPersonal('POST', 'messages', {
      conversation_id: conversaId,
      sender_id: personal.user.id,
      body: 'Pode trocar. Mantém a cadência.',
      context_kind: 'exercise',
      context_id: null,
      context_label: 'Treino A · Supino com barra',
    })
    await page.waitForFunction(
      () => /Mantém a cadência/.test(document.body.innerText),
      null,
      { timeout: 20000 },
    )
    ok('mensagem nova chegou SEM recarregar', !/Mantém a cadência/.test(antes))
    const comContexto = await page.locator('body').innerText()
    // O rótulo é renderizado em caixa alta por CSS (`uppercase`), então o innerText vem maiúsculo.
    ok('rótulo congelado do contexto visível', /Treino A · Supino com barra/i.test(comContexto))

    const rotulo = await page.evaluate(() => {
      const p = [...document.querySelectorAll('p')].find((n) =>
        n.textContent.includes('Supino com barra'),
      )
      if (!p) return null
      const corpo = [...document.querySelectorAll('p')].find((n) =>
        n.textContent.includes('Mantém a cadência'),
      )
      const e = getComputedStyle(p)
      return {
        tamanho: parseFloat(e.fontSize),
        tamanhoCorpo: parseFloat(getComputedStyle(corpo).fontSize),
        borda: e.borderLeftWidth,
        acima: p.getBoundingClientRect().bottom <= corpo.getBoundingClientRect().top,
      }
    })
    ok(
      'rótulo distinto do corpo e acima dele',
      rotulo && rotulo.acima && rotulo.tamanho < rotulo.tamanhoCorpo && parseFloat(rotulo.borda) > 0,
      JSON.stringify(rotulo),
    )

    const rolagem = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(
        (n) => n.scrollHeight > n.clientHeight + 4 && getComputedStyle(n).overflowY === 'auto',
      )
      return el ? { topo: el.scrollTop, max: el.scrollHeight - el.clientHeight } : null
    })
    ok(
      'rolou para o fim (ou thread cabe na tela)',
      rolagem === null || rolagem.max - rolagem.topo < 8,
      JSON.stringify(rolagem),
    )
    await page.screenshot({ path: `${OUT}/02-contexto-realtime.png` })

    // ── 4. marcou como lida com a conversa aberta ─────────────────────────────────────────
    await page.waitForTimeout(1500)
    const lidas = await restPersonal(
      'GET',
      `messages?conversation_id=eq.${conversaId}&sender_id=eq.${personal.user.id}&select=read_at`,
    )
    ok('mensagem marcada como lida com a conversa aberta', lidas.every((m) => m.read_at !== null))

    // ── 5. badge de não lidas em outra tela ──────────────────────────────────────────────
    await page.click(ABA('/aluno/inicio'))
    await page.waitForURL('**/aluno/inicio', { timeout: 15000 })
    await page.waitForTimeout(1200)

    const semBadge = await page.evaluate(() => {
      const aba = document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]')
      return aba ? aba.innerText.trim() : 'SEM ABA'
    })
    ok('aba Chat existe na navegação do aluno', semBadge !== 'SEM ABA', semBadge)
    ok('badge não aparece sem não lidas', !/\d/.test(semBadge), JSON.stringify(semBadge))

    await restPersonal('POST', 'messages', {
      conversation_id: conversaId,
      sender_id: personal.user.id,
      body: 'Amanhã muda para o treino B.',
      context_kind: 'free',
      context_id: null,
      context_label: '',
    })
    await page.waitForFunction(
      () => {
        const aba = document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]')
        return aba && /1/.test(aba.innerText)
      },
      null,
      { timeout: 20000 },
    )
    ok('badge subiu para 1 em tempo real, fora do chat', true)
    const rotuloAba = await page.evaluate(() =>
      document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]').getAttribute('aria-label'),
    )
    ok('badge acessível', /1 não lidas/.test(rotuloAba || ''), rotuloAba)
    await page.screenshot({ path: `${OUT}/03-badge.png` })

    // ── 6. abrir a conversa zera o badge e some ao sair ──────────────────────────────────
    await page.click(ABA('/aluno/chat'))
    await page.waitForURL('**/aluno/chat', { timeout: 15000 })
    await page.waitForFunction(() => /treino B/.test(document.body.innerText), null, { timeout: 20000 })
    const naConversa = await page.evaluate(() =>
      document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]').innerText.trim(),
    )
    ok('badge zerado com a conversa aberta', !/\d/.test(naConversa), JSON.stringify(naConversa))
    await page.screenshot({ path: `${OUT}/04-conversa.png` })

    await page.waitForTimeout(1500)
    await page.click(ABA('/aluno/inicio'))
    await page.waitForURL('**/aluno/inicio', { timeout: 15000 })
    await page.waitForTimeout(1500)
    const depois = await page.evaluate(() =>
      document.querySelector('nav[aria-label="Navegação principal"] a[href="/aluno/chat"]').innerText.trim(),
    )
    ok('badge continua zerado depois de ler', !/\d/.test(depois), JSON.stringify(depois))

    // ── 7. composer não fica atrás da barra de navegação (mobile) ───────────────────────
    await page.click(ABA('/aluno/chat'))
    await page.waitForSelector('input[aria-label="Mensagem"]')
    const geometria = await page.evaluate(() => {
      const campo = document.querySelector('input[aria-label="Mensagem"]').getBoundingClientRect()
      const barra = document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect()
      return { campoBottom: campo.bottom, barraTop: barra.top }
    })
    ok(
      'campo de digitação acima da barra de navegação',
      geometria.campoBottom <= geometria.barraTop + 1,
      JSON.stringify(geometria),
    )
    await page.screenshot({ path: `${OUT}/05-composer.png` })

    // ── 8. com histórico que não cabe na tela: abre no fim e segue no fim ───────────────
    // A etapa 3 não prova a rolagem: com 3 mensagens a thread cabe na tela e não há o que rolar.
    for (let i = 1; i <= 16; i += 1) {
      await restPersonal('POST', 'messages', {
        conversation_id: conversaId,
        sender_id: personal.user.id,
        body: `Mensagem de histórico número ${i}, comprida o bastante para empurrar a thread além da altura da tela.`,
        context_kind: 'free',
        context_id: null,
        context_label: '',
      })
    }
    await page.reload()
    await page.waitForFunction(() => /número 16/.test(document.body.innerText), null, {
      timeout: 20000,
    })
    await page.waitForTimeout(600)

    const fim = () =>
      page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(
          (n) => n.scrollHeight > n.clientHeight + 4 && getComputedStyle(n).overflowY === 'auto',
        )
        return el ? { restante: el.scrollHeight - el.clientHeight - el.scrollTop } : null
      })

    const aoAbrir = await fim()
    ok('thread maior que a tela rola para o fim ao abrir', aoAbrir && aoAbrir.restante < 8, JSON.stringify(aoAbrir))

    await restPersonal('POST', 'messages', {
      conversation_id: conversaId,
      sender_id: personal.user.id,
      body: 'Última: chegou com a tela rolada.',
      context_kind: 'free',
      context_id: null,
      context_label: '',
    })
    await page.waitForFunction(() => /chegou com a tela rolada/.test(document.body.innerText), null, {
      timeout: 20000,
    })
    await page.waitForTimeout(400)
    const aoChegar = await fim()
    ok(
      'mensagem nova do Realtime rola para o fim',
      aoChegar && aoChegar.restante < 8,
      JSON.stringify(aoChegar),
    )
    await page.screenshot({ path: `${OUT}/06-historico.png` })
  } finally {
    await browser.close()
    if (conversaId) {
      // Limpeza: dado de teste não fica no banco.
      await rest(SERVICE)('DELETE', `messages?conversation_id=eq.${conversaId}`)
      await rest(SERVICE)('DELETE', `conversations?id=eq.${conversaId}`)
      console.log('limpeza: conversa e mensagens de teste apagadas')
    }
  }

  console.log(falhas.length === 0 ? '\nTODOS OS ASSERTS PASSARAM' : `\nFALHAS: ${falhas.join(', ')}`)
  process.exit(falhas.length === 0 ? 0 : 1)
})()
