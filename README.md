[README.md.txt](https://github.com/user-attachments/files/27407155/README.md.txt)
# 💰 CYANO – Sistema Financeiro Pessoal

## 📌 Descrição

O **Cyano** é um sistema financeiro pessoal desenvolvido em **HTML, CSS e JavaScript puro**, com foco em:

* controle de gastos
* cartões de crédito
* importação de faturas (PDF)
* assinaturas recorrentes
* personalização avançada
* experiência estilo app (mobile-first)

O sistema roda totalmente no navegador, utilizando **localStorage** para persistência.

---

## 🚀 Funcionalidades principais

### 💰 Financeiro

* cadastro de despesas e receitas
* categorias
* histórico completo

### ⚡ Lançamento rápido

* tela `quick.html`
* salva rápido via atalho
* origem marcada como `quick`

### 💳 Cartões de crédito

* cadastro de cartões
* limite e uso
* fatura atual e futura
* compras parceladas (ex: 2/4)
* pagamento de fatura

### 📄 Importação de fatura (PDF)

* leitura de PDF (ex: Nubank)
* criação automática de lançamentos
* detecção de parcelas
* preview antes de salvar
* anti-duplicação
* histórico de importações

### 🔁 Assinaturas

* cadastro de assinaturas mensais
* integração com cartão
* geração automática de lançamentos
* controle de status (ativo/pausado)
* geração de até 12 meses futuros
* origem `subscription`

### 🧠 Inteligência

* categorização automática (aprendizado simples)
* insights financeiros
* comparação mensal
* previsão de saldo

### 📅 Calendário

* visualização por dia
* vencimentos e parcelas

### 📊 Dashboard

* resumo financeiro
* blocos configuráveis
* visão geral do sistema

---

## 🎨 Personalização (V18)

* múltiplos temas (iOS, Cyano, Neon, etc.)
* ajuste de blur e transparência
* tamanho da interface
* dashboard customizável
* botão "+" configurável
* cores por categoria

---

## ⚙️ Estrutura do projeto

```text
/
├── index.html
├── quick.html
├── style.css
├── app.js
├── assets/
└── README.md
```

---

## 🧠 Arquitetura

* **Frontend only**
* armazenamento via `localStorage`
* navegação por troca de `.page.active`
* lógica central em `app.js`

---

## 📦 Estrutura de dados

### Lançamentos

```js
{
  desc: "Netflix",
  valor: 39.9,
  tipo: "despesa",
  data: "2026-05-10",
  categoria: "lazer",
  pagamento: "cartao",
  cartao: "Nubank",
  parcela: "2/4",
  source: "manual | quick | import | subscription"
}
```

---

### Assinaturas

```js
{
  nome: "Netflix",
  valor: 39.9,
  dia: 10,
  cartao: "Nubank",
  ativo: true
}
```

---

### Importações

```js
{
  id: "import_123",
  data: "2026-05",
  itens: [...]
}
```

---

## ⚠️ Regras importantes

* nunca duplicar lançamentos
* sempre validar parcelas
* nunca somar parcelas futuras no mês atual
* sempre manter compatibilidade com dados existentes
* não quebrar funções existentes ao adicionar novas

---

## 🚫 NÃO FAZER

* não alterar estrutura de dados sem migração
* não duplicar lógica
* não criar múltiplos sistemas paralelos
* não remover funcionalidades existentes

---

## 🔐 Segurança

* sistema preparado para PIN/biometria (em evolução)

---

## 🌐 Deploy

* hospedado via **Vercel**
* frontend estático

---

## 📈 Próximos passos

* notificações push
* backup em nuvem
* IA mais avançada
* sincronização multi-dispositivo

---
