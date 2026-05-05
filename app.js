
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.classList.remove('open');
  // Não usar display:none inline aqui. Isso impedia openModal() de abrir os modais.
  m.style.display='';
 });
});

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

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // EMERGÊNCIA: segurança/PIN temporariamente desativados para destravar o app.
  try {
    localStorage.removeItem('financeiro_v5_security');
    localStorage.removeItem('financeiro_should_lock');
    sessionStorage.removeItem('financeiro_should_lock');
  } catch(e) {}

  // Correção anti-trava: permite limpar somente a segurança local pelo link ?reset=1
  // Isso não apaga dados do Supabase, lançamentos, cartões ou categorias.
  if (new URLSearchParams(window.location.search).has('reset')) {
    resetV5SecurityLocal(false);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  if (typeof applyProfileV17 === 'function') applyProfileV17();
  await loadAllData();
  initPWAExperience();
  navigateTo('dashboard');
  if (typeof initV5PremiumFeatures === 'function') initV5PremiumFeatures();
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
    reports: 'Relatórios', calendar: 'Calendário', insights: 'Insights', recurring: 'Recorrências', subscriptions: 'Assinaturas', 'import-history': 'Importações', settings: 'Configurações'
  };
  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titleMap[page] || 'Controle Financeiro';

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'pending-review': renderPendingReview(); break;
    case 'bills': renderBills(); break;
    case 'cards': renderCards(); break;
    case 'categories': renderCategories(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': renderReports(); break;
    case 'calendar': renderCalendar(); break;
    case 'insights': renderInsights(); break;
    case 'recurring': renderRecurring(); break;
    case 'subscriptions': renderSubscriptions(); break;
    case 'import-history': renderImportHistory(); break;
    case 'settings': renderSettings(); break;
  }

  // Fechar sidebar mobile
  if (typeof closeSidebar === 'function') closeSidebar(); else document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.body.classList.toggle('sidebar-open-v17', sidebar.classList.contains('open'));
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  document.body.classList.remove('sidebar-open-v17');
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
  if (currentPage === 'calendar') renderCalendar();
  if (currentPage === 'insights') renderInsights();
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
  let category_id = document.getElementById('tx-category').value || null;
  const status = document.getElementById('tx-status').value;
  const payment_method = document.getElementById('tx-payment').value;
  const credit_card_id = document.getElementById('tx-card').value || null;
  const notes = document.getElementById('tx-notes').value.trim();
  const installments = parseInt(document.getElementById('tx-installments')?.value || '1');

  category_id = smartSuggestCategoryId(description, type, category_id);

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
          <span>Fatura atual: ${formatCurrency(used)}</span>
          <span>${pct}% usado</span>
        </div>
        <div class="invoice-extra">
          <div><small>Período</small><strong>${formatDateBR(currentPeriodStart)} a ${formatDateBR(currentPeriodEnd)}</strong></div>
          <div><small>Próxima fatura</small><strong>${formatCurrency(getNextCardInvoiceTotal(card))}</strong></div>
        </div>
        <div class="card-actions-row">
          <span class="card-dates">Fecha dia ${card.closing_day} · Vence dia ${card.due_day}</span>
          <div>
            <button class="btn-icon" title="Importar fatura PDF" onclick="openInvoiceImport('${card.id}')">📄</button>
            <button class="btn-icon" title="Pagar fatura" onclick="payCardInvoice('${card.id}')">✅</button>
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
// IMPORTAR FATURA PDF
// ============================================================
let invoiceImportPreview = [];

function openInvoiceImport(cardId = null) {
  if (!allCards.length) {
    showToast('Cadastre um cartão antes de importar a fatura', 'error');
    navigateTo('cards');
    openNewCard();
    return;
  }

  const cardSelect = document.getElementById('invoice-import-card');
  if (cardSelect) {
    cardSelect.innerHTML = allCards.map(c => `<option value="${c.id}" ${c.id === cardId ? 'selected' : ''}>${c.name}</option>`).join('');
  }

  const monthInput = document.getElementById('invoice-import-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }

  invoiceImportPreview = [];
  const summary = document.getElementById('invoice-import-summary');
  const list = document.getElementById('invoice-preview-list');
  const file = document.getElementById('invoice-pdf-file');
  if (summary) { summary.classList.add('hidden'); summary.innerHTML = ''; }
  if (list) list.innerHTML = '';
  if (file) file.value = '';
  const saveBtn = document.getElementById('invoice-save-btn');
  if (saveBtn) saveBtn.disabled = true;

  openModal('invoice-import-modal');
}

async function handleInvoicePdfFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Selecione um arquivo PDF', 'error');
    return;
  }

  const saveBtn = document.getElementById('invoice-save-btn');
  if (saveBtn) saveBtn.disabled = true;
  const list = document.getElementById('invoice-preview-list');
  const summary = document.getElementById('invoice-import-summary');
  if (list) list.innerHTML = '<div class="import-loading">Lendo PDF e procurando compras...</div>';
  if (summary) { summary.classList.add('hidden'); summary.innerHTML = ''; }

  try {
    if (!window.pdfjsLib) throw new Error('PDF.js não carregou');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = content.items.map(item => item.str).join(' ');
      text += '\n' + lines;
    }

    invoiceImportPreview = parseInvoiceTextToTransactions(text);
    renderInvoicePreview();
  } catch (err) {
    console.error(err);
    if (list) list.innerHTML = emptyState('Não consegui ler esse PDF. Tente um PDF textual da fatura, não print/imagem.', '⚠️');
    showToast('Erro ao ler PDF', 'error');
  }
}


function isInvoiceSummaryLine(line) {
  const l = String(line || '').toLowerCase();
  // Linhas de resumo/total da fatura NUNCA devem virar compra.
  // Isso evita importar o total da fatura + itens individuais e quase dobrar o valor.
  return /(^|\b)(total|totais|subtotal|resumo|fatura atual|fechamento|vencimento|pagamento|pague até|pague ate|valor a pagar|pagamento recebido|limite disponível|limite disponivel|limite total|saldo|encargos|juros|iof|mínimo|minimo|crédito rotativo|credito rotativo|nubank ultravioleta|mastercard|visa)(\b|:)/i.test(l);
}

function getDayFromDate(dateStr, fallback = 1) {
  const parts = String(dateStr || '').split('-');
  const day = parseInt(parts[2], 10);
  return Number.isFinite(day) ? Math.min(28, Math.max(1, day)) : fallback;
}

function getInvoiceMonthBaseDate(originalDate, invoiceYear, invoiceMonth) {
  // Para fatura importada, a parcela atual deve cair no mês selecionado da fatura,
  // mesmo se a data exibida no PDF for a data da compra original.
  const day = getDayFromDate(originalDate, 1);
  return dateFromParts(invoiceYear, invoiceMonth, day);
}

function parseInvoiceTextToTransactions(text) {
  const monthInput = document.getElementById('invoice-import-month')?.value || `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const [invoiceYear, invoiceMonth] = monthInput.split('-').map(Number);
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d{1,2}\s*(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ))/gi, '\n$1')
    .replace(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/g, '\n$1');

  const rawLines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const ignoredWords = /(pagamento recebido|compra cancelada|estorno|cashback|ajuste de crédito|ajuste de credito)/i;
  const seen = new Set();
  const seenNoDate = new Set();
  const results = [];

  rawLines.forEach(line => {
    if (line.length < 8) return;
    if (isInvoiceSummaryLine(line)) return;
    if (ignoredWords.test(line)) return;

    const moneyMatches = [...line.matchAll(/(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/g)];
    if (!moneyMatches.length) return;

    // Se a linha tem muitos valores, geralmente é resumo/parcelamento/total misturado.
    // Mantemos o último valor apenas quando a linha parece uma compra real.
    if (moneyMatches.length > 2 && !/\d{1,2}\s*\/\s*\d{1,2}/.test(line)) return;

    const amountStr = moneyMatches[moneyMatches.length - 1][1];
    let amount = parseCurrency(amountStr);
    if (!amount || amount <= 0) return;

    const dateInfo = extractInvoiceLineDate(line, invoiceYear, invoiceMonth);
    const installmentInfo = extractInstallmentInfo(line);
    let description = line;

    description = description.replace(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?-?\d+,\d{2}/g, ' ');
    description = description.replace(/\d{1,2}\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/ig, ' ');
    description = description.replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, ' ');
    description = description.replace(/\b(parcela|parc|compra|lançamento|lancamento)\b/ig, ' ');
    description = description.replace(/\d{1,2}\s*\/\s*\d{1,2}/g, ' ');
    description = description.replace(/\s{2,}/g, ' ').trim();

    if (!description || description.length < 3) description = 'Compra importada';
    description = cleanInvoiceDescription(description);

    const cleanKeyDesc = normalizeImportText(description);
    const key = `${dateInfo.date}|${cleanKeyDesc}|${amount.toFixed(2)}|${installmentInfo.current}/${installmentInfo.total}`;
    const noDateKey = `${cleanKeyDesc}|${amount.toFixed(2)}|${installmentInfo.current}/${installmentInfo.total}`;
    if (seen.has(key) || seenNoDate.has(noDateKey)) return;
    seen.add(key);
    seenNoDate.add(noDateKey);

    const category = guessCategoryForImport(description);
    const needsReview = !category || category.name?.toLowerCase() === 'outros';

    results.push({
      id: crypto.randomUUID(),
      checked: true,
      date: getInvoiceMonthBaseDate(dateInfo.date, invoiceYear, invoiceMonth),
      original_date: dateInfo.date,
      description,
      amount,
      category_id: category?.id || getOutrosCategoryId(),
      category_name: category?.name || 'Outros',
      installment_current: installmentInfo.current,
      installment_total: installmentInfo.total,
      needs_review: needsReview
    });
  });

  return results.slice(0, 120);
}

function extractInvoiceLineDate(line, invoiceYear, invoiceMonth) {
  const months = { JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6, JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12 };
  let m = line.match(/(\d{1,2})\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i);
  if (m) {
    const day = Math.min(28, parseInt(m[1], 10));
    const month = months[m[2].toUpperCase()] || invoiceMonth;
    return { date: dateFromParts(invoiceYear, month, day) };
  }
  m = line.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    const day = Math.min(28, parseInt(m[1], 10));
    const month = parseInt(m[2], 10) || invoiceMonth;
    let year = m[3] ? parseInt(m[3], 10) : invoiceYear;
    if (year < 100) year += 2000;
    return { date: dateFromParts(year, month, day) };
  }
  return { date: dateFromParts(invoiceYear, invoiceMonth, 1) };
}

function extractInstallmentInfo(line) {
  const m = line.match(/(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/);
  if (!m) return { current: 1, total: 1 };
  const current = Math.max(1, parseInt(m[1], 10));
  const total = Math.max(current, parseInt(m[2], 10));
  if (total > 48) return { current: 1, total: 1 };
  return { current, total };
}

function dateFromParts(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.toISOString().split('T')[0];
}

function addMonthsToDate(dateStr, monthsToAdd) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + monthsToAdd);
  return d.toISOString().split('T')[0];
}

function cleanInvoiceDescription(description) {
  return description
    .replace(/\*+/g, ' ')
    .replace(/\bbrasil\b|\bbrazil\b/ig, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

function getOutrosCategoryId() {
  const cat = allCategories.find(c => c.name?.toLowerCase() === 'outros' && (c.type === 'expense' || c.type === 'both'));
  return cat?.id || null;
}

function guessCategoryForImport(description) {
  const desc = description.toLowerCase();
  const rules = [
    ['Transporte', /(uber|99|posto|combust|gasolina|etanol|estacion|pedagio|pedágio|taxi|ônibus|onibus)/],
    ['Alimentação', /(ifood|restaurante|lanch|pizza|burger|padaria|cafe|café|sorvete|açaí|acai|bar\b)/],
    ['Mercado', /(mercado|supermercado|atacadao|atacadão|assai|assaí|carrefour|extra|atacado|comper)/],
    ['Saúde', /(farmacia|farmácia|drogaria|droga|hospital|clinica|clínica|laboratorio|laboratório)/],
    ['Lazer', /(cinema|netflix|spotify|prime video|disney|streaming|show|ingresso|game|steam)/],
    ['Assinaturas', /(apple|google|icloud|amazon prime|assinatura|recorrente)/],
    ['Educação', /(curso|faculdade|escola|livro|udemy|alura)/],
    ['Moradia', /(aluguel|condominio|condomínio|energia|internet|agua|água)/]
  ];
  for (const [name, regex] of rules) {
    if (regex.test(desc)) {
      const cat = allCategories.find(c => c.name?.toLowerCase() === name.toLowerCase() && (c.type === 'expense' || c.type === 'both'));
      if (cat) return cat;
    }
  }
  if (typeof suggestCategoryFromText === 'function') {
    const suggestion = suggestCategoryFromText(description);
    if (suggestion) return suggestion;
  }
  return allCategories.find(c => c.name?.toLowerCase() === 'outros' && (c.type === 'expense' || c.type === 'both')) || null;
}

function renderInvoicePreview() {
  const list = document.getElementById('invoice-preview-list');
  const summary = document.getElementById('invoice-import-summary');
  const saveBtn = document.getElementById('invoice-save-btn');
  if (!list) return;

  if (!invoiceImportPreview.length) {
    list.innerHTML = emptyState('Nenhuma compra encontrada no PDF', '📄');
    if (summary) { summary.classList.add('hidden'); summary.innerHTML = ''; }
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  const selectedItems = invoiceImportPreview.filter(i => i.checked);
  const selectedCount = selectedItems.length;
  const total = selectedItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const futureTotal = selectedItems.reduce((s, i) => {
    const remaining = Math.max(0, Number(i.installment_total || 1) - Number(i.installment_current || 1));
    return s + (Number(i.amount || 0) * remaining);
  }, 0);
  const installmentCount = invoiceImportPreview.filter(i => i.installment_total > 1).length;
  const reviewCount = invoiceImportPreview.filter(i => i.needs_review).length;

  if (summary) {
    summary.classList.remove('hidden');
    summary.innerHTML = `
      <div><strong>${selectedCount}</strong><span>selecionadas</span></div>
      <div><strong>${formatCurrency(total)}</strong><span>fatura atual</span></div>
      <div><strong>${formatCurrency(futureTotal)}</strong><span>futuro agendado</span></div>
      <div><strong>${reviewCount}</strong><span>para revisar</span></div>
    `;
  }

  const categoryOptions = '<option value="">Outros</option>' +
    allCategories.filter(c => c.type === 'expense' || c.type === 'both')
      .map(c => `<option value="${c.id}">${c.icon || '•'} ${c.name}</option>`).join('');

  list.innerHTML = invoiceImportPreview.map((item, index) => `
    <div class="invoice-preview-row ${item.needs_review ? 'needs-review' : ''}">
      <label class="invoice-check"><input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleInvoiceImportItem(${index}, this.checked)"></label>
      <div class="invoice-preview-main">
        <div class="invoice-preview-title">${escapeHtml(item.description)}</div>
        <div class="invoice-preview-meta">${formatDateBR(item.date)} · ${item.installment_total > 1 ? `${item.installment_current}/${item.installment_total}` : 'à vista'} · ${item.needs_review ? 'revisar categoria' : item.category_name}</div>
      </div>
      <div class="invoice-preview-side">
        <div class="invoice-preview-amount">${formatCurrency(item.amount)}</div>
        <select class="form-input invoice-category-select" onchange="setInvoiceImportCategory(${index}, this.value)">${categoryOptions}</select>
      </div>
    </div>
  `).join('');

  invoiceImportPreview.forEach((item, index) => {
    const sel = list.querySelectorAll('.invoice-category-select')[index];
    if (sel) sel.value = item.category_id || '';
  });

  if (saveBtn) saveBtn.disabled = selectedCount === 0;
}

function toggleInvoiceImportItem(index, checked) {
  if (!invoiceImportPreview[index]) return;
  invoiceImportPreview[index].checked = checked;
  renderInvoicePreview();
}

function setInvoiceImportCategory(index, categoryId) {
  const item = invoiceImportPreview[index];
  if (!item) return;
  item.category_id = categoryId || getOutrosCategoryId();
  const cat = allCategories.find(c => c.id === item.category_id);
  item.category_name = cat?.name || 'Outros';
  item.needs_review = !categoryId || item.category_name.toLowerCase() === 'outros';
  renderInvoicePreview();
}


function normalizeImportText(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function makeImportFingerprint(row) {
  const desc = normalizeImportText(row.description);
  const amount = Number(row.amount || 0).toFixed(2);
  const date = row.date || '';
  const card = row.credit_card_id || '';
  const parcel = row.is_installment ? `${row.installment_number || ''}/${row.installment_total || ''}` : 'avista';
  return `${card}|${date}|${desc}|${amount}|${parcel}`;
}

function parseImportMeta(notes) {
  const text = String(notes || '');
  return {
    batchId: (text.match(/\[IMPORT_BATCH:([^\]]+)\]/) || [])[1] || null,
    batchName: (text.match(/\[IMPORT_NAME:([^\]]+)\]/) || [])[1] || 'Fatura importada',
    source: (text.match(/\[SOURCE:([^\]]+)\]/) || [])[1] || null,
    key: (text.match(/\[IMPORT_KEY:([^\]]+)\]/) || [])[1] || null,
    createdAt: (text.match(/\[IMPORT_AT:([^\]]+)\]/) || [])[1] || null
  };
}

function buildExistingTransactionFingerprints(cardId = null) {
  const set = new Set();
  allTransactions.forEach(t => {
    if (cardId && t.credit_card_id !== cardId) return;
    set.add(makeImportFingerprint({
      description: t.description,
      amount: Number(t.amount || 0),
      date: t.date,
      credit_card_id: t.credit_card_id,
      is_installment: !!t.is_installment,
      installment_number: t.installment_number,
      installment_total: t.installment_total
    }));
    const meta = parseImportMeta(t.notes);
    if (meta.key) set.add(meta.key);
  });
  return set;
}

function registerLocalActivity(action, payload = {}) {
  try {
    const key = `cyano_activity_${currentUser?.id || 'local'}`;
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    items.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action, ...payload });
    localStorage.setItem(key, JSON.stringify(items.slice(0, 50)));
  } catch (e) { console.warn('activity log failed', e); }
}

async function confirmInvoiceImport() {
  const cardId = document.getElementById('invoice-import-card')?.value;
  if (!cardId) { showToast('Selecione o cartão', 'error'); return; }
  const selected = invoiceImportPreview.filter(i => i.checked);
  if (!selected.length) { showToast('Nenhuma compra selecionada', 'error'); return; }

  const card = allCards.find(c => c.id === cardId);
  const monthInput = document.getElementById('invoice-import-month')?.value || `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const [invoiceYearForRows, invoiceMonthForRows] = monthInput.split('-').map(Number);
  const batchId = crypto.randomUUID();
  const batchName = `${card?.name || 'Cartão'} ${monthInput}`;
  const importAt = new Date().toISOString();
  const existing = buildExistingTransactionFingerprints(cardId);
  const rows = [];
  const duplicates = [];
  const reviewRows = [];
  const invalidRows = [];

  selected.forEach(item => {
    if (!item.amount || Number(item.amount) <= 0 || !item.date || !item.description) {
      invalidRows.push(item);
      return;
    }

    const groupId = item.installment_total > 1 ? crypto.randomUUID() : null;
    const start = item.installment_total > 1 ? item.installment_current : 1;
    const total = item.installment_total || 1;
    const baseInvoiceDate = getInvoiceMonthBaseDate(item.original_date || item.date, invoiceYearForRows, invoiceMonthForRows);

    for (let n = start; n <= total; n++) {
      const monthOffset = n - start;
      const row = {
        user_id: currentUser.id,
        type: 'expense',
        description: total > 1 ? `${item.description} (${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')})` : item.description,
        amount: Number(item.amount || 0),
        date: addMonthsToDate(baseInvoiceDate, monthOffset),
        category_id: item.category_id || getOutrosCategoryId(),
        status: 'pending',
        payment_method: 'credit_card',
        credit_card_id: cardId,
        is_installment: total > 1,
        installment_number: total > 1 ? n : null,
        installment_total: total > 1 ? total : null,
        installment_group_id: groupId
      };

      const fingerprint = makeImportFingerprint(row);
      if (existing.has(fingerprint)) {
        duplicates.push(row);
        return;
      }
      existing.add(fingerprint);

      const needsReview = item.needs_review || !item.category_id || (item.category_name || '').toLowerCase() === 'outros';
      if (needsReview) reviewRows.push(row);
      const currentInvoiceTag = n === start ? '[FATURA_ATUAL] ' : '[PARCELA_FUTURA] ';
      row.notes = `${needsReview ? '[REVISAR] ' : ''}${currentInvoiceTag}[SOURCE:import_pdf] [IMPORTADO PDF] [IMPORT_BATCH:${batchId}] [IMPORT_NAME:${batchName}] [IMPORT_AT:${importAt}] [IMPORT_KEY:${fingerprint}] [ORIGINAL_DATE:${item.original_date || item.date}] Conferir fatura/categoria`;
      rows.push(row);
    }
  });

  if (!rows.length) {
    showToast(`Nada novo para importar. ${duplicates.length} duplicado(s) ignorado(s).`, 'success');
    if (document.getElementById('invoice-import-summary')) {
      document.getElementById('invoice-import-summary').classList.remove('hidden');
      document.getElementById('invoice-import-summary').innerHTML = `<div><strong>0</strong><span>criados</span></div><div><strong>${duplicates.length}</strong><span>duplicados</span></div><div><strong>${invalidRows.length}</strong><span>inválidos</span></div>`;
    }
    return;
  }

  setLoading('invoice-save-btn', true);
  const { error } = await db.from('transactions').insert(rows);
  setLoading('invoice-save-btn', false);

  if (error) {
    console.error(error);
    showToast('Erro ao salvar importação', 'error');
    return;
  }

  const currentRows = rows.filter(r => String(r.notes || '').includes('[FATURA_ATUAL]')).length;
  const futureRows = rows.length - currentRows;
  registerLocalActivity('import_pdf', { batchId, batchName, created: rows.length, currentRows, futureRows, duplicates: duplicates.length, review: reviewRows.length });
  showToast(`Importação salva: ${currentRows} da fatura atual + ${futureRows} futura(s). ${duplicates.length} duplicado(s) ignorado(s).`, 'success');
  closeModal('invoice-import-modal');
  await loadTransactions();
  renderCurrentPage();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}


// ============================================================
// HISTÓRICO DE IMPORTAÇÕES / ANTI-BAGUNÇA
// ============================================================
function getImportBatches() {
  const map = new Map();
  allTransactions.forEach(t => {
    const meta = parseImportMeta(t.notes);
    if (!meta.batchId) return;
    if (!map.has(meta.batchId)) {
      map.set(meta.batchId, {
        batchId: meta.batchId,
        batchName: meta.batchName || 'Fatura importada',
        createdAt: meta.createdAt,
        cardId: t.credit_card_id,
        items: [],
        total: 0,
        review: 0
      });
    }
    const batch = map.get(meta.batchId);
    batch.items.push(t);
    batch.total += Number(t.amount || 0);
    if (String(t.notes || '').includes('[REVISAR]')) batch.review += 1;
  });
  return Array.from(map.values()).sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function renderImportHistory() {
  const list = document.getElementById('import-history-list');
  const count = document.getElementById('import-history-count');
  if (!list) return;
  const batches = getImportBatches();
  if (count) count.textContent = batches.length;

  if (!batches.length) {
    list.innerHTML = emptyState('Nenhuma fatura importada ainda', '🧾');
    return;
  }

  list.innerHTML = batches.map(batch => {
    const card = allCards.find(c => c.id === batch.cardId);
    const paid = batch.items.filter(i => i.status === 'paid').length;
    const pending = batch.items.filter(i => i.status !== 'paid').length;
    return `
      <div class="import-batch-card" id="import-batch-${batch.batchId}">
        <div class="import-batch-head">
          <div>
            <div class="import-batch-title">${escapeHtml(batch.batchName)}</div>
            <div class="import-batch-meta">${card?.name || 'Cartão'} · ${batch.createdAt ? new Date(batch.createdAt).toLocaleString('pt-BR') : 'sem data'} · ${batch.items.length} lançamento(s)</div>
          </div>
          <div class="import-batch-total">${formatCurrency(batch.total)}</div>
        </div>
        <div class="import-batch-stats">
          <span>${pending} pendente(s)</span>
          <span>${paid} pago(s)</span>
          <span>${batch.review} para revisar</span>
        </div>
        <div class="import-batch-actions">
          <button class="btn-secondary" onclick="toggleImportBatchItems('${batch.batchId}')">Ver itens</button>
          <button class="btn-danger" onclick="deleteImportBatch('${batch.batchId}')">Excluir importação</button>
        </div>
        <div class="import-batch-items hidden" id="import-batch-items-${batch.batchId}">
          ${batch.items.sort((a,b)=>a.date.localeCompare(b.date)).map(item => `
            <div class="import-batch-item">
              <div>
                <strong>${escapeHtml(item.description)}</strong>
                <span>${formatDateBR(item.date)} · ${item.status === 'paid' ? 'Pago' : 'Pendente'} ${String(item.notes || '').includes('[REVISAR]') ? '· revisar' : ''}</span>
              </div>
              <b>${formatCurrency(item.amount)}</b>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleImportBatchItems(batchId) {
  const el = document.getElementById('import-batch-items-' + batchId);
  if (el) el.classList.toggle('hidden');
}

async function deleteImportBatch(batchId) {
  if (!batchId) return;
  const batches = getImportBatches();
  const batch = batches.find(b => b.batchId === batchId);
  const count = batch?.items?.length || 0;
  if (!confirm(`Excluir esta importação e apagar ${count} lançamento(s) criados por ela?`)) return;

  const ids = (batch?.items || []).map(i => i.id);
  if (!ids.length) return;
  const { error } = await db.from('transactions').delete().in('id', ids).eq('user_id', currentUser.id);
  if (error) {
    console.error(error);
    showToast('Erro ao excluir importação', 'error');
    return;
  }
  registerLocalActivity('delete_import_batch', { batchId, deleted: ids.length });
  showToast(`Importação excluída: ${ids.length} lançamento(s) apagado(s).`, 'success');
  await loadTransactions();
  renderImportHistory();
  if (currentPage === 'dashboard') renderDashboard();
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
// V13: CALENDÁRIO, INSIGHTS, FATURA E RECORRÊNCIAS VISUAIS
// ============================================================
function getMonthTransactions() {
  return allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });
}

function getNextCardInvoiceTotal(card) {
  const today = new Date();
  const end = new Date(getCardPeriodEnd(card, today) + 'T00:00:00');
  const nextStart = new Date(end); nextStart.setDate(end.getDate() + 1);
  const nextEnd = new Date(nextStart); nextEnd.setMonth(nextEnd.getMonth() + 1); nextEnd.setDate(nextEnd.getDate() - 1);
  const startStr = nextStart.toISOString().split('T')[0];
  const endStr = nextEnd.toISOString().split('T')[0];
  return allTransactions.filter(t => t.credit_card_id === card.id && t.type === 'expense' && t.date >= startStr && t.date <= endStr)
    .reduce((s,t)=>s+parseFloat(t.amount||0),0);
}

async function payCardInvoice(cardId) {
  const card = allCards.find(c => c.id === cardId);
  if (!card) return;
  const today = new Date();
  const start = getCardPeriodStart(card, today);
  const end = getCardPeriodEnd(card, today);
  const total = allTransactions.filter(t => t.credit_card_id === cardId && t.type === 'expense' && t.date >= start && t.date <= end && t.status !== 'paid')
    .reduce((s,t)=>s+parseFloat(t.amount||0),0);
  if (total <= 0) { showToast('Essa fatura não tem pendências', 'success'); return; }
  if (!confirm(`Marcar fatura de ${formatCurrency(total)} como paga?`)) return;
  const { error } = await db.from('transactions')
    .update({ status: 'paid', notes: 'Fatura paga pelo painel de cartões' })
    .eq('user_id', currentUser.id)
    .eq('credit_card_id', cardId)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end);
  if (error) { showToast('Erro ao pagar fatura', 'error'); return; }
  await loadTransactions();
  showToast('Fatura marcada como paga!', 'success');
  renderCards();
}

function renderCalendar() {
  updateMonthLabel();
  const txs = getMonthTransactions();
  const income = txs.filter(t=>t.type==='income' && t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const expenses = txs.filter(t=>t.type==='expense' && t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const pending = txs.filter(t=>t.type==='expense' && t.status!=='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const set = (id,val)=>{const el=document.getElementById(id); if(el) el.textContent=formatCurrency(val);};
  set('cal-income', income); set('cal-expenses', expenses); set('cal-pending', pending);

  const container = document.getElementById('finance-calendar');
  if (!container) return;
  const first = new Date(currentYear, currentMonth - 1, 1);
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const startBlank = first.getDay();
  const byDay = {};
  txs.forEach(t => {
    const day = parseInt(t.date.split('-')[2]);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  });
  let html = '<div class="calendar-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div class="calendar-grid-v13">';
  for(let i=0;i<startBlank;i++) html += '<div class="calendar-day empty"></div>';
  for(let day=1; day<=lastDay; day++){
    const items = byDay[day] || [];
    const totalOut = items.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const totalIn = items.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const hasPending = items.some(t=>t.status!=='paid');
    html += `<div class="calendar-day ${items.length?'has-items':''}"><div class="day-num">${day}</div>${totalIn?`<div class="day-pill in">+${formatCurrency(totalIn).replace('R$','')}</div>`:''}${totalOut?`<div class="day-pill out">-${formatCurrency(totalOut).replace('R$','')}</div>`:''}${hasPending?'<div class="day-dot">pendente</div>':''}</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderInsights() {
  const txs = getMonthTransactions();
  const income = txs.filter(t=>t.type==='income' && t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const paidExpenses = txs.filter(t=>t.type==='expense' && t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const committed = txs.filter(t=>t.type==='expense' && t.status!=='paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const projected = income - paidExpenses - committed;
  const byCat = {};
  txs.filter(t=>t.type==='expense').forEach(t=>{const name=t.categories?.name||'Outros'; byCat[name]=(byCat[name]||0)+parseFloat(t.amount||0);});
  const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val;};
  set('ins-projected', formatCurrency(projected));
  set('ins-committed', formatCurrency(committed));
  set('ins-top-cat', top ? top[0] : '-');

  const list=[];
  if (projected < 0) list.push(['danger','Seu saldo projetado está negativo se todas as pendências forem pagas.']);
  else list.push(['success',`Depois das pendências, a previsão é sobrar ${formatCurrency(projected)}.`]);
  if (committed > income * .4 && income>0) list.push(['warning','Seu dinheiro comprometido está alto para este mês.']);
  if (top) list.push(['info',`Sua maior categoria de gasto é ${top[0]} (${formatCurrency(top[1])}).`]);
  const avgDaily = paidExpenses / Math.max(1, new Date().getDate());
  const daysLeft = new Date(currentYear, currentMonth, 0).getDate() - new Date().getDate();
  list.push(['info',`No ritmo atual, você pode gastar mais ${formatCurrency(Math.max(0, avgDaily*daysLeft))} até o fim do mês.`]);
  const el=document.getElementById('insights-list');
  if(el) el.innerHTML=list.map(([type,text])=>`<div class="insight-row ${type}"><span>${type==='danger'?'🚨':type==='warning'?'⚠️':type==='success'?'✅':'💡'}</span><p>${text}</p></div>`).join('');
}

function openRecurringForm(){const el=document.getElementById('recurring-form-card'); if(el) el.classList.remove('hidden');}
function closeRecurringForm(){const el=document.getElementById('recurring-form-card'); if(el) el.classList.add('hidden');}
function saveRecurringFromForm(){
  const description=document.getElementById('rec-desc')?.value.trim();
  const amount=parseCurrency(document.getElementById('rec-amount')?.value||'');
  const day=parseInt(document.getElementById('rec-day')?.value||'1');
  const payment_method=document.getElementById('rec-payment')?.value||'pix';
  if(!description||!amount||day<1||day>28){showToast('Preencha descrição, valor e dia válido','error');return;}
  const items=getRecurringItems();
  items.push({id:crypto.randomUUID(),description,amount,day,payment_method,lastKey:''});
  saveRecurringItems(items);
  ['rec-desc','rec-amount'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  closeRecurringForm();
  showToast('Recorrência criada!','success');
  renderRecurring();
}
function deleteRecurring(id){const items=getRecurringItems().filter(r=>r.id!==id);saveRecurringItems(items);renderRecurring();showToast('Recorrência apagada','success');}
async function runRecurringNow(){await maybeRunRecurringTransactions();renderRecurring();renderCurrentPage();}
function renderRecurring(){
  const list=document.getElementById('recurring-list'); if(!list)return;
  const items=getRecurringItems();
  if(!items.length){list.innerHTML=emptyState('Nenhuma recorrência cadastrada','🔁');return;}
  list.innerHTML = `<div class="recurring-actions"><button class="btn-add" onclick="runRecurringNow()">Gerar pendências deste mês</button></div>` + items.map(r=>`<div class="recurring-row"><div><strong>${r.description}</strong><span>${formatCurrency(r.amount)} · todo dia ${r.day} · ${paymentLabel(r.payment_method||'pix')}</span></div><button class="btn-icon" onclick="deleteRecurring('${r.id}')">🗑️</button></div>`).join('');
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
  syncV5SettingsUI();
  applyV5VisualOptions();
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'block';
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      btn.textContent = '🍎 Ver instrução para iPhone';
    } else {
      btn.textContent = deferredInstallPrompt ? '📲 Instalar app' : '📲 Instalar / Ver dica';
    }
  }
  const emailEl = document.getElementById('settings-email');
  if (emailEl && currentUser) emailEl.textContent = currentUser.email;
  if (typeof syncProfileControlsV17 === 'function') syncProfileControlsV17();
  syncAppearanceControlsV11();
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
  document.getElementById('tx-modal-title').textContent = 'Lançamento rápido';
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-type').value = 'expense';
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-status').value = 'paid';
  document.getElementById('tx-payment').value = 'money';
  document.getElementById('tx-notes').value = '';
  document.getElementById('tx-installments').value = '1';
  document.getElementById('tx-card-group').style.display = 'none';
  document.getElementById('tx-installments-group').style.display = 'none';

  populateCategorySelect('expense');
  openModal('tx-modal');

  setTimeout(() => {
    const desc = document.getElementById('tx-description');
    const amount = document.getElementById('tx-amount');
    if (desc) desc.placeholder = 'Ex: Café, mercado, gasolina...';
    if (amount) amount.focus();
  }, 200);
}


// ============================================================
// CENTRAL DE AÇÕES RÁPIDAS - V13.1
// ============================================================
function openQuickActions() {
  openModal('quick-actions-modal');
}

function quickAction(action) {
  closeModal('quick-actions-modal');
  setTimeout(() => {
    switch (action) {
      case 'expense':
        openNewTransaction('expense');
        break;
      case 'income':
        openNewTransaction('income');
        break;
      case 'card':
        navigateTo('cards');
        setTimeout(openNewCard, 120);
        break;
      case 'bill':
        openNewTransaction('expense');
        setTimeout(() => {
          const status = document.getElementById('tx-status');
          const payment = document.getElementById('tx-payment');
          const title = document.getElementById('tx-modal-title');
          if (status) status.value = 'pending';
          if (payment) payment.value = 'boleto';
          if (title) title.textContent = 'Nova Conta a Pagar';
          if (typeof onPaymentChange === 'function') onPaymentChange();
        }, 180);
        break;
      case 'recurring':
        navigateTo('recurring');
        setTimeout(addRecurringPrompt, 120);
        break;
      case 'pending':
        navigateTo('pending-review');
        break;
    }
  }, 180);
}

// ============================================================
// MODAL
// ============================================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => {
    if (!modal.classList.contains('open')) modal.style.display = '';
  }, 180);
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    setTimeout(() => {
      if (!e.target.classList.contains('open')) e.target.style.display = '';
    }, 180);
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
  if (currentPage === 'insights') renderInsights();
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


// ============================================================
// V5 PREMIUM: segurança, pendências, inteligência e recorrências
// ============================================================
const V5_SECURITY_KEY = 'financeiro_v5_security';
const V5_OPTIONS_KEY = 'financeiro_v5_options';
const V5_RECURRING_KEY = 'financeiro_v5_recurring';
function isValidV5Pin(pin){return /^\d{4}$/.test(String(pin||''));}
function resetV5SecurityLocal(showMessage=true){
  localStorage.removeItem('financeiro_v5_security');
  localStorage.removeItem('financeiro_should_lock');
  const modal=document.getElementById('lock-modal-v5');
  if(modal) modal.classList.remove('open');
  document.body.style.overflow='';
  if(showMessage && typeof showToast==='function') showToast('Bloqueio local resetado. Crie um PIN novo nas Configurações.','success');
}
function getV5Security(){
  let s={pinEnabled:false,pin:'',lockOnBlur:false,biometric:false};
  try{s={...s,...JSON.parse(localStorage.getItem(V5_SECURITY_KEY)||'{}')};}catch(e){resetV5SecurityLocal(false);return s;}
  // Segurança anti-trava: se não tiver PIN válido, nunca bloqueia o app.
  if(!isValidV5Pin(s.pin)){
    s.pinEnabled=false;
    s.pin='';
    s.lockOnBlur=false;
    s.biometric=false;
    localStorage.setItem(V5_SECURITY_KEY,JSON.stringify(s));
  }
  return s;
}
function saveV5Security(c){localStorage.setItem(V5_SECURITY_KEY,JSON.stringify(c));}
function getV5Options(){return JSON.parse(localStorage.getItem(V5_OPTIONS_KEY)||'{"smartCategories":true,"smartAlerts":true,"privacy":false,"compact":false}');}
function saveV5Options(c){localStorage.setItem(V5_OPTIONS_KEY,JSON.stringify(c));}
function initV5PremiumFeatures(){resetV5SecurityLocal(false);syncV5SettingsUI();applyV5VisualOptions();maybeRunRecurringTransactions();setTimeout(()=>{if(getV5Options().smartAlerts)showSmartNudges();},1200);}
function syncV5SettingsUI(){const s=getV5Security(),o=getV5Options();const set=(id,v)=>{const e=document.getElementById(id);if(e)e.checked=!!v};set('pin-enabled-toggle',s.pinEnabled);set('lock-blur-toggle',s.lockOnBlur);set('biometric-toggle',s.biometric);set('smart-cat-toggle',o.smartCategories);set('smart-alert-toggle',o.smartAlerts);set('privacy-toggle',o.privacy);set('compact-toggle',o.compact);}
function setV5Option(k,v){const o=getV5Options();o[k]=v;saveV5Options(o);applyV5VisualOptions();showToast('Preferência salva!','success');}
function setSecurityOption(k,v){
  resetV5SecurityLocal(false);
  syncV5SettingsUI();
  showToast('PIN/biometria estão temporariamente desativados para evitar travamento.','error');
}
function togglePinSecurity(enabled){
  resetV5SecurityLocal(false);
  syncV5SettingsUI();
  showToast('PIN temporariamente desativado nesta versão.','error');
}
function setPinFlow(){
  resetV5SecurityLocal(false);
  showToast('Criação de PIN temporariamente desativada.','error');
}
function maybeShowLockOnOpen(){ resetV5SecurityLocal(false); }
function lockAppNow(showMsg=true){
  resetV5SecurityLocal(false);
  if(showMsg) showToast('Bloqueio temporariamente desativado.','success');
}
function unlockWithPin(){ resetV5SecurityLocal(true); }
async function unlockWithBiometric(){ showToast('Face ID/biometria temporariamente desativado.','error'); }
document.addEventListener('visibilitychange',()=>{ resetV5SecurityLocal(false); });
function togglePrivacyMode(v){const o=getV5Options();o.privacy=v;saveV5Options(o);applyV5VisualOptions();showToast('Modo privacidade atualizado!','success');}
function toggleCompactMode(v){const o=getV5Options();o.compact=v;saveV5Options(o);applyV5VisualOptions();showToast('Modo compacto atualizado!','success');}
function applyV5VisualOptions(){const o=getV5Options();document.body.classList.toggle('privacy-mode-v5',!!o.privacy);document.body.classList.toggle('compact-mode-v5',!!o.compact);}
function smartSuggestCategoryId(description,type,currentCategoryId){if(currentCategoryId||!getV5Options().smartCategories)return currentCategoryId;const text=(description||'').toLowerCase();const rules=[['mercado|supermercado|atacad|carrefour',['Mercado','Alimentação']],['uber|99|taxi|gasolina|combustível|combustivel',['Transporte','Combustível']],['ifood|restaurante|lanche|pizza|almoço|almoco|janta|café|cafe',['Alimentação','Lazer']],['netflix|spotify|prime|assinatura|icloud',['Assinaturas']],['academia|gym|smart fit',['Academia','Saúde']],['farmacia|remedio|médico|medico|saúde|saude',['Saúde']],['salario|salário|pagamento|recebi',['Salário']]];for(const [pat,names] of rules){if(new RegExp(pat).test(text)){const c=allCategories.find(cat=>names.some(n=>cat.name?.toLowerCase().includes(n.toLowerCase()))&&(cat.type===type||cat.type==='both'));if(c)return c.id;}}return currentCategoryId;}
function getPendingReviewTransactions(){return allTransactions.filter(t=>t.status==='pending'&&((t.notes||'').includes('[REVISAR]')||(t.description||'').includes('[REVISAR]')));}
function renderPendingReview(){updateMonthLabel();const list=getPendingReviewTransactions().sort((a,b)=>b.date.localeCompare(a.date));const count=document.getElementById('pending-count-v5');if(count)count.textContent=list.length;const el=document.getElementById('pending-review-list');if(!el)return;if(!list.length){el.innerHTML=emptyState('Nenhuma pendência para revisar','✅');return;}el.innerHTML=list.map(t=>`<div class="pending-row-v5"><div class="tx-icon">⚡</div><div class="tx-info"><div class="tx-description">${(t.description||'').replace('[REVISAR]','').trim()}</div><div class="tx-meta">${formatDateBR(t.date)} · ${paymentLabel(t.payment_method)} · ${formatCurrency(t.amount)}</div></div><div class="pending-actions-v5"><button class="btn-add" onclick="openEditTransaction('${t.id}')">Completar</button><button class="btn-secondary" onclick="quickApprovePending('${t.id}')">OK rápido</button></div></div>`).join('');}
async function quickApprovePending(id){const tx=allTransactions.find(t=>t.id===id);if(!tx)return;const clean=(tx.notes||'').replace('[REVISAR]','').trim();const {error}=await db.from('transactions').update({status:'paid',notes:clean}).eq('id',id).eq('user_id',currentUser.id);if(error){showToast('Erro ao confirmar pendência','error');return;}showToast('Pendência confirmada!','success');await loadTransactions();renderPendingReview();}
function showSmartNudges(){const p=getPendingReviewTransactions().length;if(p)showToast(`Você tem ${p} pendência(s) para revisar ⚡`,'success');}
function showSmartMonthlySummary(){const txs=allTransactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return d.getMonth()+1===currentMonth&&d.getFullYear()===currentYear});const income=txs.filter(t=>t.type==='income'&&t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount),0);const expenses=txs.filter(t=>t.type==='expense'&&t.status==='paid').reduce((s,t)=>s+parseFloat(t.amount),0);const committed=txs.filter(t=>t.type==='expense'&&t.status==='pending').reduce((s,t)=>s+parseFloat(t.amount),0);const projected=income-expenses-committed;alert(`Resumo inteligente do mês:\n\nReceitas pagas: ${formatCurrency(income)}\nDespesas pagas: ${formatCurrency(expenses)}\nDinheiro comprometido: ${formatCurrency(committed)}\nSaldo projetado após pendências: ${formatCurrency(projected)}\n\n${projected<0?'⚠️ Se tudo for pago, o mês pode fechar negativo.':'✅ Você ainda tem margem após as pendências.'}`);}
function getRecurringItems(){return JSON.parse(localStorage.getItem(V5_RECURRING_KEY)||'[]');}function saveRecurringItems(i){localStorage.setItem(V5_RECURRING_KEY,JSON.stringify(i));}
function addRecurringPrompt(){const description=prompt('Nome da recorrência (ex: Internet, Academia):');if(!description)return;const amount=parseCurrency(prompt('Valor mensal (ex: 99,90):')||'');if(!amount){showToast('Valor inválido','error');return;}const day=parseInt(prompt('Dia do mês para lançar (1 a 28):')||'1');if(day<1||day>28){showToast('Use um dia entre 1 e 28','error');return;}const payment_method=prompt('Forma de pagamento: pix, money, credit_card, boleto','pix')||'pix';const items=getRecurringItems();items.push({id:crypto.randomUUID(),description,amount,day,payment_method,lastKey:''});saveRecurringItems(items);showToast('Recorrência criada!','success');}
function manageRecurringPrompt(){const items=getRecurringItems();if(!items.length){alert('Nenhuma recorrência criada.');return;}const text=items.map((r,i)=>`${i+1}. ${r.description} - ${formatCurrency(r.amount)} todo dia ${r.day}`).join('\n');const del=prompt(`Recorrências:\n\n${text}\n\nDigite o número para apagar ou deixe vazio para fechar:`);const idx=parseInt(del||'0')-1;if(idx>=0&&items[idx]){items.splice(idx,1);saveRecurringItems(items);showToast('Recorrência apagada!','success');}}
async function maybeRunRecurringTransactions(){const items=getRecurringItems();if(!items.length||!currentUser)return;const key=`${currentYear}-${String(currentMonth).padStart(2,'0')}`;const rows=[];items.forEach(r=>{if(r.lastKey===key)return;const d=new Date(currentYear,currentMonth-1,Math.min(28,r.day));rows.push({user_id:currentUser.id,type:'expense',description:r.description,amount:r.amount,date:d.toISOString().split('T')[0],category_id:null,status:'pending',payment_method:r.payment_method||'pix',notes:'[RECORRENTE] gerado automaticamente'});r.lastKey=key;});if(!rows.length)return;const {error}=await db.from('transactions').insert(rows);if(!error){saveRecurringItems(items);await loadTransactions();showToast(`${rows.length} recorrência(s) lançada(s) para este mês`,'success');}}
setTimeout(()=>{const p=document.getElementById('pin-input-v5');if(p)p.addEventListener('keydown',e=>{if(e.key==='Enter')unlockWithPin();});},500);

// V9 OVERRIDES FINAIS: segurança desativada temporariamente
function resetV5SecurityLocal(showMessage=false){try{Object.keys(localStorage).forEach(k=>{if(/pin|lock|security|biometric|auth_lock|bloque/i.test(k))localStorage.removeItem(k)});Object.keys(sessionStorage).forEach(k=>{if(/pin|lock|security|biometric|auth_lock|bloque/i.test(k))sessionStorage.removeItem(k)});localStorage.setItem('financeiro_security_disabled_v9','true')}catch(e){}const modal=document.getElementById('lock-modal-v5');if(modal){modal.classList.remove('open');modal.style.display='none';modal.remove()}if(document.body)document.body.style.overflow='';if(showMessage&&typeof showToast==='function')showToast('Bloqueio desativado temporariamente.','success')}
function getV5Security(){return{pinEnabled:false,pin:'',lockOnBlur:false,biometric:false}}
function saveV5Security(){resetV5SecurityLocal(false)}
function setSecurityOption(){resetV5SecurityLocal(false);if(typeof syncV5SettingsUI==='function')syncV5SettingsUI();if(typeof showToast==='function')showToast('PIN/Face ID desativados nesta versão.','success')}
function togglePinSecurity(){resetV5SecurityLocal(false);if(typeof syncV5SettingsUI==='function')syncV5SettingsUI();if(typeof showToast==='function')showToast('PIN desativado nesta versão.','success')}
function setPinFlow(){resetV5SecurityLocal(false);if(typeof showToast==='function')showToast('PIN será refeito em uma versão segura depois.','success')}
function maybeShowLockOnOpen(){resetV5SecurityLocal(false)}
function lockAppNow(){resetV5SecurityLocal(false);if(typeof showToast==='function')showToast('Bloqueio desativado temporariamente.','success')}
function unlockWithPin(){resetV5SecurityLocal(true)}
async function unlockWithBiometric(){resetV5SecurityLocal(false);if(typeof showToast==='function')showToast('Face ID desativado temporariamente.','success')}
window.addEventListener('DOMContentLoaded',()=>{resetV5SecurityLocal(false);setInterval(()=>resetV5SecurityLocal(false),500)});


// ============================================================
// V11 - APARÊNCIA: iOS GLASS + CYANO DARK + CORES
// ============================================================
const APPEARANCE_V11_KEY = 'financeiro_appearance_v11';
const DEFAULT_APPEARANCE_V11 = { uiStyle: 'ios-glass', accent: '#007aff' };

function getAppearanceV11() {
  try {
    return { ...DEFAULT_APPEARANCE_V11, ...(JSON.parse(localStorage.getItem(APPEARANCE_V11_KEY) || '{}')) };
  } catch (e) {
    return { ...DEFAULT_APPEARANCE_V11 };
  }
}

function saveAppearanceV11(settings) {
  localStorage.setItem(APPEARANCE_V11_KEY, JSON.stringify({ ...getAppearanceV11(), ...settings }));
}

function applyAppearanceV11() {
  const settings = getAppearanceV11();
  document.body.classList.remove('ios-glass', 'cyano-dark');
  document.body.classList.add(settings.uiStyle || 'ios-glass');
  document.documentElement.style.setProperty('--primary', settings.accent || '#007aff');
  document.documentElement.style.setProperty('--primary-light', lightenHex(settings.accent || '#007aff', 18));
  document.documentElement.style.setProperty('--primary-dark', darkenHex(settings.accent || '#007aff', 14));
  syncAppearanceControlsV11();
}

function setUIStyle(style) {
  saveAppearanceV11({ uiStyle: style });
  applyAppearanceV11();
  showToast(style === 'cyano-dark' ? 'Visual Cyano Dark ativado!' : 'Visual iOS Glass ativado!', 'success');
}

function setAccentColor(color) {
  saveAppearanceV11({ accent: color });
  applyAppearanceV11();
  showToast('Cor atualizada!', 'success');
}

function resetAppearanceV11() {
  localStorage.setItem(APPEARANCE_V11_KEY, JSON.stringify(DEFAULT_APPEARANCE_V11));
  applyAppearanceV11();
  showToast('Aparência restaurada!', 'success');
}

function syncAppearanceControlsV11() {
  const settings = getAppearanceV11();
  const ios = document.getElementById('ui-style-ios');
  const cyano = document.getElementById('ui-style-cyano');
  if (ios) ios.classList.toggle('active', settings.uiStyle === 'ios-glass');
  if (cyano) cyano.classList.toggle('active', settings.uiStyle === 'cyano-dark');
  const picker = document.getElementById('custom-accent-color');
  if (picker) picker.value = settings.accent || '#007aff';
}

function lightenHex(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#5aa9ff';
  const mix = (c) => Math.round(c + (255 - c) * percent / 100);
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

function darkenHex(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#0051d5';
  const mix = (c) => Math.round(c * (1 - percent / 100));
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#','');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return { r: parseInt(clean.slice(0,2),16), g: parseInt(clean.slice(2,4),16), b: parseInt(clean.slice(4,6),16) };
}

function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2,'0')).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(applyAppearanceV11);
});

// ============================================================
// V13 FIX: renderizador central seguro
// ============================================================
function renderCurrentPage() {
  switch (currentPage) {
    case 'dashboard': return renderDashboard();
    case 'transactions': return renderTransactions();
    case 'pending-review': return renderPendingReview();
    case 'bills': return renderBills();
    case 'cards': return renderCards();
    case 'categories': return renderCategories();
    case 'budgets': return renderBudgets();
    case 'reports': return renderReports();
    case 'calendar': return renderCalendar();
    case 'insights': return renderInsights();
    case 'recurring': return renderRecurring();
    case 'subscriptions': return renderSubscriptions();
    case 'import-history': return renderImportHistory();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

// ============================================================
// V15: INTELIGÊNCIA AVANÇADA, APRENDIZADO E PREVISÕES
// ============================================================
const CYANO_RULES_V15_KEY = 'cyano_category_rules_v15';

function normalizeTextV15(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCategoryRulesV15() {
  try { return JSON.parse(localStorage.getItem(CYANO_RULES_V15_KEY) || '{}'); }
  catch { return {}; }
}

function saveCategoryRulesV15(rules) {
  localStorage.setItem(CYANO_RULES_V15_KEY, JSON.stringify(rules || {}));
}

function learnCategoryRuleV15(description, categoryId) {
  if (!description || !categoryId) return;
  const cat = allCategories.find(c => c.id === categoryId);
  if (!cat) return;
  const words = normalizeTextV15(description).split(' ').filter(w => w.length >= 3 && !/^\d+$/.test(w));
  if (!words.length) return;
  const rules = getCategoryRulesV15();
  words.slice(0, 4).forEach(word => { rules[word] = categoryId; });
  saveCategoryRulesV15(rules);
}

function guessCategoryIdV15(description) {
  const clean = normalizeTextV15(description);
  if (!clean) return null;
  const rules = getCategoryRulesV15();
  const words = clean.split(' ').filter(Boolean);
  for (const word of words) {
    if (rules[word] && allCategories.some(c => c.id === rules[word])) return rules[word];
  }
  const builtins = [
    [['uber','99','taxi','combustivel','posto','gasolina'], ['Transporte','Combustível']],
    [['ifood','restaurante','lanche','pizza','almoco','jantar','padaria'], ['Alimentação']],
    [['mercado','supermercado','atacadao','assai','carrefour'], ['Mercado','Alimentação']],
    [['netflix','spotify','prime','disney','assinatura'], ['Assinaturas','Lazer']],
    [['farmacia','drogaria','medico','saude'], ['Saúde']],
    [['academia','gym'], ['Academia','Saúde']],
    [['faculdade','curso','livro','educacao'], ['Educação']],
    [['energia','cemig','equatorial'], ['Energia']],
    [['agua','saneago'], ['Água']],
    [['internet','vivo','claro','tim'], ['Internet']],
  ];
  for (const [keys, cats] of builtins) {
    if (keys.some(k => clean.includes(k))) {
      const found = allCategories.find(c => cats.some(name => normalizeTextV15(c.name).includes(normalizeTextV15(name))));
      if (found) return found.id;
    }
  }
  return null;
}

function applyCategorySuggestionV15() {
  const descEl = document.getElementById('tx-description');
  const catEl = document.getElementById('tx-category');
  if (!descEl || !catEl || catEl.value) return;
  const guessed = guessCategoryIdV15(descEl.value);
  if (guessed) {
    catEl.value = guessed;
    const cat = allCategories.find(c => c.id === guessed);
    showToast(`Categoria sugerida: ${cat?.name || 'categoria'}`, 'success');
  }
}

(function installSmartCategoryHookV15(){
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'tx-description') {
      clearTimeout(window.__cyanoSuggestTimerV15);
      window.__cyanoSuggestTimerV15 = setTimeout(applyCategorySuggestionV15, 450);
    }
  });

  if (typeof saveTransaction === 'function' && !window.__saveTransactionWrappedV15) {
    const originalSaveTransaction = saveTransaction;
    window.__saveTransactionWrappedV15 = true;
    saveTransaction = async function(e) {
      const desc = document.getElementById('tx-description')?.value || '';
      const cat = document.getElementById('tx-category')?.value || '';
      learnCategoryRuleV15(desc, cat);
      return originalSaveTransaction(e);
    };
  }
})();

function getMonthTxsV15(monthOffset = 0) {
  const base = new Date(currentYear, currentMonth - 1 + monthOffset, 1);
  const m = base.getMonth() + 1;
  const y = base.getFullYear();
  return allTransactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === m && d.getFullYear() === y;
  });
}

function sumTxsV15(txs, type, paidOnly = true) {
  return txs.filter(t => t.type === type && (!paidOnly || t.status === 'paid'))
    .reduce((s,t)=>s+parseFloat(t.amount||0),0);
}

function renderMonthlyComparisonV15() {
  const el = document.getElementById('monthly-comparison-v15');
  if (!el) return;
  const curr = getMonthTxsV15(0);
  const prev = getMonthTxsV15(-1);
  const currExp = sumTxsV15(curr, 'expense', true);
  const prevExp = sumTxsV15(prev, 'expense', true);
  const currInc = sumTxsV15(curr, 'income', true);
  const prevInc = sumTxsV15(prev, 'income', true);
  const diffExp = currExp - prevExp;
  const diffInc = currInc - prevInc;
  const byCat = {};
  curr.filter(t=>t.type==='expense').forEach(t=>{ const n=t.categories?.name||'Outros'; byCat[n]=(byCat[n]||0)+parseFloat(t.amount||0); });
  const prevByCat = {};
  prev.filter(t=>t.type==='expense').forEach(t=>{ const n=t.categories?.name||'Outros'; prevByCat[n]=(prevByCat[n]||0)+parseFloat(t.amount||0); });
  const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,val])=>{
    const p = prevByCat[name] || 0;
    const d = val-p;
    return `<div class="v15-compare-row"><span>${name}</span><strong class="${d>0?'negative':'positive'}">${d>=0?'+':''}${formatCurrency(d)}</strong></div>`;
  }).join('') || '<div class="empty-mini">Sem dados suficientes ainda</div>';
  el.innerHTML = `
    <div class="v15-compare-row"><span>Despesas vs mês anterior</span><strong class="${diffExp>0?'negative':'positive'}">${diffExp>=0?'+':''}${formatCurrency(diffExp)}</strong></div>
    <div class="v15-compare-row"><span>Receitas vs mês anterior</span><strong class="${diffInc>=0?'positive':'negative'}">${diffInc>=0?'+':''}${formatCurrency(diffInc)}</strong></div>
    <div class="v15-mini-title">Categorias que mais mudaram</div>
    ${catRows}
  `;
}

function renderCardLimitIntelligenceV15() {
  const el = document.getElementById('card-limit-intelligence-v15');
  if (!el) return;
  if (!allCards.length) { el.innerHTML = emptyState('Cadastre um cartão para ver análise de limite', '💳'); return; }
  const today = new Date();
  el.innerHTML = allCards.map(card => {
    const start = getCardPeriodStart(card, today);
    const end = getCardPeriodEnd(card, today);
    const used = allTransactions.filter(t => t.credit_card_id === card.id && t.type === 'expense' && t.date >= start && t.date <= end)
      .reduce((s,t)=>s+parseFloat(t.amount||0),0);
    const limit = parseFloat(card.credit_limit||0);
    const pct = limit > 0 ? Math.min(100, Math.round((used/limit)*100)) : 0;
    const status = pct >= 85 ? 'danger' : pct >= 65 ? 'warning' : 'success';
    const msg = pct >= 85 ? 'Atenção: limite bem alto' : pct >= 65 ? 'Controle recomendado' : 'Limite confortável';
    return `<div class="v15-card-limit ${status}">
      <div><strong>${card.name}</strong><span>${msg}</span></div>
      <div class="v15-limit-meter"><i style="width:${pct}%"></i></div>
      <b>${pct}% · ${formatCurrency(used)} de ${formatCurrency(limit)}</b>
    </div>`;
  }).join('');
}

// Override seguro do renderInsights existente com blocos extras V15.
if (typeof renderInsights === 'function') {
  const renderInsightsBaseV15 = renderInsights;
  renderInsights = function() {
    renderInsightsBaseV15();
    renderMonthlyComparisonV15();
    renderCardLimitIntelligenceV15();
  };
}

// Reforça atualização dos cards inteligentes quando a página atual for Insights.
(function wrapRenderCurrentPageV15(){
  if (typeof renderCurrentPage === 'function' && !window.__renderCurrentWrappedV15) {
    const oldRenderCurrentPage = renderCurrentPage;
    window.__renderCurrentWrappedV15 = true;
    renderCurrentPage = function(){
      const r = oldRenderCurrentPage();
      if (currentPage === 'insights') { renderMonthlyComparisonV15(); renderCardLimitIntelligenceV15(); }
      return r;
    };
  }
})();


// ============================================================
// V16.1 - ASSINATURAS INTELIGENTES (localStorage + lançamentos)
// ============================================================
const CYANO_SUBSCRIPTIONS_KEY = 'cyano_subscriptions_v16';

function getSubscriptionsKey(){
  return `${CYANO_SUBSCRIPTIONS_KEY}_${currentUser?.id || 'local'}`;
}
function loadSubscriptions(){
  try { return JSON.parse(localStorage.getItem(getSubscriptionsKey()) || '[]'); }
  catch(e){ return []; }
}
function saveSubscriptions(list){
  localStorage.setItem(getSubscriptionsKey(), JSON.stringify(list || []));
}
function subscriptionTemplates(){
  return {
    'Netflix': { amount: '39,90', icon:'🎬' },
    'Spotify': { amount: '21,90', icon:'🎵' },
    'YouTube Premium': { amount: '24,90', icon:'▶️' },
    'Amazon Prime': { amount: '19,90', icon:'📦' },
    'Disney+': { amount: '33,90', icon:'🏰' },
    'Max': { amount: '34,90', icon:'🎞️' },
    'iCloud': { amount: '4,90', icon:'☁️' },
    'Google One': { amount: '6,99', icon:'☁️' },
    'Canva': { amount: '34,90', icon:'🎨' },
    'ChatGPT': { amount: '110,00', icon:'🤖' },
    'Academia': { amount: '99,90', icon:'🏋️' },
    'Internet': { amount: '99,90', icon:'🌐' },
    'Celular': { amount: '49,90', icon:'📱' },
    'Energia': { amount: '150,00', icon:'💡' },
    'Água': { amount: '80,00', icon:'💧' },
    'Aluguel': { amount: '1200,00', icon:'🏠' }
  };
}
function getSubscriptionIcon(name){
  const t = subscriptionTemplates()[name];
  if (t?.icon) return t.icon;
  const s = String(name||'').toLowerCase();
  if (s.includes('netflix') || s.includes('disney') || s.includes('max')) return '🎬';
  if (s.includes('spotify') || s.includes('music')) return '🎵';
  if (s.includes('icloud') || s.includes('google')) return '☁️';
  if (s.includes('academ')) return '🏋️';
  return '🔁';
}
function openSubscriptionForm(id=null){
  const form = document.getElementById('subscription-form-card');
  if (!form) return;
  const subs = loadSubscriptions();
  const sub = id ? subs.find(s=>s.id===id) : null;
  document.getElementById('subscription-form-title').textContent = sub ? 'Editar assinatura' : 'Nova assinatura';
  document.getElementById('sub-id').value = sub?.id || '';
  document.getElementById('sub-template').value = '';
  document.getElementById('sub-name').value = sub?.name || '';
  document.getElementById('sub-amount').value = sub ? formatAmountInput(sub.amount) : '';
  document.getElementById('sub-day').value = sub?.day || 5;
  document.getElementById('sub-payment').value = sub?.payment_method || 'credit_card';
  document.getElementById('sub-status').value = sub?.status || 'active';
  document.getElementById('sub-notes').value = sub?.notes || '';
  populateSubscriptionCards(sub?.credit_card_id || '');
  toggleSubscriptionCardField();
  form.classList.remove('hidden');
  setTimeout(()=>document.getElementById('sub-name')?.focus(), 80);
}
function closeSubscriptionForm(){
  const form = document.getElementById('subscription-form-card');
  if (form) form.classList.add('hidden');
}
function applySubscriptionTemplate(){
  const name = document.getElementById('sub-template')?.value;
  if (!name) return;
  const t = subscriptionTemplates()[name] || {};
  document.getElementById('sub-name').value = name;
  if (!document.getElementById('sub-amount').value && t.amount) document.getElementById('sub-amount').value = t.amount;
}
function populateSubscriptionCards(selected=''){
  const sel = document.getElementById('sub-card');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o cartão</option>' + allCards.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${c.name}</option>`).join('');
}
function toggleSubscriptionCardField(){
  const wrap = document.getElementById('sub-card-wrap');
  const payment = document.getElementById('sub-payment')?.value;
  if (wrap) wrap.style.display = payment === 'credit_card' ? 'block' : 'none';
}
function normalizeSubName(name){
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}
async function saveSubscriptionFromForm(){
  const id = document.getElementById('sub-id').value;
  const name = document.getElementById('sub-name').value.trim();
  const amount = parseCurrency(document.getElementById('sub-amount').value);
  const day = Math.min(28, Math.max(1, parseInt(document.getElementById('sub-day').value || '5', 10)));
  const payment_method = document.getElementById('sub-payment').value;
  const credit_card_id = payment_method === 'credit_card' ? (document.getElementById('sub-card').value || null) : null;
  const status = document.getElementById('sub-status').value;
  const notes = document.getElementById('sub-notes').value.trim();
  if (!name || !amount) { showToast('Informe nome e valor da assinatura', 'error'); return; }
  let subs = loadSubscriptions();
  const duplicate = subs.find(s => s.id !== id && normalizeSubName(s.name) === normalizeSubName(name));
  if (duplicate && !confirm('Já existe uma assinatura com esse nome. Quer salvar mesmo assim?')) return;
  const now = new Date().toISOString();
  const payload = { id: id || crypto.randomUUID(), name, amount, day, payment_method, credit_card_id, status, notes, updated_at: now, created_at: id ? (subs.find(s=>s.id===id)?.created_at || now) : now, last_generated_month: null };
  if (id) subs = subs.map(s=>s.id===id ? { ...s, ...payload, last_generated_month: s.last_generated_month || null } : s);
  else subs.unshift(payload);
  saveSubscriptions(subs);
  closeSubscriptionForm();
  showToast(id ? 'Assinatura atualizada!' : 'Assinatura criada!', 'success');
  await generateSubscriptionMonths(payload, 12, {silent:true});
  showToast(id ? 'Assinatura atualizada e próximos meses verificados!' : 'Assinatura criada e próximos 12 meses gerados!', 'success');
  renderSubscriptions();
  if (currentPage === 'cards') renderCards();
}
function subscriptionMonthKey(year=currentYear, month=currentMonth){
  return `${year}-${String(month).padStart(2,'0')}`;
}
function addMonthsFromCurrent(offset=0){
  const d = new Date(currentYear, currentMonth - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
function subscriptionChargeDate(sub, year=currentYear, month=currentMonth){
  const d = new Date(year, month - 1, Math.min(28, Number(sub.day || 5)));
  return d.toISOString().split('T')[0];
}
function subscriptionExists(sub, monthKey){
  return allTransactions.some(t => String(t.notes||'').includes(`[SUBSCRIPTION_ID:${sub.id}]`) && String(t.notes||'').includes(`[SUB_MONTH:${monthKey}]`));
}
function buildSubscriptionRow(sub, year=currentYear, month=currentMonth){
  const monthKey = subscriptionMonthKey(year, month);
  return {
    user_id: currentUser.id,
    type: 'expense',
    description: `${sub.name} (Assinatura)`,
    amount: Number(sub.amount || 0),
    date: subscriptionChargeDate(sub, year, month),
    category_id: guessSubscriptionCategoryId(sub.name),
    status: 'pending',
    payment_method: sub.payment_method || 'pix',
    credit_card_id: sub.payment_method === 'credit_card' ? (sub.credit_card_id || null) : null,
    notes: `[SOURCE:subscription] [SUBSCRIPTION_ID:${sub.id}] [SUB_MONTH:${monthKey}] ${sub.notes || ''}`.trim()
  };
}
async function generateSubscriptionMonths(sub, months=12, opts={}){
  if (!sub || sub.status !== 'active') return {created:0, skipped:0};
  months = Math.max(1, Math.min(36, Number(months || 12)));
  const rows = [];
  let skipped = 0;
  for (let i = 0; i < months; i++) {
    const { year, month } = addMonthsFromCurrent(i);
    const monthKey = subscriptionMonthKey(year, month);
    if (subscriptionExists(sub, monthKey) || rows.some(r => String(r.notes||'').includes(`[SUB_MONTH:${monthKey}]`))) {
      skipped++;
      continue;
    }
    rows.push(buildSubscriptionRow(sub, year, month));
  }
  if (!rows.length) {
    if(!opts.silent) showToast(`Nenhuma cobrança nova. ${skipped} mês(es) já existiam.`, 'success');
    return {created:0, skipped};
  }
  const { error } = await db.from('transactions').insert(rows);
  if (error) { console.error(error); if(!opts.silent) showToast('Erro ao gerar assinaturas', 'error'); return {created:0, skipped, error}; }
  await loadTransactions();
  if(!opts.silent) showToast(`${rows.length} cobrança(s) gerada(s). ${skipped} já existiam.`, 'success');
  return {created:rows.length, skipped};
}
async function generateSubscriptionForCurrentMonth(sub, opts={}){
  return generateSubscriptionMonths(sub, 1, opts);
}
async function generateSubscriptionFuture(id, months=12){
  const sub = loadSubscriptions().find(s=>s.id===id);
  const res = await generateSubscriptionMonths(sub, months, {silent:false});
  await loadTransactions();
  renderSubscriptions();
  if (currentPage === 'cards') renderCards();
  return res;
}
function guessSubscriptionCategoryId(name){
  const s = normalizeSubName(name);
  const findCat = words => allCategories.find(c => words.some(w => normalizeSubName(c.name).includes(w)));
  let cat = null;
  if (/(netflix|spotify|youtube|prime|disney|max|canva|chatgpt)/.test(s)) cat = findCat(['assinatura','lazer','educacao','outros']);
  if (/(academ)/.test(s)) cat = findCat(['academia','saude','outros']);
  if (/(internet|celular|icloud|google)/.test(s)) cat = findCat(['internet','assinatura','outros']);
  if (/(energia|agua|aluguel)/.test(s)) cat = findCat(['moradia','energia','agua','outros']);
  return cat?.id || getOutrosCategoryId?.() || null;
}
async function generateAllSubscriptionsForCurrentMonth(){
  const subs = loadSubscriptions().filter(s=>s.status==='active');
  let created=0, skipped=0;
  for (const sub of subs) {
    const res = await generateSubscriptionMonths(sub, 12, {silent:true});
    created += res.created || 0; skipped += res.skipped || 0;
  }
  showToast(`Assinaturas: ${created} cobrança(s) gerada(s), ${skipped} já existiam`, 'success');
  await loadTransactions();
  renderSubscriptions();
  renderCurrentPage();
}
function toggleSubscriptionStatus(id){
  const subs = loadSubscriptions().map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s);
  saveSubscriptions(subs); renderSubscriptions();
}
function deleteSubscription(id){
  if (!confirm('Excluir esta assinatura? Os lançamentos já criados continuam salvos.')) return;
  saveSubscriptions(loadSubscriptions().filter(s=>s.id!==id));
  showToast('Assinatura excluída!', 'success');
  renderSubscriptions();
}
function renderSubscriptions(){
  const subs = loadSubscriptions();
  const active = subs.filter(s=>s.status==='active');
  const total = active.reduce((sum,s)=>sum+Number(s.amount||0),0);
  const monthEl=document.getElementById('subs-total-month'); if(monthEl) monthEl.textContent=formatCurrency(total);
  const yearEl=document.getElementById('subs-total-year'); if(yearEl) yearEl.textContent=formatCurrency(total*12);
  const countEl=document.getElementById('subs-active-count'); if(countEl) countEl.textContent=String(active.length);
  renderSubscriptionAlerts(subs);
  const list=document.getElementById('subscriptions-list');
  if(!list) return;
  if(!subs.length){ list.innerHTML = emptyState('Nenhuma assinatura cadastrada', '📺'); return; }
  const sorted = [...subs].sort((a,b)=> (a.status==='active'?0:1) - (b.status==='active'?0:1) || Number(b.amount||0)-Number(a.amount||0));
  list.innerHTML = sorted.map(sub=>{
    const card = allCards.find(c=>c.id===sub.credit_card_id);
    const monthKey = subscriptionMonthKey();
    const generated = subscriptionExists(sub, monthKey);
    return `<div class="subscription-row ${sub.status==='paused'?'paused':''}">
      <div class="subscription-icon">${getSubscriptionIcon(sub.name)}</div>
      <div class="subscription-info">
        <div class="subscription-name">${sub.name}</div>
        <div class="subscription-meta">${formatCurrency(sub.amount)} · dia ${sub.day || 5} · ${paymentLabel(sub.payment_method||'pix')}${card ? ' · '+card.name : ''}</div>
        <div class="subscription-badges"><span class="badge ${sub.status==='active'?'badge-paid':'badge-pending'}">${sub.status==='active'?'Ativa':'Pausada'}</span>${generated?'<span class="badge badge-paid">Gerada este mês</span>':'<span class="badge badge-pending">Ainda não gerada</span>'}</div>
      </div>
      <div class="subscription-actions">
        <button class="btn-icon" title="Editar" onclick="openSubscriptionForm('${sub.id}')">✏️</button>
        <button class="btn-icon" title="Pausar/ativar" onclick="toggleSubscriptionStatus('${sub.id}')">${sub.status==='active'?'⏸️':'▶️'}</button>
        <button class="btn-icon" title="Gerar próximos 12 meses" onclick="generateSubscriptionFuture('${sub.id}', 12)">📆</button>
        <button class="btn-icon" title="Excluir" onclick="deleteSubscription('${sub.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}
function renderSubscriptionAlerts(subs){
  const el=document.getElementById('subs-alerts'); if(!el) return;
  const active=subs.filter(s=>s.status==='active');
  const total=active.reduce((sum,s)=>sum+Number(s.amount||0),0);
  const top=[...active].sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)).slice(0,3);
  const alerts=[];
  if(total>300) alerts.push(`⚠️ Você está gastando ${formatCurrency(total)}/mês em assinaturas.`);
  if(top.length) alerts.push(`🔥 Mais caras: ${top.map(s=>`${s.name} (${formatCurrency(s.amount)})`).join(', ')}`);
  const possible = detectPossibleSubscriptions();
  if(possible.length) alerts.push(`💡 Detectei possíveis assinaturas pelos lançamentos: ${possible.slice(0,3).map(p=>p.name).join(', ')}.`);
  el.innerHTML = alerts.length ? alerts.map(a=>`<div class="subscription-alert">${a}</div>`).join('') : '<div class="subscription-alert good">✅ Tudo certo. Nenhum alerta de assinatura agora.</div>';
}
function detectPossibleSubscriptions(){
  const map = {};
  allTransactions.filter(t=>t.type==='expense').forEach(t=>{
    const name = normalizeSubName(t.description).replace(/ assinatura/g,'').slice(0,30);
    const amount = Number(t.amount||0).toFixed(2);
    const key = `${name}|${amount}`;
    map[key] = map[key] || {name:t.description.replace(/\s*\(Assinatura\)/i,''), amount:Number(t.amount||0), count:0};
    map[key].count++;
  });
  return Object.values(map).filter(x=>x.count>=2 && !loadSubscriptions().some(s=>normalizeSubName(s.name)===normalizeSubName(x.name)));
}

// Adiciona Assinaturas aos menus dinâmicos sem depender da versão original
(function ensureSubscriptionsNavigation(){
  try {
    const oldNavigate = navigateTo;
    if (!window.__subsNavWrapped) {
      window.__subsNavWrapped = true;
      navigateTo = function(page){
        oldNavigate(page);
        if (page === 'subscriptions') renderSubscriptions();
      };
    }
  } catch(e) { console.warn('subs nav wrapper failed', e); }
})();


// ============================================================
// V17.1 - PERFIL, CAMADAS MOBILE E RESUMO RÁPIDO
// ============================================================
const CYANO_PROFILE_V17_KEY = 'cyano_profile_v17';

function getProfileV17() {
  try { return JSON.parse(localStorage.getItem(CYANO_PROFILE_V17_KEY) || '{}'); }
  catch { return {}; }
}

function saveProfileV17(profile) {
  localStorage.setItem(CYANO_PROFILE_V17_KEY, JSON.stringify({ ...getProfileV17(), ...profile }));
  applyProfileV17();
}

function applyProfileV17() {
  const profile = getProfileV17();
  const fallbackName = currentUser?.email?.split('@')?.[0] || 'Usuário';
  const displayName = (profile.name || '').trim() || fallbackName;
  const avatarUrl = profile.avatar || '';

  const userName = document.getElementById('user-name');
  if (userName) userName.textContent = displayName;

  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    if (avatarUrl) {
      avatar.innerHTML = `<img src="${avatarUrl}" alt="Foto de perfil">`;
      avatar.classList.add('has-photo-v17');
    } else {
      avatar.textContent = displayName.charAt(0).toUpperCase();
      avatar.classList.remove('has-photo-v17');
    }
  }

  const preview = document.getElementById('profile-photo-preview');
  if (preview) {
    if (avatarUrl) {
      preview.innerHTML = `<img src="${avatarUrl}" alt="Foto de perfil">`;
      preview.classList.add('has-photo-v17');
    } else {
      preview.textContent = displayName.charAt(0).toUpperCase();
      preview.classList.remove('has-photo-v17');
    }
  }

  const nameInput = document.getElementById('profile-display-name');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = profile.name || '';
}

function syncProfileControlsV17() {
  applyProfileV17();
}

function saveProfileName(value) {
  saveProfileV17({ name: (value || '').slice(0, 32) });
}

function handleProfilePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Escolha uma imagem válida', 'error'); return; }
  if (file.size > 2.5 * 1024 * 1024) { showToast('Imagem muito grande. Use até 2,5 MB.', 'error'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    saveProfileV17({ avatar: reader.result });
    showToast('Foto de perfil atualizada!', 'success');
  };
  reader.onerror = () => showToast('Não consegui carregar a foto', 'error');
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  saveProfileV17({ avatar: '' });
  const input = document.getElementById('profile-photo-input');
  if (input) input.value = '';
  showToast('Foto removida', 'success');
}

function copyMonthlySummaryV17() {
  const txs = (allTransactions || []).filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });
  const income = txs.filter(t => t.type === 'income' && t.status === 'paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const expenses = txs.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const pending = txs.filter(t => t.status === 'pending').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const balance = income - expenses;
  const monthLabel = document.querySelector('.month-label')?.textContent || 'mês atual';
  const text = `Resumo Cyano - ${monthLabel}\nReceitas: ${formatCurrency(income)}\nDespesas pagas: ${formatCurrency(expenses)}\nPendentes: ${formatCurrency(pending)}\nSaldo do mês: ${formatCurrency(balance)}`;
  navigator.clipboard?.writeText(text).then(() => showToast('Resumo copiado!', 'success')).catch(() => {
    prompt('Copie seu resumo:', text);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  applyProfileV17();
});

// ============================================================
// V18 - PERSONALIZAÇÃO TOTAL
// ============================================================
const PERSONALIZATION_V18_KEY = 'cyano_personalization_v18';
const UI_STYLE_CLASSES_V18 = ['ios-glass','cyano-dark','minimal-clean','black-pro','neon-flow','ocean-glass','sunset-glass'];
const NAV_STYLE_CLASSES_V18 = ['nav-glass-pill','nav-minimal','nav-compact'];
const DEFAULT_PERSONALIZATION_V18 = {
  glassAlpha: 58,
  glassBlur: 28,
  fontScale: 100,
  bottomNavStyle: 'glass-pill',
  fabAction: 'quick-actions',
  widgets: {
    balance:true, income:true, expenses:true, pending:true, overdue:true, card:true, saving:true, chart:true, recent:true
  }
};

function getPersonalizationV18() {
  try {
    return { ...DEFAULT_PERSONALIZATION_V18, ...(JSON.parse(localStorage.getItem(PERSONALIZATION_V18_KEY) || '{}')),
      widgets: { ...DEFAULT_PERSONALIZATION_V18.widgets, ...((JSON.parse(localStorage.getItem(PERSONALIZATION_V18_KEY) || '{}')).widgets || {}) }
    };
  } catch (e) {
    return { ...DEFAULT_PERSONALIZATION_V18 };
  }
}

function savePersonalizationV18(patch) {
  const current = getPersonalizationV18();
  const next = { ...current, ...patch };
  if (patch.widgets) next.widgets = { ...current.widgets, ...patch.widgets };
  localStorage.setItem(PERSONALIZATION_V18_KEY, JSON.stringify(next));
  applyPersonalizationV18();
}

// Override seguro do applyAppearance anterior para aceitar todos os temas.
function applyAppearanceV11() {
  const settings = getAppearanceV11();
  document.body.classList.remove(...UI_STYLE_CLASSES_V18);
  document.body.classList.add(settings.uiStyle || 'ios-glass');
  document.documentElement.style.setProperty('--primary', settings.accent || '#007aff');
  document.documentElement.style.setProperty('--primary-light', lightenHex(settings.accent || '#007aff', 18));
  document.documentElement.style.setProperty('--primary-dark', darkenHex(settings.accent || '#007aff', 14));
  syncAppearanceControlsV11();
  syncPersonalizationControlsV18();
}

function setUIStyle(style) {
  if (!UI_STYLE_CLASSES_V18.includes(style)) style = 'ios-glass';
  saveAppearanceV11({ uiStyle: style });
  applyAppearanceV11();
  const names = { 'ios-glass':'iOS Glass', 'cyano-dark':'Cyano Dark', 'minimal-clean':'Minimal Clean', 'black-pro':'Black Pro', 'neon-flow':'Neon Flow', 'ocean-glass':'Ocean Glass', 'sunset-glass':'Sunset' };
  showToast(`Visual ${names[style] || style} ativado!`, 'success');
}

function syncAppearanceControlsV11() {
  const settings = getAppearanceV11();
  const ios = document.getElementById('ui-style-ios');
  const cyano = document.getElementById('ui-style-cyano');
  if (ios) ios.classList.toggle('active', settings.uiStyle === 'ios-glass');
  if (cyano) cyano.classList.toggle('active', settings.uiStyle === 'cyano-dark');
  const picker = document.getElementById('custom-accent-color');
  if (picker) picker.value = settings.accent || '#007aff';
  document.querySelectorAll('[data-theme-preset]').forEach(btn => btn.classList.toggle('active', btn.dataset.themePreset === settings.uiStyle));
}

function applyPersonalizationV18() {
  const prefs = getPersonalizationV18();
  const alpha = Math.max(4, Math.min(85, Number(prefs.glassAlpha || 58))) / 100;
  const blur = Math.max(8, Math.min(46, Number(prefs.glassBlur || 28)));
  const scale = Math.max(90, Math.min(112, Number(prefs.fontScale || 100))) / 100;
  document.documentElement.style.setProperty('--glass-alpha-v18', String(alpha));
  document.documentElement.style.setProperty('--glass-blur-v18', `${blur}px`);
  document.documentElement.style.setProperty('--ui-font-scale-v18', String(scale));

  document.body.classList.remove(...NAV_STYLE_CLASSES_V18);
  document.body.classList.add('nav-' + (prefs.bottomNavStyle || 'glass-pill'));

  applyDashboardWidgetsV18();
  syncPersonalizationControlsV18();
  setupFabV18();
}

function syncPersonalizationControlsV18() {
  const prefs = getPersonalizationV18();
  const alpha = document.getElementById('glass-alpha-range-v18');
  const blur = document.getElementById('glass-blur-range-v18');
  const font = document.getElementById('font-scale-range-v18');
  const nav = document.getElementById('bottom-nav-style-v18');
  const fab = document.getElementById('fab-action-v18');
  if (alpha && document.activeElement !== alpha) alpha.value = prefs.glassAlpha;
  if (blur && document.activeElement !== blur) blur.value = prefs.glassBlur;
  if (font && document.activeElement !== font) font.value = prefs.fontScale;
  if (nav && document.activeElement !== nav) nav.value = prefs.bottomNavStyle;
  if (fab && document.activeElement !== fab) fab.value = prefs.fabAction;
  document.querySelectorAll('[data-widget-v18]').forEach(input => {
    const key = input.dataset.widgetV18;
    input.checked = prefs.widgets?.[key] !== false;
  });
  document.querySelectorAll('[data-theme-preset]').forEach(btn => btn.classList.toggle('active', btn.dataset.themePreset === getAppearanceV11().uiStyle));
}

function setGlassAlphaV18(value) { savePersonalizationV18({ glassAlpha: parseInt(value, 10) || 58 }); }
function setGlassBlurV18(value) { savePersonalizationV18({ glassBlur: parseInt(value, 10) || 28 }); }
function setFontScaleV18(value) { savePersonalizationV18({ fontScale: parseInt(value, 10) || 100 }); }
function setBottomNavStyleV18(value) { savePersonalizationV18({ bottomNavStyle: value || 'glass-pill' }); showToast('Barra inferior atualizada!', 'success'); }
function setFabActionV18(value) { savePersonalizationV18({ fabAction: value || 'quick-actions' }); showToast('Botão + atualizado!', 'success'); }

function toggleDashboardWidgetV18(key, enabled) {
  savePersonalizationV18({ widgets: { [key]: !!enabled } });
  if (currentPage === 'dashboard') applyDashboardWidgetsV18();
}

function applyDashboardWidgetsV18() {
  const prefs = getPersonalizationV18();
  const map = {
    balance: 'dash-balance', income: 'dash-income', expenses: 'dash-expenses', pending: 'dash-pending',
    overdue: 'dash-overdue', card: 'dash-card-expenses', saving: 'dash-saving'
  };
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    const card = el?.closest('.dash-card');
    if (card) card.style.display = prefs.widgets?.[key] === false ? 'none' : '';
  });
  const chart = document.getElementById('dash-chart')?.closest('.section-card');
  if (chart) chart.style.display = prefs.widgets?.chart === false ? 'none' : '';
  const recent = document.getElementById('recent-transactions')?.closest('.section-card');
  if (recent) recent.style.display = prefs.widgets?.recent === false ? 'none' : '';
}

function setupFabV18() {
  const fab = document.querySelector('.fab');
  if (!fab) return;
  fab.onclick = handleFabV18;
}

function handleFabV18() {
  const action = getPersonalizationV18().fabAction || 'quick-actions';
  switch (action) {
    case 'expense': return openNewTransaction('expense');
    case 'income': return openNewTransaction('income');
    case 'quick-add': return openQuickAdd();
    case 'pending': return navigateTo('pending-review');
    default: return openModal('quick-actions-modal');
  }
}

function resetPersonalizationV18() {
  localStorage.setItem(PERSONALIZATION_V18_KEY, JSON.stringify(DEFAULT_PERSONALIZATION_V18));
  localStorage.setItem(APPEARANCE_V11_KEY, JSON.stringify(DEFAULT_APPEARANCE_V11));
  applyAppearanceV11();
  applyPersonalizationV18();
  showToast('Personalização restaurada!', 'success');
}

// Wrappers para manter tudo sincronizado sem mexer na lógica principal.
if (typeof renderSettings === 'function') {
  const renderSettingsBeforeV18 = renderSettings;
  renderSettings = function() {
    renderSettingsBeforeV18();
    syncPersonalizationControlsV18();
  };
}
if (typeof renderDashboard === 'function') {
  const renderDashboardBeforeV18 = renderDashboard;
  renderDashboard = function() {
    renderDashboardBeforeV18();
    setTimeout(applyDashboardWidgetsV18, 0);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    applyAppearanceV11();
    applyPersonalizationV18();
  });
});
