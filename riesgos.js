(function () {
  'use strict';
  var heat = document.getElementById('risk-heat');
  if (!heat) return;
  var tbody = document.querySelector('#risk-tabla tbody');
  var kpis = document.getElementById('risk-kpis');
  var status = document.getElementById('risk-status');
  var data, nivelActual = 'todos';
  var NIVELES = ['Alto', 'Medio', 'Bajo'];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nivelDe(s) { return s >= 13 ? 'Alto' : s >= 6 ? 'Medio' : 'Bajo'; }

  fetch('riesgos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { data = d; render(); bind(); })
    .catch(function () { document.getElementById('riesgos-resumen').textContent = 'No se pudo cargar la matriz de riesgos (riesgos.json).'; });

  function render() {
    var R = data.riesgos;
    document.getElementById('riesgos-resumen').textContent = R.length + ' riesgos identificados · Severidad = Probabilidad (1–5) × Impacto (1–5)';
    document.getElementById('risk-scale').textContent = 'Escala de nivel: Bajo ' + data.escala.Bajo + ' · Medio ' + data.escala.Medio + ' · Alto ' + data.escala.Alto + '.';

    // KPIs
    var t = el('div', 'risk-kpi risk-kpi--total'); t.appendChild(el('b', null, String(R.length))); t.appendChild(el('span', null, 'Riesgos totales')); kpis.appendChild(t);
    NIVELES.forEach(function (n) {
      var k = el('div', 'risk-kpi risk-kpi--' + n);
      k.appendChild(el('b', null, String(R.filter(function (r) { return r.nivel === n; }).length)));
      k.appendChild(el('span', null, 'Nivel ' + n));
      kpis.appendChild(k);
    });

    // Mapa de calor: filas Impacto 5→1, columnas Probabilidad 1→5
    for (var i = 5; i >= 1; i--) {
      heat.appendChild(el('div', 'risk-axis', 'I = ' + i));
      for (var p = 1; p <= 5; p++) {
        var cell = el('div', 'risk-cell risk-cell--' + nivelDe(p * i));
        cell.setAttribute('role', 'group'); cell.setAttribute('aria-label', 'Probabilidad ' + p + ', impacto ' + i);
        R.filter(function (r) { return r.probabilidad === p && r.impacto === i; }).forEach(function (r) {
          var c = el('button', 'risk-chip risk-chip--' + r.nivel, r.id.replace('RSG-', 'R')); c.type = 'button';
          c.dataset.id = r.id; c.title = r.id + ' · ' + r.riesgo;
          c.setAttribute('aria-label', r.id + ': ' + r.riesgo + '. Ver detalle');
          c.addEventListener('click', function () { openRow(r.id, true); });
          cell.appendChild(c);
        });
        heat.appendChild(cell);
      }
    }
    heat.appendChild(el('div', 'risk-axis'));
    for (var q = 1; q <= 5; q++) heat.appendChild(el('div', 'risk-axis risk-axis--x', 'P = ' + q));

    // Tabla
    fitDetail(); window.addEventListener('resize', fitDetail);
    R.forEach(function (r) {
      var tr = el('tr'); tr.dataset.id = r.id; tr.dataset.nivel = r.nivel;
      var td = el('td'); var b = el('button', 'risk-toggle', r.id); b.type = 'button'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'det-' + r.id);
      b.addEventListener('click', function () { toggle(r.id); }); td.appendChild(b); tr.appendChild(td);
      tr.appendChild(el('td', null, r.riesgo));
      tr.appendChild(el('td', null, r.categoria));
      tr.appendChild(el('td', null, String(r.probabilidad)));
      tr.appendChild(el('td', null, String(r.impacto)));
      tr.appendChild(el('td', null, String(r.severidad)));
      var tn = el('td'); tn.appendChild(el('span', 'risk-badge risk-badge--' + r.nivel, r.nivel)); tr.appendChild(tn);
      tr.appendChild(el('td', null, r.estrategia));
      tbody.appendChild(tr);

      var d = el('tr', 'risk-detail'); d.id = 'det-' + r.id; d.hidden = true; d.dataset.nivel = r.nivel; d.dataset.for = r.id;
      var dt = el('td'); dt.colSpan = 8;
      var g = el('div', 'risk-detail-grid');
      [['Causa raíz', r.causa], ['Plan preventivo / mitigante', r.preventivo], ['Plan de contingencia', r.contingencia]].forEach(function (x) {
        var box = el('div'); box.appendChild(el('h4', null, x[0])); box.appendChild(el('p', null, x[1])); g.appendChild(box);
      });
      dt.appendChild(g); d.appendChild(dt); tbody.appendChild(d);
    });
  }

  function fitDetail() {
    var w = document.querySelector('.risk-table-wrap');
    if (w) w.style.setProperty('--risk-w', (w.clientWidth - 40) + 'px');
  }

  function toggle(id, force) {
    var d = document.getElementById('det-' + id);
    var btn = tbody.querySelector('tr[data-id="' + id + '"] .risk-toggle');
    var open = force != null ? force : d.hidden;
    d.hidden = !open; btn.setAttribute('aria-expanded', open);
  }

  function openRow(id, scroll) {
    // si el filtro lo oculta, volver a "Todos"
    var row = tbody.querySelector('tr[data-id="' + id + '"]');
    if (row.classList.contains('is-hidden')) { document.querySelector('.risk-filter[data-nivel="todos"]').click(); }
    toggle(id, true);
    if (scroll) row.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    row.classList.add('is-flash'); setTimeout(function () { row.classList.remove('is-flash'); }, 1600);
    row.querySelector('.risk-toggle').focus({ preventScroll: true });
  }

  function bind() {
    var btns = document.querySelectorAll('.risk-filter');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
        nivelActual = b.dataset.nivel; apply();
      });
    });
  }

  function apply() {
    var all = nivelActual === 'todos', n = 0;
    tbody.querySelectorAll('tr').forEach(function (r) {
      var show = all || r.dataset.nivel === nivelActual;
      r.classList.toggle('is-hidden', !show);
      if (show && !r.classList.contains('risk-detail')) n++;
    });
    heat.querySelectorAll('.risk-chip').forEach(function (c) {
      var r = data.riesgos.filter(function (x) { return x.id === c.dataset.id; })[0];
      c.classList.toggle('is-dim', !all && r.nivel !== nivelActual);
    });
    status.textContent = all ? '' : 'Mostrando ' + n + ' riesgo(s) de nivel ' + nivelActual + '.';
  }
})();
