// ==UserScript==
// @name         MagicalDraw Danmaku
// @namespace    https://github.com/
// @version      0.9.0
// @description  MagicalDrawのチャットを60px/sの弾幕で表示。ON/OFFと色変更に対応。
// @match        https://draw.kuku.lu/room/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__mddUserscript) return;
  window.__mddUserscript = true;
  const key = 'mdd_userscript_settings_v1';
  const defaults = { enabled: true, color: '#000000' };
  let cfg;
  try { cfg = {...defaults, ...JSON.parse(localStorage.getItem(key) || '{}')}; }
  catch { cfg = {...defaults}; }
  cfg.speed = 60; // 固定速度。過去の保存設定より優先する。
  const save = () => localStorage.setItem(key, JSON.stringify({ enabled: cfg.enabled, color: cfg.color }));
  const layer = document.createElement('div');
  Object.assign(layer.style, {position:'fixed', inset:'0', zIndex:'2147483646', pointerEvents:'none', overflow:'hidden'});
  document.documentElement.appendChild(layer);
  const lanes = [], queue = [];
  function show(value) {
    const txt = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!cfg.enabled || !txt) return;
    queue.push(txt);
    if (queue.length > 100) queue.shift();
    drain();
  }
  function drain() {
    if (!cfg.enabled) { queue.length = 0; return; }
    const speed = 60, now = performance.now();
    const max = Math.max(1, Math.floor((innerHeight - 125) / 30));
    while (queue.length) {
      let lane = -1;
      for (let i = 0; i < max; i++) {
        const prev = lanes[i];
        if (!prev) { lane = i; break; }
        const elapsed = (now - prev.time) / 1000;
        const previousTail = innerWidth + prev.width - prev.speed * elapsed;
        // Only reuse the lane if the previous comment has cleared the right edge.
        const separation = innerWidth - previousTail;
        const remaining = Math.max(0, (previousTail + 30) / prev.speed);
        // Do not allow a faster new comment to catch the previous one.
        if (separation >= 35 && (speed <= prev.speed || separation >= (speed - prev.speed) * remaining + 35)) { lane = i; break; }
      }
      if (lane < 0) break;
      const txt = queue.shift(), el = document.createElement('div');
      el.textContent = txt;
      Object.assign(el.style, {position:'absolute', left:'100%', top:(90 + lane * 30) + 'px', width:'max-content', whiteSpace:'nowrap', font:'bold 20px sans-serif', color:cfg.color, textShadow:'0 0 3px white,0 0 5px white'});
      layer.appendChild(el);
      const w = el.getBoundingClientRect().width;
      lanes[lane] = {time:now, width:w, speed};
      const duration = (innerWidth + w + 10) / speed * 1000;
      const anim = el.animate([{transform:'translateX(0)'}, {transform:`translateX(-${innerWidth+w+10}px)`}], {duration, easing:'linear'});
      anim.onfinish = () => el.remove();
    }
  }
  setInterval(drain, 150);
  function findChatPanel() {
    const candidates = [...document.querySelectorAll('div,section,aside')].filter(el => {
      if (el === layer || layer.contains(el) || controls.contains(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 170 || r.width > 600 || r.height < 180) return false;
      const t = (el.innerText || '').trim();
      return t.startsWith('チャット') || (t.includes('チャット') && t.includes('Enterでチャット'));
    });
    candidates.sort((a,b) => {const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height;});
    return candidates[0] || null;
  }
  let panel = null, observer = null, ready = false, seen = new WeakMap(), scanTimer;
  function valid(node) {
    if (node.children.length > 5 || node.querySelector('textarea,input,button')) return '';
    const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || text.length > 220 || /^(チャット|Enterでチャット|参加者|操作|発言|送信)$/.test(text)) return '';
    const r = node.getBoundingClientRect();
    if (r.width < 30 || r.height < 12) return '';
    return text;
  }
  function scan() {
    if (!panel || !panel.isConnected) return;
    for (const node of panel.querySelectorAll('div,p,li,span')) {
      const t = valid(node);
      if (!t || [...node.querySelectorAll('div,p,li,span')].some(child => valid(child) === t)) continue;
      if (seen.get(node) === t) continue;
      seen.set(node, t);
      if (ready) show(t);
    }
    ready = true;
  }
  function attach(el) {
    if (!el || el === panel) return;
    observer?.disconnect(); panel = el; ready = false; seen = new WeakMap(); scan();
    observer = new MutationObserver(() => {clearTimeout(scanTimer);scanTimer=setTimeout(scan,120);});
    observer.observe(panel, {subtree:true, childList:true, characterData:true});
  }
  function autoAttach() {
    if (panel?.isConnected) return;
      const found = findChatPanel(); if (found) attach(found);
  }
  const controls=document.createElement('div');
  Object.assign(controls.style,{position:'fixed',top:'65px',right:'12px',zIndex:'2147483647',display:'flex',alignItems:'center',gap:'5px',padding:'5px',background:'#1c1c23ee',color:'white',borderRadius:'8px',font:'12px sans-serif'});
  const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.type='button';Object.assign(b.style,{padding:'6px',background:'#34343d',color:'white',border:'1px solid #666',borderRadius:'5px',cursor:'pointer'});b.onclick=fn;controls.appendChild(b);return b;};
  const toggle=button('弾幕 OFF',()=>{cfg.enabled=!cfg.enabled;layer.style.display=cfg.enabled?'block':'none';save();updateStatus();});
  const color=document.createElement('input');color.type='color';color.title='文字色';color.value=cfg.color;color.style.width='30px';color.oninput=()=>{cfg.color=color.value;save();};controls.appendChild(color);
  function updateStatus(){toggle.textContent=cfg.enabled?'弾幕 OFF':'弾幕 ON';}
  document.documentElement.appendChild(controls);
  layer.style.display=cfg.enabled?'block':'none';updateStatus();
  autoAttach();setInterval(autoAttach,1200);
})();
