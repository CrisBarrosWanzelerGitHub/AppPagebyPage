# 📖 PageByPage — Design System

> *"Não é sobre quantidade. É sobre constância."*

Sistema de design do PageByPage — um tracker de leitura editorial, minimalista e warm.

**Versão:** 2.1 · **Última atualização:** Abril/2026

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
- **Tipografia geométrica leve** — Questrial nos títulos, Inter no corpo
- **Respiro antes de densidade** — spacing generoso > informação amontoada
- **Números protagonistas** — métricas grandes, labels pequenos em UPPERCASE
- **Dual-mode equilibrado** — dark permanece vibrante, light ganha warmth de papel

---

## ✍️ Tipografia

### Famílias

```css
--font-display: 'Questrial', sans-serif;
--font-body: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

**Questrial** (Joe Prince, 2011) é single-weight (400), geométrica humanista com terminações abertas. Manda na voz visual. **Inter** (Rasmus Andersson) cuida da UI com múltiplos pesos.

**Regra de ouro:** Questrial = *voz visual*, Inter = *voz funcional*.

### Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Questrial&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Escala tipográfica

| Token | Tamanho | Família | Peso | Uso |
|---|---|---|---|---|
| `--text-display-xl` | 56px | Questrial | 400 | Números hero |
| `--text-display` | 40px | Questrial | 400 | Números grandes (2.485) |
| `--text-h1` | 28px | Questrial | 400 | Logo PageByPage |
| `--text-h2` | 20px | Questrial | 400 | Títulos de seção |
| `--text-h3` | 16px | Inter | 600 | Títulos de card |
| `--text-body` | 14px | Inter | 400 | Texto corrido |
| `--text-small` | 13px | Inter | 400 | Metadados |
| `--text-label` | 11px | Inter | 600 | Labels UPPERCASE |
| `--text-micro` | 10px | Inter | 600 | Badges |
| `--text-editorial` | 14px | Questrial italic | 400 | Numerações terracota |

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

/* Light sand — sombras derivadas de marrom */
--shadow-sm: 0 1px 2px rgba(92, 85, 77, 0.06);
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

### Book Card (signature)

- Título em Questrial
- **Fita "LENDO": `--accent-surface`** (mostarda — é uma superfície visual)
- Stat pill "Lido %": `--accent-text` (chocolate — é texto)

### FAB

- **Background: `--accent-surface`** (mostarda)
- Puro impacto visual, não entra como texto

### Heatmap

- **Células preenchidas: `--accent-surface`** (são superfícies visuais)
- Gradiente de opacidade pros 4 níveis

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

- **"3 Books Every Copywriter Must Read"** → escolha do **Questrial**
- **App GTD editorial** → **sand mode** + **terracota editorial** + **chocolate de texto**
- **Library App (Silent Echoes)** → **spacing** e **cards brancos**

---

## 🗺️ Changelog

- **v2.1** (atual) — sistema dual de amarelo: chocolate pra textos, mostarda pra superfícies. Acessibilidade AAA.
- **v2.0** — Sand Edition, Questrial, terracota editorial
- **v1.0** — Estrutura inicial com amarelo único

---

*Documento vivo. Atualize sempre que um novo componente nascer.* 📖
