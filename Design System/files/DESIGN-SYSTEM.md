# 📖 PageByPage — Design System

> *"Não é sobre quantidade. É sobre constância."*

Sistema de design do PageByPage — um tracker de leitura editorial, minimalista e warm.

**Versão:** 2.2 · **Última atualização:** Maio/2026

---

## 🎨 Filosofia de design

O PageByPage é um **diário de leitura**, não um dashboard corporativo. A estética bebe de três referências:

1. **Editorial tipográfico** — capas de livro minimalistas com tipografia geométrica em peso leve
2. **Paleta de papel** — fundos areia/cremoso no light mode, remetendo a papel envelhecido
3. **Dataviz cozy** — números grandes protagonistas, barras limpas, heatmap de constância

**Três cores conversam entre si:**

- **Amarelo** — o signature, usado pra metas, destaques, sucesso
- **Chocolate** — editorial de texto no light mode (contraste + warmth)
- **Terracota** — editorial secundário pra numerações e tags raras

**Princípios:**
- **Tipografia editorial dupla** — Playfair Display (serif) nos títulos e palavras-chave em itálico, Space Mono (monospace) no corpo
- **Respiro antes de densidade** — spacing generoso > informação amontoada
- **Números protagonistas** — métricas grandes, labels pequenos em UPPERCASE
- **Dual-mode equilibrado** — dark permanece vibrante, light ganha warmth de papel

---

## ✍️ Tipografia

### Famílias

```css
--font-display: 'Playfair Display', serif;
--font-body:    'Space Mono', monospace;
```

**Playfair Display** (Claus Eggers Sørensen) é serif transitional clássica — alto contraste, terminações afiadas, voz editorial. Carregada **apenas no peso 400 (regular + italic)** para evitar bold sintético em terminações serifadas. Manda na voz visual.

**Space Mono** (Colophon Foundry) é monospace geométrica com personalidade — cuida da UI funcional sem cair na frieza do mono técnico. Carregada em 400 e 700.

**Regra de ouro:** Playfair = *voz visual e emocional*, Space Mono = *voz funcional e dado*.

> **Atenção à largura do mono.** Space Mono é ~60% mais largo por caractere que Inter no mesmo `font-size`. Calibrar margens, larguras de container e `white-space: nowrap` com isso em mente — várias linhas que cabiam em Inter precisam de `text-overflow: ellipsis` agora.

### Itálico semântico

Regra única e obrigatória em frases editoriais (taglines, títulos de hero, subtítulos, frases introdutórias):

- `<em>` aplicado a **uma única palavra por frase** — aquela com maior peso emocional/semântico
- Nunca mais de uma palavra por frase
- Títulos de livros em texto corrido **sempre em itálico**

**Exemplos no produto:**
- Tagline: "Não é sobre quantidade. É sobre *constância*."
- Hero Performance: "Performance que conta uma *história*"
- Subtítulo Performance: "Menos planilha e mais *jornada*"
- Frase intro Performance: "Sua *jornada* de leitura já acumula..."
- Dashboard: "Cada página que você lê vira parte de uma *história* única — a sua."

### Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

### Escala tipográfica

Todos os elementos display usam **`font-weight: 400`** — Playfair é carregada só nesse peso, e bold sintético em serifa transitional fica grosseiro.

| Token | Tamanho | Família | Peso | Uso |
|---|---|---|---|---|
| `--text-display-xl` | 2.4rem | Playfair Display | 400 | Números hero (total do ano) |
| `--text-display`    | 2rem    | Playfair Display | 400 | Números grandes de stat cards |
| `--text-h1`         | 1.75rem | Playfair Display | 400 | Métricas de Dashboard/History |
| `--text-h2`         | 1.65rem | Playfair Display | 400 | Logo PageByPage |
| `--text-h3`         | 1.55rem | Playfair Display | 400 | Hero Performance |
| `--text-h4`         | 1.45rem | Playfair Display | 400 | Next chapter card |
| `--text-h5`         | 1.25rem | Playfair Display | 400 | Insight cards |
| `--text-card-title` | 1.15rem | Playfair Display | 400 | Título de livro na frente do card |
| `--text-body`       | 0.88rem | Space Mono | 400 | Texto corrido |
| `--text-tagline`    | 0.82rem | Playfair Display | 400 italic | Tagline da brand, frases editoriais |
| `--text-small`      | 0.78rem | Space Mono | 400 | Metadados, autor |
| `--text-label`      | 0.7rem  | Space Mono | 700 | Labels UPPERCASE |
| `--text-micro`      | 0.65rem | Space Mono | 700 | Badges, hints |

---

## 🎨 Design Tokens

### Cores — Dark Mode (default)

| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#0F0F12` | Fundo da página |
| `--bg-surface` | `#16161B` | Header, zonas elevadas |
| `--bg-card` | `#1C1C22` | Cards, painéis |
| `--bg-card-hover` | `#22222A` | Card em hover |
| `--bg-input` | `#0F0F12` | Inputs, selects |
| `--border-subtle` | `#2A2A33` | Divisores |
| `--border-default` | `#3A3A45` | Borda de input |
| `--text-primary` | `#FFFFFF` | Títulos, valores grandes |
| `--text-secondary` | `#B8B8C0` | Corpo, descrições |
| `--text-muted` | `#6E6E78` | Labels, meta info |
| `--text-disabled` | `#45454F` | Estados inativos |

### Cores — Light Mode (Sand Edition)

| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#EDE6D9` | Fundo cremoso — papel envelhecido |
| `--bg-surface` | `#F5EFE3` | Header levemente mais claro |
| `--bg-card` | `#FFFFFF` | Cards brancos flutuando no areia |
| `--bg-card-hover` | `#FAF6EC` | Card em hover |
| `--bg-input` | `#FFFFFF` | Inputs |
| `--border-subtle` | `#E0D8C8` | Divisores |
| `--border-default` | `#CFC5B0` | Borda de input |
| `--text-primary` | `#1A1614` | Preto-tinta, quase sépia |
| `--text-secondary` | `#5C554D` | Marrom escuro suave |
| `--text-muted` | `#8A8272` | Labels, meta |
| `--text-disabled` | `#BFB8A8` | Inativos |

### ⭐ Sistema dual de accent — Amarelo (NOVO)

O amarelo tem **duas funções** no app, e cada uma precisa de um tom calibrado:

**1. Função TEXTO (números, valores, texto accent)**
→ Precisa de contraste AA/AAA pra acessibilidade
→ No light mode vira **chocolate** (`#6B4423`)

**2. Função SUPERFÍCIE (FAB, fita LENDO, progress fills, heatmap)**
→ Precisa de impacto visual, puro *highlighter*
→ No light mode permanece **mostarda** (`#D4A72C`)

No **dark mode**, os dois usam o mesmo amarelo vibrante (`#F5C518`) — contraste já é perfeito sobre o escuro.

### Tokens de accent

| Token | Dark | Light (Sand) | Uso |
|---|---|---|---|
| `--accent-text` | `#F5C518` | `#6B4423` | Números grandes, texto accent, progress value % |
| `--accent-text-hover` | `#FFD43B` | `#4A2E1A` | Hover de texto accent |
| `--accent-surface` | `#F5C518` | `#D4A72C` | FAB, fita LENDO, progress fills, heatmap cells |
| `--accent-surface-hover` | `#FFD43B` | `#E6B63D` | Hover de superfícies amarelas |
| `--accent-surface-muted` | `#8B7010` | `#A88820` | Heatmap low level |
| `--accent-soft` | `rgba(245,197,24,0.12)` | `rgba(107,68,35,0.10)` | Fundos suaves (badges filled, focus ring) |
| `--accent-border` | `#F5C518` | `#6B4423` | Bordas de pill ativa, badge outline |

**Regra de aplicação:**
- **Em textos, progress values, bordas de foco** → `--accent-text`
- **Em superfícies preenchidas que atuam como marca-texto visual** → `--accent-surface`
- **Em fundos soft (badge filled, hover states)** → `--accent-soft`

### Terracota (editorial)

| Token | Dark | Light (Sand) | Uso |
|---|---|---|---|
| `--accent-editorial` | `#C9584E` | `#B5463C` | Numerações 01/02/03, tags raras |
| `--accent-editorial-soft` | `rgba(201,88,78,0.10)` | `rgba(181,70,60,0.08)` | Fundo soft terracota |

### Danger

| Token | Dark | Light (Sand) | Uso |
|---|---|---|---|
| `--danger` | `#EF5A5A` | `#B5463C` | Alerta (terracota no light!) |
| `--danger-soft` | `rgba(239,90,90,0.12)` | `rgba(181,70,60,0.10)` | Fundo alerta |

No light sand, vermelho puro brigaria com a paleta quente — por isso danger vira terracota.

### Spacing

| Token | Valor | Uso comum |
|---|---|---|
| `--space-1` | 4px | Gap ícone+texto |
| `--space-2` | 8px | Padding de pills |
| `--space-3` | 12px | Gap entre elementos próximos |
| `--space-4` | 16px | Padding de cards pequenos |
| `--space-5` | 20px | Gap entre campos de form |
| `--space-6` | 24px | Padding de cards padrão |
| `--space-8` | 32px | Gap entre seções |
| `--space-10` | 40px | Blocos grandes |
| `--space-12` | 48px | Topo de página |

### Border Radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | Inputs, pills pequenas |
| `--radius-md` | 10px | Buttons, badges |
| `--radius-lg` | 14px | Cards, painéis |
| `--radius-xl` | 20px | Cards grandes |
| `--radius-full` | 9999px | Pills, FAB |

### Sombras

```css
/* Dark mode */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 24px rgba(245, 197, 24, 0.25);

/* Light sand — sombra neutra com mais presença */
--shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.12);
--shadow-md: 0 4px 14px rgba(92, 85, 77, 0.08);
--shadow-lg: 0 12px 32px rgba(92, 85, 77, 0.12);
--shadow-glow: 0 6px 20px rgba(212, 167, 44, 0.35);
```

### Transições

```css
--transition-fast: 120ms ease-out;
--transition-base: 200ms ease-out;
--transition-slow: 320ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## 🧩 Componentes

### Brand (header)

A marca no cabeçalho — logo + nome + tagline editorial.

- `.brandLogo` — width `2.8rem`, cor `--text-primary`
- `.brandName` — Playfair Display, `1.65rem`, weight 400, letter-spacing `-0.01em`
- `.brandTagline` — Playfair Display, `0.82rem`, weight 400, cor `--warm-gray`. Aplica regra do **itálico semântico**:

```html
<span class="brandTagline">
  Não é sobre quantidade. É sobre <em>constância</em>.
</span>
```

A tagline é exemplo canônico: uma única palavra (`constância`) carrega o peso emocional da frase inteira.

### Button

| Variante | Uso |
|---|---|
| `primary` | Ação principal — **fundo `--accent-surface`** (mostarda no light), texto escuro |
| `secondary` | Ação secundária — outline |
| `ghost` | Ação terciária — só hover |
| `editorial` | Ação especial — outline terracota |
| `danger` | Destrutiva — terracota (light) / vermelho (dark) |

**Importante:** botões primary usam `--accent-surface` (mostarda), não chocolate. O botão É a superfície amarela — texto escuro sobre fundo mostarda tem contraste ótimo.

### Card

- Padding: `--space-6`
- Radius: `--radius-lg` padrão
- Background: `--bg-card`
- **Números grandes dentro do card usam `--accent-text`** (chocolate no light)

### Progress Bar

- Track: `--border-subtle`
- **Fill: `--accent-surface`** (mostarda — função superfície)
- **Value % texto: `--accent-text`** (chocolate — função texto)

### Badge / Pill

| Variante | Uso |
|---|---|
| `filled-yellow` | Fundo `--accent-soft`, texto `--accent-text` (chocolate) |
| `outline-yellow` | Borda `--accent-border` (chocolate), texto chocolate |
| `filled-terracota` | Tags editoriais raras |
| `outline-terracota` | Numerações, referências |

### Hero Year Row (Performance tab)

Cabeçalho da aba Performance combina seletor de ano à esquerda + frase introdutória à direita, na mesma linha.

- `.heroYearRow` — `display: flex; align-items: flex-end; gap: 16px`
- `.heroYearGroup` — coluna vertical com label "Ano" (`.heroYearLabel`) + `<select>` (`.yearSelect`), `gap: 3px`
- `.heroHeading` — `margin-bottom: 28px` (distância título→linha do seletor)
- `.heroIntro` — frase em Space Mono, com `<em>` na palavra-chave ("jornada")
- **Mobile (≤640px):** `.heroYearRow` vira `flex-direction: column; align-items: flex-start; gap: 12px`

### Book Card (signature)

- Título em Playfair Display, `1.15rem`, weight 400 (`.cardTitle`)
- **Fita "LENDO": `--accent-surface`** (mostarda — é uma superfície visual)
- Stat pill "Lido %": `--accent-text` (chocolate — é texto)
- **Container da capa:** `background: var(--bg-primary)` · `border-radius: var(--radius-xl)` · `padding: var(--space-3)` · `margin: var(--space-4)` · `width/height: 130px` · `align-self: center` — centralizado verticalmente, com respiro de 16px em relação às bordas do card. Mobile: `80×80px` com `padding: var(--space-2)`. A fita de status permanece com `position: absolute`; a imagem interna recebe `border-radius: var(--radius-sm)` (raio interno = raio externo − padding).
- **Layout da frente:** `align-items: center` — capa, info e botões de ação ficam no mesmo eixo vertical central. Padding vertical do info: `0.65rem 1rem`.
- **Flip 3D:** o container `.bookCard` é `background: transparent` e sem borda — cada face tem seu próprio `background: var(--bg-card)` e `border: 0.5px solid var(--border)`. Isso garante que no meio do giro (90°) nenhum fundo aparece, criando o efeito real de carta virando. `perspective: 1000px` · animação `cubic-bezier(0.4, 0, 0.2, 1)` · elevação com `box-shadow` e `translateY(-2px)` quando o verso está ativo (`:has(.flipped)`).
- **Verso do card — layout geral:** `display: flex; flex-direction: column; justify-content: space-between` — distribui as 3 seções (info · campos · botões) verticalmente pelo espaço do card. Padding `0.65rem 1rem`.
- **Verso — seção info (`backInfo`):** `display: flex; flex-direction: column`. Contém linha de título+botões (`justify-content: space-between; align-items: flex-start`), linha de autor (`margin-top: -6px` para compensar a altura extra do modeToggle e igualar a distância título→autor da frente) e linha de status+datas (`margin-top: 4px`).
- **Verso — campos:** DATA e NOVA PÁGINA em grid `1fr 1fr` em todos os tamanhos de tela (sem colapso mobile). Labels com `margin-bottom: 0.15rem` (override do global `0.4rem`).
- **Verso — título e meta:** título em Playfair (`.backBookTitle`, `0.95rem`, weight 400) com `text-overflow: ellipsis`. Linha de meta (`.backBookMeta`) usa "**até** DD/MM/AAAA" (não "último:") e precisa de `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` por causa da largura do Space Mono.
- **Mobile — anti-clipping 3D:** `.cardFlipInner { min-height: 230px }`. Sem isso, o contexto 3D criado por `perspective: 1000px` recorta a face de trás no tamanho da frente (~110px no mobile) e o verso fica invisível.
- **Verso — botões:** CANCELAR e REGISTRAR em grid `1fr 1fr`.
- **Botão Registrar disabled:** `opacity: 0.65` (override do global `0.45`) — mantém a cor `--accent-surface` (amarelo) reconhecível mesmo quando o input ainda não é válido.
- **Toggle Pág/% no verso:** posicionado no canto superior direito da `backInfo`, ao lado dos botões de ação (releitura, ≡). Não ocupa linha própria — elimina espaço morto.
- **Seletor de status no verso:** compacto, `font-size: 0.78rem`, `width: auto`. Ao mudar o status, o card vira de volta automaticamente.
- **ISBN no formulário:** sempre `type="text"` (sem `type="number"`). No export CSV, forçar aspas para evitar que o Excel interprete como número e perca dígitos em notação científica.

### FAB

- **Background: `--accent-surface`** (mostarda)
- Puro impacto visual, não entra como texto

### Heatmap

- **Células preenchidas: `--accent-surface`** (são superfícies visuais)
- Gradiente de opacidade pros 4 níveis

---

## ⌨️ Atalhos de teclado

| Tecla | Ação | Notas |
|---|---|---|
| **N** | Abre modal "Adicionar livro" e foca direto no campo de busca por título | Ignorado quando foco está em `INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]` ou quando há modificador (Cmd/Ctrl/Alt) |

Implementação: `useEffect` global em `App.tsx` com listener `keydown` na `window`. O modal `AddBookModal` recebe `autoFocus` no primeiro `<input>` (busca por título) — o usuário começa a digitar de cara, sem precisar clicar.

---

## 📐 Padrões de Layout

- Max-width: 1200px
- Padding: `--space-6` desktop, `--space-4` mobile
- Grid métricas: 4 colunas desktop, 2 tablet, 1 mobile
- Header: 88px altura

---

## 🌓 Dark ↔ Light Mode

```css
:root { color-scheme: dark; /* tokens dark */ }
[data-theme="light"] { color-scheme: light; /* tokens sand */ }

* { transition: background-color var(--transition-slow),
              border-color var(--transition-slow),
              color var(--transition-slow); }
```

Persistência: `localStorage` como `pbp-theme`. Default: `dark`.

---

## ✨ Micro-interações

- **Hover em card:** translateY(-1px) + shadow cresce
- **Click button:** scale(0.98) active
- **Progress fill:** 0 → valor em 600ms
- **Number counter:** 0 → valor em 800ms
- **Conquista unlock:** pop scale + borda ganha glow
- **FAB:** pulse ao carregar, scale 1.08 hover
- **Tab change:** underline desliza horizontal
- **Theme toggle:** rotação 15° hover, body cross-fade
- **Heatmap hover:** célula scale(1.3) + tooltip

---

## ♿ Acessibilidade

### Contraste garantido no light sand

| Elemento | Cor | Fundo | Ratio | AA |
|---|---|---|---|---|
| Número grande | `#6B4423` chocolate | `#FFFFFF` card | ~8.2:1 | ✓ AAA |
| Número grande | `#6B4423` chocolate | `#EDE6D9` sand | ~7.3:1 | ✓ AAA |
| Texto corpo | `#1A1614` preto-tinta | `#EDE6D9` sand | ~15:1 | ✓ AAA |
| Botão primary | `#1A1614` texto | `#D4A72C` mostarda | ~7.8:1 | ✓ AAA |
| Label muted | `#8A8272` | `#EDE6D9` sand | ~3.2:1 | ✓ AA Large |

- Todo input tem `<label>` associado
- Focus ring sempre visível: 2px `--accent-text` com offset 2px
- Suporta `prefers-reduced-motion`
- Target mínimo: 44x44px
- Terracota em texto só ≥14px

---

## 📦 Stack recomendada pro Claude Code

```
src/
  styles/
    tokens.css       ← CSS vars (dark + light sand)
    base.css         ← reset + typography
    components/      ← um arquivo por componente
```

Classnaming: BEM lite (`.card`, `.card--book`, `.card__title`).

---

## 📚 Referências visuais

- **Tipografia editorial clássica** → escolha do **Playfair Display** (serif transitional para a voz emocional) + **Space Mono** (mono geométrica para a voz funcional)
- **App GTD editorial** → **sand mode** + **terracota editorial** + **chocolate de texto**
- **Library App (Silent Echoes)** → **spacing** e **cards brancos**

---

## 🗺️ Changelog

- **v2.2** (atual) — migração tipográfica para Playfair Display + Space Mono, regra do itálico semântico, novos componentes Brand e Hero Year Row, atalho de teclado **N**, "até" no verso do card.
- **v2.1** — sistema dual de amarelo: chocolate pra textos, mostarda pra superfícies. Acessibilidade AAA.
- **v2.0** — Sand Edition, Questrial, terracota editorial
- **v1.0** — Estrutura inicial com amarelo único

---

*Documento vivo. Atualize sempre que um novo componente nascer.* 📖
