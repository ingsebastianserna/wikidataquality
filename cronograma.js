(function () {
  'use strict';
  var DAY = 86400000;
  var NAMES = { cogerentes: 'Co-Gerentes', auditoria: 'Auditoría Médica', analitica: 'Analítica' };
  var fmt = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var fmtShort = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var monthFmt = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

  var gantt = document.getElementById('gantt');
  if (!gantt) return;
  var tip = document.getElementById('gantt-tooltip');
  var status = document.getElementById('gantt-status');
  var summary = document.getElementById('crono-resumen');
  var tbody = document.querySelector('#crono-tabla tbody');
  var data, activeBtn = null;

  function utc(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  fetch('cronograma.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { data = d; render(); bindFilters(); })
    .catch(function () { summary.textContent = 'No se pudo cargar el cronograma (cronograma.json).'; });

  function render() {
    var t0 = utc(data.inicio_proyecto);
    var acts = data.items.filter(function (i) { return i.tipo === 'actividad'; });
    var lastEnd = Math.max.apply(null, acts.map(function (a) { return utc(a.fin); }));
    var weeks = Math.ceil(((lastEnd - t0) / DAY + 1) / 7);
    var total = weeks * 7;
    gantt.style.setProperty('--weeks', weeks);
    var pct = function (ms) { return ((ms - t0) / DAY) / total * 100; };

    //summary.textContent = data.cliente + ' · ' + fmt.format(new Date(t0)) + ' → ' + fmt.format(new Date(lastEnd)) + ' · ' + weeks + ' semanas · ' + acts.length + ' actividades y ' + (data.items.length - acts.length) + ' hitos';
    summary.textContent = data.cliente + ' · ' +  'Cronograma de Actividades'  + ' · ' + weeks + ' semanas · ' + acts.length + ' actividades y ' + (data.items.length - acts.length) + ' hitos';

    // Encabezado
    var head = el('div', 'gantt-head');
    for (var w = 0; w < weeks; w++) {
      var d = new Date(t0 + w * 7 * DAY);
      var c = el('div', 'gantt-wk');
      var prev = new Date(t0 + (w - 1) * 7 * DAY);
      var m = el('span', 'gantt-month', (w === 0 || prev.getUTCMonth() !== d.getUTCMonth()) ? monthFmt.format(d) : ' ');
      c.appendChild(m); c.appendChild(el('b', null, 'S' + (w + 1)));
      head.appendChild(c);
    }
    gantt.appendChild(head);

    // Filas
    data.items.forEach(function (it) {
      var isH = it.tipo === 'hito';
      var row = el('div', 'gantt-row' + (isH ? ' gantt-row--hito' : ''));
      row.dataset.resp = isH ? '' : it.responsable;
      row.dataset.id = it.id;
      if (isH) row.dataset.tras = it.tras.join(',');
      var track = el('div', 'gantt-track');
      (data.festivos || []).forEach(function (f) {
        var ms = utc(f); if (ms < t0 || ms >= t0 + total * DAY) return;
        var h = el('div', 'gantt-holiday'); h.style.left = pct(ms) + '%'; h.style.width = (100 / total) + '%'; track.appendChild(h);
      });
      var b;
      if (isH) {
        b = el('button', 'gantt-milestone'); b.type = 'button';
        b.style.left = pct(utc(it.fecha) + DAY / 2) + '%';
      } else {
        b = el('button', 'gantt-bar gantt-bar--' + it.responsable, it.id); b.type = 'button';
        var s = utc(it.inicio), e = utc(it.fin) + DAY;
        b.style.left = pct(s) + '%'; b.style.width = ((e - s) / DAY / total * 100) + '%';
      }
      b.setAttribute('aria-label', label(it));
      b.addEventListener('mouseenter', function (ev) { show(it, b); place(ev.clientX, ev.clientY); });
      b.addEventListener('mousemove', function (ev) { place(ev.clientX, ev.clientY); });
      b.addEventListener('mouseleave', function () { if (activeBtn !== b) hide(); });
      b.addEventListener('focus', function () { var r = b.getBoundingClientRect(); show(it, b); place(r.left + r.width / 2, r.bottom); });
      b.addEventListener('blur', hide);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (activeBtn === b) { hide(); } else { show(it, b, ev); place(ev.clientX, ev.clientY); activeBtn = b; b.classList.add('is-active'); } });
      track.appendChild(b);
      row.appendChild(track);
      gantt.appendChild(row);

      // Tabla
      var tr = el('tr', isH ? 'is-hito' : ''); tr.dataset.resp = isH ? '' : it.responsable; tr.dataset.id = it.id;
      if (isH) tr.dataset.tras = it.tras.join(',');
      tr.appendChild(el('td', null, it.id));
      tr.appendChild(el('td', null, isH ? '◆ ' + it.nombre : it.nombre));
      var tdR = el('td'); if (!isH) tdR.appendChild(el('span', 'resp-badge resp-badge--' + it.responsable, NAMES[it.responsable])); else tdR.textContent = '—';
      tr.appendChild(tdR);
      tr.appendChild(el('td', null, fmtShort.format(new Date(utc(isH ? it.fecha : it.inicio)))));
      tr.appendChild(el('td', null, fmtShort.format(new Date(utc(isH ? it.fecha : it.fin)))));
      tr.appendChild(el('td', null, isH ? '—' : String(it.dias_habiles)));
      tr.appendChild(el('td', null, isH ? 'S' + it.semana : (it.semana_inicio === it.semana_fin ? 'S' + it.semana_inicio : 'S' + it.semana_inicio + '–S' + it.semana_fin)));
      tr.appendChild(el('td', null, (isH ? it.tras : it.predecesoras).join(', ') || '—'));
      tbody.appendChild(tr);
    });
    fitTable(); window.addEventListener('resize', fitTable);
    document.addEventListener('click', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    gantt.parentNode.addEventListener('scroll', hide, { passive: true });
  }

  function label(it) {
    return it.tipo === 'hito'
      ? 'Hito ' + it.id + ': ' + it.nombre + ', ' + fmt.format(new Date(utc(it.fecha)))
      : it.id + ': ' + it.nombre + ', ' + NAMES[it.responsable] + ', del ' + fmt.format(new Date(utc(it.inicio))) + ' al ' + fmt.format(new Date(utc(it.fin)));
  }

  function show(it, btn) {
    tip.textContent = '';
    tip.appendChild(el('strong', null, it.id + ' · ' + it.nombre));
    var dl = el('dl');
    function add(k, v) { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, v)); }
    if (it.tipo === 'hito') {
      add('Fecha', fmt.format(new Date(utc(it.fecha)))); add('Semana', 'S' + it.semana); add('Tras', it.tras.join(', '));
    } else {
      add('Responsable', it.responsable_nombre);
      add('Inicio', fmt.format(new Date(utc(it.inicio)))); add('Fin', fmt.format(new Date(utc(it.fin))));
      add('Duración', it.dias_habiles + ' días hábiles'); add('Semanas', 'S' + it.semana_inicio + (it.semana_fin !== it.semana_inicio ? '–S' + it.semana_fin : ''));
      add('Predecesoras', it.predecesoras.join(', ') || '—');
      if (it.entregable) add('Entregable', it.entregable);
    }
    tip.appendChild(dl); tip.hidden = false;
  }

  function place(x, y) {
    var pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x + pad), window.innerWidth - w - 8);
    var top = y + pad + h > window.innerHeight - 8 ? y - h - pad : y + pad;
    tip.style.left = left + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }

  function hide() {
    tip.hidden = true;
    if (activeBtn) { activeBtn.classList.remove('is-active'); activeBtn = null; }
  }

  function bindFilters() {
    var btns = document.querySelectorAll('.gantt-filter');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
        apply(b.dataset.filter);
      });
    });
  }

  function apply(f) {
    var all = f === 'todos', shown = 0;
    var rows = gantt.querySelectorAll('.gantt-row');
    // Un hito se muestra si alguna de sus actividades precedentes pertenece al responsable
    var respOf = {};
    data.items.forEach(function (i) { if (i.tipo === 'actividad') respOf[i.id] = i.responsable; });
    function visible(el) {
      if (all) return true;
      if (el.dataset.resp) return el.dataset.resp === f;
      return el.dataset.tras.split(',').some(function (t) { return respOf[t] === f; });
    }
    rows.forEach(function (r) { var v = visible(r); r.classList.toggle('is-dim', !v); if (v && r.dataset.resp) shown++; });
    tbody.querySelectorAll('tr').forEach(function (r) { r.classList.toggle('is-hidden', !visible(r)); });
    status.textContent = all ? '' : 'Resaltando ' + shown + ' actividades de ' + NAMES[f] + '.';
    hide(); fitTable();
  }

  // Altura de la tabla = encabezado + las primeras 8 filas visibles; el resto, con scroll
  var VISIBLE_ROWS = 4;
  function fitTable() {
    var wrap = document.getElementById('crono-tabla-wrap'); if (!wrap) return;
    var rows = Array.prototype.filter.call(tbody.querySelectorAll('tr'), function (r) { return !r.classList.contains('is-hidden'); });
    wrap.style.maxHeight = 'none';
    var head = wrap.querySelector('thead').offsetHeight, h = head;
    rows.slice(0, VISIBLE_ROWS).forEach(function (r) { h += r.offsetHeight; });
    wrap.style.maxHeight = (h + 2) + 'px';
    wrap.scrollTop = 0;
  }
})();