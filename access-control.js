// =============================================
//  Controle de Acessos – HubOn Patrimônio
// =============================================

let currentUserId = null;

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrador' : 'Visualizador';
}

function roleBadgeClass(role) {
  return role === 'admin' ? 'role-admin' : 'role-viewer';
}

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function checkIsAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.role === 'admin';
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

function showAlert(el, message, type = 'success') {
  el.textContent = message;
  el.className = `access-alert access-alert-${type}`;
  el.hidden = false;
}

function hideAlert(el) {
  el.hidden = true;
  el.textContent = '';
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`
  };
}

async function apiManageUsers(body) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/manage-users', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na API');
  return data;
}

async function loadUsers() {
  const loading = document.getElementById('accessListLoading');
  const errorEl = document.getElementById('accessListError');
  const tableWrap = document.getElementById('accessTableWrap');
  const tbody = document.getElementById('accessUsersBody');

  loading.hidden = false;
  tableWrap.hidden = true;
  hideAlert(errorEl);

  const { data, error } = await supabase.rpc('admin_list_users');

  loading.hidden = true;

  if (error) {
    showAlert(errorEl, error.message, 'error');
    return;
  }

  const users = data || [];
  tableWrap.hidden = false;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">Nenhum usuário encontrado.</div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const email = esc(u.email || '');
    const isSelf = u.id === currentUserId;
    return `
      <tr data-user-id="${esc(u.id)}">
        <td>
          <div class="access-user-cell">
            <span class="access-user-email">${email}</span>
            ${isSelf ? '<span class="access-self-tag">Você</span>' : ''}
          </div>
        </td>
        <td>
          <select class="access-role-select" data-user-id="${esc(u.id)}" ${isSelf ? 'disabled title="Não é possível alterar seu próprio papel"' : ''}>
            <option value="viewer" ${u.role !== 'admin' ? 'selected' : ''}>Visualizador</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </td>
        <td class="access-date">${formatDate(u.created_at)}</td>
        <td class="access-date">${formatDate(u.last_sign_in_at)}</td>
        <td>
          ${isSelf ? '' : `
          <button type="button" class="btn-action delete access-delete-btn" data-user-id="${esc(u.id)}" title="Excluir usuário">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>`}
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.access-role-select').forEach(select => {
    select.addEventListener('change', async () => {
      const userId = select.dataset.userId;
      const newRole = select.value;
      const prev = select.dataset.prev || (newRole === 'admin' ? 'viewer' : 'admin');
      select.disabled = true;

      const { error: rpcError } = await supabase.rpc('admin_set_user_role', {
        target_user_id: userId,
        new_role: newRole
      });

      select.disabled = false;

      if (rpcError) {
        select.value = prev;
        alert(rpcError.message);
        return;
      }

      select.dataset.prev = newRole;
    });
    select.dataset.prev = select.value;
  });

  tbody.querySelectorAll('.access-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const row = btn.closest('tr');
      const email = row?.querySelector('.access-user-email')?.textContent || 'este usuário';

      if (!confirm(`Excluir o acesso de ${email}? Esta ação não pode ser desfeita.`)) return;

      btn.disabled = true;
      try {
        await apiManageUsers({ action: 'delete', userId });
        await loadUsers();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

function renderTopbar(user) {
  const topbar = document.getElementById('appTopbar');
  if (!topbar || !user) return;

  const email = user.email || '';
  const initials = esc(email.substring(0, 2).toUpperCase());
  const name = esc(user.user_metadata?.name || email.split('@')[0] || 'Usuário');

  topbar.innerHTML = `
    <div class="app-topbar-user">
      <div class="app-topbar-avatar">${initials}</div>
      <span>${name}</span>
      <span class="role-badge role-admin">Admin</span>
    </div>
    <button class="btn-logout" onclick="logout()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Sair
    </button>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkAuth();
  if (!session) return;

  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    alert('Acesso negado. Apenas administradores podem gerenciar usuários.');
    window.location.href = 'index.html';
    return;
  }

  currentUserId = session.user.id;
  renderTopbar(session.user);

  document.getElementById('btnRefreshUsers').addEventListener('click', loadUsers);

  document.getElementById('formNewUser').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('accessFormAlert');
    const btn = document.getElementById('btnCreateUser');
    hideAlert(alertEl);

    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.querySelector('input[name="newUserRole"]:checked')?.value || 'viewer';

    if (!email || password.length < 6) {
      showAlert(alertEl, 'Informe usuário e senha com pelo menos 6 caracteres.', 'error');
      return;
    }

    btn.disabled = true;
    try {
      await apiManageUsers({ action: 'create', email, password, role });
      showAlert(alertEl, `Acesso criado: ${hubonEmailFromUser(email)} (${roleLabel(role)})`, 'success');
      document.getElementById('formNewUser').reset();
      document.querySelector('input[name="newUserRole"][value="viewer"]').checked = true;
      await loadUsers();
    } catch (err) {
      showAlert(alertEl, err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  await loadUsers();
});
