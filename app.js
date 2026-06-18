// =============================================
//  Estado da aplicação
// =============================================
let notebooks       = [];
let celulares       = [];
let filteredAssets  = [];
let currentAssetType = 'todos';
let editingId       = null;
let editingType     = null;
let currentPhotos   = []; // Array de { url, path, file } — url=preview, path=storage, file=File|null
let originalPhotoPaths = []; // Caminhos de storage antes da edição (para detectar remoções)
let lightboxPhotos  = [];
let currentPhotoIndex = 0;
let currentUserIsAdmin = false;
let draggedCustodyId = null;
let custodyDropInsertAfter = false;

const CUSTODY_DRAG_HANDLE_SVG = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
  </svg>`;

// =============================================
//  Auth
// =============================================
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function getSession() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function checkIsAdmin() {
  const user = await getSession();
  return user?.app_metadata?.role === 'admin';
}

function getUserRole(user) {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'viewer';
}

function applyViewerRestrictions() {
  if (currentUserIsAdmin) return;

  document.body.classList.add('viewer-mode');

  const hide = id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };

  hide('btnAdicionar');
  hide('btnEditarView');
  hide('btnAddCustodyHistory');

  const actionsHead = document.getElementById('tableActionsHead');
  if (actionsHead) actionsHead.classList.add('hidden');
}

function requireAdmin(actionLabel) {
  if (currentUserIsAdmin) return true;
  alert(`Acesso negado. Visualizadores não podem ${actionLabel}.`);
  return false;
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// =============================================
//  Mapeamento DB ↔ JS
// =============================================
function getPublicUrl(storagePath) {
  const { data } = supabase.storage.from('assets').getPublicUrl(storagePath);
  return data.publicUrl;
}

function mapDbToAsset(row) {
  const fotos = (row.asset_photos || []).map(p => ({
    url:  getPublicUrl(p.storage_path),
    path: p.storage_path,
    id:   p.id,
    file: null
  }));
  return {
    id: row.id, type: row.type,
    patrimonio: row.patrimonio, imei: row.imei,
    modelo: row.modelo, armazenamento: row.armazenamento,
    ano: row.ano, status: row.status,
    departamento: row.departamento, responsavel: row.responsavel,
    observacoes: row.observacoes, nota: parseFloat(row.nota),
    senhaDispositivo: row.senha_dispositivo,
    custodyHistory: (row.asset_custody_history || [])
      .slice()
      .sort((a, b) => {
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.started_at) - new Date(a.started_at);
      })
      .map(h => ({
        id: h.id,
        responsavel: h.responsavel,
        departamento: h.departamento,
        assetStatus: h.asset_status || 'Em uso',
        observacoes: h.observacoes,
        sortOrder: h.sort_order ?? 0,
        startedAt: h.started_at,
        endedAt: h.ended_at
      })),
    fotos,
    // Notebook
    ram: row.ram, placaVideo: row.placa_video,
    estadoBateria: row.estado_bateria, estadoCarregador: row.estado_carregador,
    versaoWindows: row.versao_windows,
    tecladoFuncionando: row.teclado_funcionando, observacoesTeclado: row.observacoes_teclado,
    temLeitora: row.tem_leitora,
    tipoConexao: row.tipo_conexao, bandaWiFi: row.banda_wifi,
    usbFuncionando: row.usb_funcionando, observacoesUSB: row.observacoes_usb,
    precisaAdaptador: row.precisa_adaptador,
    antivirus: row.antivirus,
    pastasServidor: row.pastas_servidor, pastasDropbox: row.pastas_dropbox,
    officeInstalado: row.office_instalado,
    // Celular
    numeroLinha: row.numero_linha, operadora: row.operadora,
    contaNuvem: row.conta_nuvem, pinBloqueio: row.pin_bloqueio,
    condicaoTela: row.condicao_tela, acessorios: row.acessorios
  };
}

function mapAssetToDb(type, data) {
  const base = {
    type,
    patrimonio:   data.patrimonio,
    imei:         data.imei         || null,
    modelo:       data.modelo,
    armazenamento: data.armazenamento || null,
    ano:          data.ano,
    status:       data.status,
    departamento: data.departamento,
    responsavel:  data.responsavel  || null,
    observacoes:  data.observacoes  || null,
    nota:         data.nota,
    senha_dispositivo: data.senhaDispositivo || null
  };
  if (type === 'notebook') {
    Object.assign(base, {
      ram:                 data.ram                || null,
      placa_video:         data.placaVideo         || null,
      estado_bateria:      data.estadoBateria       || null,
      estado_carregador:   data.estadoCarregador    || null,
      versao_windows:      data.versaoWindows       || null,
      teclado_funcionando: data.tecladoFuncionando,
      observacoes_teclado: data.observacoesTeclado  || null,
      tem_leitora:         data.temLeitora,
      tipo_conexao:        data.tipoConexao         || null,
      banda_wifi:          data.bandaWiFi           || null,
      usb_funcionando:     data.usbFuncionando,
      observacoes_usb:     data.observacoesUSB      || null,
      precisa_adaptador:   data.precisaAdaptador,
      antivirus:           data.antivirus           || null,
      pastas_servidor:     data.pastasServidor       || null,
      pastas_dropbox:      data.pastasDropbox        || null,
      office_instalado:    data.officeInstalado
    });
  } else {
    Object.assign(base, {
      numero_linha: data.numeroLinha  || null,
      operadora:    data.operadora    || null,
      conta_nuvem:  data.contaNuvem   || null,
      pin_bloqueio: data.pinBloqueio  || null,
      condicao_tela: data.condicaoTela || null,
      acessorios:   data.acessorios   || null
    });
  }
  return base;
}

// =============================================
//  Carregar ativos do banco
// =============================================
async function loadAssets() {
  showTableLoading(true);
  const { data, error } = await supabase
    .from('assets')
    .select('*, asset_photos(id, storage_path), asset_custody_history(id, responsavel, departamento, asset_status, observacoes, sort_order, started_at, ended_at)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar ativos:', error);
    showTableLoading(false);
    return;
  }

  notebooks = [];
  celulares = [];
  data.forEach(row => {
    const asset = mapDbToAsset(row);
    if (row.type === 'notebook') notebooks.push(asset);
    else celulares.push(asset);
  });

  showTableLoading(false);
  applyFilters();
}

function showTableLoading(show) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  if (show) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state" style="color:#64748b;">Carregando ativos...</div>
        </td>
      </tr>`;
  }
}

// =============================================
//  Utilitários
// =============================================
function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esc(value) {
  return escapeHtml(value);
}

function displayValue(value, fallback = 'Não informado') {
  return value ? esc(value) : fallback;
}

function getEmptyStateMessage() {
  if (currentAssetType === 'todos') return 'Nenhum patrimônio encontrado.';
  if (currentAssetType === 'notebook') return 'Nenhum notebook encontrado.';
  return 'Nenhum celular encontrado.';
}

function formatCustodyDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatCustodyDuration(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end   = endedAt ? new Date(endedAt) : new Date();
  const days  = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  if (days < 1) return 'Menos de 1 dia';
  if (days < 30) return `${days} dia${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months !== 1 ? 'meses' : 'mês'}`;
  const years     = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return `${years} ${years !== 1 ? 'anos' : 'ano'}`;
  return `${years} ${years !== 1 ? 'anos' : 'ano'} e ${remMonths} ${remMonths !== 1 ? 'meses' : 'mês'}`;
}

function formatCustodySituation(entry) {
  const status = entry.assetStatus || 'Em uso';
  if (status === 'Estoque') return '<span class="custody-badge-estoque">Estoque</span>';
  if (status === 'Manutenção') return '<span class="custody-badge-manutencao">Manutenção</span>';
  return '<span class="custody-badge-uso">Em uso</span>';
}

function formatCustodyResponsavelDisplay(entry) {
  if (entry.assetStatus === 'Estoque' || entry.assetStatus === 'Manutenção') {
    return '<span class="custody-text-muted">—</span>';
  }
  return entry.responsavel ? esc(entry.responsavel) : '—';
}

function formatCustodySetorDisplay(entry) {
  if (entry.assetStatus === 'Estoque') return 'Estoque';
  return esc(entry.departamento);
}

function getCustodySnapshot(status, responsavel, departamento) {
  const stat = status || 'Em uso';
  if (stat === 'Estoque') {
    return { assetStatus: 'Estoque', responsavel: null, departamento: 'Estoque' };
  }
  if (stat === 'Manutenção') {
    return {
      assetStatus: 'Manutenção',
      responsavel: null,
      departamento: departamento?.trim() || 'Manutenção'
    };
  }
  const dep = departamento?.trim();
  if (!dep) return null;
  return {
    assetStatus: 'Em uso',
    responsavel: responsavel?.trim() || null,
    departamento: dep
  };
}

function renderCustodyLogHtml(entries, options = {}) {
  const { showActions = false, showDelete = false, clickable = false, reorderable = false, assetId = null } = options;
  if (!entries || entries.length === 0) {
    return '<div class="custody-log-empty">Nenhum registro de custódia ainda.</div>';
  }
  const hasActionCol = showActions || showDelete;
  const baseCols = 6;
  const extraCols = (reorderable ? 1 : 0) + (hasActionCol ? 1 : 0);
  const colspan = baseCols + extraCols;

  return `
    <table class="custody-log-table ${clickable ? 'custody-log-table-clickable' : ''} ${reorderable ? 'custody-log-table-reorderable' : ''}">
      <thead>
        <tr>
          ${reorderable ? '<th class="custody-col-drag"></th>' : ''}
          <th>Situação</th>
          <th>Responsável</th>
          <th>Setor</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Tempo</th>
          ${hasActionCol ? '<th class="custody-col-actions"></th>' : ''}
        </tr>
      </thead>
      <tbody id="custodyLogTbody">
        ${entries.map(entry => `
          <tr class="custody-log-row ${entry.endedAt ? '' : 'custody-log-current'} ${clickable ? 'custody-log-row-clickable' : ''}"
              data-custody-id="${esc(entry.id)}"
              ${reorderable ? 'draggable="true"' : ''}
              ${clickable ? 'title="Clique para editar datas e informações"' : ''}>
            ${reorderable ? `
            <td class="custody-drag-cell">
              <span class="custody-drag-handle" title="Arraste para reordenar">${CUSTODY_DRAG_HANDLE_SVG}</span>
            </td>` : ''}
            <td>${formatCustodySituation(entry)}</td>
            <td>${formatCustodyResponsavelDisplay(entry)}</td>
            <td>${formatCustodySetorDisplay(entry)}</td>
            <td>${formatCustodyDate(entry.startedAt)}</td>
            <td>${entry.endedAt ? formatCustodyDate(entry.endedAt) : '<span class="custody-badge-atual">Atual</span>'}</td>
            <td>${formatCustodyDuration(entry.startedAt, entry.endedAt)}</td>
            ${hasActionCol ? `
            <td class="custody-actions">
              ${showActions ? `
              <button type="button" class="btn-custody-edit" title="Editar registro"
                onclick="event.stopPropagation(); openCustodyEditModal('${esc(assetId)}', '${esc(entry.id)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>` : ''}
              ${showDelete ? `
              <button type="button" class="btn-custody-delete" title="Excluir registro"
                onclick="event.stopPropagation(); openCustodyDeleteModal('${esc(assetId)}', '${esc(entry.id)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>` : ''}
            </td>` : ''}
          </tr>
          ${entry.observacoes ? `
          <tr class="custody-obs-row" data-obs-for="${esc(entry.id)}">
            <td colspan="${colspan}"><span class="custody-obs-label">Obs:</span> ${esc(entry.observacoes)}</td>
          </tr>` : ''}
        `).join('')}
      </tbody>
    </table>
    ${clickable ? '<p class="custody-log-click-hint">Clique na linha para editar · Arraste pelas três barras para reordenar</p>' : ''}
  `;
}

function renderFormCustodyLog(entries) {
  const el = document.getElementById('formCustodyLog');
  if (!el) return;
  updateCustodyLogFooter();
  if (!entries || entries.length === 0) {
    el.innerHTML = editingId
      ? '<div class="custody-log-empty">Nenhum registro ainda. Use o botão <strong>+</strong> abaixo ou salve mudanças de responsável/setor/status.</div>'
      : '<div class="custody-log-empty">O histórico é criado ao salvar mudanças de responsável, setor ou status (ex.: ir para Estoque).</div>';
    return;
  }
  el.innerHTML = renderCustodyLogHtml(entries, {
    clickable: !!editingId && currentUserIsAdmin,
    reorderable: !!editingId && currentUserIsAdmin,
    showActions: false,
    showDelete: !!editingId && currentUserIsAdmin,
    assetId: editingId
  });
}

function updateCustodyLogFooter() {
  const footer = document.getElementById('custodyLogFooter');
  if (!footer) return;
  footer.style.display = editingId && currentUserIsAdmin ? 'flex' : 'none';
}

async function getNextCustodySortOrder(assetId) {
  const { data } = await supabase
    .from('asset_custody_history')
    .select('sort_order')
    .eq('asset_id', assetId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 0) + 1;
}

function reorderCustodyEntries(entries, draggedId, targetId, insertAfter = false) {
  const fromIdx = entries.findIndex(e => e.id === draggedId);
  let toIdx = entries.findIndex(e => e.id === targetId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return entries;

  const result = [...entries];
  const [item] = result.splice(fromIdx, 1);
  if (fromIdx < toIdx) toIdx--;
  if (insertAfter) toIdx++;
  result.splice(toIdx, 0, item);
  return result;
}

async function persistCustodySortOrder(entries) {
  const updates = entries.map((entry, index) =>
    supabase
      .from('asset_custody_history')
      .update({ sort_order: index + 1 })
      .eq('id', entry.id)
  );
  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

async function reorderCustodyLog(assetId, draggedId, targetId, insertAfter = false) {
  const asset = [...notebooks, ...celulares].find(a => a.id === assetId);
  if (!asset) return;

  const previous = [...(asset.custodyHistory || [])];
  const reordered = reorderCustodyEntries(previous, draggedId, targetId, insertAfter);
  const orderChanged = reordered.some((e, i) => e.id !== previous[i]?.id);
  if (!orderChanged) return;

  asset.custodyHistory = reordered;
  renderFormCustodyLog(reordered);

  try {
    await persistCustodySortOrder(reordered);
  } catch (err) {
    asset.custodyHistory = previous;
    renderFormCustodyLog(previous);
    alert(`Erro ao reordenar: ${err.message}`);
  }
}

function clearCustodyDropIndicators(container) {
  container.querySelectorAll('.custody-log-drop-before, .custody-log-drop-after').forEach(r => {
    r.classList.remove('custody-log-drop-before', 'custody-log-drop-after');
  });
}

function bindCustodyDragDrop() {
  const log = document.getElementById('formCustodyLog');
  if (!log || log.dataset.dragBound) return;
  log.dataset.dragBound = '1';

  log.addEventListener('dragstart', (e) => {
    if (!editingId || !currentUserIsAdmin) return;
    const row = e.target.closest('tr.custody-log-row');
    if (!row || !row.draggable) { e.preventDefault(); return; }
    if (!e.target.closest('.custody-drag-handle') && !e.target.closest('.custody-drag-cell')) {
      e.preventDefault();
      return;
    }
    draggedCustodyId = row.dataset.custodyId;
    custodyDropInsertAfter = false;
    row.classList.add('custody-log-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCustodyId);
  });

  log.addEventListener('dragover', (e) => {
    if (!draggedCustodyId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('tr.custody-log-row');
    clearCustodyDropIndicators(log);

    if (row && row.dataset.custodyId !== draggedCustodyId) {
      const rect = row.getBoundingClientRect();
      custodyDropInsertAfter = e.clientY > rect.top + rect.height / 2;
      row.classList.add(custodyDropInsertAfter ? 'custody-log-drop-after' : 'custody-log-drop-before');
    }
  });

  log.addEventListener('drop', async (e) => {
    e.preventDefault();
    const targetRow = e.target.closest('tr.custody-log-row');
    clearCustodyDropIndicators(log);
    if (!targetRow || !draggedCustodyId || !editingId) return;

    const targetId = targetRow.dataset.custodyId;
    const dragId   = draggedCustodyId;
    const insertAfter = custodyDropInsertAfter;

    draggedCustodyId = null;
    custodyDropInsertAfter = false;

    if (targetId === dragId) return;
    await reorderCustodyLog(editingId, dragId, targetId, insertAfter);
  });

  log.addEventListener('dragend', () => {
    draggedCustodyId = null;
    custodyDropInsertAfter = false;
    log.querySelectorAll('.custody-log-dragging').forEach(r => {
      r.classList.remove('custody-log-dragging');
    });
    clearCustodyDropIndicators(log);
  });
}

function refreshCustodyAfterSave(assetId) {
  const assets = [...notebooks, ...celulares];
  const asset  = assets.find(a => a.id === assetId);
  if (!asset) return;
  if (document.getElementById('screenForm').classList.contains('active')) {
    renderFormCustodyLog(asset.custodyHistory || []);
  }
  if (document.getElementById('screenView').classList.contains('active')) {
    renderViewAsset(asset.type, asset);
  }
}

function bindCustodyStatusFields() {
  const toggleResp = () => {
    const isAssignment = document.getElementById('custodyEditStatus').value === 'Em uso';
    document.getElementById('custodyEditResponsavel').disabled = !isAssignment;
  };
  document.getElementById('custodyEditStatus').addEventListener('change', () => {
    const status = document.getElementById('custodyEditStatus').value;
    if (status === 'Estoque') {
      document.getElementById('custodyEditDepartamento').value = 'Estoque';
      document.getElementById('custodyEditResponsavel').value  = '';
    }
    toggleResp();
  });
  toggleResp();
}

function readCustodyFormValues() {
  const status  = document.getElementById('custodyEditStatus').value;
  const dep     = document.getElementById('custodyEditDepartamento').value.trim();
  const started = document.getElementById('custodyEditStarted').value;
  const ended   = document.getElementById('custodyEditEnded').value;
  const obs     = document.getElementById('custodyEditObservacoes').value.trim();

  if (!dep) return { error: 'Informe o setor/departamento.' };
  if (!started) return { error: 'Informe a data de início do período.' };

  let responsavel = document.getElementById('custodyEditResponsavel').value.trim() || null;
  if (status === 'Estoque' || status === 'Manutenção') {
    responsavel = null;
  }

  return {
    asset_status: status,
    responsavel,
    departamento: status === 'Estoque' ? 'Estoque' : dep,
    started_at:   new Date(started).toISOString(),
    ended_at:     ended ? new Date(ended).toISOString() : null,
    observacoes:  obs || null
  };
}

function buildCustodyModalHtml(title, saveLabel, hintExtra = '') {
  return `
    <div class="modal custody-edit-modal">
      <div class="modal-header"><h2 class="modal-title">${title}</h2></div>
      <div class="modal-body custody-edit-body">
        ${hintExtra ? `<p class="custody-edit-intro">${hintExtra}</p>` : ''}
        <div class="form-group">
          <label class="form-label">Situação</label>
          <select class="form-input" id="custodyEditStatus">
            <option value="Em uso">Em uso</option>
            <option value="Estoque">Estoque</option>
            <option value="Manutenção">Manutenção</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Responsável</label>
          <input type="text" class="form-input" id="custodyEditResponsavel" placeholder="Nome do responsável" />
        </div>
        <div class="form-group">
          <label class="form-label">Setor / Departamento</label>
          <input type="text" class="form-input" id="custodyEditDepartamento" placeholder="Departamento" maxlength="100" />
        </div>
        <div class="form-group">
          <label class="form-label">Início do período</label>
          <input type="datetime-local" class="form-input" id="custodyEditStarted" />
        </div>
        <div class="form-group">
          <label class="form-label">Fim do período</label>
          <input type="datetime-local" class="form-input" id="custodyEditEnded" />
          <span class="custody-edit-hint">Para registros do passado, preencha a data de fim. Deixe em branco apenas se for o período atual.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-input form-textarea" id="custodyEditObservacoes" rows="3" placeholder="Ex.: Responsável anterior à implantação do sistema"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" id="btnCancelCustodyEdit">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btnSaveCustodyEdit">${saveLabel}</button>
      </div>
    </div>
  `;
}

function findCustodyEntry(assetId, custodyId) {
  const assets = [...notebooks, ...celulares];
  const asset  = assets.find(a => a.id === assetId);
  if (!asset) return null;
  return (asset.custodyHistory || []).find(h => h.id === custodyId) || null;
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openCustodyEditModal(assetId, custodyId) {
  if (!requireAdmin('editar o histórico de custódia')) return;
  const entry = findCustodyEntry(assetId, custodyId);
  if (!entry) {
    alert('Registro de custódia não encontrado.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = buildCustodyModalHtml('Editar registro de custódia', 'Salvar alterações');
  document.body.appendChild(modal);

  document.getElementById('custodyEditStatus').value      = entry.assetStatus || 'Em uso';
  document.getElementById('custodyEditResponsavel').value  = entry.responsavel || '';
  document.getElementById('custodyEditDepartamento').value = entry.departamento || '';
  document.getElementById('custodyEditStarted').value    = toDatetimeLocalValue(entry.startedAt);
  document.getElementById('custodyEditEnded').value        = toDatetimeLocalValue(entry.endedAt);
  document.getElementById('custodyEditObservacoes').value  = entry.observacoes || '';

  bindCustodyStatusFields();

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('btnCancelCustodyEdit').addEventListener('click', () => modal.remove());
  document.getElementById('btnSaveCustodyEdit').addEventListener('click', async () => {
    await saveCustodyEntry(assetId, custodyId, modal);
  });
}

function openCustodyAddModal(assetId) {
  if (!requireAdmin('adicionar registros ao histórico')) return;
  if (!assetId) {
    alert('Salve o patrimônio antes de adicionar registros ao histórico.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = buildCustodyModalHtml(
    'Adicionar registro histórico',
    'Adicionar registro',
    'Use para cadastrar períodos anteriores à implantação do sistema ou correções de histórico.'
  );
  document.body.appendChild(modal);

  document.getElementById('custodyEditStatus').value = 'Em uso';
  bindCustodyStatusFields();

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('btnCancelCustodyEdit').addEventListener('click', () => modal.remove());
  document.getElementById('btnSaveCustodyEdit').addEventListener('click', async () => {
    await insertCustodyEntry(assetId, modal);
  });
}

function formatCustodyDeleteSummary(entry) {
  const situacao = entry.assetStatus || 'Em uso';
  const resp = entry.assetStatus === 'Estoque' || entry.assetStatus === 'Manutenção'
    ? '—'
    : (entry.responsavel || '—');
  const setor = entry.assetStatus === 'Estoque' ? 'Estoque' : (entry.departamento || '—');
  const inicio = formatCustodyDate(entry.startedAt);
  const fim = entry.endedAt ? formatCustodyDate(entry.endedAt) : 'Atual';
  return `<strong>${esc(situacao)}</strong> · ${esc(resp)} · ${esc(setor)}<br>Início: ${inicio} · Fim: ${fim}`;
}

function openCustodyDeleteModal(assetId, custodyId) {
  if (!requireAdmin('excluir registros do histórico')) return;

  const entry = findCustodyEntry(assetId, custodyId);
  if (!entry) {
    alert('Registro de custódia não encontrado.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h2 class="modal-title">Excluir registro de custódia</h2></div>
      <div class="modal-body">
        Tem certeza que deseja excluir este registro do histórico?<br><br>
        <div class="custody-delete-summary">${formatCustodyDeleteSummary(entry)}</div>
        <br>Esta ação não pode ser desfeita.
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" id="btnCancelCustodyDelete">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btnConfirmCustodyDelete" style="background:#dc2626;">Excluir</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('btnCancelCustodyDelete').addEventListener('click', () => modal.remove());
  document.getElementById('btnConfirmCustodyDelete').addEventListener('click', async () => {
    const btn = document.getElementById('btnConfirmCustodyDelete');
    btn.disabled = true;
    btn.textContent = 'Excluindo...';
    await deleteCustodyEntry(assetId, custodyId);
    modal.remove();
  });
}

async function deleteCustodyEntry(assetId, custodyId) {
  const { error } = await supabase
    .from('asset_custody_history')
    .delete()
    .eq('id', custodyId);

  if (error) {
    alert(`Erro ao excluir: ${error.message}`);
    return;
  }

  await loadAssets();
  refreshCustodyAfterSave(assetId);
}

async function insertCustodyEntry(assetId, modal) {
  const values = readCustodyFormValues();
  if (values.error) {
    alert(values.error);
    return;
  }

  if (!values.ended_at) {
    const { data: active } = await supabase
      .from('asset_custody_history')
      .select('id')
      .eq('asset_id', assetId)
      .is('ended_at', null)
      .maybeSingle();

    if (active) {
      alert('Já existe um período atual em aberto. Informe a data de fim deste registro ou edite o período atual.');
      return;
    }
  }

  if (values.ended_at && new Date(values.ended_at) <= new Date(values.started_at)) {
    alert('A data de fim deve ser posterior à data de início.');
    return;
  }

  const user = await getSession();
  const btn  = document.getElementById('btnSaveCustodyEdit');
  btn.disabled    = true;
  btn.textContent = 'Salvando...';

  const sortOrder = await getNextCustodySortOrder(assetId);

  const { error } = await supabase.from('asset_custody_history').insert({
    asset_id: assetId,
    ...values,
    sort_order: sortOrder,
    created_by: user?.id || null
  });

  btn.disabled    = false;
  btn.textContent = 'Adicionar registro';

  if (error) {
    alert(`Erro ao adicionar registro: ${error.message}`);
    return;
  }

  modal.remove();
  await loadAssets();
  refreshCustodyAfterSave(assetId);
}

async function saveCustodyEntry(assetId, custodyId, modal) {
  const values = readCustodyFormValues();
  if (values.error) {
    alert(values.error);
    return;
  }

  if (values.ended_at && new Date(values.ended_at) <= new Date(values.started_at)) {
    alert('A data de fim deve ser posterior à data de início.');
    return;
  }

  const user = await getSession();
  const btn  = document.getElementById('btnSaveCustodyEdit');
  btn.disabled    = true;
  btn.textContent = 'Salvando...';

  const { error } = await supabase
    .from('asset_custody_history')
    .update({
      asset_status: values.asset_status,
      responsavel: values.responsavel,
      departamento: values.departamento,
      started_at: values.started_at,
      ended_at: values.ended_at,
      observacoes: values.observacoes,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null
    })
    .eq('id', custodyId);

  btn.disabled    = false;
  btn.textContent = 'Salvar alterações';

  if (error) {
    alert(`Erro ao salvar registro: ${error.message}`);
    return;
  }

  modal.remove();
  await loadAssets();
  refreshCustodyAfterSave(assetId);
}

function getBadgeClass(status) {
  const map = { 'Em uso': 'badge-em-uso', 'Manutenção': 'badge-manutencao', 'Estoque': 'badge-estoque' };
  return map[status] || 'badge-em-uso';
}

function getNotaColor(nota) {
  if (nota < 4.5) return 'red';
  if (nota < 8)   return 'yellow';
  return 'green';
}

function renderNotaBar(nota) {
  const pct   = Math.min(Math.max((nota / 10) * 100, 0), 100);
  const color = getNotaColor(nota);
  return `
    <div class="nota-wrapper">
      <span class="nota-value">${nota.toFixed(1)}</span>
      <div class="nota-bar-bg">
        <div class="nota-bar-fill ${color}" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function getEvaluationStatus(nota) {
  if (nota < 4.5) return { text: 'Necessita Atenção', class: 'atencao' };
  if (nota < 8)   return { text: 'Bom', class: 'bom' };
  return { text: 'Excelente', class: 'excelente' };
}

// =============================================
//  Tipo de Ativo
// =============================================
function setAssetType(type) {
  currentAssetType = type;
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  updateResultCount();
  applyFilters();
}

function updateResultCount() {
  let assets = [], typeLabel = '';
  if (currentAssetType === 'todos')    { assets = [...notebooks, ...celulares]; typeLabel = 'patrimônio'; }
  else if (currentAssetType === 'notebook') { assets = notebooks; typeLabel = 'notebook'; }
  else                                  { assets = celulares;  typeLabel = 'celular'; }
  const count = document.getElementById('resultCount');
  count.textContent = `Mostrando ${filteredAssets.length} de ${assets.length} ${typeLabel}${assets.length !== 1 ? 's' : ''}`;
}

// =============================================
//  Renderização da tabela
// =============================================
function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  updateResultCount();

  const colSpan = currentUserIsAdmin ? 9 : 8;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}">
          <div class="empty-state">${getEmptyStateMessage()}</div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.map(asset => {
    const assetType = asset.type;
    const badge    = assetType === 'notebook' ? '💻 NB' : '📱 CEL';
    const bgColor  = assetType === 'notebook' ? '#e0e7ff' : '#fef3c7';
    const txtColor = assetType === 'notebook' ? '#3b82f6' : '#d97706';
    return `
    <tr data-id="${esc(asset.id)}" data-type="${esc(assetType)}" style="cursor:pointer;">
      <td><span class="badge" style="background:${bgColor};color:${txtColor};">${badge}</span></td>
      <td>${esc(asset.patrimonio)}</td>
      <td>${esc(asset.modelo)}</td>
      <td><span class="badge ${getBadgeClass(asset.status)}">${esc(asset.status)}</span></td>
      <td>${esc(asset.departamento)}</td>
      <td>${asset.responsavel ? esc(asset.responsavel) : '—'}</td>
      <td>${esc(asset.ano)}</td>
      <td>${asset.nota !== undefined ? renderNotaBar(asset.nota) : '—'}</td>
      ${currentUserIsAdmin ? `
      <td onclick="event.stopPropagation();">
        <div class="table-actions">
          <button class="btn-action delete" title="Excluir" onclick="openDeleteModal('${esc(assetType)}', '${esc(asset.id)}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </td>` : ''}
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openViewAsset(row.dataset.type, row.dataset.id));
  });
}

// =============================================
//  Busca e Filtros
// =============================================
function applyFilters() {
  const search      = document.getElementById('searchInput').value.toLowerCase().trim();
  const status      = document.getElementById('filterStatus').value;
  const departamento = document.getElementById('filterDepartamento').value;
  const ano         = document.getElementById('filterAno').value;

  let assets = [];
  if (currentAssetType === 'todos')         assets = [...notebooks, ...celulares];
  else if (currentAssetType === 'notebook') assets = notebooks;
  else                                       assets = celulares;

  filteredAssets = assets.filter(asset => {
    const matchSearch = !search ||
      asset.patrimonio.toLowerCase().includes(search) ||
      asset.modelo.toLowerCase().includes(search);
    const matchStatus = !status      || asset.status      === status;
    const matchDep    = !departamento || asset.departamento === departamento;
    const matchAno    = !ano          || String(asset.ano)  === ano;
    return matchSearch && matchStatus && matchDep && matchAno;
  });

  renderTable(filteredAssets);
}

// =============================================
//  Visualização de Ativo
// =============================================
function openViewAsset(type, id) {
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset  = assets.find(a => a.id === id);
  if (!asset) return;
  editingId   = id;
  editingType = type;
  renderViewAsset(type, asset);
  switchScreen('screenView');
}

function renderViewAsset(type, asset) {
  const content = document.getElementById('viewContent');
  lightboxPhotos    = asset.fotos || [];
  currentPhotoIndex = 0;

  let html = `
    <div class="view-section">
      <h3 class="view-section-title">Identificação Básica</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Tipo de Ativo</span><span class="view-value">${type === 'notebook' ? 'Notebook' : 'Celular'}</span></div>
        <div class="view-field"><span class="view-label">Patrimônio</span><span class="view-value">${esc(asset.patrimonio)}</span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Marca/Modelo</span><span class="view-value">${esc(asset.modelo)}</span></div>
        <div class="view-field"><span class="view-label">Armazenamento</span><span class="view-value ${!asset.armazenamento ? 'empty' : ''}">${displayValue(asset.armazenamento)}</span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Ano de Compra</span><span class="view-value">${esc(asset.ano)}</span></div>
        <div class="view-field"><span class="view-label">Status do Ativo</span><span class="view-value view-badge"><span class="badge ${getBadgeClass(asset.status)}">${esc(asset.status)}</span></span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Departamento</span><span class="view-value">${esc(asset.departamento)}</span></div>
        ${asset.status !== 'Estoque' ? `
        <div class="view-field"><span class="view-label">Responsável</span><span class="view-value ${!asset.responsavel ? 'empty' : ''}">${displayValue(asset.responsavel)}</span></div>
        ` : ''}
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Senha do Dispositivo</span><span class="view-value ${!asset.senhaDispositivo ? 'empty' : ''}">${displayValue(asset.senhaDispositivo)}</span></div>
      </div>
      <h3 class="view-section-title" style="margin-top:20px;">Histórico de Custódia</h3>
      <div class="view-row full">
        <div class="view-field custody-log-view">
          ${renderCustodyLogHtml(asset.custodyHistory, {
            showActions: currentUserIsAdmin,
            showDelete: currentUserIsAdmin,
            assetId: asset.id
          })}
        </div>
        ${currentUserIsAdmin ? `
        <div class="custody-log-toolbar custody-log-toolbar-view">
          <button type="button" class="btn btn-outline btn-custody-add" onclick="openCustodyAddModal('${esc(asset.id)}')">
            + Adicionar registro histórico
          </button>
        </div>` : ''}
      </div>
  `;

  if (type === 'celular') {
    html += `
      <div class="view-row">
        <div class="view-field"><span class="view-label">IMEI</span><span class="view-value ${!asset.imei ? 'empty' : ''}">${displayValue(asset.imei)}</span></div>
      </div>
      <h3 class="view-section-title" style="margin-top:20px;">Linha e Acessos</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Número da Linha</span><span class="view-value ${!asset.numeroLinha ? 'empty' : ''}">${displayValue(asset.numeroLinha)}</span></div>
        <div class="view-field"><span class="view-label">Operadora</span><span class="view-value ${!asset.operadora ? 'empty' : ''}">${displayValue(asset.operadora)}</span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Conta de Nuvem Vinculada</span><span class="view-value ${!asset.contaNuvem ? 'empty' : ''}">${displayValue(asset.contaNuvem)}</span></div>
        <div class="view-field"><span class="view-label">PIN/Senha de Bloqueio</span><span class="view-value ${!asset.pinBloqueio ? 'empty' : ''}">${displayValue(asset.pinBloqueio)}</span></div>
      </div>
      <h3 class="view-section-title" style="margin-top:20px;">Condição Física</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Condição da Tela</span><span class="view-value ${!asset.condicaoTela ? 'empty' : ''}">${displayValue(asset.condicaoTela)}</span></div>
        <div class="view-field"><span class="view-label">Acessórios Fornecidos</span><span class="view-value ${!asset.acessorios ? 'empty' : ''}">${displayValue(asset.acessorios)}</span></div>
      </div>
      ${asset.fotos && asset.fotos.length > 0 ? `
        <div class="view-row full">
          <div class="view-field">
            <span class="view-label">Fotos do Celular</span>
            <div class="view-photos">
              ${asset.fotos.map((foto, idx) => `
                <div class="view-photo" onclick="openLightbox(${idx})">
                  <img src="${esc(foto.url)}" alt="Foto ${idx + 1}" />
                </div>`).join('')}
            </div>
          </div>
        </div>` : ''}
    `;
  } else {
    html += `
      <h3 class="view-section-title" style="margin-top:20px;">Hardware e Sistema</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Memória RAM</span><span class="view-value ${!asset.ram ? 'empty' : ''}">${displayValue(asset.ram)}</span></div>
        <div class="view-field"><span class="view-label">Placa de Vídeo</span><span class="view-value ${!asset.placaVideo ? 'empty' : ''}">${displayValue(asset.placaVideo)}</span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Estado da Bateria</span><span class="view-value ${!asset.estadoBateria ? 'empty' : ''}">${displayValue(asset.estadoBateria)}</span></div>
        <div class="view-field"><span class="view-label">Estado do Carregador</span><span class="view-value ${!asset.estadoCarregador ? 'empty' : ''}">${displayValue(asset.estadoCarregador)}</span></div>
      </div>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Versão do Windows</span><span class="view-value ${!asset.versaoWindows ? 'empty' : ''}">${displayValue(asset.versaoWindows)}</span></div>
        <div class="view-field"><span class="view-label">Teclado Funcionando</span><span class="view-value">${asset.tecladoFuncionando ? '✓ Sim' : '✗ Não'}</span></div>
      </div>
      <h3 class="view-section-title" style="margin-top:20px;">Conectividade</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Tipo de Conexão</span><span class="view-value ${!asset.tipoConexao ? 'empty' : ''}">${displayValue(asset.tipoConexao)}</span></div>
        <div class="view-field"><span class="view-label">Banda do Wi-Fi</span><span class="view-value ${!asset.bandaWiFi ? 'empty' : ''}">${displayValue(asset.bandaWiFi)}</span></div>
      </div>
      <h3 class="view-section-title" style="margin-top:20px;">Softwares e Acessos</h3>
      <div class="view-row">
        <div class="view-field"><span class="view-label">Antivírus</span><span class="view-value ${!asset.antivirus ? 'empty' : ''}">${displayValue(asset.antivirus)}</span></div>
        <div class="view-field"><span class="view-label">Office Instalado</span><span class="view-value">${asset.officeInstalado ? '✓ Sim' : '✗ Não'}</span></div>
      </div>
      ${asset.fotos && asset.fotos.length > 0 ? `
        <div class="view-row full">
          <div class="view-field">
            <span class="view-label">Fotos do Notebook</span>
            <div class="view-photos">
              ${asset.fotos.map((foto, idx) => `
                <div class="view-photo" onclick="openLightbox(${idx})">
                  <img src="${esc(foto.url)}" alt="Foto ${idx + 1}" />
                </div>`).join('')}
            </div>
          </div>
        </div>` : ''}
    `;
  }

  if (asset.nota !== undefined) {
    const evaluation = getEvaluationStatus(asset.nota);
    html += `
      <h3 class="view-section-title" style="margin-top:20px;">Avaliação</h3>
      <div class="view-row full">
        <div class="view-field">
          <span class="view-label">Nota do Patrimônio</span>
          <div style="margin-top:8px;">${renderNotaBar(asset.nota)}</div>
        </div>
      </div>
      <div class="view-row full">
        <div class="evaluation-summary">
          <h3 class="summary-title">Resumo de Avaliação</h3>
          <div class="summary-item"><span class="summary-label">Estado Geral:</span><span class="summary-value ${evaluation.class}">${evaluation.text}</span></div>
    `;
    if (type === 'notebook') {
      html += `
          <div class="summary-item"><span class="summary-label">Estado da Bateria:</span><span class="summary-value">${displayValue(asset.estadoBateria, '—')}</span></div>
          <div class="summary-item"><span class="summary-label">Conectividade:</span><span class="summary-value">${displayValue(asset.tipoConexao, '—')}</span></div>
          <div class="summary-item"><span class="summary-label">Sistema:</span><span class="summary-value">${displayValue(asset.versaoWindows, '—')}</span></div>
      `;
    } else {
      html += `
          <div class="summary-item"><span class="summary-label">Condição da Tela:</span><span class="summary-value">${displayValue(asset.condicaoTela, '—')}</span></div>
          <div class="summary-item"><span class="summary-label">Conectividade:</span><span class="summary-value">${displayValue(asset.operadora, '—')}</span></div>
      `;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  content.innerHTML = html;
}

// =============================================
//  Exclusão
// =============================================
function openDeleteModal(type, id) {
  if (!requireAdmin('excluir patrimônios')) return;
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset  = assets.find(a => a.id === id);
  if (!asset) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h2 class="modal-title">Confirmar Exclusão</h2></div>
      <div class="modal-body">
        Tem certeza que deseja excluir o ${type === 'notebook' ? 'notebook' : 'celular'} <strong>${esc(asset.patrimonio)}</strong> (${esc(asset.modelo)})?<br><br>
        Esta ação não pode ser desfeita.
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-primary" style="background:#dc2626;" id="btnConfirmDelete">Excluir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#btnConfirmDelete').addEventListener('click', async () => {
    modal.remove();
    await deleteAsset(type, id);
  });
}

async function deleteAsset(type, id) {
  try {
    // Remover fotos do Storage
    const { data: photos } = await supabase
      .from('asset_photos').select('storage_path').eq('asset_id', id);
    if (photos && photos.length > 0) {
      await supabase.storage.from('assets').remove(photos.map(p => p.storage_path));
    }
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) throw error;
    await loadAssets();
  } catch (err) {
    console.error('Erro ao excluir:', err);
    alert('Erro ao excluir o ativo. Tente novamente.');
  }
}

// =============================================
//  Formulário
// =============================================
function openAddForm() {
  if (!requireAdmin('adicionar patrimônios')) return;
  editingId   = null;
  editingType = null;
  currentPhotos       = [];
  originalPhotoPaths  = [];
  const defaultType = currentAssetType === 'todos' ? 'notebook' : currentAssetType;
  document.getElementById('formTitle').textContent = 'Novo Patrimônio';
  document.getElementById('formTipoAtivo').value   = defaultType;
  clearForm();
  renderFormCustodyLog([]);
  updateIdentificationFormFields();
  updateFormTabs();
  updateEvaluationSummary();
  switchScreen('screenForm');
}

function openEditForm(type, id) {
  if (!requireAdmin('editar patrimônios')) return;
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset  = assets.find(a => a.id === id);
  if (!asset) return;
  editingId   = id;
  editingType = type;
  currentPhotos      = asset.fotos ? [...asset.fotos] : [];
  originalPhotoPaths = currentPhotos.filter(p => p.path).map(p => p.path);
  document.getElementById('formTitle').textContent     = 'Editar Patrimônio';
  document.getElementById('formTipoAtivo').value       = type;
  populateForm(type, asset);
  updateFormTabs();
  updateEvaluationSummary();
  switchScreen('screenForm');
}

function clearForm() {
  document.querySelectorAll('.form-input').forEach(input => {
    if (input.type === 'checkbox') input.checked = false;
    else input.value = '';
  });
  document.getElementById('formNotaSlider').value    = 5;
  document.getElementById('formNotaValue').textContent = '5.0';
  currentPhotos = [];
  document.getElementById('photoPreview').innerHTML       = '';
  document.getElementById('fotoCelularPreview').innerHTML = '';
  const senhaInput = document.getElementById('formSenhaDispositivo');
  if (senhaInput) senhaInput.type = 'password';
  updateIdentificationFormFields();
}

function getPredefinedDepartamentos() {
  const select = document.getElementById('formDepartamento');
  if (!select) return [];
  return Array.from(select.options)
    .map(o => o.value)
    .filter(v => v && v !== 'Outros');
}

function resolveDepartamentoFromForm() {
  const selected = document.getElementById('formDepartamento').value;
  if (selected === 'Outros') {
    return document.getElementById('formDepartamentoOutro').value.trim();
  }
  return selected;
}

function setDepartamentoFormValue(departamento) {
  const select = document.getElementById('formDepartamento');
  const outro  = document.getElementById('formDepartamentoOutro');
  const predefined = getPredefinedDepartamentos();

  if (departamento && predefined.includes(departamento)) {
    select.value = departamento;
    outro.value  = '';
  } else if (departamento) {
    select.value = 'Outros';
    outro.value  = departamento;
  } else {
    select.value = '';
    outro.value  = '';
  }
}

function updateIdentificationFormFields() {
  const isOutros  = document.getElementById('formDepartamento').value === 'Outros';
  const isEstoque = document.getElementById('formStatus').value === 'Estoque';

  document.getElementById('formDepartamentoOutroGroup').style.display = isOutros ? 'flex' : 'none';
  document.getElementById('formResponsavelGroup').style.display       = isEstoque ? 'none' : 'flex';

  if (isEstoque) {
    document.getElementById('formResponsavel').value = '';
  }
}

function populateForm(type, asset) {
  document.getElementById('formTipoAtivo').value    = type;
  document.getElementById('formIMEI').value         = asset.imei          || '';
  document.getElementById('formPatrimonio').value   = asset.patrimonio;
  document.getElementById('formModelo').value       = asset.modelo;
  document.getElementById('formArmazenamento').value = asset.armazenamento || '';
  document.getElementById('formAno').value          = asset.ano;
  document.getElementById('formStatus').value       = asset.status;
  setDepartamentoFormValue(asset.departamento);
  document.getElementById('formResponsavel').value  = asset.status === 'Estoque' ? '' : (asset.responsavel || '');
  document.getElementById('formSenhaDispositivo').value = asset.senhaDispositivo || '';
  document.getElementById('formObservacoes').value  = asset.observacoes   || '';
  renderFormCustodyLog(asset.custodyHistory || []);

  if (type === 'celular') {
    document.getElementById('formNumeroLinha').value  = asset.numeroLinha  || '';
    document.getElementById('formOperadora').value    = asset.operadora    || '';
    document.getElementById('formContaNuvem').value   = asset.contaNuvem   || '';
    document.getElementById('formPINBloqueio').value  = asset.pinBloqueio  || '';
    document.getElementById('formCondicaoTela').value = asset.condicaoTela || '';
    document.getElementById('formAcessorios').value   = asset.acessorios   || '';
    renderFotosCelular();
  } else {
    document.getElementById('formRAM').value                       = asset.ram              || '';
    document.getElementById('formPlacaVideo').value                = asset.placaVideo       || '';
    document.getElementById('formEstadoBateria').value             = asset.estadoBateria    || '';
    document.getElementById('formEstadoCarregador').value          = asset.estadoCarregador || '';
    document.getElementById('formVersaoWindows').value             = asset.versaoWindows    || '';
    document.getElementById('formTecladoFuncionando').checked      = asset.tecladoFuncionando || false;
    document.getElementById('formTemLeitora').checked              = asset.temLeitora        || false;
    document.getElementById('formUSBFuncionando').checked          = asset.usbFuncionando    || false;
    document.getElementById('formTipoConexao').value               = asset.tipoConexao      || '';
    document.getElementById('formBandaWiFi').value                 = asset.bandaWiFi        || '';
    document.getElementById('formPrecisaAdaptador').checked        = asset.precisaAdaptador  || false;
    document.getElementById('formOfficeInstalado').checked         = asset.officeInstalado   || false;
    document.getElementById('formAntivirus').value                 = asset.antivirus        || '';
    document.getElementById('formPastasServidor') && (document.getElementById('formPastasServidor').value = asset.pastasServidor || '');
    document.getElementById('formPastasDropbox')  && (document.getElementById('formPastasDropbox').value  = asset.pastasDropbox  || '');
    renderPhotos();
  }

  document.getElementById('formNotaSlider').value      = asset.nota || 5;
  document.getElementById('formNotaValue').textContent = (asset.nota || 5).toFixed(1);
  updateIdentificationFormFields();
}

function getFormData() {
  const type     = document.getElementById('formTipoAtivo').value;
  const isEstoque = document.getElementById('formStatus').value === 'Estoque';
  const baseData = {
    patrimonio:   document.getElementById('formPatrimonio').value.trim(),
    modelo:       document.getElementById('formModelo').value.trim(),
    armazenamento: document.getElementById('formArmazenamento').value.trim(),
    ano:          parseInt(document.getElementById('formAno').value),
    status:       document.getElementById('formStatus').value,
    departamento: resolveDepartamentoFromForm(),
    responsavel:  isEstoque ? '' : document.getElementById('formResponsavel').value.trim(),
    senhaDispositivo: document.getElementById('formSenhaDispositivo').value.trim(),
    observacoes:  document.getElementById('formObservacoes').value.trim(),
    nota:         parseFloat(document.getElementById('formNotaSlider').value)
  };

  if (type === 'celular') {
    return {
      ...baseData,
      imei:         document.getElementById('formIMEI').value.trim(),
      numeroLinha:  document.getElementById('formNumeroLinha').value.trim(),
      operadora:    document.getElementById('formOperadora').value.trim(),
      contaNuvem:   document.getElementById('formContaNuvem').value.trim(),
      pinBloqueio:  document.getElementById('formPINBloqueio').value.trim(),
      condicaoTela: document.getElementById('formCondicaoTela').value,
      acessorios:   document.getElementById('formAcessorios').value.trim()
    };
  } else {
    return {
      ...baseData,
      ram:               document.getElementById('formRAM').value.trim(),
      placaVideo:        document.getElementById('formPlacaVideo').value.trim(),
      estadoBateria:     document.getElementById('formEstadoBateria').value,
      estadoCarregador:  document.getElementById('formEstadoCarregador').value.trim(),
      versaoWindows:     document.getElementById('formVersaoWindows').value,
      tecladoFuncionando: document.getElementById('formTecladoFuncionando').checked,
      temLeitora:        document.getElementById('formTemLeitora').checked,
      usbFuncionando:    document.getElementById('formUSBFuncionando').checked,
      tipoConexao:       document.getElementById('formTipoConexao').value,
      bandaWiFi:         document.getElementById('formBandaWiFi').value,
      precisaAdaptador:  document.getElementById('formPrecisaAdaptador').checked,
      officeInstalado:   document.getElementById('formOfficeInstalado').checked,
      antivirus:         document.getElementById('formAntivirus').value.trim(),
      pastasServidor:    document.getElementById('formPastasServidor') ? document.getElementById('formPastasServidor').value.trim() : '',
      pastasDropbox:     document.getElementById('formPastasDropbox')  ? document.getElementById('formPastasDropbox').value.trim()  : ''
    };
  }
}

function validateForm(data) {
  const required = ['patrimonio', 'modelo', 'ano', 'status', 'departamento'];
  for (const field of required) {
    if (!data[field]) {
      const labels = {
        patrimonio: 'Número do Patrimônio',
        modelo: 'Marca/Modelo',
        ano: 'Ano de Compra',
        status: 'Status do Ativo',
        departamento: document.getElementById('formDepartamento').value === 'Outros'
          ? 'departamento (campo Outros)'
          : 'Departamento'
      };
      alert(`Por favor, preencha o campo "${labels[field] || field}" (obrigatório).`);
      return false;
    }
  }
  if (document.getElementById('formDepartamento').value === 'Outros' && data.departamento.length > 100) {
    alert('O nome do departamento deve ter no máximo 100 caracteres.');
    return false;
  }
  if (isNaN(data.ano) || data.ano < 2000 || data.ano > 2099) {
    alert('Ano deve ser um valor válido entre 2000 e 2099.');
    return false;
  }
  if (isNaN(data.nota) || data.nota < 0 || data.nota > 10) {
    alert('Nota deve ser um valor entre 0 e 10.');
    return false;
  }
  return true;
}

async function saveAsset() {
  if (!requireAdmin('salvar alterações')) return;
  const type = document.getElementById('formTipoAtivo').value;
  const data = getFormData();
  if (!validateForm(data)) return;

  const btn = document.getElementById('btnSalvar');
  btn.disabled    = true;
  btn.textContent = 'Salvando...';

  try {
    const dbData = mapAssetToDb(type, data);
    let assetId;

    if (editingId !== null) {
      const { error } = await supabase.from('assets').update(dbData).eq('id', editingId);
      if (error) throw error;
      assetId = editingId;
    } else {
      const { data: newRow, error } = await supabase.from('assets').insert(dbData).select('id').single();
      if (error) throw error;
      assetId = newRow.id;
    }

    await syncPhotos(assetId);
    await syncCustodyHistory(assetId, data.responsavel, data.departamento, data.status);
    await loadAssets();
    switchScreen('screenListing');
  } catch (err) {
    console.error('Erro ao salvar:', err);
    console.error('Detalhes:', err?.message, err?.details, err?.hint, err?.code);
    alert(`Erro ao salvar: ${err?.message || JSON.stringify(err)}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar';
  }
}

// Sincroniza histórico quando responsável, departamento ou status mudam
async function syncCustodyHistory(assetId, responsavel, departamento, status) {
  const snapshot = getCustodySnapshot(status, responsavel, departamento);
  if (!snapshot) return;

  const { assetStatus, responsavel: resp, departamento: dep } = snapshot;
  const user = await getSession();

  const { data: active, error: fetchError } = await supabase
    .from('asset_custody_history')
    .select('id, responsavel, departamento, asset_status')
    .eq('asset_id', assetId)
    .is('ended_at', null)
    .maybeSingle();

  if (fetchError) {
    console.error('Erro ao buscar custódia ativa:', fetchError);
    return;
  }

  if (!active) {
    const sortOrder = await getNextCustodySortOrder(assetId);
    const { error } = await supabase.from('asset_custody_history').insert({
      asset_id: assetId,
      responsavel: resp,
      departamento: dep,
      asset_status: assetStatus,
      sort_order: sortOrder,
      started_at: new Date().toISOString(),
      created_by: user?.id || null
    });
    if (error) console.error('Erro ao criar custódia:', error);
    return;
  }

  const sameState =
    (active.responsavel || null) === resp &&
    active.departamento === dep &&
    (active.asset_status || 'Em uso') === assetStatus;

  if (sameState) return;

  const now = new Date().toISOString();
  const { error: closeError } = await supabase
    .from('asset_custody_history')
    .update({ ended_at: now })
    .eq('id', active.id);

  if (closeError) {
    console.error('Erro ao encerrar custódia:', closeError);
    return;
  }

  const sortOrder = await getNextCustodySortOrder(assetId);
  const { error: insertError } = await supabase.from('asset_custody_history').insert({
    asset_id: assetId,
    responsavel: resp,
    departamento: dep,
    asset_status: assetStatus,
    sort_order: sortOrder,
    started_at: now,
    created_by: user?.id || null
  });
  if (insertError) console.error('Erro ao registrar nova custódia:', insertError);
}

// Sincroniza fotos: faz upload das novas e remove as deletadas
async function syncPhotos(assetId) {
  const currentPaths = currentPhotos.filter(p => p.path).map(p => p.path);
  const pathsToDelete = originalPhotoPaths.filter(p => !currentPaths.includes(p));

  // Deletar fotos removidas
  if (pathsToDelete.length > 0) {
    await supabase.storage.from('assets').remove(pathsToDelete);
    for (const path of pathsToDelete) {
      await supabase.from('asset_photos').delete().eq('asset_id', assetId).eq('storage_path', path);
    }
  }

  // Fazer upload das novas fotos (file !== null)
  for (const photo of currentPhotos) {
    if (!photo.file) continue;
    const ext  = photo.file.name.split('.').pop().toLowerCase();
    const path = `${assetId}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('assets').upload(path, photo.file);
    if (uploadError) { console.error('Erro no upload da foto:', uploadError); continue; }
    await supabase.from('asset_photos').insert({ asset_id: assetId, storage_path: path });
  }
}

// =============================================
//  Abas do Formulário
// =============================================
function updateFormTabs() {
  const type = document.getElementById('formTipoAtivo').value;
  document.querySelectorAll('.notebook-tab').forEach(btn => { btn.style.display = type === 'notebook' ? 'block' : 'none'; });
  document.querySelectorAll('.celular-tab').forEach(btn  => { btn.style.display = type === 'celular'  ? 'block' : 'none'; });
  document.getElementById('formIMEIGroup').style.display = type === 'celular' ? 'flex' : 'none';
  document.querySelectorAll('.tab-btn').forEach(btn     => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c   => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="tab-identificacao"]').classList.add('active');
  document.getElementById('tab-identificacao').classList.add('active');
}

// =============================================
//  Resumo de Avaliação
// =============================================
function updateEvaluationSummary() {
  const type = document.getElementById('formTipoAtivo').value;
  const nota = parseFloat(document.getElementById('formNotaSlider').value);
  document.getElementById('estadoGeralValue').textContent =
    nota < 4.5 ? 'Necessita Atenção' : nota < 8 ? 'Bom' : 'Excelente';
  if (type === 'notebook') {
    document.getElementById('estadoBateriaValue').textContent  = document.getElementById('formEstadoBateria').value || '—';
    document.getElementById('conectividadeValue').textContent  = document.getElementById('formTipoConexao').value   || '—';
    document.getElementById('sistemaValue').textContent        = document.getElementById('formVersaoWindows').value || '—';
  } else {
    document.getElementById('estadoBateriaValue').textContent  = document.getElementById('formCondicaoTela').value  || '—';
    document.getElementById('conectividadeValue').textContent  = document.getElementById('formOperadora').value     || '—';
    document.getElementById('sistemaValue').textContent        = '—';
  }
}

// =============================================
//  Upload de Fotos (armazenado como blob até salvar)
// =============================================
function handlePhotoUpload(e) {
  Array.from(e.target.files).forEach(file => {
    currentPhotos.push({ url: URL.createObjectURL(file), path: null, file });
    renderPhotos();
  });
  e.target.value = '';
}

function handleFotoCelularUpload(e) {
  Array.from(e.target.files).forEach(file => {
    currentPhotos.push({ url: URL.createObjectURL(file), path: null, file });
    renderFotosCelular();
  });
  e.target.value = '';
}

function renderPhotos() {
  document.getElementById('photoPreview').innerHTML = currentPhotos.map((photo, idx) => `
    <div class="photo-item" onclick="openLightboxFromForm(${idx})">
      <img src="${esc(photo.url)}" alt="Foto ${idx + 1}" />
      <button class="photo-remove" onclick="event.stopPropagation(); removePhoto(${idx})" title="Remover">×</button>
    </div>
  `).join('');
}

function renderFotosCelular() {
  document.getElementById('fotoCelularPreview').innerHTML = currentPhotos.map((photo, idx) => `
    <div class="photo-item" onclick="openLightboxFromForm(${idx})">
      <img src="${esc(photo.url)}" alt="Foto ${idx + 1}" />
      <button class="photo-remove" onclick="event.stopPropagation(); removeFoto(${idx})" title="Remover">×</button>
    </div>
  `).join('');
}

function removePhoto(idx) {
  if (currentPhotos[idx]?.file) URL.revokeObjectURL(currentPhotos[idx].url);
  currentPhotos.splice(idx, 1);
  renderPhotos();
}
function removeFoto(idx) {
  if (currentPhotos[idx]?.file) URL.revokeObjectURL(currentPhotos[idx].url);
  currentPhotos.splice(idx, 1);
  renderFotosCelular();
}

function openLightbox(idx)         { currentPhotoIndex = idx; showLightbox(); }
function openLightboxFromForm(idx) { lightboxPhotos = currentPhotos; currentPhotoIndex = idx; showLightbox(); }

function showLightbox() {
  if (lightboxPhotos.length === 0) return;
  document.getElementById('lightboxImage').src   = lightboxPhotos[currentPhotoIndex].url;
  document.getElementById('lightboxCounter').textContent = `${currentPhotoIndex + 1} / ${lightboxPhotos.length}`;
  document.getElementById('lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function nextPhoto() { currentPhotoIndex = (currentPhotoIndex + 1) % lightboxPhotos.length; showLightbox(); }
function prevPhoto() { currentPhotoIndex = (currentPhotoIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length; showLightbox(); }

// =============================================
//  Ajuda
// =============================================
function openHelpModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal help-modal">
      <div class="modal-header"><h2 class="modal-title">Ajuda rápida</h2></div>
      <div class="modal-body help-modal-body">
        <ul class="help-list">
          <li><strong>Listagem:</strong> use os filtros Todos, Notebooks ou Celulares e a busca por patrimônio ou modelo.</li>
          <li><strong>Visualizar:</strong> clique em qualquer linha da tabela para ver os detalhes do ativo.</li>
          <li><strong>Cadastrar:</strong> clique em <em>Adicionar Patrimônio</em> e preencha o formulário por abas.</li>
          <li><strong>Editar:</strong> abra o ativo e use o botão <em>Editar</em> na tela de visualização.</li>
          <li><strong>Fotos:</strong> adicione imagens no formulário; elas são salvas ao confirmar o cadastro.</li>
          <li><strong>Exportar:</strong> gera um CSV com os ativos atualmente filtrados na listagem.</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" type="button" id="btnCloseHelp">Entendi</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector('#btnCloseHelp').addEventListener('click', () => modal.remove());
}

// =============================================
//  Exportar CSV
// =============================================
function exportCSV() {
  const headers = ['Tipo', 'Patrimônio', 'Marca/Modelo', 'Status', 'Departamento', 'Responsável', 'Ano', 'Nota'];
  const rows    = filteredAssets.map(asset => [
    asset.type === 'celular' ? 'Celular' : 'Notebook',
    asset.patrimonio, asset.modelo, asset.status,
    asset.departamento, asset.responsavel || '', asset.ano, asset.nota || '—'
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'patrimonio.csv'; a.click();
  URL.revokeObjectURL(url);
}

// =============================================
//  Event Listeners
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

  // Verificar autenticação
  const session = await checkAuth();
  if (!session) return;

  currentUserIsAdmin = await checkIsAdmin();

  // Topbar com dados do usuário Supabase
  const user   = session.user;
  const role   = getUserRole(user);
  const topbar = document.getElementById('appTopbar');
  if (topbar && user) {
    const email    = user.email || '';
    const initials = esc(email.substring(0, 2).toUpperCase());
    const name     = esc(user.user_metadata?.name || email.split('@')[0] || 'Usuário');
    const roleBadge = role === 'admin'
      ? '<span class="role-badge role-admin">Admin</span>'
      : '<span class="role-badge role-viewer">Visualizador</span>';
    const accessLink = role === 'admin'
      ? `<a href="access-control.html" class="btn-topbar-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Acessos
        </a>`
      : '';
    topbar.innerHTML = `
      <div class="app-topbar-user">
        <div class="app-topbar-avatar">${initials}</div>
        <span>${name}</span>
        ${roleBadge}
      </div>
      <div class="app-topbar-actions">
        ${accessLink}
        <button class="btn-logout" onclick="logout()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>`;
  }

  applyViewerRestrictions();

  // Carregar dados do banco
  await loadAssets();

  // Seletor de tipo de ativo
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.addEventListener('click', () => setAssetType(btn.dataset.type));
  });

  // Busca em tempo real
  document.getElementById('searchInput').addEventListener('input', applyFilters);

  // Filtros
  document.getElementById('btnFiltros').addEventListener('click', () => {
    const panel = document.getElementById('filterPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btnAplicarFiltros').addEventListener('click', applyFilters);
  document.getElementById('btnLimparFiltros').addEventListener('click', () => {
    document.getElementById('filterStatus').value       = '';
    document.getElementById('filterDepartamento').value = '';
    document.getElementById('filterAno').value          = '';
    applyFilters();
  });

  document.getElementById('btnExportar').addEventListener('click', exportCSV);
  document.getElementById('btnAdicionar').addEventListener('click', openAddForm);
  document.getElementById('btnAjuda').addEventListener('click', openHelpModal);
  document.getElementById('btnVoltar').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnVoltarView').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnEditarView').addEventListener('click', () => openEditForm(editingType, editingId));
  document.getElementById('btnCancelar').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnSalvar').addEventListener('click', saveAsset);

  // Abas do formulário
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b  => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  document.getElementById('formTipoAtivo').addEventListener('change', () => {
    updateFormTabs(); updateEvaluationSummary();
  });
  document.getElementById('formDepartamento').addEventListener('change', updateIdentificationFormFields);
  document.getElementById('formStatus').addEventListener('change', updateIdentificationFormFields);
  document.getElementById('formNotaSlider').addEventListener('input', e => {
    document.getElementById('formNotaValue').textContent = parseFloat(e.target.value).toFixed(1);
    updateEvaluationSummary();
  });
  document.getElementById('formEstadoBateria').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formTipoConexao').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formVersaoWindows').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formCondicaoTela').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formOperadora').addEventListener('input', updateEvaluationSummary);

  document.getElementById('btnAddCustodyHistory')?.addEventListener('click', () => {
    openCustodyAddModal(editingId);
  });

  document.getElementById('formCustodyLog')?.addEventListener('click', (e) => {
    if (e.target.closest('.custody-drag-cell') || e.target.closest('.custody-actions')) return;
    const row = e.target.closest('tr.custody-log-row-clickable');
    if (!row || !editingId) return;
    openCustodyEditModal(editingId, row.dataset.custodyId);
  });

  bindCustodyDragDrop();

  document.getElementById('formFotos').addEventListener('change', handlePhotoUpload);
  document.getElementById('formFotoCelular').addEventListener('change', handleFotoCelularUpload);

  document.getElementById('btnToggleSenhaDispositivo')?.addEventListener('click', () => {
    const input = document.getElementById('formSenhaDispositivo');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (document.getElementById('lightbox').style.display === 'flex') {
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft')  prevPhoto();
      if (e.key === 'Escape')     closeLightbox();
    }
  });
});
