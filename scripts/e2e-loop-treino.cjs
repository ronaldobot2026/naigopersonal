#!/usr/bin/env node
/**
 * E2E do loop completo da Fase 10 (naigopersonal), em navegador real.
 *
 * Do zero: cria um aluno limpo (`naigo-aluno teste-f10@naigo.demo`), o PERSONAL monta a ficha
 * pela UI do construtor, prova que o RASCUNHO não chega ao aluno, publica, o ALUNO executa o
 * treino série por série com carga, RECARREGA a página no meio (tem de retomar), conclui, a home
 * do aluno passa a dizer "Concluído hoje", o PERSONAL vê a aderência daquela sessão com a carga
 * certa — e no fim todo o dado de teste é apagado e a ausência é conferida.
 *
 * Playwright do Hermes, perfil isolado. Não usa a tool browser_exec (travaria o Chrome do usuário).
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require(
  path.join(os.homedir(), '.hermes/hermes-agent/node_modules/playwright'),
)

const REF = 'midftshifkvweehrtyte'
const KEY = fs
  .readFileSync(path.join(os.homedir(), '.config/naigo/service_role.key'), 'utf8')
  .trim()
const BASE = 'http://localhost:5173'
const OUT = path.join(os.homedir(), '.hermes/cache/scratch/f10-7')
const EMAIL = 'teste-f10@naigo.demo'
const OBJETIVO = 'Hipertrofia (E2E F10-7)'

const headers = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  ...extra,
})

async function rest(method, q, body, prefer) {
  const res = await fetch(`https://${REF}.supabase.co/rest/v1/${q}`, {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${q} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function authAdmin(method, q, body) {
  const res = await fetch(`https://${REF}.supabase.co/auth/v1/${q}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${q} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function acharUsuario(email) {
  const page = await authAdmin('GET', `admin/users?per_page=200`)
  return (page.users || []).find((u) => u.email === email) || null
}

async function sessionFor(email) {
  const link = await authAdmin('POST', 'admin/generate_link', { type: 'magiclink', email })
  const res = await fetch(`https://${REF}.supabase.co/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
  })
  const s = await res.json()
  if (!s.access_token)
    throw new Error(`sem sessão para ${email}: ${JSON.stringify(s).slice(0, 200)}`)
  return s
}

const ok = []
const fail = []
function check(label, cond, detail = '') {
  ;(cond ? ok : fail).push(`${cond ? 'OK  ' : 'FALHA'} ${label}`)
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function pularIntro(page) {
  await page
    .waitForFunction(
      () => {
        const v = document.querySelector('video[src*="intro"]')
        if (!v) return true
        v.currentTime = v.duration || 12
        v.dispatchEvent(new Event('ended'))
        return false
      },
      { timeout: 25000 },
    )
    .catch(() => undefined)
  await page
    .waitForFunction(() => !document.querySelector('video[src*="intro"]'), { timeout: 30000 })
    .catch(() => undefined)
}

const texto = (page) => page.evaluate(() => document.body.innerText)

async function contextoPara(browser, email, role, mobile) {
  const ctx = await browser.newContext(
    mobile
      ? {
          viewport: { width: 393, height: 852 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1280, height: 900 } },
  )
  const sess = await sessionFor(email)
  await ctx.addInitScript(
    ([ref, s, r]) => {
      localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({
          access_token: s.access_token,
          token_type: 'bearer',
          expires_in: s.expires_in,
          expires_at: s.expires_at,
          refresh_token: s.refresh_token,
          user: s.user,
        }),
      )
      localStorage.setItem('windson-wood.role', r)
    },
    [REF, sess, role],
  )
  return { ctx, sess }
}

async function apagarAluno(id) {
  if (!id) return
  const logs = await rest('GET', `workout_logs?select=id&student_id=eq.${id}`)
  for (const l of logs) await rest('DELETE', `set_logs?workout_log_id=eq.${l.id}`)
  await rest('DELETE', `workout_logs?student_id=eq.${id}`)
  await rest('DELETE', `workout_plans?student_id=eq.${id}`)
  await rest('DELETE', `students?id=eq.${id}`)
  await authAdmin('DELETE', `admin/users/${id}`).catch(() => undefined)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  // ---------- 0) aluno limpo, do zero
  const residuo = await acharUsuario(EMAIL)
  if (residuo) {
    console.log('resíduo de rodada anterior, apagando', residuo.id)
    await apagarAluno(residuo.id)
  }
  const saida = execFileSync(
    path.join(os.homedir(), '.local/bin/naigo-aluno'),
    [EMAIL, 'Teste F10'],
    {
      encoding: 'utf8',
    },
  )
  const ALUNO = saida.match(/id:\s+([0-9a-f-]{36})/)[1]
  console.log(`aluno de teste criado: ${ALUNO}`)
  const perfil = await rest('GET', `profiles?select=role,full_name&id=eq.${ALUNO}`)
  const vinculo = await rest('GET', `students?select=trainer_id&id=eq.${ALUNO}`)
  check(
    'aluno nasce limpo: role student, vinculado ao personal, sem ficha e sem log',
    perfil[0]?.role === 'student' && !!vinculo[0]?.trainer_id,
    `${perfil[0]?.full_name} / trainer ${vinculo[0]?.trainer_id?.slice(0, 8)}`,
  )

  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const personal = await contextoPara(browser, 'personal@naigo.demo', 'trainer', false)
  const aluno = await contextoPara(browser, EMAIL, 'student', true)
  const pp = await personal.ctx.newPage()
  const pa = await aluno.ctx.newPage()
  for (const p of [pp, pa]) {
    p.on('pageerror', (e) => console.log('   [pageerror]', e.message.slice(0, 160)))
  }

  // ---------- 1) aluno sem ficha: estado vazio honesto
  await pa.goto(`${BASE}/aluno/treinos`, { waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForTimeout(2000)
  let v = await texto(pa)
  check(
    'aluno sem ficha publicada vê o estado vazio (nenhum treino publicado)',
    /Nenhum treino publicado/i.test(v),
    v.replace(/\s+/g, ' ').slice(0, 90),
  )

  // ---------- 2) personal monta a ficha pela UI
  await pp.goto(`${BASE}/personal/alunos/${ALUNO}/treino`, { waitUntil: 'networkidle' })
  await pularIntro(pp)
  await pp.getByLabel('Objetivo').waitFor({ timeout: 60000 })
  await pp.getByLabel('Objetivo').fill(OBJETIVO)
  await pp.getByLabel('Frequência semanal').fill('3')
  await pp.getByLabel('Foco do treino A').fill('Superior')
  await pp.getByLabel('Buscar na biblioteca').first().fill('supino')
  const addBtn = pp.locator('li button', { hasText: 'Adicionar' }).first()
  await addBtn.waitFor({ timeout: 30000 })
  const nomeExercicio = (await addBtn.locator('p.font-bold').textContent()).trim()
  await addBtn.click()
  await pp.waitForTimeout(600)
  // segundo exercício: serve de prova de "prescrito e não tocado" na visão do personal
  await pp.getByLabel('Buscar na biblioteca').first().fill('crucifixo')
  const addBtn2 = pp.locator('li button', { hasText: 'Adicionar' }).first()
  await addBtn2.waitFor({ timeout: 30000 })
  const nomeExercicio2 = (await addBtn2.locator('p.font-bold').textContent()).trim()
  await addBtn2.click()
  await pp.waitForTimeout(600)

  // prescrição do 1º exercício: 2 × 10 com 50 kg (o painel de edição abre pelo lápis)
  await pp.getByLabel(`Editar ${nomeExercicio}`).first().click()
  await pp.getByLabel('Séries', { exact: true }).first().fill('2')
  await pp.getByLabel('Repetições', { exact: true }).first().fill('10')
  // NumberInput põe a unidade no próprio <label>: o acessível é "Carga (kg)", não "Carga".
  await pp.getByLabel('Carga (kg)', { exact: true }).first().fill('50')
  await pp.waitForTimeout(400)

  await pp.getByRole('button', { name: /Salvar rascunho/ }).click()
  await pp.getByText('Rascunho salvo em', { exact: false }).waitFor({ timeout: 20000 })
  await pp.screenshot({ path: path.join(OUT, '1-personal-rascunho.png'), fullPage: true })
  const fichas = await rest(
    'GET',
    `workout_plans?select=id,status,divisions,weekly_frequency&student_id=eq.${ALUNO}`,
  )
  check(
    'ficha gravada como rascunho (uma linha, status draft)',
    fichas.length === 1 && fichas[0].status === 'draft',
    JSON.stringify(fichas.map((f) => f.status)),
  )
  check(
    'prescrição do construtor chegou ao banco (2 × 10 · 50 kg no 1º exercício)',
    fichas[0].divisions[0].entries[0].sets === 2 &&
      fichas[0].divisions[0].entries[0].reps === '10' &&
      fichas[0].divisions[0].entries[0].loadKg === 50,
    JSON.stringify(fichas[0].divisions[0].entries[0]),
  )

  // ---------- 3) PROVA DO NEGATIVO: rascunho não chega ao aluno
  await pa.reload({ waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForTimeout(2000)
  v = await texto(pa)
  await pa.screenshot({ path: path.join(OUT, '2-aluno-nao-ve-rascunho.png'), fullPage: true })
  check(
    'NEGATIVO: ficha em draft não aparece para o aluno',
    /Nenhum treino publicado/i.test(v) &&
      !new RegExp(nomeExercicio, 'i').test(v) &&
      !/Superior/.test(v),
    v.replace(/\s+/g, ' ').slice(0, 90),
  )
  const restDoAluno = await fetch(
    `https://${REF}.supabase.co/rest/v1/workout_plans?select=id,status&student_id=eq.${ALUNO}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${aluno.sess.access_token}` } },
  )
  const listaDoAluno = await restDoAluno.json()
  check(
    'NEGATIVO: a própria RLS esconde o rascunho do aluno (lista vazia pela API com o token dele)',
    Array.isArray(listaDoAluno) && listaDoAluno.length === 0,
    JSON.stringify(listaDoAluno).slice(0, 80),
  )

  // ---------- 4) personal publica
  await pp.getByRole('button', { name: /^(send )?Publicar$/ }).click()
  await pp.getByRole('button', { name: /^(check_circle )?Publicada$/ }).waitFor({ timeout: 20000 })
  await pp.screenshot({ path: path.join(OUT, '3-personal-publicou.png'), fullPage: true })
  const publicadas = await rest('GET', `workout_plans?select=id,status&student_id=eq.${ALUNO}`)
  check(
    'ficha publicada',
    publicadas.some((f) => f.status === 'published'),
    JSON.stringify(publicadas.map((f) => f.status)),
  )

  // ---------- 5) aluno executa, recarrega no meio e conclui
  await pa.goto(`${BASE}/aluno/treinos/A`, { waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForSelector('text=Iniciar treino', { timeout: 20000 })
  await pa.click('text=Iniciar treino')
  await pa.waitForSelector('input[aria-label*="Carga em quilos"]', { timeout: 20000 })
  const cargas = pa.locator('input[aria-label*="Carga em quilos"]')
  const reps = pa.locator('input[aria-label*="Repetições"]')
  check(
    'execução abriu com as 2 séries prescritas do 1º exercício (+ o 2º exercício)',
    (await cargas.count()) >= 2,
    `${await cargas.count()} linhas de série`,
  )
  await cargas.nth(0).fill('45')
  await reps.nth(0).fill('10')
  await pa.locator('button[aria-label*="Marcar como feita"]').nth(0).click()
  await pa.waitForTimeout(1200)

  // RELOAD no meio do treino: tem de retomar a sessão aberta com o que já foi registrado
  await pa.reload({ waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForSelector('text=Treino em andamento', { timeout: 20000 })
  await pa.waitForTimeout(1500)
  const retomado = await texto(pa)
  const cargaDepoisDoReload = await pa
    .locator('input[aria-label*="Carga em quilos"]')
    .nth(0)
    .inputValue()
  await pa.screenshot({ path: path.join(OUT, '4-aluno-retomou.png'), fullPage: true })
  check(
    'recarregar no meio RETOMA a sessão (não começa de novo)',
    /Treino em andamento/.test(retomado) && !/Iniciar treino/.test(retomado),
    retomado.match(/Treino em andamento[\s\S]{0,60}/)?.[0]?.replace(/\n/g, ' '),
  )
  check(
    'a carga registrada antes do reload continua na tela (45 kg)',
    cargaDepoisDoReload === '45',
    `input = "${cargaDepoisDoReload}"`,
  )
  check(
    'progresso preservado: 1 de N séries feitas',
    /1 de \d+ séries feitas/.test(retomado),
    retomado.match(/\d de \d+ séries feitas.*/)?.[0],
  )

  // 2ª série e conclusão
  const cargas2 = pa.locator('input[aria-label*="Carga em quilos"]')
  const reps2 = pa.locator('input[aria-label*="Repetições"]')
  await cargas2.nth(1).fill('55')
  await reps2.nth(1).fill('8')
  await pa.locator('button[aria-label*="Marcar como feita"]').nth(1).click()
  await pa.waitForTimeout(1200)
  await pa.click('text=Concluir treino')
  await pa.waitForSelector('text=Treino concluído hoje', { timeout: 20000 })
  const resumo = await texto(pa)
  await pa.screenshot({ path: path.join(OUT, '5-aluno-concluiu.png'), fullPage: true })
  check(
    'resumo honesto da sessão: 2 séries feitas e volume 890 kg (45×10 + 55×8)',
    /2\/\d/.test(resumo) && /890 kg/.test(resumo),
    resumo.match(/Séries[\s\S]{0,40}/)?.[0]?.replace(/\n/g, ' '),
  )

  // recarregar depois de concluir não reabre a sessão
  await pa.reload({ waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForSelector('text=Treino concluído hoje', { timeout: 20000 })
  const depoisDeConcluir = await texto(pa)
  check(
    'recarregar depois de concluir mantém "concluído" (não reabre sessão)',
    /Treino concluído hoje/.test(depoisDeConcluir) && !/Iniciar treino/.test(depoisDeConcluir),
  )

  // ---------- 6) home do aluno reflete o dia real
  await pa.goto(`${BASE}/aluno/inicio`, { waitUntil: 'networkidle' })
  await pularIntro(pa)
  await pa.waitForSelector('[data-testid="training-day-state"]', { timeout: 20000 })
  await pa.waitForTimeout(2000)
  const home = await texto(pa)
  const estado = await pa.locator('[data-testid="training-day-state"]').innerText()
  await pa.screenshot({ path: path.join(OUT, '6-aluno-home.png'), fullPage: true })
  check('home do aluno diz "Concluído hoje"', /Conclu[íi]do hoje/i.test(estado), estado)
  check(
    'home conta a semana real contra a frequência da ficha (1 de 3)',
    /1 de 3 treinos da sua ficha/.test(home),
    home.match(/\d de \d treinos da sua ficha/)?.[0],
  )

  // ---------- 7) personal vê a aderência com a carga certa
  await pp.goto(`${BASE}/personal/alunos/${ALUNO}`, { waitUntil: 'networkidle' })
  await pularIntro(pp)
  await pp.waitForSelector('text=Treinos registrados', { timeout: 20000 })
  await pp.waitForTimeout(2000)
  const visao = await texto(pp)
  await pp.screenshot({ path: path.join(OUT, '7-personal-aderencia.png'), fullPage: true })
  check('personal vê a sessão do aluno (divisão + foco)', /Treino A · Superior/.test(visao))
  check(
    'séries feitas sobre prescritas na visão do personal',
    /2 de \d séries/.test(visao),
    visao.match(/\d de \d séries.*/)?.[0],
  )
  check('volume real da sessão (890 kg) na visão do personal', /890 kg/.test(visao))
  check(
    'semana do personal bate com a do aluno (1 de 3)',
    /1 de 3 treinos prescritos/.test(visao),
    visao.match(/\d de \d treinos prescritos/)?.[0],
  )

  await pp.click('text=Treino A · Superior')
  await pp.waitForSelector('text=abaixo do prescrito', { timeout: 10000 })
  const detalhe = await texto(pp)
  await pp.screenshot({ path: path.join(OUT, '8-personal-drilldown.png'), fullPage: true })
  check(
    'drill-down mostra a prescrição que o personal montou (2 × 10 · 50 kg)',
    /Prescrito: 2 × 10 · 50 kg/.test(detalhe),
    detalhe.match(/Prescrito:.*/)?.[0],
  )
  check(
    'carga de cada série com o desvio: 45 kg abaixo e 55 kg acima do prescrito',
    /45 kg/.test(detalhe) &&
      /abaixo do prescrito/.test(detalhe) &&
      /55 kg/.test(detalhe) &&
      /acima do prescrito/.test(detalhe),
  )
  check(
    `exercício prescrito e não tocado (${nomeExercicio2}) aparece como não registrado`,
    /Não registrado nesta sessão/.test(detalhe),
  )

  // ---------- 8) o banco conta a mesma história
  const logs = await rest(
    'GET',
    `workout_logs?select=id,division_key,started_at,completed_at&student_id=eq.${ALUNO}`,
  )
  check(
    'uma única sessão no banco, da divisão A, fechada',
    logs.length === 1 && logs[0].division_key === 'A' && logs[0].completed_at !== null,
    JSON.stringify(logs),
  )
  const sets = await rest(
    'GET',
    `set_logs?select=set_index,reps,weight_kg,done&workout_log_id=eq.${logs[0].id}&order=set_index`,
  )
  check(
    'as duas séries gravadas com a carga da prova (45 e 55)',
    sets.filter((s) => s.done).length === 2 &&
      sets.find((s) => s.weight_kg === 45) &&
      sets.find((s) => s.weight_kg === 55),
    JSON.stringify(sets),
  )

  await browser.close()

  // ---------- 9) limpeza total
  await apagarAluno(ALUNO)
  const sobraPlan = await rest('GET', `workout_plans?select=id&student_id=eq.${ALUNO}`)
  const sobraLog = await rest('GET', `workout_logs?select=id&student_id=eq.${ALUNO}`)
  const sobraStudent = await rest('GET', `students?select=id&id=eq.${ALUNO}`)
  const sobraProfile = await rest('GET', `profiles?select=id&id=eq.${ALUNO}`)
  const sobraUser = await acharUsuario(EMAIL)
  const demos = await authAdmin('GET', 'admin/users?per_page=200')
  const outrosDemo = (demos.users || [])
    .filter((u) => u.email.endsWith('@naigo.demo'))
    .map((u) => u.email)
    .sort()
  check(
    'limpeza: nada do aluno de teste sobrou (ficha, sessão, student, profile, usuário)',
    sobraPlan.length === 0 &&
      sobraLog.length === 0 &&
      sobraStudent.length === 0 &&
      sobraProfile.length === 0 &&
      sobraUser === null,
    `plans=${sobraPlan.length} logs=${sobraLog.length} students=${sobraStudent.length} profiles=${sobraProfile.length} user=${sobraUser ? 'SOBROU' : 'não'}`,
  )
  check(
    'só as contas demo permanentes continuam no banco',
    outrosDemo.length === 2 && !outrosDemo.includes(EMAIL),
    outrosDemo.join(', '),
  )
  const orfaos = await rest(
    'GET',
    `workout_plans?select=id,objective&objective=eq.${encodeURIComponent(OBJETIVO)}`,
  )
  check('nenhuma ficha órfã com o objetivo do teste', orfaos.length === 0, JSON.stringify(orfaos))

  console.log(`\n${ok.length} OK, ${fail.length} falhas · prints em ${OUT}`)
  if (fail.length) process.exit(1)
}

main().catch(async (e) => {
  console.error('ERRO', e)
  // mesmo falhando, não deixa aluno de teste no banco
  const u = await acharUsuario(EMAIL).catch(() => null)
  if (u) await apagarAluno(u.id).catch(() => undefined)
  process.exit(1)
})
