// ============================================================
// CONTROLE FINANCEIRO PREMIUM - app.js
// ============================================================
// CONFIGURAÇÃO SUPABASE:
// 1. Acesse https://supabase.com e faça login
// 2. Crie um projeto novo
// 3. Vá em: Project Settings > API
// 4. Copie a "Project URL" e cole em SUPABASE_URL
// 5. Copie a "anon public" key e cole em SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL = "https://vckpovszyxcdnxdxlgnp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_znq3_9Z7-WaRgKlSHbi0DA_ZAgFvFyc";

// ============================================================
// INICIALIZAÇÃO DO SUPABASE
// ============================================================
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================================
let currentUser = null;
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentPage = 'dashboard';
let allTransactions = [];
let allCategories = [];
let allCards = [];
let allBudgets = [];
let allGoals = [];
let charts = {};
let deferredInstallPrompt = null;
let installTipShown = false;
let cachedUserPrefs = {};


// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await checkAuth();
});

async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showAuth();
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      showApp();
    } else {
      currentUser = null;
      showAuth();
    }
  });
}

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  showLoginTab();
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-name').textContent = currentUser.email.split('@')[0];
  document.getElementById('user-email').textContent = currentUser.email;
  loadUserPreferences();
  applyUserPreferences();
  await loadAllData();
  updatePendingBadges();
  initPWAExperience();
  const initialPage = new URLSearchParams(window.location.search).get('pending') === '1' ? 'pending' : 'dashboard';
  navigateTo(initialPage);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================
function showLoginTab() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-login').classList.add('active');
}

function showRegisterTab() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-register').classList.add('active');
}

function showForgotTab() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-form').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setLoading('login-btn', true);

  const { error } = await db.auth.signInWithPassword({ email, password });
  setLoading('login-btn', false);

  if (error) {
    showToast('E-mail ou senha incorretos', 'error');
  } else {
    showToast('Login realizado com sucesso!', 'success');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (password.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }

  setLoading('register-btn', true);
  const { error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  setLoading('register-btn', false);

  if (error) {
    showToast(error.message, 'error');
  } else {
    showToast('Conta criada! Verifique seu e-mail para confirmar.', 'success');
    showLoginTab();
  }
}

async function handleForgot(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  setLoading('forgot-btn', true);
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  setLoading('forgot-btn', false);
  if (error) {
    showToast(error.message, 'error');
  } else {
    showToast('Link de recuperação enviado para seu e-mail!', 'success');
    showLoginTab();
  }
}

async function handleLogout() {
  await db.auth.signOut();
  showToast('Até logo!', 'success');
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.remove('hidden');

  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

  const titleMap = {
    dashboard: 'Dashboard', transactions: 'Lançamentos', bills: 'Contas a Pagar',
    cards: 'Cartões', categories: 'Categorias', budgets: 'Metas e Orçamentos',
    reports: 'Relatórios', pending: 'Pendências', calendar: 'Calendário', settings: 'Configurações'
  };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titleMap[page] || 'Controle Financeiro';

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'bills': renderBills(); break;
    case 'cards': renderCards(); break;
    case 'categories': renderCategories(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': renderReports(); break;
    case 'pending': renderPendingReviews(); break;
    case 'calendar': renderCalendar(); break;
    case 'settings': renderSettings(); break;
  }

  // Fechar sidebar mobile
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// CARREGAR DADOS
// ============================================================
async function loadAllData() {
  await Promise.all([
    loadTransactions(),
    loadCategories(),
    loadCards(),
    loadBudgets(),
    loadGoals()
  ]);
}

async function loadTransactions() {
  const { data, error } = await db.from('transactions')
    .select('*, categories(name, icon, color)')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false });
  if (!error) allTransactions = data || [];
}

async function loadCategories() {
  const { data, error } = await db.from('categories')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('name');
  if (!error) allCategories = data || [];
}

async function loadCards() {
  const { data, error } = await db.from('credit_cards')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('name');
  if (!error) allCards = data || [];
}

async function loadBudgets() {
  const { data, error } = await db.from('budgets')
    .select('*, categories(name, icon, color)')
    .eq('user_id', currentUser.id);
  if (!error) allBudgets = data || [];
}

async function loadGoals() {
  const { data, error } = await db.from('goals')
    .select('*')
    .eq('user_id', currentUser.id);
  if (!error) allGoals = data || [];
}


// ============================================================
// V2 PREMIUM: FATURAS, ALERTAS E INTELIGÊNCIA
// ============================================================
function monthKeyFromDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getInvoiceMonthForPurchase(card, purchaseDateStr) {
  const d = new Date(purchaseDateStr + 'T00:00:00');
  const invoice = new Date(d);
  const closingDay = parseInt(card?.closing_day || 31);
  if (d.getDate() > closingDay) invoice.setMonth(invoice.getMonth() + 1);
  return { month: invoice.getMonth() + 1, year: invoice.getFullYear(), key: `${invoice.getFullYear()}-${String(invoice.getMonth() + 1).padStart(2, '0')}` };
}

function getInvoiceDueDate(card, invoiceMonth, invoiceYear) {
  const dueDay = Math.min(parseInt(card?.due_day || 10), 28);
  return new Date(invoiceYear, invoiceMonth - 1, dueDay).toISOString().split('T')[0];
}

function getCardInvoice(card, offset = 0) {
  const base = new Date(currentYear, currentMonth - 1 + offset, 1);
  const month = base.getMonth() + 1;
  const year = base.getFullYear();
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const txs = allTransactions.filter(t => {
    if (t.credit_card_id !== card.id || t.type !== 'expense') return false;
    return getInvoiceMonthForPurchase(card, t.date).key === key;
  });
  const total = txs.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const dueDate = getInvoiceDueDate(card, month, year);
  return { key, month, year, total, dueDate, txs };
}

async function payCardInvoice(cardId, offset = 0) {
  const card = allCards.find(c => c.id === cardId);
  if (!card) return;
  const invoice = getCardInvoice(card, offset);
  if (!invoice.txs.length) { showToast('Nenhuma compra nessa fatura', 'error'); return; }
  if (!confirm(`Marcar fatura de ${formatCurrency(invoice.total)} como paga?`)) return;
  const ids = invoice.txs.map(t => t.id);
  const { error } = await db.from('transactions').update({ status: 'paid' }).in('id', ids).eq('user_id', currentUser.id);
  if (error) { showToast('Erro ao pagar fatura', 'error'); return; }
  showToast('Fatura paga!', 'success');
  await loadTransactions();
  updatePendingBadges();
  renderCurrentPage();
}

function getFinancialAlerts() {
  const today = new Date(); today.setHours(0,0,0,0);
  const alerts = [];
  allTransactions.filter(t => t.type === 'expense' && t.status !== 'paid').forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) alerts.push({ type: 'danger', icon: '🚨', title: 'Conta vencida', text: `${t.description} venceu há ${Math.abs(diff)} dia(s): ${formatCurrency(t.amount)}` });
    else if (diff <= 2) alerts.push({ type: 'warning', icon: '⏰', title: 'Conta perto de vencer', text: `${t.description} vence ${diff === 0 ? 'hoje' : 'em ' + diff + ' dia(s)'}: ${formatCurrency(t.amount)}` });
  });
  allBudgets.filter(b => b.month === currentMonth && b.year === currentYear).forEach(b => {
    const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const spent = allTransactions.filter(t => t.category_id === b.category_id && t.type === 'expense' && t.status === 'paid' && monthKeyFromDate(t.date) === key).reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    const cat = allCategories.find(c => c.id === b.category_id);
    if (pct >= 100) alerts.push({ type: 'danger', icon: '🔥', title: 'Orçamento estourado', text: `${cat?.name || 'Categoria'} passou do limite: ${formatCurrency(spent)} / ${formatCurrency(b.amount)}` });
    else if (pct >= 80) alerts.push({ type: 'warning', icon: '⚠️', title: 'Orçamento quase no limite', text: `${cat?.name || 'Categoria'} já usou ${pct.toFixed(0)}% do orçamento.` });
  });
  return alerts.slice(0, 6);
}

function getSmartInsights(monthTxs) {
  const paidExpenses = monthTxs.filter(t => t.type === 'expense' && t.status === 'paid');
  const paidIncome = monthTxs.filter(t => t.type === 'income' && t.status === 'paid');
  const income = paidIncome.reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const expenses = paidExpenses.reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const today = new Date();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const elapsed = currentYear === today.getFullYear() && currentMonth === today.getMonth()+1 ? Math.max(1, today.getDate()) : daysInMonth;
  const projectedExpenses = expenses > 0 ? expenses / elapsed * daysInMonth : 0;
  const projectedBalance = income - projectedExpenses;
  const previousDate = new Date(currentYear, currentMonth - 2, 1);
  const prevKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth()+1).padStart(2,'0')}`;
  const prevExpenses = allTransactions.filter(t => t.type === 'expense' && t.status === 'paid' && monthKeyFromDate(t.date) === prevKey).reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const diffPct = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0;
  return { income, expenses, projectedExpenses, projectedBalance, prevExpenses, diffPct };
}

function renderPremiumInsights(monthTxs) {
  const wrap = document.getElementById('premium-insights');
  if (!wrap) return;
  const data = getSmartInsights(monthTxs);
  const alerts = getFinancialAlerts();
  wrap.innerHTML = `
    <div class="premium-panel">
      <div class="premium-panel-head">
        <div><div class="section-title">🧠 Inteligência financeira</div><div class="section-subtitle">Previsão, comparação e alertas do mês</div></div>
        <button class="btn-add btn-quick" onclick="openSmartQuickAdd()">⚡ Lançar inteligente</button>
      </div>
      <div class="insight-grid">
        <div class="insight-card"><span>Saldo previsto</span><strong class="${data.projectedBalance >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.projectedBalance)}</strong><small>estimativa para o fim do mês</small></div>
        <div class="insight-card"><span>Gasto previsto</span><strong>${formatCurrency(data.projectedExpenses)}</strong><small>se continuar nesse ritmo</small></div>
        <div class="insight-card"><span>Vs. mês passado</span><strong class="${data.diffPct <= 0 ? 'positive' : 'negative'}">${data.prevExpenses ? (data.diffPct > 0 ? '+' : '') + data.diffPct.toFixed(0) + '%' : '—'}</strong><small>${data.prevExpenses ? 'comparado ao mês anterior' : 'sem base anterior'}</small></div>
      </div>
      <div class="alerts-list">${alerts.length ? alerts.map(a => `<div class="alert-chip ${a.type}"><b>${a.icon} ${a.title}</b><span>${a.text}</span></div>`).join('') : `<div class="alert-chip success"><b>✅ Tudo tranquilo</b><span>Nenhum alerta crítico agora.</span></div>`} </div>
    </div>`;
}

function parseSmartText(raw) {
  const text = (raw || '').trim();
  const amountMatch = text.match(/(\d+(?:[\.,]\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
  let clean = text.replace(amountMatch?.[0] || '', '').trim();
  const normalizedFull = text.toLowerCase();

  let payment_method = null;
  const paymentRules = [
    ['pix', 'pix'], ['cartao', 'credit_card'], ['cartão', 'credit_card'], ['credito', 'credit_card'], ['crédito', 'credit_card'],
    ['debito', 'debit_card'], ['débito', 'debit_card'], ['dinheiro', 'money'], ['cash', 'money'], ['boleto', 'boleto']
  ];
  const payHit = paymentRules.find(([key]) => normalizedFull.includes(key));
  if (payHit) {
    payment_method = payHit[1];
    clean = clean.replace(new RegExp(payHit[0], 'ig'), '').trim();
  }

  const description = clean || 'Lançamento rápido';
  const normalized = description.toLowerCase();
  let category = allCategories.find(c => normalized.includes(c.name.toLowerCase()));
  if (!category) {
    const rules = [
      ['mercado','Mercado'],['supermercado','Mercado'],['compras','Mercado'],
      ['almoço','Alimentação'],['almoco','Alimentação'],['janta','Alimentação'],['lanche','Alimentação'],['café','Alimentação'],['cafe','Alimentação'],['ifood','Alimentação'],
      ['gasolina','Combustível'],['combustivel','Combustível'],['combustível','Combustível'],['posto','Combustível'],
      ['uber','Transporte'],['99','Transporte'],['onibus','Transporte'],['ônibus','Transporte'],
      ['academia','Academia'],['internet','Internet'],['energia','Energia'],['luz','Energia'],['água','Água'],['agua','Água'],
      ['netflix','Assinaturas'],['spotify','Assinaturas'],['assinatura','Assinaturas'],['farmacia','Saúde'],['farmácia','Saúde'],['remedio','Saúde']
    ];
    const hit = rules.find(([k]) => normalized.includes(k));
    if (hit) category = allCategories.find(c => c.name.toLowerCase() === hit[1].toLowerCase());
  }
  return { amount, description, category_id: category?.id || null, payment_method };
}

function openSmartQuickAdd() {
  const input = document.getElementById('smart-quick-input');
  const preview = document.getElementById('smart-quick-preview');
  if (input) input.value = '';
  if (preview) preview.innerHTML = 'Exemplo: <b>50 mercado</b> ou <b>18 café</b>';
  openModal('smart-quick-modal');
  setTimeout(() => input?.focus(), 150);
}

function updateSmartPreview() {
  const input = document.getElementById('smart-quick-input');
  const preview = document.getElementById('smart-quick-preview');
  if (!input || !preview) return;
  const data = parseSmartText(input.value);
  const cat = allCategories.find(c => c.id === data.category_id);
  preview.innerHTML = data.amount > 0 ? `Vai salvar: <b>${formatCurrency(data.amount)}</b> · ${data.description} · ${cat ? cat.icon + ' ' + cat.name : 'Sem categoria'}${data.payment_method ? ' · ' + paymentLabel(data.payment_method) : ''}` : 'Digite algo tipo: <b>50 mercado pix</b>';
}

async function saveSmartQuickAdd(e) {
  e.preventDefault();
  const input = document.getElementById('smart-quick-input');
  const paymentEl = document.getElementById('smart-quick-payment');
  const reviewEl = document.getElementById('smart-quick-review');
  const data = parseSmartText(input.value);
  if (!data.amount) { showToast('Digite o valor. Ex: 50 mercado', 'error'); return; }
  const payment_method = paymentEl?.value || 'pix';
  const needsReview = reviewEl?.checked !== false;
  const notes = needsReview ? makeReviewNotes('Lançamento rápido dentro do app') : 'Lançamento inteligente';
  const { error } = await db.from('transactions').insert({
    user_id: currentUser.id,
    type: 'expense',
    description: data.description,
    amount: data.amount,
    date: new Date().toISOString().split('T')[0],
    category_id: needsReview ? null : data.category_id,
    status: needsReview ? 'pending' : 'paid',
    payment_method,
    notes
  });
  if (error) { showToast('Erro ao salvar lançamento rápido', 'error'); return; }
  closeModal('smart-quick-modal');
  showToast(needsReview ? 'Salvo em Pendências!' : 'Lançamento inteligente salvo!', 'success');
  if (navigator.vibrate) navigator.vibrate(25);
  await loadTransactions();
  updatePendingBadges();
  renderCurrentPage();
}

async function enableBrowserNotifications() {
  if (!('Notification' in window)) { showToast('Este navegador não suporta notificações', 'error'); return; }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') { new Notification('Controle Financeiro', { body: 'Notificações ativadas neste aparelho ✅', icon: '/icon-192.png' }); showToast('Notificações ativadas!', 'success'); }
  else showToast('Notificação não permitida', 'error');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  updateMonthLabel();

  const monthTxs = allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const income = monthTxs.filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = monthTxs.filter(t => t.type === 'expense' && t.status === 'paid')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const pending = monthTxs.filter(t => t.status === 'pending')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const overdue = allTransactions.filter(t => t.status === 'overdue')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = income - expenses;
  const saving = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;

  // Cards
  document.getElementById('dash-balance').textContent = formatCurrency(balance);
  document.getElementById('dash-income').textContent = formatCurrency(income);
  document.getElementById('dash-expenses').textContent = formatCurrency(expenses);
  document.getElementById('dash-pending').textContent = formatCurrency(pending);
  document.getElementById('dash-overdue').textContent = formatCurrency(overdue);
  document.getElementById('dash-saving').textContent = saving + '%';

  // Cor do saldo
  const balanceEl = document.getElementById('dash-balance');
  balanceEl.className = balance >= 0 ? 'card-value positive' : 'card-value negative';

  // Cartões
  const cardExpenses = monthTxs.filter(t => t.payment_method === 'credit_card' && t.type === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  document.getElementById('dash-card-expenses').textContent = formatCurrency(cardExpenses);

  // Últimas transações
  const recentEl = document.getElementById('recent-transactions');
  const recent = monthTxs.slice(0, 5);
  if (recent.length === 0) {
    recentEl.innerHTML = emptyState('Nenhuma transação este mês', '💸');
  } else {
    recentEl.innerHTML = recent.map(t => transactionRow(t)).join('');
  }

  renderDashboardChart(monthTxs);
  renderPremiumInsights(monthTxs);
  updatePendingBadges();
}

function renderDashboardChart(txs) {
  const ctx = document.getElementById('dash-chart');
  if (!ctx) return;
  if (charts.dash) { charts.dash.destroy(); }

  // Gastos por categoria (top 5)
  const byCategory = {};
  txs.filter(t => t.type === 'expense' && t.status === 'paid').forEach(t => {
    const name = t.categories?.name || 'Outros';
    byCategory[name] = (byCategory[name] || 0) + parseFloat(t.amount);
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  charts.dash = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, padding: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed)}`
          }
        }
      },
      cutout: '65%'
    }
  });
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  updateMonthLabel();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'transactions') renderTransactions();
  if (currentPage === 'bills') renderBills();
  if (currentPage === 'budgets') renderBudgets();
  if (currentPage === 'reports') renderReports();
  if (currentPage === 'calendar') renderCalendar();
  if (currentPage === 'pending') renderPendingReviews();
}

function updateMonthLabel() {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const label = `${months[currentMonth - 1]} ${currentYear}`;
  document.querySelectorAll('.month-label').forEach(el => el.textContent = label);
}

// ============================================================
// TRANSAÇÕES
// ============================================================
function renderTransactions() {
  updateMonthLabel();
  const search = (document.getElementById('tx-search')?.value || '').toLowerCase();
  const filterType = document.getElementById('tx-filter-type')?.value || '';
  const filterStatus = document.getElementById('tx-filter-status')?.value || '';
  const filterCat = document.getElementById('tx-filter-cat')?.value || '';

  let txs = allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  if (search) txs = txs.filter(t => t.description.toLowerCase().includes(search) || (t.notes || '').toLowerCase().includes(search));
  if (filterType) txs = txs.filter(t => t.type === filterType);
  if (filterStatus) txs = txs.filter(t => t.status === filterStatus);
  if (filterCat) txs = txs.filter(t => t.category_id === filterCat);

  // Popula filtro de categoria
  const catSelect = document.getElementById('tx-filter-cat');
  if (catSelect) {
    const current = catSelect.value;
    catSelect.innerHTML = '<option value="">Todas categorias</option>' +
      allCategories.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
    catSelect.value = current;
  }

  const listEl = document.getElementById('transactions-list');
  if (txs.length === 0) {
    listEl.innerHTML = emptyState('Nenhuma transação encontrada', '📋');
    return;
  }

  // Agrupar por data
  const groups = {};
  txs.forEach(t => {
    const key = t.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  listEl.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => `
      <div class="tx-date-group">
        <div class="tx-date-header">${formatDateBR(date)}</div>
        ${items.map(t => transactionRow(t)).join('')}
      </div>
    `).join('');
}

function transactionRow(t) {
  const icon = t.categories?.icon || '📦';
  const catName = t.categories?.name || 'Sem categoria';
  const color = t.categories?.color || '#6366f1';
  const sign = t.type === 'income' ? '+' : '-';
  const amountClass = t.type === 'income' ? 'positive' : 'negative';
  const statusBadge = statusLabel(t.status);

  return `
    <div class="tx-row" onclick="openEditTransaction('${t.id}')">
      <div class="tx-icon" style="background:${color}20;color:${color}">${icon}</div>
      <div class="tx-info">
        <div class="tx-description">${t.description}</div>
        <div class="tx-meta">${catName} · ${paymentLabel(t.payment_method)} ${statusBadge}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${amountClass}">${sign} ${formatCurrency(t.amount)}</div>
        <button class="tx-delete-btn" onclick="event.stopPropagation();confirmDelete('transaction','${t.id}')">✕</button>
      </div>
    </div>
  `;
}

function statusLabel(status) {
  const map = { paid: '<span class="badge badge-paid">Pago</span>', pending: '<span class="badge badge-pending">Pendente</span>', overdue: '<span class="badge badge-overdue">Vencido</span>' };
  return map[status] || '';
}

function paymentLabel(method) {
  const map = { money: 'Dinheiro', credit_card: 'Cartão Crédito', debit_card: 'Cartão Débito', pix: 'PIX', transfer: 'Transferência', boleto: 'Boleto', other: 'Outro' };
  return map[method] || method;
}

// Modal de transação
function openNewTransaction(type = 'expense') {
  document.getElementById('tx-modal-title').textContent = type === 'income' ? 'Nova Receita' : 'Nova Despesa';
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-type').value = type;
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-status').value = 'paid';
  document.getElementById('tx-payment').value = 'money';
  document.getElementById('tx-notes').value = '';
  document.getElementById('tx-installments').value = '1';
  document.getElementById('tx-card-group').style.display = 'none';

  populateCategorySelect(type);
  toggleInstallmentsGroup();
  openModal('tx-modal');
}

async function openEditTransaction(id) {
  const t = allTransactions.find(x => x.id === id);
  if (!t) return;

  document.getElementById('tx-modal-title').textContent = 'Editar Lançamento';
  document.getElementById('tx-id').value = t.id;
  document.getElementById('tx-type').value = t.type;
  document.getElementById('tx-description').value = t.description;
  document.getElementById('tx-amount').value = formatAmountInput(t.amount);
  document.getElementById('tx-date').value = t.date;
  document.getElementById('tx-status').value = t.status;
  document.getElementById('tx-payment').value = t.payment_method;
  document.getElementById('tx-notes').value = cleanReviewNotes(t.notes || '');
  document.getElementById('tx-installments').value = '1';

  populateCategorySelect(t.type, t.category_id);
  toggleInstallmentsGroup();
  document.getElementById('tx-installments-group').style.display = 'none';

  // Cartão
  if (t.payment_method === 'credit_card') {
    document.getElementById('tx-card-group').style.display = 'block';
    populateCardSelect(t.credit_card_id);
  }

  openModal('tx-modal');
}

function populateCategorySelect(type, selectedId = null) {
  const cats = allCategories.filter(c => c.type === type || c.type === 'both');
  const sel = document.getElementById('tx-category');
  sel.innerHTML = '<option value="">Sem categoria</option>' +
    cats.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
}

function populateCardSelect(selectedId = null) {
  const sel = document.getElementById('tx-card');
  sel.innerHTML = '<option value="">Selecione o cartão</option>' +
    allCards.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

function onPaymentChange() {
  const val = document.getElementById('tx-payment').value;
  document.getElementById('tx-card-group').style.display = val === 'credit_card' ? 'block' : 'none';
  populateCardSelect();
  toggleInstallmentsGroup();
}

function toggleInstallmentsGroup() {
  const payment = document.getElementById('tx-payment').value;
  const isNew = !document.getElementById('tx-id').value;
  document.getElementById('tx-installments-group').style.display =
    (payment === 'credit_card' && isNew) ? 'block' : 'none';
}

async function saveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('tx-id').value;
  const type = document.getElementById('tx-type').value;
  const description = document.getElementById('tx-description').value.trim();
  const amount = parseCurrency(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const category_id = document.getElementById('tx-category').value || null;
  const status = document.getElementById('tx-status').value;
  const payment_method = document.getElementById('tx-payment').value;
  const credit_card_id = document.getElementById('tx-card').value || null;
  const notes = document.getElementById('tx-notes').value.trim();
  const installments = parseInt(document.getElementById('tx-installments')?.value || '1');

  if (!description || !amount || !date) {
    showToast('Preencha os campos obrigatórios', 'error');
    return;
  }

  setLoading('tx-save-btn', true);

  if (id) {
    // Editar existente
    const { error } = await db.from('transactions').update({
      type, description, amount, date, category_id, status,
      payment_method, credit_card_id, notes
    }).eq('id', id);
    if (error) { showToast('Erro ao salvar', 'error'); }
    else { showToast('Lançamento atualizado!', 'success'); if (navigator.vibrate) navigator.vibrate(20); }
  } else {
    // Criar novo (com parcelamento se for cartão)
    if (installments > 1 && payment_method === 'credit_card') {
      const groupId = crypto.randomUUID();
      const totalInstallments = Number.isFinite(installments) && installments > 1 ? installments : 1;
      const amountInCents = Math.round(amount * 100);
      const baseParcelCents = Math.floor(amountInCents / totalInstallments);
      const remainderCents = amountInCents - (baseParcelCents * totalInstallments);
      const rows = [];

      for (let i = 0; i < totalInstallments; i++) {
        const d = new Date(date + 'T00:00:00');
        d.setMonth(d.getMonth() + i);

        const numeroParcela = i + 1;
        const parcelCents = baseParcelCents + (i === totalInstallments - 1 ? remainderCents : 0);
        const installmentLabel = `${String(numeroParcela).padStart(2, '0')}/${String(totalInstallments).padStart(2, '0')}`;

        rows.push({
          user_id: currentUser.id,
          type,
          category_id,
          status: i === 0 ? status : 'pending',
          payment_method,
          credit_card_id,
          notes,
          description: `${description} (${installmentLabel})`,
          amount: parcelCents / 100,
          date: d.toISOString().split('T')[0],
          is_installment: true,
          installment_number: numeroParcela,
          installment_total: totalInstallments,
          installment_group_id: groupId
        });
      }
      const { error } = await db.from('transactions').insert(rows);
      if (error) { showToast('Erro ao criar parcelas', 'error'); }
      else { showToast(`${installments} parcelas criadas!`, 'success'); }
    } else {
      const { error } = await db.from('transactions').insert({
        user_id: currentUser.id, type, description, amount, date,
        category_id, status, payment_method, credit_card_id, notes
      });
      if (error) { showToast('Erro ao salvar', 'error'); }
      else { showToast('Lançamento salvo!', 'success'); }
    }
  }

  setLoading('tx-save-btn', false);
  closeModal('tx-modal');
  await loadTransactions();
  renderCurrentPage();
}

// ============================================================
// CONTAS A PAGAR
// ============================================================
function renderBills() {
  updateMonthLabel();
  // Atualizar status vencido
  const today = new Date().toISOString().split('T')[0];

  const bills = allTransactions.filter(t =>
    t.type === 'expense' &&
    (t.status === 'pending' || t.status === 'overdue') &&
    (
      (new Date(t.date + 'T00:00:00').getMonth() + 1 === currentMonth &&
       new Date(t.date + 'T00:00:00').getFullYear() === currentYear) ||
      t.status === 'overdue'
    )
  ).sort((a, b) => a.date.localeCompare(b.date));

  const overdueBills = bills.filter(t => t.date < today || t.status === 'overdue');
  const pendingBills = bills.filter(t => t.date >= today && t.status === 'pending');

  const totalPending = bills.reduce((s, t) => s + parseFloat(t.amount), 0);
  document.getElementById('bills-total').textContent = formatCurrency(totalPending);
  document.getElementById('bills-count').textContent = bills.length + ' conta(s)';

  const listEl = document.getElementById('bills-list');
  if (bills.length === 0) {
    listEl.innerHTML = emptyState('Nenhuma conta pendente 🎉', '✅');
    return;
  }

  let html = '';
  if (overdueBills.length > 0) {
    html += `<div class="bills-section-title overdue">🔴 Vencidas (${overdueBills.length})</div>`;
    html += overdueBills.map(t => billRow(t, true)).join('');
  }
  if (pendingBills.length > 0) {
    html += `<div class="bills-section-title">🟡 Pendentes (${pendingBills.length})</div>`;
    html += pendingBills.map(t => billRow(t, false)).join('');
  }
  listEl.innerHTML = html;
}

function billRow(t, isOverdue) {
  const icon = t.categories?.icon || '📦';
  const catName = t.categories?.name || 'Sem categoria';
  const daysLabel = getDaysLabel(t.date);

  return `
    <div class="bill-row ${isOverdue ? 'overdue' : ''}">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info">
        <div class="tx-description">${t.description}</div>
        <div class="tx-meta">${catName} · Venc: ${formatDateBR(t.date)} · ${daysLabel}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount negative">- ${formatCurrency(t.amount)}</div>
        <button class="btn-pay" onclick="markAsPaid('${t.id}')">✓ Pagar</button>
      </div>
    </div>
  `;
}

function getDaysLabel(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return `<span style="color:var(--danger)">Venceu há ${Math.abs(diff)} dia(s)</span>`;
  if (diff === 0) return `<span style="color:var(--warning)">Vence hoje</span>`;
  return `Em ${diff} dia(s)`;
}

async function markAsPaid(id) {
  const { error } = await db.from('transactions').update({ status: 'paid' }).eq('id', id);
  if (error) { showToast('Erro ao marcar como pago', 'error'); return; }
  showToast('Marcado como pago!', 'success');
  await loadTransactions();
  renderBills();
  if (currentPage === 'dashboard') renderDashboard();
}

// ============================================================
// CARTÕES DE CRÉDITO
// ============================================================
function renderCards() {
  const listEl = document.getElementById('cards-list');
  if (allCards.length === 0) { listEl.innerHTML = emptyState('Nenhum cartão cadastrado', '💳'); return; }
  listEl.innerHTML = allCards.map(card => {
    const currentInvoice = getCardInvoice(card, 0);
    const nextInvoice = getCardInvoice(card, 1);
    const usedLimit = allTransactions.filter(t => t.credit_card_id === card.id && t.type === 'expense' && t.status !== 'paid').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const available = parseFloat(card.credit_limit || 0) - usedLimit;
    const pct = card.credit_limit > 0 ? Math.min(100, (usedLimit / card.credit_limit) * 100).toFixed(0) : 0;
    const barColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)';
    return `
      <div class="card-item premium-credit-card" style="background: linear-gradient(135deg, ${card.color}, ${card.color}aa)">
        <div class="card-glow"></div>
        <div class="card-header-row"><div class="card-name">${card.name}</div><div class="card-brand">${brandIcon(card.brand)}</div></div>
        <div class="card-limit-row"><span>Limite: ${formatCurrency(card.credit_limit)}</span><span>Disponível: ${formatCurrency(available)}</span></div>
        <div class="card-progress-bar"><div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="invoice-grid">
          <div class="invoice-box"><small>Fatura atual · vence ${formatDateBR(currentInvoice.dueDate)}</small><strong>${formatCurrency(currentInvoice.total)}</strong><button class="mini-pay-btn" onclick="payCardInvoice('${card.id}',0)">Pagar fatura</button></div>
          <div class="invoice-box muted"><small>Próxima fatura</small><strong>${formatCurrency(nextInvoice.total)}</strong><span>${nextInvoice.txs.length} compra(s)</span></div>
        </div>
        <div class="card-actions-row"><span class="card-dates">Fecha dia ${card.closing_day} · Vence dia ${card.due_day}</span><div><button class="btn-icon" onclick="openEditCard('${card.id}')">✏️</button><button class="btn-icon" onclick="confirmDelete('card','${card.id}')">🗑️</button></div></div>
      </div>
    `;
  }).join('');
}

function getCardPeriodStart(card, today) {
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  if (today.getDate() > card.closing_day) {
    // Próxima fatura começa no dia de fechamento deste mês
    const d = new Date(year, month - 1, card.closing_day + 1);
    return d.toISOString().split('T')[0];
  } else {
    // Fatura atual começou no fechamento do mês anterior
    const d = new Date(year, month - 2, card.closing_day + 1);
    return d.toISOString().split('T')[0];
  }
}

function getCardPeriodEnd(card, today) {
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  if (today.getDate() > card.closing_day) {
    const d = new Date(year, month, card.closing_day);
    return d.toISOString().split('T')[0];
  } else {
    const d = new Date(year, month - 1, card.closing_day);
    return d.toISOString().split('T')[0];
  }
}

function brandIcon(brand) {
  const map = { visa: '💳 VISA', mastercard: '💳 MC', elo: '💳 ELO', amex: '💳 AMEX', hipercard: '💳 HIPER', other: '💳' };
  return map[brand] || '💳';
}

function openNewCard() {
  document.getElementById('card-modal-title').textContent = 'Novo Cartão';
  document.getElementById('card-id').value = '';
  document.getElementById('card-name').value = '';
  document.getElementById('card-brand').value = 'visa';
  document.getElementById('card-limit').value = '';
  document.getElementById('card-closing').value = '';
  document.getElementById('card-due').value = '';
  document.getElementById('card-color').value = '#6366f1';
  openModal('card-modal');
}

function openEditCard(id) {
  const card = allCards.find(c => c.id === id);
  if (!card) return;
  document.getElementById('card-modal-title').textContent = 'Editar Cartão';
  document.getElementById('card-id').value = card.id;
  document.getElementById('card-name').value = card.name;
  document.getElementById('card-brand').value = card.brand;
  document.getElementById('card-limit').value = formatAmountInput(card.credit_limit);
  document.getElementById('card-closing').value = card.closing_day;
  document.getElementById('card-due').value = card.due_day;
  document.getElementById('card-color').value = card.color;
  openModal('card-modal');
}

async function saveCard(e) {
  e.preventDefault();
  const id = document.getElementById('card-id').value;
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('card-name').value.trim(),
    brand: document.getElementById('card-brand').value,
    credit_limit: parseCurrency(document.getElementById('card-limit').value),
    closing_day: parseInt(document.getElementById('card-closing').value),
    due_day: parseInt(document.getElementById('card-due').value),
    color: document.getElementById('card-color').value
  };

  setLoading('card-save-btn', true);
  let error;
  if (id) {
    ({ error } = await db.from('credit_cards').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('credit_cards').insert(payload));
  }
  setLoading('card-save-btn', false);

  if (error) { showToast('Erro ao salvar cartão', 'error'); }
  else {
    showToast(id ? 'Cartão atualizado!' : 'Cartão criado!', 'success');
    closeModal('card-modal');
    await loadCards();
    renderCards();
  }
}

// ============================================================
// CATEGORIAS
// ============================================================
function renderCategories() {
  const listEl = document.getElementById('categories-list');
  if (allCategories.length === 0) {
    listEl.innerHTML = emptyState('Nenhuma categoria cadastrada', '🏷️');
    return;
  }

  const income = allCategories.filter(c => c.type === 'income');
  const expense = allCategories.filter(c => c.type === 'expense');
  const both = allCategories.filter(c => c.type === 'both');

  let html = '';
  if (expense.length > 0) {
    html += `<div class="cat-section-title">💸 Despesas</div>`;
    html += expense.map(c => categoryRow(c)).join('');
  }
  if (income.length > 0) {
    html += `<div class="cat-section-title">💰 Receitas</div>`;
    html += income.map(c => categoryRow(c)).join('');
  }
  if (both.length > 0) {
    html += `<div class="cat-section-title">🔄 Ambos</div>`;
    html += both.map(c => categoryRow(c)).join('');
  }
  listEl.innerHTML = html;
}

function categoryRow(c) {
  return `
    <div class="category-row">
      <div class="cat-icon" style="background:${c.color}20;color:${c.color}">${c.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${c.name}</div>
        <div class="cat-type">${c.type === 'income' ? 'Receita' : c.type === 'expense' ? 'Despesa' : 'Ambos'}</div>
      </div>
      <div class="cat-actions">
        <button class="btn-icon" onclick="openEditCategory('${c.id}')">✏️</button>
        ${!c.is_default ? `<button class="btn-icon" onclick="confirmDelete('category','${c.id}')">🗑️</button>` : ''}
      </div>
    </div>
  `;
}

function openNewCategory() {
  document.getElementById('cat-modal-title').textContent = 'Nova Categoria';
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-type').value = 'expense';
  document.getElementById('cat-icon').value = '📦';
  document.getElementById('cat-color').value = '#6366f1';
  openModal('cat-modal');
}

function openEditCategory(id) {
  const c = allCategories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cat-modal-title').textContent = 'Editar Categoria';
  document.getElementById('cat-id').value = c.id;
  document.getElementById('cat-name').value = c.name;
  document.getElementById('cat-type').value = c.type;
  document.getElementById('cat-icon').value = c.icon;
  document.getElementById('cat-color').value = c.color;
  openModal('cat-modal');
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('cat-id').value;
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('cat-name').value.trim(),
    type: document.getElementById('cat-type').value,
    icon: document.getElementById('cat-icon').value.trim() || '📦',
    color: document.getElementById('cat-color').value
  };

  setLoading('cat-save-btn', true);
  let error;
  if (id) {
    ({ error } = await db.from('categories').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('categories').insert(payload));
  }
  setLoading('cat-save-btn', false);

  if (error) { showToast('Erro ao salvar categoria', 'error'); }
  else {
    showToast(id ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
    closeModal('cat-modal');
    await loadCategories();
    renderCategories();
  }
}

// ============================================================
// ORÇAMENTOS E METAS
// ============================================================
function renderBudgets() {
  updateMonthLabel();
  renderBudgetsList();
  renderGoalsList();
}

function renderBudgetsList() {
  const listEl = document.getElementById('budgets-list');
  const monthBudgets = allBudgets.filter(b => b.month === currentMonth && b.year === currentYear);

  if (monthBudgets.length === 0) {
    listEl.innerHTML = emptyState('Nenhum orçamento para este mês', '🎯');
    return;
  }

  listEl.innerHTML = monthBudgets.map(b => {
    const cat = allCategories.find(c => c.id === b.category_id);
    const spent = allTransactions.filter(t =>
      t.category_id === b.category_id &&
      t.type === 'expense' &&
      t.status === 'paid' &&
      new Date(t.date + 'T00:00:00').getMonth() + 1 === currentMonth &&
      new Date(t.date + 'T00:00:00').getFullYear() === currentYear
    ).reduce((s, t) => s + parseFloat(t.amount), 0);

    const pct = Math.min(100, (spent / b.amount) * 100).toFixed(0);
    const isOver = spent > b.amount;
    const isAlert = pct >= 80 && !isOver;
    const barColor = isOver ? 'var(--danger)' : isAlert ? 'var(--warning)' : 'var(--success)';

    return `
      <div class="budget-row ${isOver ? 'over-budget' : ''}">
        <div class="budget-header">
          <div class="budget-cat">
            <span>${cat?.icon || '📦'}</span>
            <span>${cat?.name || 'Categoria'}</span>
          </div>
          <div class="budget-amounts">
            <span class="${isOver ? 'negative' : ''}">${formatCurrency(spent)}</span>
            <span class="budget-limit"> / ${formatCurrency(b.amount)}</span>
          </div>
        </div>
        <div class="budget-progress-bar">
          <div style="width:${pct}%;background:${barColor};height:6px;border-radius:3px;transition:width .4s"></div>
        </div>
        <div class="budget-footer">
          ${isOver ? `<span class="budget-alert danger">⚠️ Orçamento estourado!</span>` :
            isAlert ? `<span class="budget-alert warning">⚠️ Atenção: ${pct}% utilizado</span>` :
            `<span>${pct}% utilizado</span>`}
          <div>
            <button class="btn-icon" onclick="openEditBudget('${b.id}')">✏️</button>
            <button class="btn-icon" onclick="confirmDelete('budget','${b.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderGoalsList() {
  const listEl = document.getElementById('goals-list');
  const monthGoals = allGoals.filter(g => g.month === currentMonth && g.year === currentYear);

  if (monthGoals.length === 0) {
    listEl.innerHTML = emptyState('Nenhuma meta para este mês', '🏆');
    return;
  }

  listEl.innerHTML = monthGoals.map(g => {
    const pct = Math.min(100, (g.current_amount / g.target_amount) * 100).toFixed(0);
    const reached = g.current_amount >= g.target_amount;

    return `
      <div class="goal-row">
        <div class="goal-header">
          <div class="goal-name">${g.name} ${reached ? '🏆' : ''}</div>
          <div>
            <span>${formatCurrency(g.current_amount)}</span>
            <span class="budget-limit"> / ${formatCurrency(g.target_amount)}</span>
          </div>
        </div>
        <div class="budget-progress-bar">
          <div style="width:${pct}%;background:${g.color};height:8px;border-radius:4px;transition:width .4s"></div>
        </div>
        <div class="budget-footer">
          <span>${pct}% alcançado</span>
          <div>
            <button class="btn-icon" onclick="openEditGoal('${g.id}')">✏️</button>
            <button class="btn-icon" onclick="confirmDelete('goal','${g.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openNewBudget() {
  document.getElementById('budget-modal-title').textContent = 'Novo Orçamento';
  document.getElementById('budget-id').value = '';
  document.getElementById('budget-amount').value = '';
  document.getElementById('budget-month').value = currentMonth;
  document.getElementById('budget-year').value = currentYear;

  const sel = document.getElementById('budget-category');
  sel.innerHTML = '<option value="">Selecione a categoria</option>' +
    allCategories.filter(c => c.type === 'expense' || c.type === 'both')
      .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  openModal('budget-modal');
}

function openEditBudget(id) {
  const b = allBudgets.find(x => x.id === id);
  if (!b) return;
  document.getElementById('budget-modal-title').textContent = 'Editar Orçamento';
  document.getElementById('budget-id').value = b.id;
  document.getElementById('budget-amount').value = formatAmountInput(b.amount);
  document.getElementById('budget-month').value = b.month;
  document.getElementById('budget-year').value = b.year;

  const sel = document.getElementById('budget-category');
  sel.innerHTML = '<option value="">Selecione a categoria</option>' +
    allCategories.filter(c => c.type === 'expense' || c.type === 'both')
      .map(c => `<option value="${c.id}" ${c.id === b.category_id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');

  openModal('budget-modal');
}

async function saveBudget(e) {
  e.preventDefault();
  const id = document.getElementById('budget-id').value;
  const payload = {
    user_id: currentUser.id,
    category_id: document.getElementById('budget-category').value || null,
    amount: parseCurrency(document.getElementById('budget-amount').value),
    month: parseInt(document.getElementById('budget-month').value),
    year: parseInt(document.getElementById('budget-year').value)
  };

  setLoading('budget-save-btn', true);
  let error;
  if (id) {
    ({ error } = await db.from('budgets').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('budgets').insert(payload));
  }
  setLoading('budget-save-btn', false);

  if (error) { showToast('Erro ao salvar orçamento', 'error'); }
  else {
    showToast(id ? 'Orçamento atualizado!' : 'Orçamento criado!', 'success');
    closeModal('budget-modal');
    await loadBudgets();
    renderBudgets();
  }
}

function openNewGoal() {
  document.getElementById('goal-modal-title').textContent = 'Nova Meta';
  document.getElementById('goal-id').value = '';
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '';
  document.getElementById('goal-month').value = currentMonth;
  document.getElementById('goal-year').value = currentYear;
  document.getElementById('goal-color').value = '#10b981';
  openModal('goal-modal');
}

function openEditGoal(id) {
  const g = allGoals.find(x => x.id === id);
  if (!g) return;
  document.getElementById('goal-modal-title').textContent = 'Editar Meta';
  document.getElementById('goal-id').value = g.id;
  document.getElementById('goal-name').value = g.name;
  document.getElementById('goal-target').value = formatAmountInput(g.target_amount);
  document.getElementById('goal-current').value = formatAmountInput(g.current_amount);
  document.getElementById('goal-month').value = g.month;
  document.getElementById('goal-year').value = g.year;
  document.getElementById('goal-color').value = g.color;
  openModal('goal-modal');
}

async function saveGoal(e) {
  e.preventDefault();
  const id = document.getElementById('goal-id').value;
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('goal-name').value.trim(),
    target_amount: parseCurrency(document.getElementById('goal-target').value),
    current_amount: parseCurrency(document.getElementById('goal-current').value),
    month: parseInt(document.getElementById('goal-month').value),
    year: parseInt(document.getElementById('goal-year').value),
    color: document.getElementById('goal-color').value
  };

  setLoading('goal-save-btn', true);
  let error;
  if (id) {
    ({ error } = await db.from('goals').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('goals').insert(payload));
  }
  setLoading('goal-save-btn', false);

  if (error) { showToast('Erro ao salvar meta', 'error'); }
  else {
    showToast(id ? 'Meta atualizada!' : 'Meta criada!', 'success');
    closeModal('goal-modal');
    await loadGoals();
    renderBudgets();
  }
}


// ============================================================
// PENDÊNCIAS DE LANÇAMENTO RÁPIDO
// ============================================================
const REVIEW_MARKER = '[PENDENCIA_REVISAO]';

function makeReviewNotes(extra = '') {
  return `${REVIEW_MARKER} ${extra}`.trim();
}

function isReviewPending(t) {
  return (t.notes || '').includes(REVIEW_MARKER);
}

function cleanReviewNotes(notes = '') {
  return notes.replace(REVIEW_MARKER, '').replace('Lançamento rápido dentro do app', '').replace('Atalho rápido iPhone', '').trim();
}

function getPendingReviews() {
  return allTransactions
    .filter(isReviewPending)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function updatePendingBadges() {
  const count = getPendingReviews().length;
  const nav = document.getElementById('pending-nav-count');
  const action = document.getElementById('pending-action-count');
  if (nav) { nav.textContent = count; nav.style.display = count ? 'inline-flex' : 'none'; }
  if (action) action.textContent = count ? `(${count})` : '';
}

function renderPendingReviews() {
  updatePendingBadges();
  const pending = getPendingReviews();
  const total = pending.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalEl = document.getElementById('pending-total');
  const countEl = document.getElementById('pending-count');
  const listEl = document.getElementById('pending-list');
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (countEl) countEl.textContent = pending.length;
  if (!listEl) return;

  if (!pending.length) {
    listEl.innerHTML = `
      <div class="section-card empty-pending-card">
        <div class="empty-icon">✅</div>
        <div class="section-title">Nenhuma pendência</div>
        <p class="settings-text">Tudo revisado. Quando você usar a tela rápida do iPhone, os lançamentos vão aparecer aqui.</p>
        <button class="btn-add btn-quick" onclick="openQuickCapture()">⚡ Testar lançamento rápido</button>
      </div>`;
    return;
  }

  listEl.innerHTML = pending.map(t => {
    const icon = paymentLabel(t.payment_method).includes('Cartão') ? '💳' : t.payment_method === 'pix' ? '💸' : '💵';
    return `
      <div class="section-card pending-review-row">
        <div class="pending-review-main">
          <div class="pending-review-icon">${icon}</div>
          <div>
            <div class="tx-description">${t.description}</div>
            <div class="tx-meta">${formatDateBR(t.date)} · ${paymentLabel(t.payment_method)} · aguardando categoria/status</div>
          </div>
        </div>
        <div class="pending-review-actions">
          <strong class="negative">- ${formatCurrency(t.amount)}</strong>
          <button class="btn-primary" onclick="openReviewTransaction('${t.id}')">Completar</button>
          <button class="btn-secondary" onclick="markReviewDone('${t.id}')">OK rápido</button>
          <button class="btn-icon" onclick="confirmDelete('transaction','${t.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function openReviewTransaction(id) {
  openEditTransaction(id);
  setTimeout(() => {
    const title = document.getElementById('tx-modal-title');
    if (title) title.textContent = 'Completar pendência';
  }, 50);
}

async function markReviewDone(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;
  const { error } = await db.from('transactions').update({
    notes: cleanReviewNotes(tx.notes || ''),
    status: tx.status === 'pending' ? 'paid' : tx.status
  }).eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast('Erro ao concluir pendência', 'error'); return; }
  showToast('Pendência concluída!', 'success');
  if (navigator.vibrate) navigator.vibrate(25);
  await loadTransactions();
  renderPendingReviews();
}

function openQuickCapture() {
  window.open('quick.html', '_blank');
}

function showQuickShortcutGuide() {
  const url = `${window.location.origin}/quick.html`;
  alert(`Atalho rápido do iPhone:\n\n1. Abra esta tela no Safari:\n${url}\n\n2. Toque no botão compartilhar\n3. Toque em “Adicionar à Tela de Início”\n4. Dê o nome: Lançar Gasto\n\nDepois é só tocar nesse ícone, preencher valor + descrição + pagamento e confirmar. Ele aparece em Pendências no app principal.`);
}

// ============================================================
// RELATÓRIOS
// ============================================================
function renderReports() {
  updateMonthLabel();
  const monthTxs = allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const income = monthTxs.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = monthTxs.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + parseFloat(t.amount), 0);

  document.getElementById('report-income').textContent = formatCurrency(income);
  document.getElementById('report-expenses').textContent = formatCurrency(expenses);
  document.getElementById('report-balance').textContent = formatCurrency(income - expenses);

  renderPieChart(monthTxs);
  renderBarChart();
  renderTopExpenses(monthTxs);
}

function renderPieChart(txs) {
  const ctx = document.getElementById('report-pie');
  if (!ctx) return;
  if (charts.pie) charts.pie.destroy();

  const byCategory = {};
  txs.filter(t => t.type === 'expense' && t.status === 'paid').forEach(t => {
    const name = t.categories?.name || 'Outros';
    const color = t.categories?.color || '#6366f1';
    if (!byCategory[name]) byCategory[name] = { value: 0, color };
    byCategory[name].value += parseFloat(t.amount);
  });

  const entries = Object.entries(byCategory).sort((a, b) => b[1].value - a[1].value);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  charts.pie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v.value),
        backgroundColor: entries.map(([, v]) => v.color),
        borderWidth: 2,
        borderColor: isDark ? '#1e293b' : '#ffffff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.parsed)}` } }
      }
    }
  });
}

function renderBarChart() {
  const ctx = document.getElementById('report-bar');
  if (!ctx) return;
  if (charts.bar) charts.bar.destroy();

  // Últimos 6 meses
  const months = [];
  const incomes = [];
  const expensesList = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    months.push(monthNames[m - 1] + '/' + String(y).slice(2));

    const txs = allTransactions.filter(t => {
      const td = new Date(t.date + 'T00:00:00');
      return td.getMonth() + 1 === m && td.getFullYear() === y && t.status === 'paid';
    });
    incomes.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0));
    expensesList.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0));
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Receitas', data: incomes, backgroundColor: '#10b98133', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
        { label: 'Despesas', data: expensesList, backgroundColor: '#ef444433', borderColor: '#ef4444', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => 'R$ ' + (v/1000).toFixed(0) + 'k' } }
      }
    }
  });
}

function renderTopExpenses(txs) {
  const listEl = document.getElementById('top-expenses');
  const byCategory = {};
  txs.filter(t => t.type === 'expense' && t.status === 'paid').forEach(t => {
    const name = t.categories?.name || 'Outros';
    const icon = t.categories?.icon || '📦';
    const color = t.categories?.color || '#6366f1';
    if (!byCategory[name]) byCategory[name] = { total: 0, icon, color };
    byCategory[name].total += parseFloat(t.amount);
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  const max = sorted[0]?.[1].total || 1;

  if (sorted.length === 0) {
    listEl.innerHTML = emptyState('Nenhuma despesa', '📊');
    return;
  }

  listEl.innerHTML = sorted.map(([name, data], i) => {
    const pct = (data.total / max * 100).toFixed(0);
    return `
      <div class="top-expense-row">
        <div class="top-rank">${i + 1}</div>
        <div class="top-icon" style="background:${data.color}20;color:${data.color}">${data.icon}</div>
        <div class="top-info">
          <div class="top-name">${name}</div>
          <div class="top-bar-wrap">
            <div class="top-bar" style="width:${pct}%;background:${data.color}"></div>
          </div>
        </div>
        <div class="top-amount">${formatCurrency(data.total)}</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// DELETE CONFIRMAÇÃO
// ============================================================
function confirmDelete(type, id) {
  document.getElementById('confirm-delete-btn').onclick = () => doDelete(type, id);
  openModal('confirm-modal');
}

async function doDelete(type, id) {
  closeModal('confirm-modal');

  let error;

  if (type === 'transaction') {
    const tx = allTransactions.find(t => t.id === id);

    if (tx?.is_installment && tx?.installment_group_id) {
      const apagarTodas = confirm(
        'Essa compra é parcelada. Deseja apagar TODAS as parcelas dessa compra?'
      );

      if (apagarTodas) {
        ({ error } = await db
          .from('transactions')
          .delete()
          .eq('installment_group_id', tx.installment_group_id)
          .eq('user_id', currentUser.id));
      } else {
        ({ error } = await db
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUser.id));
      }
    } else {
      ({ error } = await db
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id));
    }

  } else if (type === 'card') {
    ({ error } = await db.from('credit_cards').delete().eq('id', id));
  } else if (type === 'category') {
    ({ error } = await db.from('categories').delete().eq('id', id));
  } else if (type === 'budget') {
    ({ error } = await db.from('budgets').delete().eq('id', id));
  } else if (type === 'goal') {
    ({ error } = await db.from('goals').delete().eq('id', id));
  }

  if (error) {
    showToast('Erro ao excluir', 'error');
    return;
  }

  showToast('Excluído com sucesso!', 'success');
  await loadAllData();
  renderCurrentPage();
}

// ============================================================
// APP STORE / PWA + LANÇAMENTO RÁPIDO
// ============================================================
function initPWAExperience() {
  if (!installTipShown && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    installTipShown = true;
    setTimeout(() => showToast('Dica: instale na Tela de Início para usar como app 📱', 'success'), 1400);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'block';
    btn.textContent = '📲 Instalar app';
  }
});

async function installApp() {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    showInstallGuide();
    return;
  }

  if (!deferredInstallPrompt) {
    showToast('Use o menu do navegador e escolha “Instalar app”. No iPhone, use Compartilhar → Adicionar à Tela de Início.', 'success');
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
}

function showInstallGuide() {
  alert('Para instalar no iPhone:\n\n1. Abra este site no Safari\n2. Toque no botão de compartilhar\n3. Toque em “Adicionar à Tela de Início”\n4. Confirme em “Adicionar”\n\nPronto: ele abre como app, com ícone na tela inicial.');
}

function renderSettings() {
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'block';
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      btn.textContent = '🍎 Ver instrução para iPhone';
    } else {
      btn.textContent = deferredInstallPrompt ? '📲 Instalar app' : '📲 Instalar / Ver dica';
    }
  }
  const notifyEl = document.getElementById('notification-status');
  if (notifyEl) notifyEl.textContent = ('Notification' in window) ? (Notification.permission === 'granted' ? 'Ativadas neste aparelho' : 'Desativadas') : 'Não suportado';
  const emailEl = document.getElementById('settings-email');
  if (emailEl && currentUser) emailEl.textContent = currentUser.email;
  syncSettingsProfileUI();
  updatePrivacyUI();
  updatePendingBadges();
}

function exportData() {
  const backup = {
    app: 'Controle Financeiro', exported_at: new Date().toISOString(), user_email: currentUser?.email || '',
    transactions: allTransactions, categories: allCategories, credit_cards: allCards, budgets: allBudgets, goals: allGoals
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup-financeiro-' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Backup baixado!', 'success');
}

async function importDataFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup.transactions && !backup.categories && !backup.credit_cards) { showToast('Arquivo de backup inválido', 'error'); return; }
    if (!confirm('Importar backup? Isso vai adicionar os dados do arquivo à sua conta atual.')) return;
    const sanitize = (items, fields) => (items || []).map(item => { const obj = { user_id: currentUser.id }; fields.forEach(f => { if (item[f] !== undefined) obj[f] = item[f]; }); return obj; });
    const ops = [];
    const cats = sanitize(backup.categories, ['name','type','icon','color','is_default']);
    const cards = sanitize(backup.credit_cards || backup.cards, ['name','brand','credit_limit','closing_day','due_day','color']);
    const txs = sanitize(backup.transactions, ['type','description','amount','date','category_id','status','payment_method','credit_card_id','notes','is_installment','installment_number','installment_total','installment_group_id']);
    const budgets = sanitize(backup.budgets, ['category_id','amount','month','year']);
    const goals = sanitize(backup.goals, ['name','target_amount','current_amount','month','year','color']);
    if (cats.length) ops.push(db.from('categories').insert(cats));
    if (cards.length) ops.push(db.from('credit_cards').insert(cards));
    if (txs.length) ops.push(db.from('transactions').insert(txs));
    if (budgets.length) ops.push(db.from('budgets').insert(budgets));
    if (goals.length) ops.push(db.from('goals').insert(goals));
    const results = await Promise.all(ops);
    if (results.some(r => r.error)) showToast('Alguns dados não foram importados', 'error');
    else showToast('Backup importado!', 'success');
    await loadAllData(); renderCurrentPage();
  } catch (err) { showToast('Erro ao ler backup', 'error'); }
  finally { event.target.value = ''; }
}

async function clearTransactionsOnly() {
  if (!confirm('Apagar TODOS os lançamentos da sua conta? Cartões, categorias e metas serão mantidos.')) return;
  const { error } = await db.from('transactions').delete().eq('user_id', currentUser.id);
  if (error) { showToast('Erro ao apagar lançamentos', 'error'); return; }
  showToast('Lançamentos apagados!', 'success');
  await loadTransactions(); renderCurrentPage();
}

function openQuickAdd() {
  openSmartQuickAdd();
}


// ============================================================
// RENDERIZAÇÃO DA PÁGINA ATUAL
// ============================================================
function renderCurrentPage() {
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'bills': renderBills(); break;
    case 'cards': renderCards(); break;
    case 'categories': renderCategories(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': renderReports(); break;
    case 'pending': renderPendingReviews(); break;
    case 'calendar': renderCalendar(); break;
    case 'settings': renderSettings(); break;
  }
}

// ============================================================
// V4 PREMIUM: PERFIL, PERSONALIZAÇÃO, PRIVACIDADE E CALENDÁRIO
// ============================================================
function prefsKey() {
  return currentUser ? `finance_prefs_${currentUser.id}` : 'finance_prefs_guest';
}

function loadUserPreferences() {
  try {
    cachedUserPrefs = JSON.parse(localStorage.getItem(prefsKey()) || '{}');
  } catch (_) {
    cachedUserPrefs = {};
  }
  return cachedUserPrefs;
}

function saveUserPreferences(patch = {}) {
  cachedUserPrefs = { ...(cachedUserPrefs || {}), ...patch };
  localStorage.setItem(prefsKey(), JSON.stringify(cachedUserPrefs));
  applyUserPreferences();
}

function applyUserPreferences() {
  const prefs = cachedUserPrefs || loadUserPreferences();
  const fallbackName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Usuário';
  const name = prefs.displayName || fallbackName;
  const avatar = prefs.avatarDataUrl || '';
  const accent = prefs.accentColor || '#6366f1';

  document.documentElement.style.setProperty('--primary', accent);
  document.documentElement.style.setProperty('--primary-dark', shadeColor(accent, -18));
  document.documentElement.style.setProperty('--primary-light', shadeColor(accent, 18));

  const userName = document.getElementById('user-name');
  if (userName) userName.textContent = name;
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) renderAvatarElement(avatarEl, avatar, name);
  const preview = document.getElementById('profile-avatar-preview');
  if (preview) renderAvatarElement(preview, avatar, name);
  const input = document.getElementById('profile-display-name');
  if (input) input.value = prefs.displayName || '';

  document.body.classList.toggle('privacy-mode', !!prefs.privacyMode);
  document.body.classList.toggle('compact-mode', !!prefs.compactMode);
  updatePrivacyUI();
}

function renderAvatarElement(el, avatar, name) {
  if (!el) return;
  if (avatar) {
    el.innerHTML = `<img src="${avatar}" alt="Foto de perfil">`;
  } else {
    el.textContent = (name || 'U').trim().charAt(0).toUpperCase();
  }
}

function syncSettingsProfileUI() {
  loadUserPreferences();
  applyUserPreferences();
}

function saveProfileName() {
  const input = document.getElementById('profile-display-name');
  const name = (input?.value || '').trim();
  if (!name) { showToast('Digite um nome para salvar', 'error'); return; }
  saveUserPreferences({ displayName: name });
  showToast('Perfil atualizado!', 'success');
}

function handleProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Escolha uma imagem válida', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 320;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      saveUserPreferences({ avatarDataUrl: canvas.toDataURL('image/jpeg', 0.82) });
      showToast('Foto de perfil salva!', 'success');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeProfilePhoto() {
  saveUserPreferences({ avatarDataUrl: '' });
  showToast('Foto removida', 'success');
}

function setAccentColor(color) {
  saveUserPreferences({ accentColor: color });
  showToast('Cor atualizada!', 'success');
}

function resetPersonalization() {
  saveUserPreferences({ accentColor: '#6366f1', compactMode: false });
  showToast('Personalização restaurada', 'success');
}

function toggleCompactMode() {
  const prefs = cachedUserPrefs || loadUserPreferences();
  saveUserPreferences({ compactMode: !prefs.compactMode });
  showToast(!prefs.compactMode ? 'Modo compacto ativado' : 'Modo compacto desativado', 'success');
}

function togglePrivacyMode() {
  const prefs = cachedUserPrefs || loadUserPreferences();
  saveUserPreferences({ privacyMode: !prefs.privacyMode });
  updatePrivacyUI();
  showToast(!prefs.privacyMode ? 'Valores escondidos' : 'Valores visíveis', 'success');
}

function updatePrivacyUI() {
  const prefs = cachedUserPrefs || loadUserPreferences();
  const active = !!prefs.privacyMode;
  const status = document.getElementById('privacy-status');
  const btn = document.getElementById('privacy-toggle-btn');
  if (status) status.textContent = active ? 'Valores escondidos' : 'Valores visíveis';
  if (btn) btn.textContent = active ? '👁️ Mostrar valores' : '🙈 Esconder valores';
}

function shadeColor(hex, percent) {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
  return '#' + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

function renderCalendar() {
  updateMonthLabel();
  const grid = document.getElementById('calendar-grid');
  const summary = document.getElementById('calendar-summary');
  if (!grid || !summary) return;

  const first = new Date(currentYear, currentMonth - 1, 1);
  const days = new Date(currentYear, currentMonth, 0).getDate();
  const startOffset = first.getDay();
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const monthTxs = allTransactions.filter(t => monthKeyFromDate(t.date) === monthKey);
  const income = monthTxs.filter(t => t.type === 'income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const expense = monthTxs.filter(t => t.type === 'expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const pending = monthTxs.filter(t => t.status !== 'paid').length;

  summary.innerHTML = `
    <div class="calendar-summary-card positive"><span>Receitas no mês</span><strong>${formatCurrency(income)}</strong></div>
    <div class="calendar-summary-card negative"><span>Despesas no mês</span><strong>${formatCurrency(expense)}</strong></div>
    <div class="calendar-summary-card"><span>Pendências</span><strong>${pending}</strong></div>
  `;

  const headers = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let html = headers.map(h => `<div class="calendar-weekday">${h}</div>`).join('');
  for (let i = 0; i < startOffset; i++) html += '<div class="calendar-day empty"></div>';

  const todayKey = new Date().toISOString().split('T')[0];
  for (let day = 1; day <= days; day++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const txs = monthTxs.filter(t => t.date === dateStr);
    const dayIncome = txs.filter(t => t.type === 'income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const dayExpense = txs.filter(t => t.type === 'expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const hasReview = txs.some(isReviewPending);
    const isToday = dateStr === todayKey;
    html += `<button class="calendar-day ${isToday ? 'today' : ''} ${txs.length ? 'has-items' : ''}" onclick="openCalendarDay('${dateStr}')">
      <span class="calendar-day-number">${day}</span>
      ${dayIncome ? `<small class="positive">+${formatCompactCurrency(dayIncome)}</small>` : ''}
      ${dayExpense ? `<small class="negative">-${formatCompactCurrency(dayExpense)}</small>` : ''}
      ${hasReview ? `<em>revisar</em>` : ''}
    </button>`;
  }
  grid.innerHTML = html;
}

function formatCompactCurrency(value) {
  const n = Math.abs(parseFloat(value || 0));
  if (n >= 1000) return 'R$' + (n / 1000).toFixed(1).replace('.', ',') + 'k';
  return 'R$' + n.toFixed(0);
}

function openCalendarDay(dateStr) {
  currentMonth = parseInt(dateStr.slice(5,7));
  currentYear = parseInt(dateStr.slice(0,4));
  navigateTo('transactions');
  showToast(`Mostrando lançamentos de ${formatDateBR(dateStr)}. Use a busca se quiser filtrar mais.`, 'success');
}

// ============================================================
// MODAL
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ============================================================
// TEMA
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
  // Re-renderizar gráficos com nova cor
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'reports') renderReports();
  if (currentPage === 'calendar') renderCalendar();
  if (currentPage === 'pending') renderPendingReviews();
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatAmountInput(value) {
  return parseFloat(value || 0).toFixed(2).replace('.', ',');
}

function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function emptyState(text, icon) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-text">${text}</div>
    </div>
  `;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.original || 'Salvar';
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Máscara de moeda
document.addEventListener('input', e => {
  if (e.target.classList.contains('currency-input')) {
    let v = e.target.value.replace(/\D/g, '');
    if (!v) { e.target.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2);
    e.target.value = v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
});
