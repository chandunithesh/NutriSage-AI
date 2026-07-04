/**
 * NutriSage — Frontend Application Logic
 * File: static/js/app.js
 */

'use strict';

// ═══════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════
const state = {
  chatHistory    : [],    // [{role:'user'|'assistant', content:'...'}]
  userProfile    : {},
  familyMembers  : [],
  selectedDays   : 1,
  macroChart     : null,
  darkMode       : false,
};

// ═══════════════════════════════════════════════════════
//  DOM Helpers
// ═══════════════════════════════════════════════════════
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, variant = 'info') {
  const el   = $('#nsToastBody');
  const icon = variant === 'success' ? '✅ ' : variant === 'error' ? '❌ ' : 'ℹ️ ';
  el.textContent = icon + msg;
  bootstrap.Toast.getOrCreateInstance($('#nsToast'), {delay: 3000}).show();
}

function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[uo]l|<\/[uo]l|<p|<strong)(.+)$/gm, '$1<br>')
    .replace(/<br>\n?<br>/g, '</p><p>');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function formatTime(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

// ═══════════════════════════════════════════════════════
//  Navigation / Tabs
// ═══════════════════════════════════════════════════════
function switchTab(tabId) {
  $$('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = $(`#tab-${tabId}`);
  if (pane) pane.classList.add('active');

  $$('.sidebar-nav .nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === tabId);
  });
}

function initNav() {
  $$('[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });
}

// ═══════════════════════════════════════════════════════
//  Dark Mode
// ═══════════════════════════════════════════════════════
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('#themeIcon').className = dark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  state.darkMode = dark;
  localStorage.setItem('ns_dark', dark ? '1' : '0');
  if (state.macroChart) rebuildMacroChart();
}

$('#themeToggle').addEventListener('click', () => applyTheme(!state.darkMode));

// ═══════════════════════════════════════════════════════
//  Health Status Check
// ═══════════════════════════════════════════════════════
async function checkHealth() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    const dot  = $('#statusDot');
    const txt  = $('#statusText');
    if (data.ai_ready) {
      dot.className = 'status-dot online';
      txt.textContent = 'AI Connected';
    } else {
      dot.className = 'status-dot demo';
      txt.textContent = 'Demo Mode';
    }
  } catch {
    $('#statusDot').className = 'status-dot offline';
    $('#statusText').textContent = 'Offline';
  }
}

// ═══════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════
function appendMessage(role, content, timestamp) {
  const isUser = role === 'user';
  const wrap   = document.createElement('div');
  wrap.className = `msg-row ${isUser ? 'user-row' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${isUser ? 'usr-avatar' : 'ai-avatar'}`;
  avatar.innerHTML = isUser ? '<i class="bi bi-person-fill"></i>' : '<i class="bi bi-robot"></i>';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`;
  bubble.innerHTML = isUser
    ? content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    : markdownToHtml(content);

  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time';
  timeEl.textContent = formatTime(timestamp);

  const col = document.createElement('div');
  col.style.display = 'flex';
  col.style.flexDirection = 'column';
  col.style.alignItems = isUser ? 'flex-end' : 'flex-start';
  col.appendChild(bubble);
  col.appendChild(timeEl);

  wrap.appendChild(isUser ? col : avatar);
  wrap.appendChild(isUser ? avatar : col);

  $('#chatMessages').appendChild(wrap);
  scrollChatToBottom();
}

function appendTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.id = 'typingRow';
  row.innerHTML = `
    <div class="msg-avatar ai-avatar"><i class="bi bi-robot"></i></div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  $('#chatMessages').appendChild(row);
  scrollChatToBottom();
}

function removeTyping() {
  const el = $('#typingRow');
  if (el) el.remove();
}

function scrollChatToBottom() {
  const msgs = $('#chatMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

function hideQuickPrompts() {
  const qp = $('#quickPrompts');
  if (qp) qp.style.display = 'none';
}

async function sendMessage(text) {
  if (!text.trim()) return;
  hideQuickPrompts();
  appendMessage('user', text);
  state.chatHistory.push({role: 'user', content: text});

  $('#chatInput').value = '';
  autoResize($('#chatInput'));
  $('#sendBtn').disabled = true;
  appendTyping();

  try {
    const res  = await fetch('/api/chat', {
      method : 'POST',
      headers: {'Content-Type': 'application/json'},
      body   : JSON.stringify({
        message : text,
        history : state.chatHistory.slice(-10),
        profile : state.userProfile,
      }),
    });
    const data = await res.json();
    removeTyping();

    if (data.error) {
      appendMessage('assistant', `⚠️ ${data.error}`);
    } else {
      appendMessage('assistant', data.response, data.timestamp);
      state.chatHistory.push({role: 'assistant', content: data.response});
    }
  } catch (err) {
    removeTyping();
    appendMessage('assistant', '⚠️ Network error. Please check your connection and try again.');
  } finally {
    $('#sendBtn').disabled = false;
    $('#chatInput').focus();
  }
}

function initChat() {
  // Welcome message
  const welcome = (
    '👋 **Welcome to NutriSage!**\n\n' +
    'I\'m your AI-powered nutrition coach, backed by IBM Watsonx.ai and Granite models.\n\n' +
    'I can help you with:\n' +
    '• 🥗 Personalised Indian meal plans\n' +
    '• 🔢 Calorie & macro calculations\n' +
    '• 🩺 Diabetic, heart-healthy, and special diet advice\n' +
    '• 👨‍👩‍👧 Family nutrition planning\n\n' +
    'Save your profile in the **Dashboard** for fully personalised advice. Let\'s begin!'
  );
  appendMessage('assistant', welcome);

  const input = $('#chatInput');
  input.addEventListener('input', () => autoResize(input));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value.trim());
    }
  });

  $('#sendBtn').addEventListener('click', () => sendMessage(input.value.trim()));

  $('#clearChatBtn').addEventListener('click', () => {
    $('#chatMessages').innerHTML = '';
    state.chatHistory = [];
    appendMessage('assistant', '🗑️ Chat cleared. How can I help you today?');
    $('#quickPrompts').style.display = 'flex';
  });

  // Quick prompts
  $$('[data-prompt]').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.dataset.prompt);
    });
  });
}

// ═══════════════════════════════════════════════════════
//  PROFILE & DASHBOARD
// ═══════════════════════════════════════════════════════
function getProfileFromForm() {
  return {
    name      : $('#pName').value.trim(),
    age       : parseInt($('#pAge').value)   || 30,
    gender    : $('#pGender').value,
    weight    : parseFloat($('#pWeight').value) || 0,
    height    : parseFloat($('#pHeight').value) || 0,
    goal      : $('#pGoal').value,
    activity  : $('#pActivity').value,
    diet_pref : $('#pDietPref').value,
    allergies : $('#pAllergies').value.trim(),
    medical   : $('#pMedical').value.trim(),
  };
}

function saveProfile() {
  const p = getProfileFromForm();
  if (!p.weight || !p.height) {
    showToast('Enter weight and height to get calculations.', 'error');
    return;
  }
  state.userProfile = p;
  localStorage.setItem('ns_profile', JSON.stringify(p));
  updateDashboard(p);
  updateSidebarProfile(p);
  showToast('Profile saved!', 'success');
}

function loadSavedProfile() {
  const raw = localStorage.getItem('ns_profile');
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    state.userProfile = p;
    $('#pName').value    = p.name       || '';
    $('#pAge').value     = p.age        || '';
    $('#pGender').value  = p.gender     || 'male';
    $('#pWeight').value  = p.weight     || '';
    $('#pHeight').value  = p.height     || '';
    $('#pGoal').value    = p.goal       || 'maintenance';
    $('#pActivity').value= p.activity   || 'moderately_active';
    $('#pDietPref').value= p.diet_pref  || 'vegetarian';
    $('#pAllergies').value= p.allergies || '';
    $('#pMedical').value  = p.medical   || '';
    updateDashboard(p);
    updateSidebarProfile(p);
  } catch {}
}

function updateSidebarProfile(p) {
  if (p.name) $('#sidebarProfileName').textContent = p.name;
  const goals = {maintenance:'Maintain Weight', weight_loss:'Lose Weight', muscle_gain:'Gain Muscle', general:'General Health'};
  $('#sidebarGoalBadge').textContent = goals[p.goal] || p.goal || 'Set your goal →';
}

async function updateDashboard(p) {
  if (!p.weight || !p.height) return;
  try {
    const res  = await fetch('/api/bmi', {
      method : 'POST',
      headers: {'Content-Type': 'application/json'},
      body   : JSON.stringify(p),
    });
    const d = await res.json();
    if (d.error) return;

    $('#dashBMI').textContent    = d.bmi;
    $('#dashBMICat').textContent = d.category;
    $('#dashBMICat').style.color = d.color;
    $('#dashTDEE').textContent   = d.tdee.toLocaleString();
    $('#dashBMR').textContent    = d.bmr.toLocaleString();
    $('#dashProtein').textContent = d.macros.protein_g;

    renderCalorieBars(d);
    renderMacroChart(d.macros, d.tdee);
  } catch {}
}

function renderCalorieBars(d) {
  const bars = [
    {label:'Maintain',    val:d.maintenance, max:d.maintenance, color:'#10b981'},
    {label:'Lose Weight', val:d.weight_loss, max:d.maintenance, color:'#3b82f6'},
    {label:'Gain Muscle', val:d.weight_gain, max:d.weight_gain, color:'#8b5cf6'},
  ];
  $('#calorieBarGroup').innerHTML = bars.map(b => `
    <div class="calorie-bar-item">
      <div class="calorie-bar-label">
        <span>${b.label}</span><span class="fw-600">${b.val.toLocaleString()} kcal</span>
      </div>
      <div class="calorie-bar-track">
        <div class="calorie-bar-fill" style="width:${Math.min(100, b.val/b.max*100)}%; background:${b.color};"></div>
      </div>
    </div>
  `).join('');
}

function rebuildMacroChart() {
  if (!state._lastMacros || !state._lastTdee) return;
  renderMacroChart(state._lastMacros, state._lastTdee);
}

function renderMacroChart(macros, tdee) {
  state._lastMacros = macros;
  state._lastTdee   = tdee;

  const ctx    = $('#macroChart').getContext('2d');
  const isDark = state.darkMode;
  const labels = ['Carbs', 'Protein', 'Fat'];
  const values = [macros.carbs_g * 4, macros.protein_g * 4, macros.fat_g * 9];

  if (state.macroChart) state.macroChart.destroy();
  state.macroChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data          : values,
        backgroundColor: ['#3b82f6', '#10b981', '#f97316'],
        borderWidth   : 0,
        hoverOffset   : 6,
      }],
    },
    options: {
      responsive   : true,
      cutout       : '68%',
      plugins      : {
        legend: {
          position: 'bottom',
          labels  : {
            color    : isDark ? '#8b949e' : '#57606a',
            padding  : 16,
            font     : {size: 12, family: 'Inter'},
            boxWidth : 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} kcal (${Math.round(ctx.parsed/tdee*100)}%)`
          },
        },
      },
    },
  });
}

function initDashboard() {
  $('#saveProfileBtn').addEventListener('click', saveProfile);
  loadSavedProfile();
}

// ═══════════════════════════════════════════════════════
//  BMI CALCULATOR
// ═══════════════════════════════════════════════════════
async function calcBMI() {
  const weight   = parseFloat($('#bmiWeight').value);
  const height   = parseFloat($('#bmiHeight').value);
  const age      = parseInt($('#bmiAge').value) || 30;
  const gender   = $('#bmiGender').value;
  const activity = $('#bmiActivity').value;
  const goal     = $('#bmiGoal').value;

  if (!weight || !height) {
    showToast('Please enter weight and height.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/bmi', {
      method : 'POST',
      headers: {'Content-Type': 'application/json'},
      body   : JSON.stringify({weight, height, age, gender, activity, goal}),
    });
    const d = await res.json();
    if (d.error) { showToast(d.error, 'error'); return; }

    // Show results
    $('#bmiPlaceholder').classList.add('d-none');
    $('#bmiResults').classList.remove('d-none');

    // Gauge needle — map BMI 15–40 to -90° +90°
    const clampedBMI = Math.max(15, Math.min(40, d.bmi));
    const angle      = ((clampedBMI - 15) / 25) * 180 - 90;
    $('#gaugeNeedle').setAttribute('transform', `rotate(${angle} 100 100)`);
    $('#gaugeBMIVal').textContent = d.bmi;
    $('#gaugeBMICat').textContent = d.category;

    $('#resMaint').textContent = d.maintenance.toLocaleString();
    $('#resLose').textContent  = d.weight_loss.toLocaleString();
    $('#resGain').textContent  = d.weight_gain.toLocaleString();

    // Macro breakdown
    const pTotal = (d.macros.protein_g * 4 + d.macros.carbs_g * 4 + d.macros.fat_g * 9) || 1;
    $('#macroBreakdown').innerHTML = [
      {label:'Carbohydrates', g: d.macros.carbs_g,   kcal: d.macros.carbs_g*4,   color:'#3b82f6'},
      {label:'Protein',       g: d.macros.protein_g, kcal: d.macros.protein_g*4, color:'#10b981'},
      {label:'Fat',           g: d.macros.fat_g,     kcal: d.macros.fat_g*9,     color:'#f97316'},
    ].map(m => `
      <div class="macro-item">
        <div class="macro-header">
          <span>${m.label}</span>
          <span style="color:${m.color}">${m.g}g · ${m.kcal} kcal</span>
        </div>
        <div class="macro-bar">
          <div class="macro-fill" style="width:${Math.round(m.kcal/pTotal*100)}%; background:${m.color}"></div>
        </div>
      </div>`
    ).join('');

  } catch (err) {
    showToast('Calculation failed. Check your inputs.', 'error');
  }
}

function initBMI() {
  $('#calcBMIBtn').addEventListener('click', calcBMI);
  $$('#tab-bmi .form-control, #tab-bmi .form-select').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') calcBMI(); });
  });
}

// ═══════════════════════════════════════════════════════
//  MEAL PLANNER
// ═══════════════════════════════════════════════════════
function initMealPlanner() {
  $$('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.day-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedDays = parseInt(btn.dataset.days);
    });
  });

  $('#generatePlanBtn').addEventListener('click', async () => {
    const calories  = parseInt($('#mpCalories').value) || 1800;
    const diet_pref = $('#mpDiet').value;
    const goal      = $('#mpGoal').value;
    const allergies = $('#mpAllergies').value.trim();

    $('#mealPlanPlaceholder').classList.add('d-none');
    $('#mealPlanResult').classList.add('d-none');
    $('#mealPlanLoading').classList.remove('d-none');

    try {
      const res  = await fetch('/api/meal-plan', {
        method : 'POST',
        headers: {'Content-Type': 'application/json'},
        body   : JSON.stringify({
          days   : state.selectedDays,
          profile: {calories, diet_pref, goal, allergies},
        }),
      });
      const d = await res.json();
      $('#mealPlanLoading').classList.add('d-none');
      $('#mealPlanResult').classList.remove('d-none');
      $('#mealPlanContent').innerHTML = markdownToHtml(d.plan);
    } catch {
      $('#mealPlanLoading').classList.add('d-none');
      $('#mealPlanPlaceholder').classList.remove('d-none');
      showToast('Failed to generate meal plan. Try again.', 'error');
    }
  });

  $('#copyPlanBtn')?.addEventListener('click', () => {
    const text = $('#mealPlanContent').innerText;
    navigator.clipboard.writeText(text).then(() => showToast('Plan copied!', 'success'));
  });
}

// ═══════════════════════════════════════════════════════
//  FAMILY PLANNER
// ═══════════════════════════════════════════════════════
function renderFamilyMembers() {
  const list = $('#familyMembersList');
  const btn  = $('#familyPlanBtn');
  if (state.familyMembers.length === 0) {
    list.innerHTML = '<p class="text-muted small text-center py-3">No members yet. Click "Add Member".</p>';
    btn.disabled = true;
    return;
  }
  list.innerHTML = state.familyMembers.map((m, i) => `
    <div class="family-member-card">
      <div class="member-avatar"><i class="bi bi-person-fill"></i></div>
      <div class="member-info">
        <div class="member-name">${m.name || 'Member'}</div>
        <div class="member-details">${m.age}y · ${m.gender} · ${m.diet_pref} · ${m.goal}</div>
      </div>
      <button class="member-remove" data-idx="${i}"><i class="bi bi-x-circle-fill"></i></button>
    </div>`
  ).join('');
  btn.disabled = false;

  $$('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.familyMembers.splice(parseInt(btn.dataset.idx), 1);
      renderFamilyMembers();
    });
  });
}

function initFamily() {
  $('#addMemberBtn').addEventListener('click', () => {
    // Clear modal fields
    ['mName','mAge'].forEach(id => $(('#' + id)).value = '');
    new bootstrap.Modal($('#addMemberModal')).show();
  });

  $('#confirmAddMember').addEventListener('click', () => {
    const name     = $('#mName').value.trim() || 'Member';
    const age      = parseInt($('#mAge').value) || 30;
    const gender   = $('#mGender').value;
    const goal     = $('#mGoal').value;
    const diet_pref= $('#mDiet').value;
    state.familyMembers.push({name, age, gender, goal, diet_pref});
    renderFamilyMembers();
    showToast(`${name} added!`, 'success');
  });

  $('#familyPlanBtn').addEventListener('click', async () => {
    if (state.familyMembers.length === 0) return;
    $('#familyPlanPlaceholder').classList.add('d-none');
    $('#familyPlanResult').classList.add('d-none');
    $('#familyPlanLoading').classList.remove('d-none');

    try {
      const res  = await fetch('/api/family-plan', {
        method : 'POST',
        headers: {'Content-Type': 'application/json'},
        body   : JSON.stringify({members: state.familyMembers}),
      });
      const d = await res.json();
      $('#familyPlanLoading').classList.add('d-none');
      $('#familyPlanResult').classList.remove('d-none');
      $('#familyPlanContent').innerHTML = markdownToHtml(d.family_plan);
    } catch {
      $('#familyPlanLoading').classList.add('d-none');
      $('#familyPlanPlaceholder').classList.remove('d-none');
      showToast('Failed to generate family plan.', 'error');
    }
  });

  renderFamilyMembers();
}

// ═══════════════════════════════════════════════════════
//  CALORIE LOOKUP
// ═══════════════════════════════════════════════════════
async function lookupFood(food) {
  if (!food.trim()) return;
  const res = await fetch('/api/calorie-lookup', {
    method : 'POST',
    headers: {'Content-Type': 'application/json'},
    body   : JSON.stringify({food}),
  });
  const d = await res.json();
  const el = $('#lookupResult');
  el.classList.remove('d-none');

  if (d.ai_answer) {
    el.innerHTML = `
      <div class="card ns-card p-3 mt-2">
        <div class="d-flex gap-2 mb-2">
          <i class="bi bi-robot text-accent mt-1"></i>
          <strong>NutriSage says:</strong>
        </div>
        <div>${markdownToHtml(d.ai_answer)}</div>
      </div>`;
    return;
  }

  const items = Object.entries(d.db_matches);
  if (items.length === 0) {
    el.innerHTML = '<p class="text-muted small mt-2">No results found. Try a different search.</p>';
    return;
  }
  el.innerHTML = items.map(([food, kcal]) => `
    <div class="lookup-item">
      <span class="lookup-food">${food}</span>
      <span class="lookup-kcal">${kcal} kcal</span>
    </div>`
  ).join('');
}

function initLookup() {
  $('#lookupBtn').addEventListener('click', () => lookupFood($('#lookupInput').value));
  $('#lookupInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupFood($('#lookupInput').value);
  });
  $$('[data-food]').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#lookupInput').value = btn.dataset.food;
      lookupFood(btn.dataset.food);
    });
  });
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  const savedDark = localStorage.getItem('ns_dark') === '1';
  applyTheme(savedDark);

  // Init modules
  initNav();
  initChat();
  initDashboard();
  initBMI();
  initMealPlanner();
  initFamily();
  initLookup();

  // Health check
  checkHealth();
  setInterval(checkHealth, 30000);
});
