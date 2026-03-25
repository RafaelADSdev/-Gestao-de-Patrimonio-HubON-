// =============================================
//  Autenticação – Guarda de rota
// =============================================
(function authGuard() {
  const session = sessionStorage.getItem('hubon_user');
  if (!session) {
    window.location.href = 'login.html';
  }
})();

// =============================================
//  Sessão do usuário logado
// =============================================
function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('hubon_user'));
  } catch (e) {
    return null;
  }
}

function logout() {
  sessionStorage.removeItem('hubon_user');
  window.location.href = 'login.html';
}

// =============================================
//  Dados iniciais
// =============================================
const notebooksData = [];

// =============================================
//  Estado da aplicação
// =============================================
let notebooks = [...notebooksData];
let celulares = [];
let filteredAssets = [];
let currentAssetType = 'todos'; // 'todos', 'notebook' ou 'celular'
let editingId = null;
let editingType = null;
let currentPhotos = [];
let lightboxPhotos = [];
let currentPhotoIndex = 0;

// =============================================
//  Utilitários
// =============================================
function getBadgeClass(status) {
  const map = {
    'Em uso': 'badge-em-uso',
    'Manutenção': 'badge-manutencao',
    'Estoque': 'badge-estoque'
  };
  return map[status] || 'badge-em-uso';
}

function getNotaColor(nota) {
  if (nota < 4.5) return 'red';
  if (nota < 8) return 'yellow';
  return 'green';
}

function renderNotaBar(nota) {
  const pct = Math.min(Math.max((nota / 10) * 100, 0), 100);
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

function generateId() {
  const allAssets = [...notebooks, ...celulares];
  return allAssets.length > 0 ? Math.max(...allAssets.map(a => a.id)) + 1 : 1;
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function getEvaluationStatus(nota) {
  if (nota < 4.5) return { text: 'Necessita Atenção', class: 'atencao' };
  if (nota < 8) return { text: 'Bom', class: 'bom' };
  return { text: 'Excelente', class: 'excelente' };
}

// =============================================
//  Gerenciamento de Tipo de Ativo
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
  let assets = [];
  let typeLabel = '';
  if (currentAssetType === 'todos') {
    assets = [...notebooks, ...celulares];
    typeLabel = 'patrimônio';
  } else if (currentAssetType === 'notebook') {
    assets = notebooks;
    typeLabel = 'notebook';
  } else {
    assets = celulares;
    typeLabel = 'celular';
  }
  const count = document.getElementById('resultCount');
  count.textContent = `Mostrando ${filteredAssets.length} de ${assets.length} ${typeLabel}${assets.length !== 1 ? 's' : ''}`;
}

// =============================================
//  Renderização da tabela
// =============================================
function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  updateResultCount();

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">Nenhum ${currentAssetType === 'notebook' ? 'notebook' : 'celular'} encontrado.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(asset => {
    const assetType = asset.imei ? 'celular' : 'notebook';
    const badge = assetType === 'notebook' ? '📱 NB' : '📞 CEL';
    const bgColor = assetType === 'notebook' ? '#e0e7ff' : '#fef3c7';
    const textColor = assetType === 'notebook' ? '#3b82f6' : '#d97706';
    return `
    <tr data-id="${asset.id}" data-type="${assetType}" style="cursor: pointer;">
      <td><span class="badge" style="background: ${bgColor}; color: ${textColor};">${badge}</span></td>
      <td>${asset.patrimonio}</td>
      <td>${asset.modelo}</td>
      <td><span class="badge ${getBadgeClass(asset.status)}">${asset.status}</span></td>
      <td>${asset.departamento}</td>
      <td>${asset.responsavel || '—'}</td>
      <td>${asset.ano}</td>
      <td>${asset.nota !== undefined ? renderNotaBar(asset.nota) : '—'}</td>
      <td onclick="event.stopPropagation();">
        <div class="table-actions">
          <button class="btn-action delete" title="Excluir" onclick="openDeleteModal('${assetType}', ${asset.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id);
      const type = row.dataset.type;
      openViewAsset(type, id);
    });
  });
}

// =============================================
//  Busca e Filtros
// =============================================
function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const status = document.getElementById('filterStatus').value;
  const departamento = document.getElementById('filterDepartamento').value;
  const ano = document.getElementById('filterAno').value;

  let assets = [];
  if (currentAssetType === 'todos') {
    assets = [...notebooks, ...celulares];
  } else if (currentAssetType === 'notebook') {
    assets = notebooks;
  } else {
    assets = celulares;
  }

  filteredAssets = assets.filter(asset => {
    const matchSearch = !search ||
      asset.patrimonio.toLowerCase().includes(search) ||
      asset.modelo.toLowerCase().includes(search);
    const matchStatus = !status || asset.status === status;
    const matchDep = !departamento || asset.departamento === departamento;
    const matchAno = !ano || String(asset.ano) === ano;
    return matchSearch && matchStatus && matchDep && matchAno;
  });

  renderTable(filteredAssets);
}

// =============================================
//  Visualização de Ativo
// =============================================
function openViewAsset(type, id) {
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset = assets.find(a => a.id === id);
  if (!asset) return;
  editingId = id;
  editingType = type;
  renderViewAsset(type, asset);
  switchScreen('screenView');
}

function renderViewAsset(type, asset) {
  const content = document.getElementById('viewContent');
  lightboxPhotos = asset.fotos || [];
  currentPhotoIndex = 0;

  let html = `
    <div class="view-section">
      <h3 class="view-section-title">Identificação Básica</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Tipo de Ativo</span>
          <span class="view-value">${type === 'notebook' ? 'Notebook' : 'Celular'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Patrimônio</span>
          <span class="view-value">${asset.patrimonio}</span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Marca/Modelo</span>
          <span class="view-value">${asset.modelo}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Armazenamento</span>
          <span class="view-value ${!asset.armazenamento ? 'empty' : ''}">${asset.armazenamento || 'Não informado'}</span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Ano de Compra</span>
          <span class="view-value">${asset.ano}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Status do Ativo</span>
          <span class="view-value view-badge">
            <span class="badge ${getBadgeClass(asset.status)}">${asset.status}</span>
          </span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Departamento</span>
          <span class="view-value">${asset.departamento}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Responsável</span>
          <span class="view-value ${!asset.responsavel ? 'empty' : ''}">${asset.responsavel || 'Não informado'}</span>
        </div>
      </div>
  `;

  if (type === 'celular') {
    html += `
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">IMEI</span>
          <span class="view-value ${!asset.imei ? 'empty' : ''}">${asset.imei || 'Não informado'}</span>
        </div>
      </div>
      <h3 class="view-section-title" style="margin-top: 20px;">Linha e Acessos</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Número da Linha</span>
          <span class="view-value ${!asset.numeroLinha ? 'empty' : ''}">${asset.numeroLinha || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Operadora</span>
          <span class="view-value ${!asset.operadora ? 'empty' : ''}">${asset.operadora || 'Não informado'}</span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Conta de Nuvem Vinculada</span>
          <span class="view-value ${!asset.contaNuvem ? 'empty' : ''}">${asset.contaNuvem || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">PIN/Senha de Bloqueio</span>
          <span class="view-value ${!asset.pinBloqueio ? 'empty' : ''}">${asset.pinBloqueio || 'Não informado'}</span>
        </div>
      </div>
      <h3 class="view-section-title" style="margin-top: 20px;">Condição Física</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Condição da Tela</span>
          <span class="view-value ${!asset.condicaoTela ? 'empty' : ''}">${asset.condicaoTela || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Acessórios Fornecidos</span>
          <span class="view-value ${!asset.acessorios ? 'empty' : ''}">${asset.acessorios || 'Não informado'}</span>
        </div>
      </div>
      ${asset.fotos && asset.fotos.length > 0 ? `
        <div class="view-row full">
          <div class="view-field">
            <span class="view-label">Fotos do Celular</span>
            <div class="view-photos">
              ${asset.fotos.map((foto, idx) => `
                <div class="view-photo" onclick="openLightbox(${idx})">
                  <img src="${foto}" alt="Foto ${idx + 1}" />
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  } else {
    html += `
      <h3 class="view-section-title" style="margin-top: 20px;">Hardware e Sistema</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Memória RAM</span>
          <span class="view-value ${!asset.ram ? 'empty' : ''}">${asset.ram || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Placa de Vídeo</span>
          <span class="view-value ${!asset.placaVideo ? 'empty' : ''}">${asset.placaVideo || 'Não informado'}</span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Estado da Bateria</span>
          <span class="view-value ${!asset.estadoBateria ? 'empty' : ''}">${asset.estadoBateria || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Estado do Carregador</span>
          <span class="view-value ${!asset.estadoCarregador ? 'empty' : ''}">${asset.estadoCarregador || 'Não informado'}</span>
        </div>
      </div>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Versão do Windows</span>
          <span class="view-value ${!asset.versaoWindows ? 'empty' : ''}">${asset.versaoWindows || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Teclado Funcionando</span>
          <span class="view-value">${asset.tecladoFuncionando ? '✓ Sim' : '✗ Não'}</span>
        </div>
      </div>
      <h3 class="view-section-title" style="margin-top: 20px;">Conectividade</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Tipo de Conexão</span>
          <span class="view-value ${!asset.tipoConexao ? 'empty' : ''}">${asset.tipoConexao || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Banda do Wi-Fi</span>
          <span class="view-value ${!asset.bandaWiFi ? 'empty' : ''}">${asset.bandaWiFi || 'Não informado'}</span>
        </div>
      </div>
      <h3 class="view-section-title" style="margin-top: 20px;">Softwares e Acessos</h3>
      <div class="view-row">
        <div class="view-field">
          <span class="view-label">Antivírus</span>
          <span class="view-value ${!asset.antivirus ? 'empty' : ''}">${asset.antivirus || 'Não informado'}</span>
        </div>
        <div class="view-field">
          <span class="view-label">Office Instalado</span>
          <span class="view-value">${asset.officeInstalado ? '✓ Sim' : '✗ Não'}</span>
        </div>
      </div>
      ${asset.fotos && asset.fotos.length > 0 ? `
        <div class="view-row full">
          <div class="view-field">
            <span class="view-label">Fotos do Notebook</span>
            <div class="view-photos">
              ${asset.fotos.map((foto, idx) => `
                <div class="view-photo" onclick="openLightbox(${idx})">
                  <img src="${foto}" alt="Foto ${idx + 1}" />
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  if (asset.nota !== undefined) {
    const evaluation = getEvaluationStatus(asset.nota);
    html += `
      <h3 class="view-section-title" style="margin-top: 20px;">Avaliação</h3>
      <div class="view-row full">
        <div class="view-field">
          <span class="view-label">Nota do Patrimônio</span>
          <div style="margin-top: 8px;">${renderNotaBar(asset.nota)}</div>
        </div>
      </div>
      <div class="view-row full">
        <div class="evaluation-summary">
          <h3 class="summary-title">Resumo de Avaliação</h3>
          <div class="summary-item">
            <span class="summary-label">Estado Geral:</span>
            <span class="summary-value ${evaluation.class}">${evaluation.text}</span>
          </div>
    `;
    if (type === 'notebook') {
      html += `
          <div class="summary-item">
            <span class="summary-label">Estado da Bateria:</span>
            <span class="summary-value">${asset.estadoBateria || '—'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Conectividade:</span>
            <span class="summary-value">${asset.tipoConexao || '—'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Sistema:</span>
            <span class="summary-value">${asset.versaoWindows || '—'}</span>
          </div>
      `;
    } else {
      html += `
          <div class="summary-item">
            <span class="summary-label">Condição da Tela:</span>
            <span class="summary-value">${asset.condicaoTela || '—'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Conectividade:</span>
            <span class="summary-value">${asset.operadora || '—'}</span>
          </div>
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
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Confirmar Exclusão</h2>
      </div>
      <div class="modal-body">
        Tem certeza que deseja excluir o ${type === 'notebook' ? 'notebook' : 'celular'} <strong>${asset.patrimonio}</strong> (${asset.modelo})?<br><br>
        Esta ação não pode ser desfeita.
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-primary" style="background: #dc2626;" onclick="deleteAsset('${type}', ${id}); this.closest('.modal-overlay').remove()">Excluir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function deleteAsset(type, id) {
  if (type === 'notebook') {
    notebooks = notebooks.filter(n => n.id !== id);
  } else {
    celulares = celulares.filter(c => c.id !== id);
  }
  applyFilters();
}

// =============================================
//  Formulário
// =============================================
function openAddForm() {
  editingId = null;
  editingType = null;
  currentPhotos = [];
  const defaultType = currentAssetType === 'todos' ? 'notebook' : currentAssetType;
  document.getElementById('formTitle').textContent = 'Novo Patrimônio';
  document.getElementById('formTipoAtivo').value = defaultType;
  clearForm();
  updateFormTabs();
  updateEvaluationSummary();
  switchScreen('screenForm');
}

function openEditForm(type, id) {
  const assets = type === 'notebook' ? notebooks : celulares;
  const asset = assets.find(a => a.id === id);
  if (!asset) return;
  editingId = id;
  editingType = type;
  currentPhotos = asset.fotos ? [...asset.fotos] : [];
  document.getElementById('formTitle').textContent = 'Editar Patrimônio';
  document.getElementById('formTipoAtivo').value = type;
  populateForm(type, asset);
  updateFormTabs();
  updateEvaluationSummary();
  switchScreen('screenForm');
}

function clearForm() {
  document.querySelectorAll('.form-input').forEach(input => {
    if (input.type === 'checkbox') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });
  document.getElementById('formNotaSlider').value = 5;
  document.getElementById('formNotaValue').textContent = '5.0';
  currentPhotos = [];
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('fotoCelularPreview').innerHTML = '';
}

function populateForm(type, asset) {
  document.getElementById('formTipoAtivo').value = type;
  document.getElementById('formIMEI').value = asset.imei || '';
  document.getElementById('formPatrimonio').value = asset.patrimonio;
  document.getElementById('formModelo').value = asset.modelo;
  document.getElementById('formArmazenamento').value = asset.armazenamento || '';
  document.getElementById('formAno').value = asset.ano;
  document.getElementById('formStatus').value = asset.status;
  document.getElementById('formDepartamento').value = asset.departamento;
  document.getElementById('formResponsavel').value = asset.responsavel || '';

  if (type === 'celular') {
    document.getElementById('formNumeroLinha').value = asset.numeroLinha || '';
    document.getElementById('formOperadora').value = asset.operadora || '';
    document.getElementById('formContaNuvem').value = asset.contaNuvem || '';
    document.getElementById('formPINBloqueio').value = asset.pinBloqueio || '';
    document.getElementById('formCondicaoTela').value = asset.condicaoTela || '';
    document.getElementById('formAcessorios').value = asset.acessorios || '';
    currentPhotos = asset.fotos ? [...asset.fotos] : [];
    renderFotosCelular();
  } else {
    document.getElementById('formRAM').value = asset.ram || '';
    document.getElementById('formPlacaVideo').value = asset.placaVideo || '';
    document.getElementById('formEstadoBateria').value = asset.estadoBateria || '';
    document.getElementById('formEstadoCarregador').value = asset.estadoCarregador || '';
    document.getElementById('formVersaoWindows').value = asset.versaoWindows || '';
    document.getElementById('formTecladoFuncionando').checked = asset.tecladoFuncionando || false;
    document.getElementById('formTemLeitora').checked = asset.temLeitora || false;
    document.getElementById('formUSBFuncionando').checked = asset.usbFuncionando || false;
    document.getElementById('formTipoConexao').value = asset.tipoConexao || '';
    document.getElementById('formBandaWiFi').value = asset.bandaWiFi || '';
    document.getElementById('formPrecisaAdaptador').checked = asset.precisaAdaptador || false;
    document.getElementById('formOfficeInstalado').checked = asset.officeInstalado || false;
    document.getElementById('formAntivirus').value = asset.antivirus || '';
    currentPhotos = asset.fotos ? [...asset.fotos] : [];
    renderPhotos();
  }

  document.getElementById('formNotaSlider').value = asset.nota || 5;
  document.getElementById('formNotaValue').textContent = (asset.nota || 5).toFixed(1);
}

function getFormData() {
  const type = document.getElementById('formTipoAtivo').value;
  const baseData = {
    patrimonio: document.getElementById('formPatrimonio').value.trim(),
    modelo: document.getElementById('formModelo').value.trim(),
    armazenamento: document.getElementById('formArmazenamento').value.trim(),
    ano: parseInt(document.getElementById('formAno').value),
    status: document.getElementById('formStatus').value,
    departamento: document.getElementById('formDepartamento').value,
    responsavel: document.getElementById('formResponsavel').value.trim(),
    nota: parseFloat(document.getElementById('formNotaSlider').value),
    fotos: currentPhotos
  };

  if (type === 'celular') {
    return {
      ...baseData,
      imei: document.getElementById('formIMEI').value.trim(),
      numeroLinha: document.getElementById('formNumeroLinha').value.trim(),
      operadora: document.getElementById('formOperadora').value.trim(),
      contaNuvem: document.getElementById('formContaNuvem').value.trim(),
      pinBloqueio: document.getElementById('formPINBloqueio').value.trim(),
      condicaoTela: document.getElementById('formCondicaoTela').value,
      acessorios: document.getElementById('formAcessorios').value.trim()
    };
  } else {
    return {
      ...baseData,
      ram: document.getElementById('formRAM').value.trim(),
      placaVideo: document.getElementById('formPlacaVideo').value.trim(),
      estadoBateria: document.getElementById('formEstadoBateria').value,
      estadoCarregador: document.getElementById('formEstadoCarregador').value.trim(),
      versaoWindows: document.getElementById('formVersaoWindows').value,
      tecladoFuncionando: document.getElementById('formTecladoFuncionando').checked,
      temLeitora: document.getElementById('formTemLeitora').checked,
      usbFuncionando: document.getElementById('formUSBFuncionando').checked,
      tipoConexao: document.getElementById('formTipoConexao').value,
      bandaWiFi: document.getElementById('formBandaWiFi').value,
      precisaAdaptador: document.getElementById('formPrecisaAdaptador').checked,
      officeInstalado: document.getElementById('formOfficeInstalado').checked,
      antivirus: document.getElementById('formAntivirus').value.trim()
    };
  }
}

function validateForm(data) {
  const required = ['patrimonio', 'modelo', 'ano', 'status', 'departamento'];
  for (const field of required) {
    if (!data[field]) {
      alert(`Por favor, preencha o campo "${field}" (obrigatório).`);
      return false;
    }
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

function saveAsset() {
  const type = document.getElementById('formTipoAtivo').value;
  const data = getFormData();
  if (!validateForm(data)) return;

  if (editingId !== null) {
    const assets = type === 'notebook' ? notebooks : celulares;
    const idx = assets.findIndex(a => a.id === editingId);
    if (idx !== -1) assets[idx] = { id: editingId, ...data };
  } else {
    const newAsset = { id: generateId(), ...data };
    if (type === 'notebook') notebooks.push(newAsset);
    else celulares.push(newAsset);
  }

  switchScreen('screenListing');
  applyFilters();
}

// =============================================
//  Abas do Formulário
// =============================================
function updateFormTabs() {
  const type = document.getElementById('formTipoAtivo').value;
  document.querySelectorAll('.notebook-tab').forEach(btn => {
    btn.style.display = type === 'notebook' ? 'block' : 'none';
  });
  document.querySelectorAll('.celular-tab').forEach(btn => {
    btn.style.display = type === 'celular' ? 'block' : 'none';
  });
  document.getElementById('formIMEIGroup').style.display = type === 'celular' ? 'flex' : 'none';
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="tab-identificacao"]').classList.add('active');
  document.getElementById('tab-identificacao').classList.add('active');
}

// =============================================
//  Resumo de Avaliação
// =============================================
function updateEvaluationSummary() {
  const type = document.getElementById('formTipoAtivo').value;
  const nota = parseFloat(document.getElementById('formNotaSlider').value);
  let estadoGeral = nota < 4.5 ? 'Necessita Atenção' : nota < 8 ? 'Bom' : 'Excelente';
  document.getElementById('estadoGeralValue').textContent = estadoGeral;

  if (type === 'notebook') {
    document.getElementById('estadoBateriaValue').textContent = document.getElementById('formEstadoBateria').value || '—';
    document.getElementById('conectividadeValue').textContent = document.getElementById('formTipoConexao').value || '—';
    document.getElementById('sistemaValue').textContent = document.getElementById('formVersaoWindows').value || '—';
  } else {
    document.getElementById('estadoBateriaValue').textContent = document.getElementById('formCondicaoTela').value || '—';
    document.getElementById('conectividadeValue').textContent = document.getElementById('formOperadora').value || '—';
    document.getElementById('sistemaValue').textContent = '—';
  }
}

// =============================================
//  Upload de Fotos
// =============================================
function handlePhotoUpload(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => { currentPhotos.push(event.target.result); renderPhotos(); };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function handleFotoCelularUpload(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => { currentPhotos.push(event.target.result); renderFotosCelular(); };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function renderPhotos() {
  document.getElementById('photoPreview').innerHTML = currentPhotos.map((photo, idx) => `
    <div class="photo-item" onclick="openLightboxFromForm(${idx})">
      <img src="${photo}" alt="Foto ${idx + 1}" />
      <button class="photo-remove" onclick="event.stopPropagation(); removePhoto(${idx})" title="Remover">×</button>
    </div>
  `).join('');
}

function renderFotosCelular() {
  document.getElementById('fotoCelularPreview').innerHTML = currentPhotos.map((photo, idx) => `
    <div class="photo-item" onclick="openLightboxFromForm(${idx})">
      <img src="${photo}" alt="Foto ${idx + 1}" />
      <button class="photo-remove" onclick="event.stopPropagation(); removeFoto(${idx})" title="Remover">×</button>
    </div>
  `).join('');
}

function removePhoto(idx) { currentPhotos.splice(idx, 1); renderPhotos(); }
function removeFoto(idx)  { currentPhotos.splice(idx, 1); renderFotosCelular(); }

function openLightbox(idx) { currentPhotoIndex = idx; showLightbox(); }
function openLightboxFromForm(idx) { lightboxPhotos = currentPhotos; currentPhotoIndex = idx; showLightbox(); }

function showLightbox() {
  if (lightboxPhotos.length === 0) return;
  document.getElementById('lightboxImage').src = lightboxPhotos[currentPhotoIndex];
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
//  Exportar CSV
// =============================================
function exportCSV() {
  const headers = ['Tipo', 'Patrimônio', 'Marca/Modelo', 'Status', 'Departamento', 'Responsável', 'Ano', 'Nota'];
  const rows = filteredAssets.map(asset => [
    asset.imei ? 'Celular' : 'Notebook',
    asset.patrimonio,
    asset.modelo,
    asset.status,
    asset.departamento,
    asset.responsavel || '',
    asset.ano,
    asset.nota || '—'
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patrimonio.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================
//  Event Listeners
// =============================================
document.addEventListener('DOMContentLoaded', () => {

  // ── Topbar: exibe nome do usuário logado ──
  const session = getSession();
  if (session) {
    const topbar = document.getElementById('appTopbar');
    if (topbar) {
      const initials = session.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      topbar.innerHTML = `
        <div class="app-topbar-user">
          <div class="app-topbar-avatar">${initials}</div>
          <span>${session.name}</span>
        </div>
        <button class="btn-logout" onclick="logout()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      `;
    }
  }

  // Renderização inicial
  renderTable(filteredAssets);

  // Seletor de tipo de ativo
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.addEventListener('click', () => setAssetType(btn.dataset.type));
  });

  // Busca em tempo real
  document.getElementById('searchInput').addEventListener('input', applyFilters);

  // Botão Filtros
  document.getElementById('btnFiltros').addEventListener('click', () => {
    const panel = document.getElementById('filterPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btnAplicarFiltros').addEventListener('click', applyFilters);
  document.getElementById('btnLimparFiltros').addEventListener('click', () => {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterDepartamento').value = '';
    document.getElementById('filterAno').value = '';
    applyFilters();
  });

  document.getElementById('btnExportar').addEventListener('click', exportCSV);
  document.getElementById('btnAdicionar').addEventListener('click', openAddForm);
  document.getElementById('btnVoltar').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnVoltarView').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnEditarView').addEventListener('click', () => openEditForm(editingType, editingId));
  document.getElementById('btnCancelar').addEventListener('click', () => switchScreen('screenListing'));
  document.getElementById('btnSalvar').addEventListener('click', saveAsset);

  // Abas do formulário
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  document.getElementById('formTipoAtivo').addEventListener('change', () => {
    updateFormTabs();
    updateEvaluationSummary();
  });

  document.getElementById('formNotaSlider').addEventListener('input', (e) => {
    document.getElementById('formNotaValue').textContent = parseFloat(e.target.value).toFixed(1);
    updateEvaluationSummary();
  });

  document.getElementById('formEstadoBateria').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formTipoConexao').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formVersaoWindows').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formCondicaoTela').addEventListener('change', updateEvaluationSummary);
  document.getElementById('formOperadora').addEventListener('input', updateEvaluationSummary);

  document.getElementById('formFotos').addEventListener('change', handlePhotoUpload);
  document.getElementById('formFotoCelular').addEventListener('change', handleFotoCelularUpload);

  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').style.display === 'flex') {
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') closeLightbox();
    }
  });
});
