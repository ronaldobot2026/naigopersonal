# Catálogo de Exercícios

## Origem dos dados

O catálogo vem de [`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset):
1.324 exercícios com região do corpo, equipamento, músculo-alvo, músculos secundários, passos de
execução e mídia 180×180.

**Duas licenças distintas, e a diferença importa:**

| Conteúdo                                                      | Licença                      |
| ------------------------------------------------------------- | ---------------------------- |
| Estrutura do dataset, nomes, taxonomia e texto das instruções | MIT                          |
| Imagens (`images/`) e GIFs (`videos/`)                        | © Gym visual — **não** é MIT |

O `NOTICE.md` do dataset é explícito: _"cloning this repo is not a license"_. A mídia só pode ser
distribuída em 180×180, exige o aviso de copyright junto de todo uso e está sujeita aos
[Termos de Uso da Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use).

**Como este projeto lida com isso:**

- Nenhuma imagem ou GIF é copiado para o repositório. A mídia é carregada por CDN (jsDelivr)
  apontando para o repositório de origem — ver `MEDIA_CDN_BASE` em `domain/exerciseCatalog.ts`.
- `ExerciseMedia` fixa `width`/`height` em 180 para não fazer upscale além do permitido.
- `ExerciseAttribution` exibe "© Gym visual" e aparece em **toda** tela que mostra mídia:
  biblioteca, detalhe do exercício, detalhe do treino, construtor e correção postural.
- **Pendente do responsável pelo produto**: confirmar com a Gym visual se este uso está coberto
  pelos termos deles antes de ir a produção. O código não presume que está.

## Pipeline

```
exercises-dataset (GitHub, ~17 MB, 10 idiomas)
        │  npm run build:exercises        → scripts/build-exercises.mjs
        ▼
public/data/exercises.json (~0,95 MB, só inglês, campos usados)
        │  fetch sob demanda              → repositories/exerciseCatalogRepository.ts
        ▼
domínio traduzido pt-BR                   → domain/exerciseCatalog.ts
        ▼
telas (biblioteca, detalhe, treinos, correção postural)
```

O arquivo gerado **é versionado**: o app funciona sem rodar o script. Rode
`npm run build:exercises` apenas para atualizar a partir do dataset de origem.

### Por que o JSON fica em `public/` e não no bundle

Importar o catálogo por `import` colocaria ~1 MB dentro do bundle JS, estourando o orçamento de
performance do projeto. Em `public/`, ele é buscado só quando alguma tela de treino é aberta,
compartilhado entre telas por memoização no repositório e cacheável pelo navegador de forma
independente do JS.

## Tradução para pt-BR

O dataset traz instruções em 10 idiomas (`en, es, it, tr, ru, zh, hi, pl, ko, fr`) — **nenhum
deles é português**. A tradução acontece no app, em `src/features/workouts/domain/`, e não no
arquivo de dados, para ser coberta por testes e evoluir sem reprocessar o dataset.

### O que está em pt-BR hoje

| Conteúdo                               | Estado                                              |
| -------------------------------------- | --------------------------------------------------- |
| Região do corpo, equipamento, músculos | 100% (`exerciseTaxonomy.ts`)                        |
| Nome do exercício                      | 87% por regras (`exerciseNaming.ts`)                |
| Busca por vocabulário de academia      | ~70 apelidos (`exerciseSearchAliases.ts`)           |
| Passos de execução                     | 73 exercícios completos, incluindo todos os treinos |

`exerciseTaxonomy.test.ts` roda contra o catálogo real e **falha** se o dataset for atualizado com
um termo de taxonomia sem tradução — o vocabulário é fechado, então a cobertura é verificável.

### Tradução de nomes por regras

Nomes em inglês seguem `[modificadores] [equipamento] [movimento]`; o português remonta como
`movimento + termos remanescentes + modificadores + equipamento`:

```
"dumbbell incline bench press"  →  "Supino inclinado com halteres"
"barbell reverse grip decline bench press"  →  "Supino com pegada pronada declinado com barra"
"lever alternate leg press"  →  "Leg press alternado na máquina"
```

Duas regras existem para evitar nomes enganosos:

1. **Só traduz quando reconhece o movimento.** Os ~13% restantes (nomes exóticos como
   `pelvic tilt`, `air bike`) ficam em inglês, sinalizados por `isNameTranslated: false`. Um nome
   estrangeiro é melhor que uma tradução errada.
2. **Nunca descarta termo desconhecido.** "superman push-up" vira "Flexão de braço superman", não
   "Flexão de braço" — senão exercícios diferentes colapsariam no mesmo nome e ficariam
   indistinguíveis na biblioteca. Restam 42 colisões em 1.279 nomes, e todas são duplicatas reais
   do dataset (variações `v. 2`, `(female)`).

Concordância de gênero é explícita: cada movimento declara `gender` e cada modificador tem as duas
formas — "supino inclinad**o**" mas "rosca inclinad**a**".

### Passos de execução

Traduzidos por um dicionário versionado em `public/data/instructions.pt-BR.json`, um mapa
`passo em inglês → passo em pt-BR`, buscado em paralelo com o catálogo e aplicado em
`toExercise`.

**Regra de tudo ou nada.** Um exercício só muda para português quando **todos** os seus passos
têm tradução; faltando um, o exercício inteiro permanece em inglês e o detalhe exibe o selo
"Instruções ainda em inglês". Metade das instruções em cada idioma é pior de ler que tudo em
inglês, e esconderia do usuário que a tradução está incompleta.

Estado atual: **333 passos traduzidos → 73 exercícios completos**, incluindo **todos os que
aparecem nos treinos** (garantido por teste).

O universo completo é de **4.414 passos únicos (~379 mil caracteres)** de prosa livre — não cabe
num dicionário de regras como coube o vocabulário dos nomes. A tradução foi feita por
alavancagem: primeiro os exercícios efetivamente prescritos, depois os passos compartilhados por
mais exercícios. Para continuar, o caminho é o mesmo — acrescentar entradas ao JSON; nada no
código muda.

Se o arquivo faltar ou vier corrompido, o catálogo carrega mesmo assim com os passos em inglês:
uma tradução ausente não pode derrubar a biblioteca inteira.

Testes em `instructionTranslation.test.ts` garantem: a regra de tudo ou nada, a preservação da
quantidade de passos, a cobertura dos exercícios prescritos, ausência de traduções órfãs (chave
que não existe no catálogo) e de valores vazios.

## Busca e filtros

`searchText` é pré-computado por exercício com nome pt-BR + nome em inglês + taxonomia +
músculos, tudo em minúsculas e sem acento. A busca exige **todos** os termos (AND), o que torna
"rosca halteres" mais útil que busca por frase. Os filtros de região, equipamento e músculo são
facetas derivadas do próprio catálogo (`collectFacet`), então acompanham o dataset sem lista
literal no código.

A biblioteca renderiza 24 cartões por vez — 1.324 nós de uma vez travariam a rolagem — e o
construtor de treinos usa busca em vez de `<select>`, impraticável nessa escala.

## Onde o catálogo é consumido

| Tela                     | Arquivo                            |
| ------------------------ | ---------------------------------- |
| Biblioteca de Exercícios | `pages/ExerciseLibraryPage.tsx`    |
| Detalhe do exercício     | `pages/ExerciseDetailPage.tsx`     |
| Detalhe do treino        | `pages/WorkoutDetailPage.tsx`      |
| Criar treino             | `pages/WorkoutBuilderPage.tsx`     |
| Correção postural        | `pages/PosturalCorrectionPage.tsx` |

`MOCK_WORKOUTS` (`src/mocks/workouts.ts`) referencia ids reais do catálogo (`"0025"`, `"0334"`),
então as telas de treino exibem nome, mídia e execução verdadeiros mesmo antes de existir backend.

As sugestões da Correção Postural (`domain/posturalProgram.ts`) são recortes do catálogo por
região e equipamento — uma **vitrine de biblioteca**, nunca prescrição automática a partir das
métricas da Avaliação Postural. A indicação continua sendo do profissional.
