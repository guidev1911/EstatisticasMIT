/* ==========================================================
   PROGRESSO MUDANÇA DE INFRA MIT 2026
   100% sem dependências externas: lê um .csv exportado da aba
   "Dados" (colunas: Setor | Etapa | Concluído (0/1)) e desenha
   os gráficos com HTML/CSS puro — nada é carregado da internet.
   ========================================================== */

const SECTOR_ORDER_HINT = ["OUVIDORIA","AGEPLANDI","GERSAT","SETAI","RENAVAM",
  "DIROP","COPROC","CAEX","GRAVAMES","NUAVE","GERCONV","COREV","AGIN"];

let state = {
  rows: [],          // [{setor, etapa, concluido}]
  sectors: [],        // unique setor names, in order found
  stages: [],         // unique etapa names, in order found
  selectedSector: null
};

const CSV_FILE = 'dados.csv'; // fica na raiz do projeto, junto do index.html

const STAGE_TEMPLATE = [
  "Lançamento dos cabos lógicos",
  "Lançamento do circuito elétrico",
  "Instalação das descidas",
  "Instalação das tomadas elétricas",
  "Instalação das tomadas lógicas",
  "Conectorização das tomadas lógicas",
  "Conectorização dos cabos lógicos no patch painel",
  "Ativação dos pontos lógicos",
  "Ativação das tomadas elétricas",
  "Ativação dos circuitos elétricos no quadro",
  "Teste dos equipamentos"
];

const els = {
  editFab: document.getElementById('editFab'),
  editorOverlay: document.getElementById('editorOverlay'),
  editorClose: document.getElementById('editorClose'),
  editorBody: document.getElementById('editorBody'),
  editorStatus: document.getElementById('editorStatus'),
  openCsvInput: document.getElementById('openCsvInput'),
  addSectorBtn: document.getElementById('addSectorBtn'),
  addStageAllBtn: document.getElementById('addStageAllBtn'),
  saveFileBtn: document.getElementById('saveFileBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  emptyState: document.getElementById('emptyState'),
  emptyStateText: document.getElementById('emptyStateText'),
  dashboardContent: document.getElementById('dashboardContent'),
  overallPct: document.getElementById('overallPct'),
  gaugeFill: document.getElementById('gaugeFill'),
  gaugeTicks: document.getElementById('gaugeTicks'),
  statEtapas: document.getElementById('statEtapas'),
  statSetoresOk: document.getElementById('statSetoresOk'),
  statBottleneck: document.getElementById('statBottleneck'),
  sectorGrid: document.getElementById('sectorGrid'),
  sectorRanking: document.getElementById('sectorRanking'),
  stageRanking: document.getElementById('stageRanking'),
  sectorTabs: document.getElementById('sectorTabs'),
  checklist: document.getElementById('checklist'),
  footerUpdated: document.getElementById('footerUpdated'),
};

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 86; // r=86

/* ---------- ticks around gauge ---------- */
function drawGaugeTicks(){
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 100, cy = 100, rOuter = 96, rInner = 91;
  for(let i=0;i<40;i++){
    const angle = (i/40) * Math.PI * 2;
    const x1 = cx + rInner*Math.cos(angle);
    const y1 = cy + rInner*Math.sin(angle);
    const x2 = cx + rOuter*Math.cos(angle);
    const y2 = cy + rOuter*Math.sin(angle);
    const line = document.createElementNS(ns,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y1);
    line.setAttribute('x2',x2); line.setAttribute('y2',y2);
    line.setAttribute('class','tick');
    els.gaugeTicks.appendChild(line);
  }
}
drawGaugeTicks();

/* ---------- carrega dados.csv automaticamente ---------- */
async function loadData(){
  try{
    const res = await fetch(CSV_FILE, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = decodeCSVBytes(bytes);
    parseCSV(text);
    els.footerUpdated.textContent = CSV_FILE + ' · carregado em ' + new Date().toLocaleString('pt-BR');
  }catch(err){
    console.error(err);
    showLoadError(err);
  }
}

function showLoadError(err){
  els.emptyState.classList.remove('hidden');
  els.dashboardContent.classList.add('hidden');
  const isFileProtocol = location.protocol === 'file:';
  els.emptyStateText.innerHTML = isFileProtocol
    ? `Não consegui carregar <strong>${CSV_FILE}</strong>.<br><br>
       Isso costuma acontecer porque o navegador bloqueia leitura de arquivos locais quando a página é aberta direto com duplo clique (protocolo <code>file://</code>).<br><br>
       Rode o site por um servidor local (ex: extensão "Live Server" do VS Code, ou <code>python -m http.server</code> na pasta do projeto) ou publique-o num servidor/intranet.`
    : `Não consegui carregar <strong>${CSV_FILE}</strong>. Confirme se o arquivo está na mesma pasta do <code>index.html</code>, com esse nome exato, e recarregue a página.`;
  els.footerUpdated.textContent = 'Falha ao carregar ' + CSV_FILE;
}

window.addEventListener('DOMContentLoaded', loadData);

/* O Excel do Windows costuma salvar CSV em ANSI/Windows-1252, não UTF-8
   — por isso "ç", "ã", "é" etc. viram símbolos estranhos se a gente
   sempre ler como UTF-8. Aqui a gente tenta UTF-8 primeiro; se aparecer
   caractere de erro (�), refaz a leitura como Windows-1252. */
function decodeCSVBytes(bytes){
  let start = 0;
  if(bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) start = 3; // BOM UTF-8

  const utf8Text = new TextDecoder('utf-8').decode(bytes.slice(start));
  if(!utf8Text.includes('\uFFFD')){
    return utf8Text; // decodificou certinho como UTF-8
  }
  // fallback: Windows-1252 (ANSI), o padrão do Excel em PT-BR
  return new TextDecoder('windows-1252').decode(bytes.slice(start));
}

/* Parser CSV simples: detecta separador (',' ou ';'), lida com aspas. */
function parseCSVLine(line, delim){
  const out = [];
  let cur = '', inQuotes = false;
  for(let i=0;i<line.length;i++){
    const c = line[i];
    if(inQuotes){
      if(c === '"'){
        if(line[i+1] === '"'){ cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === delim){ out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function showParseError(msg){
  els.emptyState.classList.remove('hidden');
  els.dashboardContent.classList.add('hidden');
  els.emptyStateText.innerHTML = msg + `<br><br>Confira o arquivo <strong>${CSV_FILE}</strong> na raiz do projeto.`;
  els.footerUpdated.textContent = 'Erro ao interpretar ' + CSV_FILE;
}

function parseCSV(text){
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if(!lines.length){
    showParseError('O arquivo CSV está vazio.');
    return;
  }

  const headerLine = lines[0];
  const delim = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
  const header = parseCSVLine(headerLine, delim).map(h => h.toLowerCase());

  const setorIdx = header.findIndex(h => h.includes('setor'));
  const etapaIdx = header.findIndex(h => h.includes('etapa'));
  const concluidoIdx = header.findIndex(h => h.includes('conclu'));

  if(setorIdx === -1 || etapaIdx === -1 || concluidoIdx === -1){
    showParseError('Não encontrei as colunas Setor / Etapa / Concluído no cabeçalho do CSV.');
    return;
  }

  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = parseCSVLine(lines[i], delim);
    const setor = (cols[setorIdx] || '').trim();
    const etapa = (cols[etapaIdx] || '').trim();
    if(!setor || !etapa) continue;
    const rawVal = (cols[concluidoIdx] || '').trim().replace(',', '.');
    rows.push({
      setor,
      etapa,
      concluido: Number(rawVal) === 1
    });
  }

  if(!rows.length){
    showParseError('Não encontrei linhas de dados válidas no CSV.');
    return;
  }

  const sectors = [...new Set(rows.map(r => r.setor))];
  sectors.sort((a,b) => {
    const ia = SECTOR_ORDER_HINT.indexOf(a);
    const ib = SECTOR_ORDER_HINT.indexOf(b);
    if(ia === -1 && ib === -1) return a.localeCompare(b);
    if(ia === -1) return 1;
    if(ib === -1) return -1;
    return ia - ib;
  });
  const stages = [...new Set(rows.map(r => r.etapa))];

  state.rows = rows;
  state.sectors = sectors;
  state.stages = stages;
  state.selectedSector = sectors[0] || null;

  render();
}

/* ---------- derived data ---------- */
function sectorProgress(setor){
  const rs = state.rows.filter(r => r.setor === setor);
  if(!rs.length) return 0;
  const done = rs.filter(r => r.concluido).length;
  return Math.round((done / rs.length) * 100);
}
function stageProgress(etapa){
  const rs = state.rows.filter(r => r.etapa === etapa);
  if(!rs.length) return 0;
  const done = rs.filter(r => r.concluido).length;
  return Math.round((done / rs.length) * 100);
}
function overallProgress(){
  if(!state.rows.length) return 0;
  const done = state.rows.filter(r => r.concluido).length;
  return Math.round((done / state.rows.length) * 100);
}

/* ---------- render ---------- */
function render(){
  els.emptyState.classList.add('hidden');
  els.dashboardContent.classList.remove('hidden');

  renderHero();
  renderSectorGrid();
  renderBarList(els.sectorRanking, [...state.sectors].sort((a,b) => sectorProgress(b) - sectorProgress(a)).map(s => ({ label: s, value: sectorProgress(s) })));
  renderBarList(els.stageRanking, state.stages.map(s => ({ label: s, value: stageProgress(s) })));
  renderSectorTabs();
  renderChecklist(state.selectedSector);
}

function renderHero(){
  const overall = overallProgress();
  els.overallPct.textContent = overall + '%';
  const offset = GAUGE_CIRCUMFERENCE - (overall/100)*GAUGE_CIRCUMFERENCE;
  els.gaugeFill.style.strokeDashoffset = offset;
  els.gaugeFill.style.stroke = overall >= 100 ? 'var(--amber)' : 'var(--cyan)';
  els.gaugeFill.style.filter = overall >= 100
    ? 'drop-shadow(0 0 6px rgba(255,180,84,.6))'
    : 'drop-shadow(0 0 6px rgba(82,217,196,.5))';

  const doneEtapas = state.rows.filter(r => r.concluido).length;
  els.statEtapas.textContent = `${doneEtapas}/${state.rows.length}`;

  const setoresOk = state.sectors.filter(s => sectorProgress(s) === 100).length;
  els.statSetoresOk.textContent = `${setoresOk}/${state.sectors.length}`;

  let worstStage = null, worstPct = 101;
  state.stages.forEach(st => {
    const p = stageProgress(st);
    if(p < worstPct){ worstPct = p; worstStage = st; }
  });
  els.statBottleneck.textContent = worstStage ? `${worstStage} (${worstPct}%)` : '—';
  els.statBottleneck.style.fontSize = worstStage && worstStage.length > 22 ? '14px' : '20px';
}

function renderSectorGrid(){
  els.sectorGrid.innerHTML = '';
  state.sectors.forEach(setor => {
    const pct = sectorProgress(setor);
    const rs = state.rows.filter(r => r.setor === setor);
    const done = rs.filter(r => r.concluido).length;

    const card = document.createElement('div');
    card.className = 'sector-card' + (pct === 100 ? ' complete' : '') + (setor === state.selectedSector ? ' selected' : '');
    card.innerHTML = `
      <div class="sector-card-top">
        <span class="sector-name">${setor}</span>
        <span class="sector-pct">${pct}%</span>
      </div>
      <div class="trace-track">
        <div class="trace-fill" style="width:0%"></div>
        <div class="trace-node" style="left:0%"></div>
      </div>
      <div class="sector-meta">${done}/${rs.length} etapas concluídas</div>
    `;
    card.addEventListener('click', () => {
      state.selectedSector = setor;
      renderSectorTabs();
      renderChecklist(setor);
      document.querySelectorAll('.sector-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('checklist').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
    els.sectorGrid.appendChild(card);

    requestAnimationFrame(() => {
      const fill = card.querySelector('.trace-fill');
      const node = card.querySelector('.trace-node');
      fill.style.width = pct + '%';
      node.style.left = pct + '%';
    });
  });
}

/* Lista de barras genérica (usada no ranking de setores e no progresso por etapa) */
function renderBarList(container, items){
  container.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'bar-row' + (item.value === 100 ? ' complete' : '');
    row.innerHTML = `
      <span class="bar-row-label" title="${item.label}">${item.label}</span>
      <div class="trace-track">
        <div class="trace-fill" style="width:0%"></div>
        <div class="trace-node" style="left:0%"></div>
      </div>
      <span class="bar-row-value">${item.value}%</span>
    `;
    container.appendChild(row);
    requestAnimationFrame(() => {
      const fill = row.querySelector('.trace-fill');
      const node = row.querySelector('.trace-node');
      fill.style.width = item.value + '%';
      node.style.left = item.value + '%';
    });
  });
}

function renderSectorTabs(){
  els.sectorTabs.innerHTML = '';
  state.sectors.forEach(setor => {
    const btn = document.createElement('button');
    btn.className = 'sector-tab' + (setor === state.selectedSector ? ' active' : '');
    btn.textContent = setor;
    btn.addEventListener('click', () => {
      state.selectedSector = setor;
      renderSectorTabs();
      renderChecklist(setor);
    });
    els.sectorTabs.appendChild(btn);
  });
}

function renderChecklist(setor){
  els.checklist.innerHTML = '';
  if(!setor) return;
  const rs = state.rows.filter(r => r.setor === setor);
  rs.forEach(r => {
    const row = document.createElement('div');
    row.className = 'check-row ' + (r.concluido ? 'done' : 'pending');
    row.innerHTML = `<span class="check-icon">${r.concluido ? '✓' : ''}</span><span>${r.etapa}</span>`;
    els.checklist.appendChild(row);
  });
}

/* ==========================================================
   EDITOR DE DADOS
   Abre um painel com os dados carregados, permite marcar
   progresso, renomear, adicionar e remover setores/etapas,
   e salvar um novo dados.csv (via download ou direto no
   arquivo, quando o navegador suportar).
   ========================================================== */

function recomputeSectorsStages(){
  const sectors = [...new Set(state.rows.map(r => r.setor))];
  sectors.sort((a,b) => {
    const ia = SECTOR_ORDER_HINT.indexOf(a);
    const ib = SECTOR_ORDER_HINT.indexOf(b);
    if(ia === -1 && ib === -1) return a.localeCompare(b);
    if(ia === -1) return 1;
    if(ib === -1) return -1;
    return ia - ib;
  });
  state.sectors = sectors;
  state.stages = [...new Set(state.rows.map(r => r.etapa))];
  if(!state.sectors.includes(state.selectedSector)){
    state.selectedSector = state.sectors[0] || null;
  }
}

function refreshAll(){
  recomputeSectorsStages();
  if(state.rows.length){
    render();
  } else {
    els.emptyState.classList.remove('hidden');
    els.dashboardContent.classList.add('hidden');
    els.emptyStateText.textContent = 'Nenhum dado ainda — adicione um setor no editor.';
  }
}

function openEditor(){
  els.editorOverlay.classList.add('open');
  renderEditor();
}
function closeEditor(){
  els.editorOverlay.classList.remove('open');
}
els.editFab.addEventListener('click', openEditor);
els.editorClose.addEventListener('click', closeEditor);
els.editorOverlay.addEventListener('click', (e) => {
  if(e.target === els.editorOverlay) closeEditor();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && els.editorOverlay.classList.contains('open')) closeEditor();
});

function renderEditor(){
  els.editorBody.innerHTML = '';

  if(!state.sectors.length){
    const empty = document.createElement('p');
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '13px';
    empty.textContent = 'Nenhum setor ainda. Clique em "+ Adicionar setor" para começar.';
    els.editorBody.appendChild(empty);
    return;
  }

  state.sectors.forEach(setor => {
    const rs = state.rows.filter(r => r.setor === setor);
    const pct = rs.length ? Math.round((rs.filter(r => r.concluido).length / rs.length) * 100) : 0;

    const block = document.createElement('div');
    block.className = 'editor-sector';

    const head = document.createElement('div');
    head.className = 'editor-sector-head';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'field-input editor-sector-name';
    nameInput.value = setor;
    nameInput.addEventListener('change', () => {
      const newName = nameInput.value.trim();
      if(!newName) { nameInput.value = setor; return; }
      state.rows.forEach(r => { if(r.setor === setor) r.setor = newName; });
      if(state.selectedSector === setor) state.selectedSector = newName;
      refreshAll();
      renderEditor();
    });

    const pctSpan = document.createElement('span');
    pctSpan.className = 'editor-sector-pct';
    pctSpan.textContent = pct + '%';

    const removeSectorBtn = document.createElement('button');
    removeSectorBtn.className = 'sector-remove';
    removeSectorBtn.innerHTML = '&times;';
    removeSectorBtn.title = 'Remover setor';
    removeSectorBtn.addEventListener('click', () => {
      if(!confirm(`Remover o setor "${setor}" e todas as suas etapas?`)) return;
      state.rows = state.rows.filter(r => r.setor !== setor);
      refreshAll();
      renderEditor();
    });

    head.appendChild(nameInput);
    head.appendChild(pctSpan);
    head.appendChild(removeSectorBtn);
    block.appendChild(head);

    rs.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'editor-row';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = row.concluido;
      check.addEventListener('change', () => {
        row.concluido = check.checked;
        refreshAll();
        renderEditor();
      });

      const etapaInput = document.createElement('input');
      etapaInput.type = 'text';
      etapaInput.className = 'field-input';
      etapaInput.value = row.etapa;
      etapaInput.addEventListener('change', () => {
        const v = etapaInput.value.trim();
        if(!v){ etapaInput.value = row.etapa; return; }
        row.etapa = v;
        refreshAll();
      });

      const removeRowBtn = document.createElement('button');
      removeRowBtn.className = 'row-remove';
      removeRowBtn.innerHTML = '&times;';
      removeRowBtn.title = 'Remover etapa';
      removeRowBtn.addEventListener('click', () => {
        state.rows = state.rows.filter(r => r !== row);
        refreshAll();
        renderEditor();
      });

      rowEl.appendChild(check);
      rowEl.appendChild(etapaInput);
      rowEl.appendChild(removeRowBtn);
      block.appendChild(rowEl);
    });

    const addRowBtn = document.createElement('button');
    addRowBtn.className = 'editor-add-row';
    addRowBtn.textContent = '+ Adicionar etapa';
    addRowBtn.addEventListener('click', () => {
      const nome = prompt('Nome da nova etapa:');
      if(!nome || !nome.trim()) return;
      state.rows.push({ setor, etapa: nome.trim(), concluido:false });
      refreshAll();
      renderEditor();
    });
    block.appendChild(addRowBtn);

    els.editorBody.appendChild(block);
  });
}

els.addSectorBtn.addEventListener('click', () => {
  const nome = prompt('Nome do novo setor:');
  if(!nome || !nome.trim()) return;
  const setorName = nome.trim();
  STAGE_TEMPLATE.forEach(etapa => {
    state.rows.push({ setor: setorName, etapa, concluido:false });
  });
  refreshAll();
  renderEditor();
});

/* Adiciona uma etapa nova em TODOS os setores já existentes de uma vez —
   útil quando um passo novo (ex: "Ativação dos circuitos elétricos no
   quadro") passa a valer pra todo mundo, não só pra setores futuros.
   Não duplica se o setor já tiver uma etapa com esse nome. */
function addStageToAllSectors(etapaName){
  const nome = etapaName.trim();
  if(!nome) return;
  let added = 0;
  state.sectors.forEach(setor => {
    const jaTem = state.rows.some(r => r.setor === setor && r.etapa.toLowerCase() === nome.toLowerCase());
    if(!jaTem){
      state.rows.push({ setor, etapa: nome, concluido:false });
      added++;
    }
  });
  refreshAll();
  renderEditor();
  els.editorStatus.textContent = added > 0
    ? `"${nome}" adicionada em ${added} setor(es).`
    : `Todos os setores já tinham "${nome}".`;
}

els.addStageAllBtn.addEventListener('click', () => {
  const nome = prompt('Nome da etapa a adicionar em todos os setores:');
  if(!nome || !nome.trim()) return;
  addStageToAllSectors(nome);
});

els.openCsvInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = decodeCSVBytes(bytes);
    parseCSV(text);
    renderEditor();
    els.editorStatus.textContent = 'Carregado: ' + file.name;
  }catch(err){
    console.error(err);
    els.editorStatus.textContent = 'Erro ao abrir o arquivo.';
  }
  e.target.value = '';
});

/* CSV escaping: envolve em aspas se tiver vírgula, ponto-e-vírgula, aspas ou quebra de linha */
function csvEscape(field){
  const s = String(field ?? '');
  if(/[",;\n\r]/.test(s)){
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCSVText(){
  const lines = ['Setor,Etapa,Concluído (0/1),% Setor'];
  state.rows.forEach(r => {
    const pct = sectorProgress(r.setor);
    lines.push([
      csvEscape(r.setor),
      csvEscape(r.etapa),
      r.concluido ? 1 : 0,
      pct
    ].join(','));
  });
  return '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM para o Excel reconhecer UTF-8
}

els.downloadCsvBtn.addEventListener('click', () => {
  const text = buildCSVText();
  const blob = new Blob([text], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = CSV_FILE;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  els.editorStatus.textContent = 'Baixado — mova o arquivo pra pasta do site.';
});

/* ---------- salvar direto no dados.csv já existente ---------- */

// Guarda a referência (handle) do arquivo dados.csv real no disco, uma vez
// selecionado, para os próximos "Salvar" gravarem direto nele, sem perguntar
// onde salvar de novo. Fica também em IndexedDB pra sobreviver a um F5.
let cachedFileHandle = null;
const IDB_NAME = 'infraDashboardDB';
const IDB_STORE = 'handles';
const IDB_KEY = 'dadosCsvHandle';

function idbGet(key){
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readonly');
      const getReq = tx.objectStore(IDB_STORE).get(key);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}
function idbSet(key, value){
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    };
    req.onerror = () => resolve(false);
  });
}

async function verifyPermission(handle){
  const opts = { mode:'readwrite' };
  if((await handle.queryPermission(opts)) === 'granted') return true;
  if((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

/* Retorna um handle com permissão de escrita apontando para o dados.csv real.
   Primeira vez: pede pra localizar o arquivo (o navegador exige essa
   confirmação manual por segurança). Depois disso, fica guardado e os
   próximos saves gravam direto, sem perguntar de novo. */
async function getWritableFileHandle(){
  if(cachedFileHandle && await verifyPermission(cachedFileHandle)){
    return cachedFileHandle;
  }
  const stored = await idbGet(IDB_KEY);
  if(stored && await verifyPermission(stored)){
    cachedFileHandle = stored;
    return stored;
  }
  const [handle] = await window.showOpenFilePicker({
    types: [{ description:'CSV', accept: { 'text/csv': ['.csv'] } }],
    excludeAcceptAllOption: false,
    multiple: false
  });
  if(!(await verifyPermission(handle))) return null;
  cachedFileHandle = handle;
  idbSet(IDB_KEY, handle);
  return handle;
}

els.saveFileBtn.addEventListener('click', async () => {
  const text = buildCSVText();

  if(!('showOpenFilePicker' in window)){
    els.downloadCsvBtn.click();
    els.editorStatus.textContent = 'Seu navegador não salva direto — arquivo baixado, mova para a pasta do site.';
    return;
  }

  try{
    const isFirstTime = !cachedFileHandle;
    if(isFirstTime) els.editorStatus.textContent = 'Selecione o arquivo dados.csv da pasta do site…';

    const handle = await getWritableFileHandle();
    if(!handle){
      els.editorStatus.textContent = 'Permissão negada — use "Baixar CSV".';
      return;
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    els.editorStatus.textContent = '✓ Salvo em ' + CSV_FILE + '.';
    els.footerUpdated.textContent = CSV_FILE + ' · editado em ' + new Date().toLocaleString('pt-BR');
  }catch(err){
    if(err.name !== 'AbortError'){
      console.error(err);
      els.editorStatus.textContent = 'Não consegui salvar — use "Baixar CSV".';
    }
  }
});
