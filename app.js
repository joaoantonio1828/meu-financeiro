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
  await loadAllData();
  navigateTo('dashboard');
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

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'bills': renderBills(); break;
    case 'cards': renderCards(); break;
    case 'categories': renderCategories(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': renderReports(); break;
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
  document.getElementById('tx-notes').value = t.notes || '';
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
    else { showToast('Lançamento atualizado!', 'success'); }
  } else {
    // Criar novo (com parcelamento se for cartão)
    if (installments > 1 && payment_method === 'credit_card') {
      const groupId = crypto.randomUUID();
const totalInstallments = Number.isFinite(installments) && installments > 1 ? installments : 1;
const parcela = Math.round((amount / totalInstallments) * 100) / 100;
const rows = [];

for (let i = 0; i < totalInstallments; i++) {
  const d = new Date(date + 'T00:00:00');
  d.setMonth(d.getMonth() + i);

  const numeroParcela = i + 1;

  rows.push({
    user_id: currentUser.id,
    type,
    category_id,
    status: i === 0 ? status : 'pending',
    payment_method,
    credit_card_id,
    notes,
    description: `${description} (${String(numeroParcela).padStart(2, '0')}/${String(totalInstallments).padStart(2, '0')})`,
    amount: parcela,
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
  if (allCards.length === 0) {
    listEl.innerHTML = emptyState('Nenhum cartão cadastrado', '💳');
    return;
  }

  listEl.innerHTML = allCards.map(card => {
    const today = new Date();
    const currentPeriodStart = getCardPeriodStart(card, today);
    const currentPeriodEnd = getCardPeriodEnd(card, today);

    const purchases = allTransactions.filter(t =>
      t.credit_card_id === card.id &&
      t.type === 'expense' &&
      t.date >= currentPeriodStart &&
      t.date <= currentPeriodEnd
    );
    const used = purchases.reduce((s, t) => s + parseFloat(t.amount), 0);
    const available = parseFloat(card.credit_limit) - used;
    const pct = card.credit_limit > 0 ? Math.min(100, (used / card.credit_limit) * 100).toFixed(0) : 0;
    const barColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)';

    return `
      <div class="card-item" style="background: linear-gradient(135deg, ${card.color}, ${card.color}99)">
        <div class="card-header-row">
          <div class="card-name">${card.name}</div>
          <div class="card-brand">${brandIcon(card.brand)}</div>
        </div>
        <div class="card-limit-row">
          <span>Limite: ${formatCurrency(card.credit_limit)}</span>
          <span>Disponível: ${formatCurrency(available)}</span>
        </div>
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="card-info-row">
          <span>Fatura: ${formatCurrency(used)}</span>
          <span>${pct}% usado</span>
        </div>
        <div class="card-actions-row">
          <span class="card-dates">Fecha dia ${card.closing_day} · Vence dia ${card.due_day}</span>
          <div>
            <button class="btn-icon" onclick="openEditCard('${card.id}')">✏️</button>
            <button class="btn-icon" onclick="confirmDelete('card','${card.id}')">🗑️</button>
          </div>
        </div>
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
    ({ error } = await db.from('transactions').delete().eq('id', id));
  } else if (type === 'card') {
    ({ error } = await db.from('credit_cards').delete().eq('id', id));
  } else if (type === 'category') {
    ({ error } = await db.from('categories').delete().eq('id', id));
  } else if (type === 'budget') {
    ({ error } = await db.from('budgets').delete().eq('id', id));
  } else if (type === 'goal') {
    ({ error } = await db.from('goals').delete().eq('id', id));
  }

  if (error) { showToast('Erro ao excluir', 'error'); return; }
  showToast('Excluído com sucesso!', 'success');
  await loadAllData();
  renderCurrentPage();
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'bills': renderBills(); break;
    case 'cards': renderCards(); break;
    case 'categories': renderCategories(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': renderReports(); break;
  }
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
