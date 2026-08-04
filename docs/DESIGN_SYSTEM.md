# Design System — Windson Wood Personal

Fonte da verdade: `src/styles/tokens.css`. Este documento explica a origem e o racional dos
tokens; não duplique valores aqui — se o CSS mudar, esta prosa pode ficar desatualizada, então
sempre confira o arquivo antes de confiar em um valor específico.

## Origem

Extraído de `reference/stitch-original/stitch_windson_wood_personal_app/iron_elite/DESIGN.md`
(design system "Iron Elite"). Visual dark industrial, tipografia técnica, hierarquia por camadas
tonais em vez de sombras.

## Tokens semânticos

| Token                                  | Papel                                           | Origem no Iron Elite                                                                    |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `background`                           | Fundo base da aplicação                         | `surface` / `background` (#141312)                                                      |
| `surface`                              | Superfície padrão de cards                      | `surface-container` (#201f1e)                                                           |
| `surface-elevated`                     | Superfície elevada (hover, cards em destaque)   | `surface-container-high` (#2b2a28)                                                      |
| `surface-high`                         | Camada mais alta (badges, trilhos de progresso) | `surface-container-highest` (#353533)                                                   |
| `border`                               | Bordas discretas em toda a UI                   | `outline-variant` (#49473f)                                                             |
| `text-primary`                         | Texto principal                                 | `on-surface` (#e5e2df)                                                                  |
| `text-secondary`                       | Texto de apoio, labels                          | `on-surface-variant` (#cbc6bc)                                                          |
| `action-primary` / `-foreground`       | Botões e ações primárias                        | `primary` (#cbc6b8) / `on-primary` (#323127)                                            |
| `action-secondary` / `-foreground`     | Ações secundárias                               | `secondary` (#c9c6bf) / `on-secondary` (#31302c)                                        |
| `success` / `-foreground`              | Indicador "dentro do esperado"                  | Derivado — Iron Elite não definia uma cor de sucesso distinta                           |
| `warning` / `-foreground`              | Indicador "atenção"                             | Reaproveita o dourado de destaque (#f2ca50) já usado em glows/hovers no export original |
| `error` / `-foreground` / `-container` | Erros e alertas                                 | `error` (#ffb4ab) / `on-error` (#690005) / `error-container` (#93000a)                  |
| `informative` / `-foreground`          | Indicadores neutros/informativos                | `tertiary` "basalto" (#cbc4cc)                                                          |

## Tipografia

- **Hanken Grotesk** (`font-display`) — títulos, headlines, valores de métricas (`stat-lg`).
- **Inter** (`font-body`) — texto corrido.
- **JetBrains Mono** (`font-mono`) — labels em caixa alta, ângulos, medidas, timestamps.

## Espaçamento e forma

- Unidade base de 4px (`--spacing: 4px`, escala numérica do Tailwind).
- Tokens nomeados: `gutter` (16px), `margin-mobile` (16px), `margin-desktop` (32px),
  `container-max` (1200px) — usados como `p-gutter`, `px-margin-mobile`, `max-w-container-max`.
- Raios: `sm` (0.25rem), `md` (0.5rem — inputs/botões), `lg` (0.875rem — cards), `xl` (1.125rem),
  `2xl` (1.5rem), `full` (pills/avatares).

> **Mudança de 2026-08-03.** Os raios eram bem menores (`sm` 0.125rem → `lg` 0.5rem), do tema
> "Iron Elite" industrial. Foram ampliados junto com a adoção da camada de vidro: cantos duros
> contradizem a leitura de material contínuo. A identidade dark industrial permanece — o que
> mudou foi a forma e a profundidade, não a paleta.

## Materiais translúcidos (camada de vidro)

Adotados em 2026-08-03. As utilities vivem em `globals.css` e os valores em `tokens.css`.

| Utility        | Uso                                                | Blur / saturate |
| -------------- | -------------------------------------------------- | --------------- |
| `.glass`       | Cartões de conteúdo, botão secundário, tab inativa  | 18px / 170%     |
| `.glass-high`  | Superfícies que precisam de mais presença           | 24px / 180%     |
| `.glass-chrome`| Chrome estrutural: TopBar, BottomNavigation, Sidebar | 28px / 190%     |

Regras que sustentam o sistema:

- **O peso do material codifica hierarquia.** `chrome` é o mais escuro e separa regiões
  estruturais; `glass` e `glass-high` são mais leves e ficam em conteúdo. **Nunca empilhar vidro
  sobre vidro** — a legibilidade colapsa.
- **`saturate` acompanha o `blur`.** Desfocar sozinho lava a cor do que está atrás; a saturação
  devolve a vivacidade que faz o material parecer vidro e não névoa.
- **A aresta superior clara** (`inset 0 1px 0 var(--color-glass-edge)`) é a luz batendo na quina.
- **Sombras em camadas** (`--shadow-glass-*`): um contato curto mais uma difusão longa.
- **Sem divisor de 1px sob o chrome.** `.scroll-edge-top` / `.scroll-edge-bottom` desenham um
  degradê curto só onde a barra realmente cobre o conteúdo.
- **A camada atmosférica (`body::before`) é pré-requisito, não decoração.** `backdrop-filter`
  desfoca o que está atrás; sobre cor chapada não há nada para desfocar e o vidro fica
  indistinguível de uma superfície opaca.
- **A TopBar fica dentro do contêiner de rolagem**, como `sticky`. Fora dele o conteúdo pararia
  acima da barra e o material não teria o que refratar.

### Prefixo do `backdrop-filter` — cuidado ao mexer

O `package.json` declara um `browserslist`. Isso **não é opcional** aqui: sem ele o minificador
de CSS emite apenas `-webkit-backdrop-filter` e descarta a propriedade padrão, o que apaga todo
o vidro no Firefox. Escreva sempre só a propriedade sem prefixo no fonte e deixe a ferramenta
prefixar. Se mexer no `browserslist`, confira no CSS gerado que as duas formas aparecem.

## Movimento

- Curva única em token: `--ease-out-quint` — desaceleração exponencial, sem overshoot. Não há
  token com bounce: curva elástica só se justifica em interação que carrega momento (arrastar e
  soltar, flick), e o app não tem nenhuma. Se um dia tiver, o token nasce junto com ela.
- **Feedback de pressão no pointer-down**, nunca no clique — `active:scale-[0.97]` em ~110ms.
- Anima só `transform`, `opacity`, `box-shadow` e `background-color`.
- `.spotlight` acompanha o ponteiro via `--spot-x`/`--spot-y` escritos pelo hook
  `usePointerSpotlight` — custom property em vez de estado do React, porque `pointermove` dispara
  dezenas de vezes por segundo.

## Preferências de acessibilidade

Três sinais independentes, tratados separadamente em `globals.css`:

| Preferência                      | Resposta                                                 |
| -------------------------------- | -------------------------------------------------------- |
| `prefers-reduced-transparency`   | Remove o blur e usa a superfície opaca equivalente        |
| `prefers-contrast: more`         | Fundo sólido e borda definida                             |
| `prefers-reduced-motion`         | Desliga o spotlight e zera durações de transição/animação |

## Ícones

Material Symbols Outlined (Google Fonts), carregado uma única vez em `index.html` — no export
original cada uma das 13 telas repetia o mesmo `<link>`. Componente `Icon`
(`src/components/ui/Icon.tsx`) encapsula o uso; variante preenchida via classe `.icon-filled`
(nunca inline style).

## Componentes fundamentais criados nesta entrega

`Button`, `IconButton`, `Card`, `MetricCard`, `Input`, `NumberInput`, `Select`, `Tabs` (compound
component), `Badge`, `ProgressBar`, `Modal`, `EmptyState`, `LoadingState`, `ErrorState`,
`CameraPermissionState`, `CaptureQualityIndicator`, `TopBar`, `BottomNavigation`, `Sidebar`,
`PageHeader` — todos em `src/components/{ui,feedback,navigation}/`, tipados, acessíveis
(labels associados, `aria-live`, `role`, foco visível) e responsivos mobile-first.

## Responsividade

- Mobile: navegação inferior (`BottomNavigation`), fluxo vertical, funcional a partir de ~360px.
- Desktop (`md:` e acima): `Sidebar` fixa substitui a navegação inferior; conteúdo respeita
  `max-w-container-max` (1200px).
