# Deploy — BRAYAN_OS no GitHub Pages

Guia completo para publicar o portfólio online com GitHub Actions.

---

## Estrutura esperada do repositório

```
seu-repositorio/
├── .github/
│   └── workflows/
│       └── deploy.yml     ← workflow criado aqui
├── index.html
├── style.css
├── main.js
├── tela.js
├── computador.js
├── cenario.js
├── camera.js
├── controles.js
├── jogo.js
├── bzero64.js
├── musica.js
├── audio.js
├── imagens.js
└── img/                   ← pasta de imagens (se houver)
```

---

## Passo a passo

### 1. Criar o repositório no GitHub

Acesse https://github.com/new e crie um repositório. O nome define a URL final:

| Nome do repositório | URL resultante |
|---------------------|---------------|
| `portfolio`         | `https://seuusuario.github.io/portfolio` |
| `seuusuario.github.io` | `https://seuusuario.github.io` (raiz) |

> **Dica:** Se você quiser a URL mais limpa (`seuusuario.github.io` sem subpasta), nomeie o repositório exatamente como `SEU_USUARIO.github.io`.

---

### 2. Enviar os arquivos para o repositório

```bash
# Na pasta do projeto, inicialize o git (se ainda não tiver)
git init

# Adicione o repositório remoto (substitua pela sua URL)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# Crie e vá para a branch main
git checkout -b main

# Adicione todos os arquivos
git add .

# Commit inicial
git commit -m "feat: portfólio BRAYAN_OS inicial"

# Envie para o GitHub
git push -u origin main
```

---

### 3. Ativar o GitHub Pages com GitHub Actions

1. Acesse seu repositório no GitHub
2. Clique em **Settings** (⚙️ engrenagem)
3. No menu lateral, clique em **Pages**
4. Em **"Source"**, selecione **"GitHub Actions"** (não "Deploy from a branch")
5. Clique em **Save**

> Essa configuração é necessária apenas uma vez.

---

### 4. Verificar o deploy

Após fazer qualquer `git push` para `main`:

1. Acesse a aba **Actions** do seu repositório
2. Você verá o workflow **"Deploy BRAYAN_OS → GitHub Pages"** rodando
3. Aguarde o ícone ficar verde ✅ (geralmente menos de 1 minuto)
4. Acesse a URL do seu site — estará no ar

---

## Como funciona o workflow

```
git push para main
        │
        ▼
┌───────────────────────────────────┐
│  GitHub Actions inicia o job      │
│                                   │
│  1. Checkout do código            │
│  2. Configura GitHub Pages        │
│  3. Empacota arquivos estáticos   │
│  4. Publica no GitHub Pages       │
└───────────────────────────────────┘
        │
        ▼
  Site publicado em ~30–60s
  URL: https://seuusuario.github.io/repositorio
```

---

## Domínio personalizado (opcional)

Se você tiver um domínio próprio (ex: `brayan.dev`):

**Passo 1** — Crie um arquivo `CNAME` na raiz do projeto:
```
brayan.dev
```

**Passo 2** — No painel do seu DNS, adicione:
```
Tipo: CNAME
Nome: www  (ou @)
Valor: SEU_USUARIO.github.io
```

**Passo 3** — Em Settings → Pages → Custom domain, coloque o seu domínio e marque **"Enforce HTTPS"**.

> O arquivo `CNAME` precisa estar no repositório para sobreviver aos deploys — não configure só pelo painel do GitHub.

---

## Atualizando o site

A cada alteração, basta:

```bash
git add .
git commit -m "descrição da mudança"
git push
```

O deploy acontece automaticamente em segundos.

---

## Solução de problemas

**Deploy rodou mas o site mostra 404:**
- Verifique que o arquivo se chama exatamente `index.html` (minúsculas)
- Confirme que a Source em Settings → Pages está em "GitHub Actions"

**ES Modules com erro de CORS:**
- Nunca abra `index.html` direto no browser via `file://`
- O GitHub Pages serve via HTTPS — isso é resolvido automaticamente após o deploy

**Imagens não aparecem:**
- Verifique que a pasta `img/` está no repositório
- Os paths nas imagens devem ser relativos (ex: `img/foto.png`, não `/img/foto.png`)

**Workflow falhou:**
- Clique no workflow na aba Actions para ver o log de erro
- O erro mais comum é Settings → Pages não estar configurado para "GitHub Actions"
