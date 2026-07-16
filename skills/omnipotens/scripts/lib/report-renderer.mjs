import { basename } from 'node:path';
import { escapeHtml, extractSummary, parseStatus, renderMarkdown } from './markdown.mjs';

const css = `
:root{color-scheme:light;--bg:#f3f0e8;--paper:#fffdf8;--ink:#22231f;--muted:#6f716a;--line:#ded9cd;--gold:#9a6b1f;--gold-soft:#f6ead2;--red:#a33a31;--green:#2f714f;--shadow:0 15px 45px rgba(56,45,27,.10)}[data-theme=dark]{color-scheme:dark;--bg:#151511;--paper:#1e1e19;--ink:#f2eee4;--muted:#aaa79e;--line:#3b3930;--gold:#e0ae59;--gold-soft:#342b1d;--red:#ff8f84;--green:#7dd3a5;--shadow:none}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;line-height:1.7}.shell{max-width:1440px;margin:auto;min-height:100vh;background:var(--paper);box-shadow:var(--shadow)}.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(12px)}.brand{font-family:Georgia,serif;font-weight:800;letter-spacing:.12em;color:var(--gold)}.grow{flex:1}button,.button{border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink);padding:6px 10px;text-decoration:none;cursor:pointer;font:inherit}.hero{padding:34px 38px 26px;background:linear-gradient(135deg,var(--gold-soft),transparent 58%);border-bottom:1px solid var(--line)}.hero h1{font:800 clamp(28px,4vw,48px)/1.15 Georgia,"Yu Mincho",serif;margin:0}.hero p{max-width:850px;color:var(--muted)}.meta,.badges{display:flex;gap:8px;flex-wrap:wrap}.badge{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px 9px;font-size:12px;background:var(--paper)}.layout{display:grid;grid-template-columns:250px minmax(0,1fr)}.nav{position:sticky;top:49px;align-self:start;height:calc(100vh - 49px);overflow:auto;padding:18px 14px;border-right:1px solid var(--line)}.nav a{display:block;color:var(--ink);text-decoration:none;padding:7px 9px;border-radius:6px;font-size:13px}.nav a:hover{background:var(--gold-soft)}.content{padding:26px 34px 60px;min-width:0}.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:25px}.card{border:1px solid var(--line);border-radius:10px;padding:13px;background:var(--paper)}.card .label{font-size:12px;color:var(--muted)}.card .value{font-size:27px;font-weight:800;color:var(--gold)}.stage{scroll-margin-top:65px;border-top:3px double var(--line);padding-top:22px;margin-top:34px}.stage-head{display:flex;align-items:flex-start;gap:12px}.stage-no{font:700 13px Georgia,serif;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:4px 8px}.stage h2{font:750 26px/1.3 Georgia,"Yu Mincho",serif;margin:0}.summary{border-left:3px solid var(--gold);padding:8px 13px;background:var(--gold-soft);margin:12px 0 20px}.document{margin:22px 0}.document-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:7px}.document-title h3{margin:0}.source{font-size:11px;color:var(--muted)}h1,h2,h3,h4{line-height:1.35}h1{font-size:28px}h2{font-size:23px}h3{font-size:19px}h4{font-size:16px}p{margin:8px 0}code{font-family:"Cascadia Code",Consolas,monospace;background:var(--gold-soft);padding:1px 4px;border-radius:3px}pre{background:#252720;color:#f4f1e8;border-radius:8px;padding:12px;overflow:auto;font-size:12px}pre code{background:none;padding:0}blockquote{border-left:3px solid var(--gold);margin:12px 0;padding:8px 13px;background:var(--gold-soft)}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}th{background:var(--gold-soft)}a{color:var(--gold)}.related{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px}.related a{display:block;border:1px solid var(--line);border-radius:8px;padding:11px;text-decoration:none}.related a:hover{background:var(--gold-soft)}.empty-search{display:none;color:var(--muted);padding:20px}.search{width:min(420px,48vw);border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink);padding:7px 10px}
@media(max-width:800px){.hero{padding:24px 17px}.layout{display:block}.nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);display:flex;overflow:auto;gap:4px;padding:8px}.nav a{white-space:nowrap}.content{padding:20px 15px 45px}.top{padding:8px 10px}.brand{font-size:13px}}
@media print{body{background:#fff}.shell{box-shadow:none;max-width:none}.top,.nav{display:none}.layout{display:block}.hero{padding:0 0 15px}.content{padding:0}.stage{break-before:page}.stage:first-of-type{break-before:auto}.document{break-inside:avoid-page}.related a{color:#000}}
`;

function chrome(title, hero, body, script = '') {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><div class="shell"><header class="top"><span class="brand">OMNIPOTENS</span><span class="grow"></span><button data-theme type="button">◐ テーマ</button><button data-print type="button">⎙ 印刷</button></header>${hero}${body}</div><script>const r=document.documentElement;const s=localStorage.getItem('omnipotens-theme');if(s)r.dataset.theme=s;document.querySelector('button[data-theme]').onclick=()=>{r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';localStorage.setItem('omnipotens-theme',r.dataset.theme)};document.querySelector('button[data-print]').onclick=()=>print();${script}</script></body></html>`;
}

function documentBlock(artifact) {
  if (artifact.kind === 'markdown') {
    return `<article class="document"><div class="document-title"><h3>${escapeHtml(artifact.title)}</h3><span class="source">${escapeHtml(artifact.relativePath)}</span>${artifact.status ? `<span class="badge">${escapeHtml(artifact.status)}</span>` : ''}</div>${renderMarkdown(artifact.content)}</article>`;
  }
  if (artifact.kind === 'json') {
    return `<article class="document"><div class="document-title"><h3>${escapeHtml(artifact.title)}</h3><span class="source">${escapeHtml(artifact.relativePath)}</span></div><pre><code>${escapeHtml(JSON.stringify(artifact.data, null, 2))}</code></pre></article>`;
  }
  return '';
}

function generatedAtBadge(generatedAt) {
  return generatedAt ? `<span class="badge">${escapeHtml(generatedAt)}</span>` : '';
}

export function enrichArtifact(artifact, content) {
  if (artifact.kind === 'markdown') {
    const h1 = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
    return { ...artifact, content, title: h1 || basename(artifact.path, '.md'), summary: extractSummary(content), status: parseStatus(content) };
  }
  if (artifact.kind === 'json') {
    return { ...artifact, content, data: JSON.parse(content), title: basename(artifact.path), summary: 'JSON manifest' };
  }
  return { ...artifact, content, title: basename(artifact.path), summary: 'Interactive HTML report' };
}

export function renderStageReport({ projectTitle, stage, generatedAt }) {
  const readable = stage.artifacts.filter((item) => item.kind !== 'html');
  const linked = stage.artifacts.filter((item) => item.kind === 'html');
  const summary = readable.map((item) => item.summary).find(Boolean) || `${stage.artifacts.length} artifacts`;
  const hero = `<section class="hero"><div class="badges"><span class="badge">Stage ${escapeHtml(stage.id)}</span>${generatedAtBadge(generatedAt)}</div><h1>${escapeHtml(stage.title)}</h1><p>${escapeHtml(projectTitle)} — ${escapeHtml(summary)}</p></section>`;
  const related = linked.length ? `<section><h2>関連HTML</h2><div class="related">${linked.map((item) => `<a href="${escapeHtml(item.outputHref)}">↗ ${escapeHtml(item.title)}<br><small>${escapeHtml(item.relativePath)}</small></a>`).join('')}</div></section>` : '';
  return chrome(`${projectTitle} — ${stage.title}`, hero, `<main class="content">${readable.map(documentBlock).join('')}${related}</main>`);
}

export function renderFinalReport({ projectTitle, stages, generatedAt, sourceCount }) {
  const nav = `<nav class="nav">${stages.map((stage) => `<a href="#stage-${escapeHtml(stage.id)}"><b>${escapeHtml(stage.id)}</b> ${escapeHtml(stage.title)}</a>`).join('')}</nav>`;
  const stageCards = stages.map((stage) => {
    const summary = stage.artifacts.map((item) => item.summary).find(Boolean) || `${stage.artifacts.length} artifacts`;
    const statuses = [...new Set(stage.artifacts.map((item) => item.status).filter(Boolean))];
    return `<section class="stage" id="stage-${escapeHtml(stage.id)}" data-stage><div class="stage-head"><span class="stage-no">${escapeHtml(stage.id)}</span><div><h2>${escapeHtml(stage.title)}</h2><div class="badges"><span class="badge">${stage.artifacts.length} artifacts</span>${statuses.map((status) => `<span class="badge">${escapeHtml(status)}</span>`).join('')}</div></div></div><p class="summary">${escapeHtml(summary)}</p>${stage.artifacts.filter((item) => item.kind !== 'html').map(documentBlock).join('')}${stage.artifacts.some((item) => item.kind === 'html') ? `<h3>関連HTML</h3><div class="related">${stage.artifacts.filter((item) => item.kind === 'html').map((item) => `<a href="${escapeHtml(item.outputHref)}">↗ ${escapeHtml(item.title)}<br><small>${escapeHtml(item.relativePath)}</small></a>`).join('')}</div>` : ''}</section>`;
  }).join('');
  const hero = `<section class="hero"><div class="badges"><span class="badge">Final report</span>${generatedAtBadge(generatedAt)}</div><h1>${escapeHtml(projectTitle)}</h1><p>仕様、遊び、ドメイン、コード、メカニクス、UX、市場性、議論を、存在する証拠だけから統合した最終レポート。</p></section>`;
  const overview = `<div class="overview"><div class="card"><div class="label">収録工程</div><div class="value">${stages.length}</div></div><div class="card"><div class="label">入力成果物</div><div class="value">${sourceCount}</div></div><div class="card"><div class="label">生成形式</div><div class="value">HTML</div></div></div><input class="search" type="search" placeholder="全工程を検索" aria-label="全工程を検索"><div class="empty-search">一致する工程がありません。</div>`;
  const body = `<div class="layout">${nav}<main class="content">${overview}${stageCards}</main></div>`;
  const script = `const q=document.querySelector('.search'),ss=[...document.querySelectorAll('[data-stage]')],empty=document.querySelector('.empty-search');q.oninput=()=>{const n=q.value.trim().toLocaleLowerCase();let shown=0;for(const s of ss){const hit=!n||s.textContent.toLocaleLowerCase().includes(n);s.hidden=!hit;if(hit)shown++}empty.style.display=shown?'none':'block'};`;
  return chrome(`${projectTitle} — Omnipotens Final Report`, hero, body, script);
}
