/* ═══════════════════════════════════════════════════════════
   KEFILIA — Sistema de Gestión  |  app.js
   ═══════════════════════════════════════════════════════════ */

// ─── DATA LAYER ───
let movimientos = JSON.parse(localStorage.getItem("kef_movimientos")) || [];
let saldo = Number(localStorage.getItem("kef_saldo")) || 0;
let inventario = JSON.parse(localStorage.getItem("kef_inventario")) || {};
let stockLog = JSON.parse(localStorage.getItem("kef_stockLog")) || [];
let lotes = JSON.parse(localStorage.getItem("kef_lotes")) || [];
let pedidos = JSON.parse(localStorage.getItem("kef_pedidos")) || [];
let pedidoFiltro = "todos";

// Only 1L products — 4 sabores x 2 tipos = 8 productos
const SABORES = ["Natural","Strawkefir","Chocokefir","Kefipecha"];
const TIPOS = ["Kefir","Griego"];
const ICONOS = { Natural:"🥛", Strawkefir:"🍓", Chocokefir:"🍫", Kefipecha:"🍑" };

// Tabla de precios: sabor + tipo → { frasco, refill } en Bs. (1 Litro)
const PRECIOS = {
  "Natural-Kefir":     { frasco: 42, refill: 20 },
  "Natural-Griego":    { frasco: 55, refill: 35 },
  "Strawkefir-Kefir":  { frasco: 48, refill: 26 },
  "Strawkefir-Griego": { frasco: 60, refill: 38 },
  "Chocokefir-Kefir":  { frasco: 50, refill: 28 },
  "Chocokefir-Griego": { frasco: 50, refill: 28 }, // sin precio diferenciado, igual a Chocokefir
  "Kefipecha-Kefir":   { frasco: 48, refill: 26 },
  "Kefipecha-Griego":  { frasco: 55, refill: 35 },
};

// Build product list
const PRODUCTOS = [];
SABORES.forEach(s => {
  TIPOS.forEach(t => {
    const name = t === "Griego" ? `${s} Griego 1L` : `${s} 1L`;
    PRODUCTOS.push({ name, sabor:s, tipo:t, icon:ICONOS[s] });
  });
});

// Init stock for each product
PRODUCTOS.forEach(p => { if(!(p.name in inventario)) inventario[p.name] = 0; });

// Helper to get product name from sabor+tipo
function prodName(sabor, tipo){
  return tipo === "Griego" ? `${sabor} Griego 1L` : `${sabor} 1L`;
}

// ─── NAVIGATION ───
const tabs = {
  dashboard: document.getElementById("tabDashboard"),
  inventario: document.getElementById("tabInventario"),
  produccion: document.getElementById("tabProduccion"),
  finanzas: document.getElementById("tabFinanzas"),
  pedidos: document.getElementById("tabPedidos"),
};

document.querySelectorAll(".nav-btn[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn[data-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(tabs).forEach(t => t.classList.remove("active"));
    tabs[btn.dataset.tab].classList.add("active");
    closeMobileSidebar();
  });
});

// Mobile sidebar
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");
const hamburger = document.getElementById("hamburger");
hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("visible");
});
overlay.addEventListener("click", closeMobileSidebar);
function closeMobileSidebar(){
  sidebar.classList.remove("open");
  overlay.classList.remove("visible");
}

// ─── DATE ───
document.getElementById("currentDate").textContent = new Date().toLocaleDateString("es-BO",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

// ─── FORMAT ───
function fmt(v){
  return "Bs. " + Number(v).toLocaleString("es-BO",{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ─── TOAST ───
let toastTimer;
function showToast(msg, type="success"){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.innerHTML = `<div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg></div><div class="toast-msg"></div>`;
    document.body.appendChild(t);
  }
  t.className = "toast toast-" + type;
  t.querySelector(".toast-msg").textContent = msg;
  clearTimeout(toastTimer);
  requestAnimationFrame(()=>{
    t.classList.add("show");
    toastTimer = setTimeout(()=> t.classList.remove("show"), 3000);
  });
}

// ═══════ PRECIO AUTOMÁTICO (FINANZAS INGRESO) ═══════
function actualizarPrecioIngreso(){
  const sabor = document.getElementById("ingresoSabor").value;
  const tipo = document.getElementById("ingresoTipo").value;
  const tipoVenta = document.getElementById("ingresoTipoVenta").value; // "frasco" | "refill"
  const cant = Math.max(1, Number(document.getElementById("ingresoCantidad").value) || 1);
  const key = sabor + "-" + tipo;
  const precios = PRECIOS[key];
  const unitPrice = precios ? precios[tipoVenta] : 0;
  const total = unitPrice * cant;
  document.getElementById("precioUnit").textContent = fmt(unitPrice);
  document.getElementById("precioTotal").textContent = fmt(total);
}

// ═══════ FINANZAS ═══════
function agregarIngreso(){
  const sabor = document.getElementById("ingresoSabor").value;
  const tipo = document.getElementById("ingresoTipo").value;
  const tipoVenta = document.getElementById("ingresoTipoVenta").value;
  const cant = Math.max(1, Number(document.getElementById("ingresoCantidad").value) || 1);
  const key = sabor + "-" + tipo;
  const precios = PRECIOS[key];
  const unitPrice = precios ? precios[tipoVenta] : 0;
  const monto = unitPrice * cant;

  if(monto <= 0) return showToast("Selecciona un producto válido","error");

  // Descontar del inventario
  const pName = prodName(sabor, tipo);
  const stockActual = inventario[pName] || 0;
  if(stockActual < cant){
    return showToast(`Stock insuficiente de ${pName}. Tienes ${stockActual} uds.`,"error");
  }
  inventario[pName] -= cant;

  // Log de stock (salida por venta)
  stockLog.push({ id:Date.now(), timestamp:Date.now(), producto:pName, cantidad:cant, tipo:"salida (venta)", lote:"" });
  guardarStock();

  const tipoVentaLabel = tipoVenta === "refill" ? "Refill" : "Con frasco";
  const desc = `${cant}x ${pName} (${tipoVentaLabel})`;
  const cat = "Venta";
  const timestamp = Date.now();
  saldo += monto;

  movimientos.push({ id:timestamp, timestamp, tipo:"INGRESO", cat, desc, ingreso:monto, gasto:0, saldo });
  guardar();

  // Reset
  document.getElementById("ingresoCantidad").value = 1;
  actualizarPrecioIngreso();
  renderAll();
  showToast(`Venta registrada: ${desc} — ${fmt(monto)}`);
}

function agregarGasto(){
  const desc = document.getElementById("gastoDesc").value;
  const cat = document.getElementById("gastoCat").value;
  const monto = Number(document.getElementById("gastoMonto").value);

  if(!desc || !cat || monto <= 0) return showToast("Completa todos los campos","error");

  const timestamp = Date.now();
  saldo -= monto;
  movimientos.push({ id:timestamp, timestamp, tipo:"GASTO", cat, desc, ingreso:0, gasto:monto, saldo });
  guardar();
  document.getElementById("gastoDesc").value = "";
  document.getElementById("gastoMonto").value = "";
  renderAll();
  showToast("Gasto registrado");
}

function eliminar(id){
  movimientos = movimientos.filter(m => m.id !== id);
  saldo = 0;
  movimientos.forEach(m => { saldo += m.ingreso - m.gasto; m.saldo = saldo; });
  guardar();
  renderAll();
  showToast("Movimiento eliminado");
}

// ═══════ PRODUCCIÓN ═══════
function registrarProduccion(){
  const sabor = document.getElementById("prodSabor").value;
  const tipo = document.getElementById("prodTipoKefir").value;
  const litros = Number(document.getElementById("prodLitros").value);
  const estado = document.getElementById("prodEstado").value;
  const notas = document.getElementById("prodNotas").value;

  const producto = prodName(sabor, tipo);
  if(!producto || litros <= 0) return showToast("Datos inválidos","error");

  const loteId = "LOT-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + Math.random().toString(36).substring(2,5).toUpperCase();

  const loteData = { id:Date.now(), loteId, producto, sabor, tipo, litros, estado, notas, timestamp:Date.now() };
  lotes.push(loteData);

  // Si el estado ya es "Envasado", sumar al inventario inmediatamente
  if(estado === "Envasado"){
    agregarAlInventario(loteData);
  }

  guardarLotes();
  document.getElementById("prodLitros").value = "";
  document.getElementById("prodNotas").value = "";
  renderAll();
  showToast(`Lote ${loteId} registrado`);
}

function agregarAlInventario(lote){
  const pName = lote.producto;
  const unidades = lote.litros; // 1 litro = 1 unidad de producto 1L
  inventario[pName] = (inventario[pName] || 0) + unidades;
  stockLog.push({ id:Date.now(), timestamp:Date.now(), producto:pName, cantidad:unidades, tipo:"entrada (producción)", lote:lote.loteId });
  guardarStock();
}

function actualizarEstadoLote(id, nuevoEstado){
  const lote = lotes.find(l => l.id === id);
  if(!lote) return;

  const prevEstado = lote.estado;
  lote.estado = nuevoEstado;

  // Cuando llega a "Envasado", sumar al inventario
  if(nuevoEstado === "Envasado" && prevEstado !== "Envasado"){
    agregarAlInventario(lote);
  }

  guardarLotes();
  renderAll();
  showToast(nuevoEstado === "Envasado" 
    ? `Lote envasado y agregado al inventario (+${lote.litros} uds)` 
    : "Estado actualizado");
}

function eliminarLote(id){
  lotes = lotes.filter(l => l.id !== id);
  guardarLotes(); renderAll(); showToast("Lote eliminado");
}

// ═══════ PERSISTENCE ═══════
function guardar(){
  localStorage.setItem("kef_movimientos", JSON.stringify(movimientos));
  localStorage.setItem("kef_saldo", saldo);
}
function guardarStock(){
  localStorage.setItem("kef_inventario", JSON.stringify(inventario));
  localStorage.setItem("kef_stockLog", JSON.stringify(stockLog));
}
function guardarLotes(){
  localStorage.setItem("kef_lotes", JSON.stringify(lotes));
}

function resetear(){
  if(confirm("¿Eliminar TODA la información financiera?")){
    movimientos = []; saldo = 0;
    localStorage.removeItem("kef_movimientos");
    localStorage.removeItem("kef_saldo");
    renderAll();
    showToast("Datos financieros reiniciados");
  }
}

// ═══════ RENDER ═══════
function renderAll(){
  renderDashboard();
  renderFinanzas();
  renderInventario();
  renderProduccion();
  renderPedidos();
}

function renderDashboard(){
  document.getElementById("dashSaldo").textContent = fmt(saldo);
  document.getElementById("dashIngresos").textContent = fmt(totalIngresos());
  document.getElementById("dashGastos").textContent = fmt(totalGastos());
  document.getElementById("dashStock").textContent = Object.values(inventario).reduce((a,b)=>a+b,0);

  const list = document.getElementById("dashActivity");
  const empty = document.getElementById("dashEmpty");
  const all = [...movimientos.map(m=>({...m,_type:"fin"})), ...stockLog.map(s=>({...s,_type:"stock"}))];
  all.sort((a,b) => b.timestamp - a.timestamp);
  const recent = all.slice(0,8);

  document.getElementById("activityCount").textContent = all.length;
  list.innerHTML = "";
  if(recent.length === 0){ empty.style.display = "block"; return; }
  empty.style.display = "none";

  recent.forEach(item => {
    const li = document.createElement("li");
    li.className = "activity-item";
    const fecha = new Date(item.timestamp).toLocaleString("es-BO");
    if(item._type === "fin"){
      const isIn = item.tipo === "INGRESO";
      li.innerHTML = `
        <div class="activity-dot ${isIn ? 'dot-green':'dot-red'}"></div>
        <div class="activity-info"><strong>${item.desc}</strong><span>${item.cat} — ${fecha}</span></div>
        <span class="activity-amount ${isIn ? 'amount-green':'amount-red'}">${isIn ? '+':'-'}${fmt(isIn ? item.ingreso : item.gasto)}</span>`;
    } else {
      const isIn = item.tipo.includes("entrada");
      li.innerHTML = `
        <div class="activity-dot ${isIn ? 'dot-blue':'dot-yellow'}"></div>
        <div class="activity-info"><strong>${item.producto}</strong><span>${item.tipo} — ${item.cantidad} uds — ${fecha}</span></div>`;
    }
    list.appendChild(li);
  });
}

function renderFinanzas(){
  const list = document.getElementById("lista");
  const empty = document.getElementById("finanzasEmpty");
  document.getElementById("finanzasCount").textContent = movimientos.length;
  list.innerHTML = "";
  if(movimientos.length === 0){ empty.style.display = "block"; return; }
  empty.style.display = "none";

  movimientos.slice().reverse().forEach(m => {
    const fecha = new Date(m.timestamp);
    const isIn = m.tipo === "INGRESO";
    const li = document.createElement("li");
    li.className = "activity-item";
    li.innerHTML = `
      <div class="activity-dot ${isIn ? 'dot-green':'dot-red'}"></div>
      <div class="activity-info">
        <strong>${m.desc}</strong>
        <span>${m.cat} — ${fecha.toLocaleString("es-BO")} — Saldo: ${fmt(m.saldo)}</span>
      </div>
      <span class="activity-amount ${isIn ? 'amount-green':'amount-red'}">${isIn?'+':'-'}${fmt(isIn?m.ingreso:m.gasto)}</span>
      <button class="activity-delete" onclick="eliminar(${m.id})" title="Eliminar">✕</button>`;
    list.appendChild(li);
  });
}

function renderInventario(){
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";
  PRODUCTOS.forEach((p, i) => {
    const qty = inventario[p.name] || 0;
    const statusClass = qty > 10 ? "stock-ok" : qty > 0 ? "stock-low" : "stock-out";
    const card = document.createElement("div");
    card.className = "inv-card";
    card.style.animationDelay = (i * 0.06) + "s";
    const tipoLabel = p.tipo === "Griego" ? "Griego" : "Kefir";
    card.innerHTML = `
      <div class="inv-card-status ${statusClass}"></div>
      <div class="inv-card-icon">${p.icon}</div>
      <div class="inv-card-name">${p.name}</div>
      <div class="inv-card-qty">${qty}</div>
      <div class="inv-card-unit">litros</div>`;
    grid.appendChild(card);
  });

  // Stock log
  const logList = document.getElementById("stockLog");
  const logEmpty = document.getElementById("stockEmpty");
  document.getElementById("stockLogCount").textContent = stockLog.length;
  logList.innerHTML = "";
  if(stockLog.length === 0){ logEmpty.style.display = "block"; return; }
  logEmpty.style.display = "none";

  stockLog.slice().reverse().slice(0, 30).forEach(s => {
    const li = document.createElement("li");
    li.className = "activity-item";
    const isIn = s.tipo.includes("entrada");
    const dotClass = isIn ? "dot-blue" : "dot-yellow";
    li.innerHTML = `
      <div class="activity-dot ${dotClass}"></div>
      <div class="activity-info">
        <strong>${s.producto}</strong>
        <span>${s.tipo} — ${s.cantidad} uds${s.lote ? ' — '+s.lote : ''} — ${new Date(s.timestamp).toLocaleString("es-BO")}</span>
      </div>`;
    logList.appendChild(li);
  });
}

function renderProduccion(){
  const grid = document.getElementById("batchGrid");
  const empty = document.getElementById("batchEmpty");
  document.getElementById("batchCount").textContent = lotes.length;
  grid.innerHTML = "";
  if(lotes.length === 0){ empty.style.display = "block"; return; }
  empty.style.display = "none";

  const statusMap = {
    "En fermentación":"status-fermenting",
    "En maduración":"status-maturing",
    "Listo para envasar":"status-ready",
    "Envasado":"status-packed"
  };
  const nextState = {
    "En fermentación":"En maduración",
    "En maduración":"Listo para envasar",
    "Listo para envasar":"Envasado"
  };

  lotes.slice().reverse().forEach(l => {
    const card = document.createElement("div");
    card.className = "batch-card";
    const next = nextState[l.estado];
    const envasadoNote = next === undefined ? '<div class="batch-inv-note">Agregado al inventario</div>' : '';
    card.innerHTML = `
      <div class="batch-status ${statusMap[l.estado] || 'status-fermenting'}">${l.estado}</div>
      <div class="batch-id">${l.loteId}</div>
      <div class="batch-product">${l.producto}</div>
      <div class="batch-meta">
        <span>${l.litros}L producidos</span>
        <span>${new Date(l.timestamp).toLocaleDateString("es-BO")}</span>
      </div>
      ${l.notas ? `<div class="batch-meta"><span>${l.notas}</span></div>` : ''}
      ${envasadoNote}
      <div class="batch-actions">
        ${next ? `<button class="batch-btn" onclick="actualizarEstadoLote(${l.id},'${next}')">Avanzar a: ${next}</button>` : '<span class="batch-btn" style="opacity:.5;cursor:default">Completado</span>'}
        <button class="batch-btn delete" onclick="eliminarLote(${l.id})">Eliminar</button>
      </div>`;
    grid.appendChild(card);
  });
}

function totalIngresos(){ return movimientos.reduce((a,m) => a + m.ingreso, 0); }
function totalGastos(){ return movimientos.reduce((a,m) => a + m.gasto, 0); }

// ═══════ EXCEL EXPORT ═══════
function exportarExcel(){
  const wb = XLSX.utils.book_new();

  const resumen = [
    ["KEFILIA — Probiótico Natural"],
    ["Reporte de Gestión"],
    [],
    ["Saldo Actual", saldo],
    ["Total Ingresos", totalIngresos()],
    ["Total Gastos", totalGastos()],
    ["Total Productos en Stock", Object.values(inventario).reduce((a,b)=>a+b,0)],
    [],
    ["Generado", new Date().toLocaleString("es-BO")]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

  if(movimientos.length){
    const ws = XLSX.utils.json_to_sheet(movimientos.map(m=>({
      Fecha: new Date(m.timestamp).toLocaleDateString("es-BO"),
      Hora: new Date(m.timestamp).toLocaleTimeString("es-BO"),
      Tipo: m.tipo, Categoría: m.cat, Descripción: m.desc,
      Ingreso: m.ingreso, Gasto: m.gasto, Saldo: m.saldo
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Finanzas");
  }

  const invData = PRODUCTOS.map(p => ({ Producto: p.name, Stock: inventario[p.name]||0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), "Inventario");

  if(stockLog.length){
    const sl = XLSX.utils.json_to_sheet(stockLog.map(s=>({
      Fecha: new Date(s.timestamp).toLocaleString("es-BO"),
      Producto: s.producto, Tipo: s.tipo, Cantidad: s.cantidad, Lote: s.lote
    })));
    XLSX.utils.book_append_sheet(wb, sl, "Movimientos Stock");
  }

  if(lotes.length){
    const lt = XLSX.utils.json_to_sheet(lotes.map(l=>({
      Lote: l.loteId, Producto: l.producto, Litros: l.litros,
      Estado: l.estado, Notas: l.notas,
      Fecha: new Date(l.timestamp).toLocaleString("es-BO")
    })));
    XLSX.utils.book_append_sheet(wb, lt, "Lotes Producción");
  }

  XLSX.writeFile(wb, "Kefilia_Reporte.xlsx");
  showToast("Excel exportado correctamente");
}

// ═══════ ANIMATED BACKGROUND ═══════
(function(){
  const c = document.getElementById("bgCanvas"), ctx = c.getContext("2d");
  let W, H;
  function resize(){ W = c.width = innerWidth; H = c.height = innerHeight; }
  resize(); window.addEventListener("resize", resize);

  const pts = [];
  for(let i = 0; i < 45; i++){
    pts.push({
      x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random()*2-1,
      vx:(Math.random()-.5)*.0015, vy:(Math.random()-.5)*.0015, vz:(Math.random()-.5)*.0015
    });
  }
  function project(p,t){
    let x=p.x,y=p.y,z=p.z;
    const cy=Math.cos(t*.12),sy=Math.sin(t*.12),cx=Math.cos(t*.08),sx=Math.sin(t*.08);
    let x1=x*cy-z*sy, z1=x*sy+z*cy;
    let y1=y*cx-z1*sx, z2=y*sx+z1*cx;
    const s=500/(z2+3);
    return {x:W/2+x1*s, y:H/2+y1*s, s, z:z2};
  }
  let t = 0;
  function draw(){
    ctx.clearRect(0,0,W,H); t += 0.005;
    const proj = pts.map(p=>{
      p.x+=p.vx; p.y+=p.vy; p.z+=p.vz;
      if(Math.abs(p.x)>1) p.vx*=-1;
      if(Math.abs(p.y)>1) p.vy*=-1;
      if(Math.abs(p.z)>1) p.vz*=-1;
      return project(p,t);
    });
    for(let i=0;i<proj.length;i++){
      for(let j=i+1;j<proj.length;j++){
        const dx=proj[i].x-proj[j].x, dy=proj[i].y-proj[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<160){
          const a=((160-d)/160)*0.08;
          ctx.beginPath();ctx.moveTo(proj[i].x,proj[i].y);ctx.lineTo(proj[j].x,proj[j].y);
          ctx.strokeStyle=`rgba(74,222,128,${a})`;ctx.lineWidth=0.5;ctx.stroke();
        }
      }
    }
    for(const p of proj){
      const r=Math.max(1,p.s*0.012);
      const a=Math.min(0.4,(p.z+2)/4);
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle=`rgba(134,239,172,${a})`;ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ─── INIT ───
actualizarPrecioIngreso();
actualizarPrecioPedido();
renderAll();

// ═══════ PEDIDOS ═══════

function actualizarPrecioPedido(){
  const sabor = document.getElementById("pedidoSabor").value;
  const tipo  = document.getElementById("pedidoTipo").value;
  const tv    = document.getElementById("pedidoTipoVenta").value;
  const cant  = Math.max(1, Number(document.getElementById("pedidoCantidad").value) || 1);
  const precios = PRECIOS[sabor + "-" + tipo];
  const total = precios ? precios[tv] * cant : 0;
  document.getElementById("pedidoPrecioTotal").textContent = fmt(total);
}

function registrarPedido(){
  const cliente  = document.getElementById("pedidoCliente").value.trim();
  const sabor    = document.getElementById("pedidoSabor").value;
  const tipo     = document.getElementById("pedidoTipo").value;
  const tv       = document.getElementById("pedidoTipoVenta").value;
  const cant     = Math.max(1, Number(document.getElementById("pedidoCantidad").value) || 1);
  const entrega  = document.getElementById("pedidoEntrega").value;
  const notas    = document.getElementById("pedidoNotas").value.trim();

  if(!cliente) return showToast("Escribe el nombre del cliente", "error");

  const precios = PRECIOS[sabor + "-" + tipo];
  const unitPrice = precios ? precios[tv] : 0;
  const total = unitPrice * cant;

  const pName = prodName(sabor, tipo);
  const tvLabel = tv === "refill" ? "Refill" : "Con frasco";
  const pedidoId = "PED-" + Date.now().toString(36).toUpperCase();

  pedidos.push({
    id: Date.now(),
    pedidoId,
    cliente,
    sabor, tipo, tv, tvLabel,
    cant,
    producto: pName,
    unitPrice, total,
    entrega,
    notas,
    estado: "Pendiente",
    timestamp: Date.now(),
    completadoAt: null
  });

  guardarPedidos();

  // Reset form
  document.getElementById("pedidoCliente").value = "";
  document.getElementById("pedidoCantidad").value = 1;
  document.getElementById("pedidoEntrega").value = "";
  document.getElementById("pedidoNotas").value = "";
  actualizarPrecioPedido();
  renderAll();
  showToast(`Pedido ${pedidoId} registrado para ${cliente}`);
}

function completarPedido(id){
  const p = pedidos.find(o => o.id === id);
  if(!p || p.estado !== "Pendiente") return;

  // Descontar inventario y registrar venta en finanzas
  const stockActual = inventario[p.producto] || 0;
  if(stockActual < p.cant){
    if(!confirm(`Stock insuficiente de ${p.producto} (tienes ${stockActual} uds). \u00bfRegistrar el pedido igual sin descontar stock?`)) return;
  } else {
    inventario[p.producto] -= p.cant;
    stockLog.push({ id:Date.now(), timestamp:Date.now(), producto:p.producto, cantidad:p.cant, tipo:"salida (pedido)", lote:p.pedidoId });
    guardarStock();
  }

  // Registrar como ingreso en finanzas
  const timestamp = Date.now();
  saldo += p.total;
  movimientos.push({ id:timestamp, timestamp, tipo:"INGRESO", cat:"Venta (Pedido)",
    desc: `${p.cant}x ${p.producto} (${p.tvLabel}) — Pedido ${p.pedidoId}`,
    ingreso: p.total, gasto: 0, saldo });
  guardar();

  p.estado = "Completado";
  p.completadoAt = Date.now();
  guardarPedidos();
  renderAll();
  showToast(`Pedido ${p.pedidoId} completado — ${fmt(p.total)} registrado`);
}

function cancelarPedido(id){
  const p = pedidos.find(o => o.id === id);
  if(!p) return;
  if(!confirm(`¿Cancelar el pedido ${p.pedidoId} de ${p.cliente}?`)) return;
  p.estado = "Cancelado";
  guardarPedidos();
  renderAll();
  showToast("Pedido cancelado", "error");
}

function eliminarPedido(id){
  if(!confirm("\u00bfEliminar este pedido definitivamente?")) return;
  pedidos = pedidos.filter(o => o.id !== id);
  guardarPedidos();
  renderAll();
  showToast("Pedido eliminado");
}

function filtrarPedidos(filtro){
  pedidoFiltro = filtro;
  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filtro);
  });
  renderPedidos();
}

function guardarPedidos(){
  localStorage.setItem("kef_pedidos", JSON.stringify(pedidos));
}

function renderPedidos(){
  const grid  = document.getElementById("orderGrid");
  const empty = document.getElementById("pedidosEmpty");
  const count = document.getElementById("pedidosCount");

  const lista = pedidoFiltro === "todos"
    ? pedidos
    : pedidos.filter(p => p.estado === pedidoFiltro);

  count.textContent = lista.length;
  grid.innerHTML = "";

  if(lista.length === 0){ empty.style.display = "block"; return; }
  empty.style.display = "none";

  lista.slice().reverse().forEach(p => {
    const card = document.createElement("div");
    card.className = "order-card";

    const statusClass = p.estado === "Pendiente" ? "pendiente" : p.estado === "Completado" ? "completado" : "cancelado";
    const entregaStr = p.entrega ? new Date(p.entrega + "T12:00").toLocaleDateString("es-BO",{day:"2-digit",month:"short",year:"numeric"}) : "Sin fecha";
    const creadoStr  = new Date(p.timestamp).toLocaleDateString("es-BO",{day:"2-digit",month:"short",year:"numeric"});

    const dotClass = p.estado === "Pendiente" ? "dot-orange" : p.estado === "Completado" ? "dot-green" : "dot-red";

    const accionesHTML = p.estado === "Pendiente"
      ? `<button class="order-btn complete" onclick="completarPedido(${p.id})">Completar</button>
         <button class="order-btn cancel" onclick="cancelarPedido(${p.id})">Cancelar</button>
         <button class="order-btn del" onclick="eliminarPedido(${p.id})">✕</button>`
      : `<button class="order-btn del" onclick="eliminarPedido(${p.id})">Eliminar</button>`;

    card.innerHTML = `
      <div class="order-header">
        <div>
          <div class="order-id">${p.pedidoId}</div>
          <div class="order-client">${p.cliente}</div>
        </div>
        <span class="order-status ${statusClass}">${p.estado}</span>
      </div>
      <div class="order-product">${p.producto}</div>
      <div class="order-details">
        <span class="order-detail-item">${p.tvLabel}</span>
        <span class="order-detail-item">${p.cant} ud${p.cant > 1 ? "s" : ""}</span>
        <span class="order-detail-item">Bs. ${p.unitPrice} c/u</span>
      </div>
      <div class="order-price-row">
        <span class="order-price-label">Total</span>
        <span class="order-price">${fmt(p.total)}</span>
      </div>
      ${p.notas ? `<div class="order-notes">${p.notas}</div>` : ""}
      <div class="order-date">Creado: ${creadoStr} &nbsp;&bull;&nbsp; Entrega: ${entregaStr}</div>
      <div class="order-actions">${accionesHTML}</div>`;

    grid.appendChild(card);
  });
}
