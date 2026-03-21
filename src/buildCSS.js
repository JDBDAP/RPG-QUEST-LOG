import { GFONTS, GFONTS_RPG, THEME_PRESETS } from "./constants";

export function buildCSS(C, T, FS=14, MODE="rpg"){
  const t={...THEME_PRESETS[0],...T};
  const hb=t.bg.length===7?t.bg+"f5":t.bg;
  const f=FS||14; const f2=Math.round(f*0.857); const f3=Math.round(f*0.785);
  const fonts=MODE==="rpg"?GFONTS_RPG:GFONTS;

  const rpgExtras=MODE==="rpg"?`
/* ── RPG MODE ── */
@keyframes grain{0%,100%{transform:translate(0,0)}10%{transform:translate(-2%,-3%)}30%{transform:translate(3%,-1%)}50%{transform:translate(-1%,2%)}70%{transform:translate(2%,3%)}90%{transform:translate(-3%,1%)}}
body::after{content:'';position:fixed;inset:-200%;width:400%;height:400%;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");animation:grain 8s steps(1) infinite;pointer-events:none;z-index:999;opacity:.4;}
.hdr-title{font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--tx2);}
.side-title{font-family:'Cinzel',serif;font-size:9px;letter-spacing:2px;color:var(--tx2);}
.lv-badge{font-family:'Cinzel',serif !important;letter-spacing:2px;box-shadow:0 0 14px var(--primaryb),0 0 4px var(--primaryb);}
.side-lv{font-family:'Cinzel',serif !important;letter-spacing:2px;box-shadow:0 0 10px var(--primaryb);}
.xp-fill{box-shadow:0 0 6px var(--primaryb);}
.sk-bar{box-shadow:0 0 4px currentColor;}
.nbtn.on::before{box-shadow:0 0 10px var(--primary),0 0 4px var(--primary);}
.slink.on{box-shadow:inset 2px 0 8px var(--primaryb);}
.card.quest-main{box-shadow:inset 2px 0 12px var(--primaryb);}
.card.quest-radiant{box-shadow:inset 2px 0 12px var(--secondaryb);}
.slbl{font-family:'DM Mono',monospace;letter-spacing:2.5px;}
.sk-streak{box-shadow:0 0 8px var(--primaryb);}
.toast{box-shadow:0 0 16px var(--primaryb),0 4px 20px #0008;}
.ui-mode-btn{background:var(--bg);border:1px solid var(--b2);border-radius:4px;color:var(--tx3);font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 12px;cursor:pointer;flex:1;transition:all .15s;}
.ui-mode-btn:hover{border-color:var(--b3);color:var(--tx2);}
.ui-mode-btn.on{background:var(--primaryf);border-color:var(--primaryb);color:var(--primary);box-shadow:0 0 8px var(--primaryb);}
`:MODE==="minimal"?`
/* ── MINIMAL MODE ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
body{font-family:'Inter',sans-serif !important;}
button,input,textarea,select{font-family:'Inter',sans-serif !important;}
.hdr-title{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.3px;color:var(--tx3);}
.side-title{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.3px;color:var(--tx3);}
.lv-badge{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.3px;box-shadow:none;border-radius:4px;background:var(--s2);border-color:var(--b2);}
.side-lv{font-family:'JetBrains Mono',monospace;letter-spacing:.3px;box-shadow:none;border-radius:4px;}
.xp-fill{background:var(--primary);box-shadow:none;}
.sk-bar{box-shadow:none;}
.nbtn.on::before{box-shadow:none;height:1px;}
.slink.on{box-shadow:none;border-left:2px solid var(--primary);}
.card{border-radius:4px;border-color:var(--b1);}
.card.quest-main{box-shadow:none;border-left:3px solid var(--primary);background:var(--bg);}
.card.quest-radiant{box-shadow:none;border-left:3px solid var(--secondary);background:var(--bg);}
.card.quest-side{box-shadow:none;border-left:3px solid var(--b3);background:var(--bg);}
.sk-streak{box-shadow:none;border-radius:3px;}
.toast{box-shadow:0 2px 8px #0006;border-radius:4px;}
:root{--r:4px;}
.slbl{font-family:'JetBrains Mono',monospace;letter-spacing:.5px;opacity:.6;font-size:8px;}
.slbl::after{display:none;}
.ctag{font-family:'JetBrains Mono',monospace;letter-spacing:.3px;border-radius:3px;}
.nlbl{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:.3px;}
.ui-mode-btn{background:var(--bg);border:1px solid var(--b2);border-radius:4px;color:var(--tx3);font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.5px;text-transform:uppercase;padding:8px 12px;cursor:pointer;flex:1;transition:all .15s;}
.ui-mode-btn:hover{border-color:var(--b3);color:var(--tx2);}
.ui-mode-btn.on{background:var(--s2);border-color:var(--b3);color:var(--tx);}
.stab{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.3px;}
.fwrap{border-radius:4px;}
.fsbtn{border-radius:4px;font-size:11px;}
.addbtn{border-radius:4px;font-size:11px;}
.lv-milestone{display:none;}
`:`
/* ── AI / CUSTOM MODE ── */
.ui-mode-btn{background:var(--bg);border:1px solid var(--b2);border-radius:4px;color:var(--tx3);font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 12px;cursor:pointer;flex:1;transition:all .15s;}
.ui-mode-btn:hover{border-color:var(--b3);color:var(--tx2);}
.ui-mode-btn.on{background:var(--primaryf);border-color:var(--primaryb);color:var(--primary);}
`;

  return `${fonts}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:${t.bg};--s1:${t.s1};--s2:${t.s2};--b1:${t.b1};--b2:${t.b2};--b3:${t.tx3};--tx:${t.tx};--tx2:${t.tx2};--tx3:${t.tx3};--primary:${C.primary};--primaryf:${C.primary}22;--primaryb:${C.primary}40;--secondary:${C.secondary};--secondaryf:${C.secondary}18;--secondaryb:${C.secondary}38;--success:${C.success};--successf:${C.success}18;--danger:${C.danger};--dangerf:${C.danger}20;--r:5px;}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;font-weight:300;-webkit-font-smoothing:antialiased;font-size:${f}px;}
button,input,textarea,select{font-family:'DM Sans',sans-serif;}
.app{max-width:460px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;}
@media(min-width:768px){.app{max-width:100%;margin:0;flex-direction:row;}}
.hdr{padding:12px 18px 0;border-bottom:1px solid var(--b1);background:${hb};position:sticky;top:0;z-index:40;backdrop-filter:blur(14px);}
.hdr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;gap:10px;}
.hdr-title{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.8px;color:var(--tx2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lv-badge{font-family:'DM Mono',monospace;font-size:10px;color:var(--primary);background:var(--primaryf);border:1px solid var(--primaryb);border-radius:20px;padding:2px 10px;letter-spacing:1px;white-space:nowrap;flex-shrink:0;box-shadow:0 0 8px var(--primaryb);}
.xp-row{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.xp-track{flex:1;height:3px;background:var(--b1);border-radius:2px;overflow:hidden;}
.xp-fill{height:100%;background:linear-gradient(90deg,var(--secondary),var(--primary));border-radius:2px;transition:width .5s ease;}
.xp-lbl{font-family:'DM Mono',monospace;font-size:10px;color:var(--tx3);white-space:nowrap;}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;display:flex;background:${hb};border-top:1px solid var(--b1);backdrop-filter:blur(14px);z-index:40;padding-bottom:env(safe-area-inset-bottom);}
.nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 2px 12px;background:none;border:none;cursor:pointer;color:var(--tx3);transition:color .2s,transform .15s;position:relative;overflow:hidden;}
.nbtn.on{color:var(--tx);}.nbtn:hover:not(.on){color:var(--tx2);}
.nbtn.on::before{content:'';position:absolute;top:0;left:25%;right:25%;height:2px;background:var(--primary);border-radius:0 0 3px 3px;box-shadow:0 0 8px var(--primary);}
.nicon{font-size:17px;line-height:1;transition:transform .2s,color .2s;}.nbtn.on .nicon{color:var(--primary);transform:scale(1.1);}
.nlbl{font-family:'DM Mono',monospace;font-size:7.5px;letter-spacing:.8px;text-transform:uppercase;transition:color .2s;}
.pg{padding:18px 18px 88px;flex:1;}
.stabs{display:flex;gap:3px;margin-bottom:18px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:3px;}
.stab{flex:1;padding:6px 4px;border:none;border-radius:4px;background:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--tx3);transition:all .15s;}
.stab.on{background:var(--s2);color:var(--tx);}
.slbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.slbl::after{content:'';flex:1;height:1px;background:var(--b1);}
.gap{height:18px;}
.clist{display:flex;flex-direction:column;gap:2px;margin-bottom:4px;}
.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:10px 12px;display:flex;align-items:flex-start;gap:10px;transition:border-color .15s,opacity .3s;}
.card:hover{border-color:var(--b2);}.card.done{opacity:.35;}
.card.quest-main{border-left:2px solid var(--primary);}.card.quest-radiant{border-left:2px solid var(--secondary);}
.chk{width:16px;height:16px;border-radius:3px;border:1px solid var(--b2);flex-shrink:0;cursor:pointer;background:none;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--success);transition:all .15s;margin-top:1px;}
.chk.on{background:var(--successf);border-color:var(--success);}
.cbody{flex:1;min-width:0;}
.ctitle{font-size:${f}px;font-weight:400;line-height:1.4;word-break:break-word;}.ctitle.done{text-decoration:line-through;}
.cmeta{display:flex;align-items:center;gap:5px;margin-top:5px;flex-wrap:wrap;}
.ctag{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:.8px;padding:2px 7px;border-radius:20px;border:1px solid var(--b1);color:var(--tx3);}
.cnote{font-size:${f2}px;color:var(--tx2);margin-top:3px;font-style:italic;line-height:1.4;}
.delbtn{background:none;border:none;cursor:pointer;color:var(--tx3);font-size:11px;padding:2px 4px;transition:color .15s;flex-shrink:0;margin-top:1px;border-radius:3px;}
.delbtn:hover{color:var(--danger);}
.fwrap{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:12px;}
.fi{width:100%;background:var(--s2);border:1px solid var(--b2);color:var(--tx);border-radius:var(--r);padding:8px 10px;font-size:${f}px;outline:none;transition:border-color .15s;}
.fi:focus{border-color:var(--primaryb);}
.fi.full{flex:1;}
.fsel{background:var(--s2);border:1px solid var(--b2);color:var(--tx);border-radius:var(--r);padding:7px 8px;font-size:${f2}px;outline:none;flex:1;cursor:pointer;}
.fsbtn{display:block;width:100%;padding:9px;background:var(--s2);border:1px solid var(--b2);color:var(--tx);border-radius:var(--r);cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;margin-top:6px;transition:all .15s;}
.fsbtn:hover{background:var(--primaryf);border-color:var(--primaryb);color:var(--primary);}
.fsbtn.primary{background:var(--primaryf);border-color:var(--primaryb);color:var(--primary);}
.fsbtn.secondary{background:var(--secondaryf);border-color:var(--secondaryb);color:var(--secondary);}
.frow{display:flex;gap:8px;margin-bottom:8px;align-items:center;}
.addbtn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:10px;background:none;border:1px dashed var(--b2);color:var(--tx3);border-radius:var(--r);cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;transition:all .15s;margin-bottom:10px;}
.addbtn:hover{border-color:var(--primaryb);color:var(--primary);}
.addbtn span{font-size:14px;line-height:1;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px;}
.sbox{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:10px 8px;text-align:center;}
.snum{font-family:'DM Mono',monospace;font-size:18px;color:var(--tx);margin-bottom:2px;}
.slb2{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--tx3);}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:999;padding:24px;}
.milestone-modal{background:var(--s1);border:1px solid var(--b2);border-radius:8px;padding:20px 22px;max-width:320px;width:100%;}
.milestone-modal.big{max-width:360px;text-align:center;padding:32px 28px;border-color:var(--primaryb);box-shadow:0 0 40px var(--primaryb),0 8px 32px rgba(0,0,0,.6);}
.ms-row{display:flex;align-items:center;gap:14px;margin-bottom:8px;}
.ms-glyph{font-size:28px;line-height:1;}.ms-glyph.big{font-size:56px;display:block;margin-bottom:12px;}
.ms-level{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:4px;}
.ms-skill{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--tx2);}
.ms-title{font-size:16px;color:var(--tx);font-weight:500;margin-bottom:2px;}.ms-title.big{font-size:24px;margin-bottom:8px;}
.ms-sub{font-size:12px;color:var(--tx3);line-height:1.5;}.ms-sub.big{font-size:13px;color:var(--tx2);max-width:260px;margin:0 auto 16px;}
.ms-bar{height:2px;background:var(--b1);border-radius:1px;overflow:hidden;margin-top:12px;}
.ms-bar-fill{height:100%;border-radius:1px;animation:msbar 1.5s ease forwards;}
@keyframes msbar{from{width:0}to{width:100%}}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--s1);border:1px solid var(--b2);border-radius:20px;padding:8px 16px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.8px;color:var(--tx);white-space:nowrap;z-index:9000;pointer-events:none;transition:opacity .3s,transform .3s;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
.toast.off{opacity:0;transform:translateX(-50%) translateY(8px);}
.confirm-modal{background:var(--s1);border:1px solid var(--b2);border-radius:8px;padding:20px;max-width:280px;width:90%;}
.confirm-msg{font-size:14px;color:var(--tx);margin-bottom:6px;}
.confirm-sub{font-size:12px;color:var(--tx3);margin-bottom:16px;line-height:1.4;}
.xp-float{position:fixed;top:44px;left:50%;transform:translateX(calc(-50% + var(--fx)));font-family:'DM Mono',monospace;font-size:14px;color:var(--primary);font-weight:bold;pointer-events:none;z-index:9999;animation:floatUp .9s ease forwards;}
@keyframes floatUp{0%{opacity:1;transform:translateX(calc(-50% + var(--fx))) translateY(0);}100%{opacity:0;transform:translateX(calc(-50% + var(--fx))) translateY(-32px);}}
/* ── SKILL CARDS ── */
.sk-card,.skill-card{background:var(--s1);border:1px solid var(--b1);border-left:3px solid var(--b2);border-radius:var(--r);overflow:hidden;transition:border-color .15s,border-left-color .15s;margin-bottom:6px;}
.sk-card:hover,.skill-card:hover{border-color:var(--b2);}
.sk-hdr{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;}
.sk-icon{font-size:18px;line-height:1;flex-shrink:0;}
.sk-info{flex:1;min-width:0;}
.sk-name{display:flex;align-items:center;gap:6px;font-size:${f}px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.sk-meta{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.sk-lv{font-family:'DM Mono',monospace;font-size:9px;color:var(--primary);background:var(--primaryf);border:1px solid var(--primaryb);border-radius:10px;padding:1px 7px;white-space:nowrap;}
.sk-bar-wrap{height:3px;background:var(--b1);border-radius:2px;overflow:hidden;margin:3px 12px 0;}
.sk-bar{height:100%;border-radius:2px;transition:width .6s ease;}
.sk-xprow{display:flex;justify-content:space-between;padding:3px 12px 8px;}
.sk-xplbl{font-family:'DM Mono',monospace;font-size:8px;color:var(--tx3);letter-spacing:.3px;}
.sk-streak{font-family:'DM Mono',monospace;font-size:8px;padding:2px 7px;border-radius:10px;border:1px solid;white-space:nowrap;flex-shrink:0;}
.stale-label{font-family:'DM Mono',monospace;font-size:8px;color:var(--danger);opacity:.7;white-space:nowrap;}
.sk-body{padding:0 12px 10px;}
.sk-detail{font-size:${f2}px;color:var(--tx2);line-height:1.5;}
.sk-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
.sk-delbtn{background:none;border:none;cursor:pointer;color:var(--tx3);font-size:10px;padding:2px 4px;transition:color .15s;flex-shrink:0;}
.sk-delbtn:hover{color:var(--danger);}
/* ── PRACTICE/LOG FORM ── */
.type-grid{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
.topt{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);cursor:pointer;font-size:12px;color:var(--tx2);transition:all .15s;text-align:left;}
.topt:hover{border-color:var(--b2);}
.topt.on{background:var(--secondaryf);border-color:var(--secondaryb);color:var(--tx);}
.dur-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:4px 0;}
.dur-val{font-family:'DM Mono',monospace;font-size:10px;color:var(--tx3);}
.ai-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--secondary);margin-bottom:6px;}
.exp-tog{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--tx3);cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;padding:4px 0;margin-bottom:4px;}
.exp-arr{display:inline-block;transition:transform .2s;font-size:8px;}
.exp-arr.open{transform:rotate(180deg);}
/* ── MED/SESSION CARDS ── */
.med-card{background:var(--s1);border:1px solid var(--b1);border-left:3px solid var(--secondaryb);border-radius:var(--r);padding:10px 12px;display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;transition:border-color .15s;}
.med-card:hover{border-color:var(--b2);}
.med-icon{font-size:18px;line-height:1;flex-shrink:0;margin-top:1px;}
.med-body{flex:1;min-width:0;}
.med-name{font-size:13px;color:var(--tx);font-weight:400;margin-bottom:3px;}
.med-sub{font-family:'DM Mono',monospace;font-size:9px;color:var(--tx3);letter-spacing:.3px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:3px;}
.med-reason{font-family:'DM Mono',monospace;font-size:9px;color:var(--secondary);margin-top:3px;font-style:italic;}
.med-journal{font-size:12px;color:var(--tx2);line-height:1.6;margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.med-journal.exp{-webkit-line-clamp:unset;display:block;}
.jrnl-btn{background:none;border:none;color:var(--tx3);font-family:'DM Mono',monospace;font-size:8px;cursor:pointer;padding:2px 0;letter-spacing:.5px;}
/* ── EMPTY STATES ── */
.empty-state{text-align:center;padding:40px 16px;color:var(--tx3);}
.es-icon{font-size:32px;margin-bottom:10px;opacity:.4;}
.es-title{font-size:14px;color:var(--tx2);margin-bottom:6px;font-weight:400;}
.es-desc{font-size:12px;color:var(--tx3);line-height:1.6;max-width:280px;margin:0 auto;}
/* ── PRACTICE NUDGE ── */
.practice-nudge{display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--secondaryf);border:1px solid var(--secondaryb);border-radius:var(--r);margin-top:4px;margin-bottom:2px;}
.nudge-text{flex:1;font-family:'DM Mono',monospace;font-size:9px;color:var(--secondary);letter-spacing:.5px;}
.nudge-btn{background:none;border:1px solid var(--secondaryb);border-radius:3px;cursor:pointer;font-family:'DM Mono',monospace;font-size:8px;padding:2px 8px;transition:all .15s;}
.nudge-btn.nudge-yes{color:var(--secondary);}.nudge-btn.nudge-yes:hover{background:var(--secondary);color:var(--bg);}
.nudge-btn.nudge-no{color:var(--tx3);}
/* ── AI / ADVISOR ── */
.ai-intro{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;margin-bottom:10px;}
.ai-intro-title{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);margin-bottom:5px;}
.ai-intro-body{font-size:12px;color:var(--tx3);line-height:1.5;}
.ai-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;}
.ai-chip{background:var(--s1);border:1px solid var(--b1);border-radius:20px;padding:5px 12px;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.5px;color:var(--tx2);transition:all .15s;}
.ai-chip:hover{border-color:var(--primaryb);color:var(--primary);}
.ai-msgs{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.ai-msg{max-width:90%;padding:10px 12px;border-radius:6px;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;}
.ai-msg.user{align-self:flex-end;background:var(--s2);border:1px solid var(--b2);color:var(--tx);}
.ai-msg.assistant{align-self:flex-start;background:var(--bg);border:1px solid var(--b1);color:var(--tx2);}
.ai-msg.loading{align-self:flex-start;}
.ai-actions{display:flex;flex-direction:column;gap:4px;margin-top:6px;}
.ai-input-row{display:flex;gap:8px;padding-top:8px;border-top:1px solid var(--b1);}
.ai-input{flex:1;background:var(--s1);border:1px solid var(--b2);color:var(--tx);border-radius:var(--r);padding:9px 12px;font-size:${f}px;outline:none;resize:none;max-height:120px;overflow-y:auto;line-height:1.5;}
.ai-input:focus{border-color:var(--primaryb);}
.ai-send{background:var(--primaryf);border:1px solid var(--primaryb);border-radius:var(--r);padding:9px 16px;color:var(--primary);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;cursor:pointer;transition:all .15s;white-space:nowrap;}
.ai-send:hover{background:var(--primary);color:var(--bg);}
.ai-send:disabled{opacity:.4;cursor:default;}
.act-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:8px 10px;font-size:11px;}
.act-tool{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:var(--tx3);margin-bottom:3px;}
.act-sum{color:var(--tx);margin-bottom:2px;font-weight:500;}
.act-detail{color:var(--tx3);font-size:10px;margin-bottom:6px;}
.act-btns{display:flex;gap:6px;}
.act-done{font-family:'DM Mono',monospace;font-size:10px;padding:4px 0;}
.abtn{padding:4px 12px;border-radius:3px;border:1px solid;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.8px;text-transform:uppercase;transition:all .15s;}
.abtn.ok{background:var(--successf);border-color:var(--success);color:var(--success);}
.abtn.ok:hover{background:var(--success);color:var(--bg);}
.abtn.no{background:none;border-color:var(--b2);color:var(--tx3);}
/* ── SETTINGS ── */
.sgroup{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);overflow:hidden;margin-bottom:10px;}
.sgroup-title{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);padding:10px 14px 6px;border-bottom:1px solid var(--b1);}
.srow{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--b1);}
.srow:last-child{border-bottom:none;}
.srow-label{font-size:${f}px;color:var(--tx);}
.srow-sub{font-size:${f2}px;color:var(--tx3);margin-top:2px;}
.sinput{background:var(--s2);border:1px solid var(--b2);color:var(--tx);border-radius:3px;padding:5px 8px;font-size:${f2}px;width:120px;outline:none;}
.sinput.sm{width:70px;text-align:center;}
.sinput:focus{border-color:var(--primaryb);}
.tog-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--b1);}
.tog-row:last-child{border-bottom:none;}
.tog{width:36px;height:20px;border-radius:10px;border:1px solid var(--b2);background:var(--b1);cursor:pointer;position:relative;flex-shrink:0;transition:all .2s;}
.tog.on{background:var(--primaryb);border-color:var(--primaryb);}
.tog-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;background:var(--tx3);border-radius:50%;transition:transform .2s;}
.tog.on .tog-knob{transform:translateX(16px);background:var(--primary);}
.cpick{width:36px;height:28px;padding:2px;border:1px solid var(--b2);border-radius:4px;background:none;cursor:pointer;}
.exp-btn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);color:var(--tx2);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;width:100%;transition:all .15s;margin-bottom:6px;}
.exp-btn:hover{border-color:var(--primaryb);color:var(--primary);}
.coll-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 14px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);cursor:pointer;font-size:${f2}px;color:var(--tx2);text-align:left;transition:all .15s;}
.coll-btn:hover{border-color:var(--b2);}
.coll-arr{font-size:9px;color:var(--tx3);}
.theme-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;}
.theme-opt{background:var(--bg);border:1px solid var(--b1);border-radius:4px;overflow:hidden;cursor:pointer;transition:border-color .15s;}
.theme-opt.on{border-color:var(--primary);}
.theme-swatch{height:20px;display:flex;}
.theme-name{font-family:'DM Mono',monospace;font-size:7px;letter-spacing:.5px;text-align:center;padding:3px 0;color:var(--tx3);}
.palette-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;}
.pal-opt{background:var(--bg);border:1px solid var(--b1);border-radius:4px;padding:6px;cursor:pointer;text-align:center;transition:border-color .15s;}
.pal-opt.on{border-color:var(--primary);}
.pal-dots{display:flex;gap:3px;justify-content:center;margin-bottom:4px;}
.pal-dot{width:10px;height:10px;border-radius:50%;}
.pal-name{font-family:'DM Mono',monospace;font-size:7px;color:var(--tx3);}
/* ── SKILLS GRID ── */
.icon-grid{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;}
.icon-opt{width:28px;height:28px;border:1px solid var(--b1);border-radius:3px;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.icon-opt.on{background:var(--primaryf);border-color:var(--primaryb);}
.icon-opt:hover{border-color:var(--b2);}
.color-grid{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;}
.color-opt{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border-color .15s;}
.color-opt.on{border-color:var(--tx);}
/* ── TIMER OVERLAY ── */
.timer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;}
.timer-skill{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:16px;}
.timer-face{font-family:'DM Mono',monospace;font-size:72px;color:var(--primary);line-height:1;letter-spacing:-2px;margin-bottom:8px;}
.timer-btn{display:block;width:160px;padding:12px;background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);color:var(--tx);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;text-align:center;margin-bottom:8px;transition:all .15s;}
.timer-stop{background:var(--primaryf);border-color:var(--primaryb);color:var(--primary);}
.timer-cancel{color:var(--tx3);}
/* ── QUICK ADD TOGGLE ── */
.qa-toggle{display:flex;gap:3px;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:3px;margin-bottom:10px;}
.qa-opt{flex:1;padding:5px 4px;border:none;border-radius:3px;background:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--tx3);transition:all .15s;}
.qa-opt.on{background:var(--primaryf);color:var(--primary);}
/* ── PLANNER ── */
.nl-row{display:flex;gap:8px;margin-bottom:10px;}
.nl-input{flex:1;background:var(--s1);border:1px solid var(--b1);color:var(--tx);border-radius:var(--r);padding:9px 12px;font-size:${f}px;outline:none;transition:border-color .15s;}
.nl-input:focus{border-color:var(--primaryb);}
.nl-input::placeholder{color:var(--tx3);}
.nl-btn{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);color:var(--tx2);padding:9px 14px;cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;transition:all .15s;}
.nl-btn:hover{border-color:var(--primaryb);color:var(--primary);}
.nl-btn:disabled{opacity:.4;cursor:default;}
.date-hdr{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--tx3);margin-bottom:14px;padding:6px 0;border-bottom:1px solid var(--b1);}
.block-wrap{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);overflow:hidden;margin-bottom:8px;}
.block-hdr{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;transition:background .15s;}
.block-hdr:hover{background:var(--s2);}
.block-hdr-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx2);}
.block-hdr-lbl.overdue{color:var(--danger);}
.block-count{font-family:'DM Mono',monospace;font-size:9px;color:var(--tx3);background:var(--s2);padding:1px 7px;border-radius:10px;}
.block-body{padding:4px 8px 8px;}
/* Weekly view */
.wk-day{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:8px 10px;margin-bottom:6px;}
.wk-day-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--tx3);margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--b1);}
.wk-day-lbl.today{color:var(--primary);}
/* ── NOTIFICATIONS ── */
.notif-btn{background:none;border:1px solid var(--b2);border-radius:3px;color:var(--tx3);font-family:'DM Mono',monospace;font-size:9px;padding:4px 10px;cursor:pointer;transition:all .15s;margin-top:4px;}
.notif-btn:hover{border-color:var(--primaryb);color:var(--primary);}
.notif-ok{font-family:'DM Mono',monospace;font-size:9px;color:var(--success);margin-top:4px;}
/* ── PROFILE ── */
.profile-avatar{width:48px;height:48px;border-radius:50%;background:var(--primaryf);border:1px solid var(--primaryb);display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:20px;color:var(--primary);flex-shrink:0;}
.profile-name{font-size:16px;color:var(--tx);font-weight:500;margin-bottom:3px;}
.profile-xp-bar{height:3px;background:var(--b1);border-radius:2px;overflow:hidden;margin:4px 0 2px;}
.profile-xp-fill{height:100%;background:linear-gradient(90deg,var(--secondary),var(--primary));border-radius:2px;transition:width .5s ease;}
.badge-row{display:flex;flex-wrap:wrap;gap:5px;}
.badge{background:var(--s2);border:1px solid var(--b1);border-radius:20px;padding:3px 10px;font-family:'DM Mono',monospace;font-size:9px;color:var(--tx2);}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px;}
.sbox{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:10px 8px;text-align:center;}
.snum{font-family:'DM Mono',monospace;font-size:18px;color:var(--tx);margin-bottom:2px;}
.slb2{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--tx3);}
/* ── COMMUNITY ── */
.community-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px;margin-bottom:8px;transition:border-color .15s;}
.community-card:hover{border-color:var(--b2);}
/* ── SIDEBAR SKILLS ── */
.slink{display:flex;align-items:center;gap:8px;padding:8px 10px;border:none;background:none;cursor:pointer;width:100%;text-align:left;border-radius:0;border-left:2px solid transparent;transition:all .15s;color:var(--tx3);}
.slink:hover{background:var(--s1);color:var(--tx2);}
.slink.on{background:var(--s1);color:var(--tx);border-left-color:var(--primary);}
.side-lv{font-family:'DM Mono',monospace;font-size:9px;padding:1px 7px;border-radius:10px;border:1px solid var(--b1);}
.side-icon{font-size:14px;flex-shrink:0;}
.side-name{font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.side-title{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);padding:10px 10px 4px;}
/* ── QUEST ROADMAP ── */
.roadmap{display:flex;flex-direction:column;gap:0;margin-bottom:12px;}
.roadmap-row{display:flex;align-items:flex-start;gap:0;}
.roadmap-line{width:24px;display:flex;flex-direction:column;align-items:center;padding-top:8px;}
.roadmap-connector{width:2px;flex:1;background:var(--b2);min-height:16px;}
.roadmap-dot{width:12px;height:12px;border-radius:50%;background:var(--s2);border:2px solid var(--b2);flex-shrink:0;}
.roadmap-dot.active{background:var(--primary);border-color:var(--primary);}
.roadmap-dot.done{background:var(--success);border-color:var(--success);}
.roadmap-dot.locked{background:var(--b1);border-color:var(--b1);}
.roadmap-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:8px 11px;cursor:default;}
.roadmap-card.done{opacity:.5;}
.roadmap-title{font-size:13px;font-weight:400;margin-bottom:3px;}
.roadmap-meta{display:flex;gap:5px;flex-wrap:wrap;}
/* ── SHARE CARD ── */
.share-card{background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:20px;text-align:center;margin-bottom:12px;}
.share-level{font-family:'DM Mono',monospace;font-size:32px;color:var(--primary);line-height:1;}
.share-name{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-top:4px;margin-bottom:16px;}
.share-stats{display:flex;justify-content:center;gap:20px;margin-bottom:16px;}
.share-stat{text-align:center;}.share-stat-num{font-family:'DM Mono',monospace;font-size:18px;color:var(--tx);}.share-stat-lbl{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;color:var(--tx3);}
/* ── COMING UP STRIP ── */
.coming-up-card{display:flex;align-items:center;gap:8px;background:var(--s1);border:1px solid var(--b1);border-left:2px solid var(--primaryb);border-radius:var(--r);padding:7px 10px;margin-bottom:3px;opacity:.75;}
.coming-up-title{flex:1;font-size:12px;color:var(--tx2);}
.coming-up-due{font-family:'DM Mono',monospace;font-size:8px;color:var(--tx3);}
/* ── JOURNAL TAB ── */
.jtab-row{display:flex;gap:3px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:3px;margin-bottom:16px;}
.jtab{flex:1;padding:6px 4px;border:none;border-radius:4px;background:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--tx3);transition:all .15s;}
.jtab.on{background:var(--s2);color:var(--tx);}
.sub-progress{height:2px;background:var(--b1);border-radius:1px;margin-top:5px;overflow:hidden;}
.sub-progress-fill{height:100%;background:var(--primary);border-radius:1px;transition:width .3s;}
.card.quest-side{border-color:var(--secondaryb);}
.review-btn{position:fixed;bottom:72px;right:16px;background:var(--s2);border:1px solid var(--b2);color:var(--tx2);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;padding:7px 12px;border-radius:20px;cursor:pointer;z-index:50;transition:all .15s;box-shadow:0 2px 12px #0008;}
.review-btn:hover{background:var(--primary);color:var(--bg);border-color:var(--primary);}
@media(min-width:768px){.review-btn{bottom:20px;right:24px;}}
.journal-entry{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;margin-bottom:8px;}
.journal-entry.practice-entry{border-color:var(--secondaryb);background:var(--s2);}
.journal-entry.ai-journal-entry{border-color:var(--secondaryb);background:linear-gradient(135deg,var(--s2),var(--bg));}
.journal-date{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--tx3);margin-bottom:6px;}
.journal-text{font-size:13px;color:var(--tx);line-height:1.7;white-space:pre-wrap;}
.journal-img{max-width:100%;border-radius:4px;margin-bottom:8px;border:1px solid var(--b1);}
.xp-log-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--b1);font-size:12px;}
.xp-log-amt{font-family:'DM Mono',monospace;font-size:11px;color:var(--success);min-width:50px;}
.xp-log-label{flex:1;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.xp-log-time{font-family:'DM Mono',monospace;font-size:9px;color:var(--tx3);}
.search-row{display:flex;gap:8px;margin-bottom:14px;}
.search-input{flex:1;background:var(--s1);border:1px solid var(--b1);color:var(--tx);border-radius:var(--r);padding:7px 12px;font-size:12px;outline:none;}
.search-input:focus{border-color:var(--primaryb);}
.review-modal{background:var(--s1);border:1px solid var(--b1);border-radius:8px;padding:24px;max-width:560px;width:100%;max-height:80vh;overflow-y:auto;}
/* ── UTILITY CLASSES ── */
.row{display:flex;align-items:center;}
.row-gap4{display:flex;align-items:center;gap:4px;}
.row-gap6{display:flex;align-items:center;gap:6px;}
.row-gap8{display:flex;align-items:center;gap:8px;}
.row-gap10{display:flex;align-items:center;gap:10px;}
.row-sb{display:flex;align-items:center;justify-content:space-between;}
.col{display:flex;flex-direction:column;}
.col-gap4{display:flex;flex-direction:column;gap:4px;}
.col-gap8{display:flex;flex-direction:column;gap:8px;}
.mono{font-family:'DM Mono',monospace;}
.mono9{font-family:'DM Mono',monospace;font-size:9px;}
.mono10{font-family:'DM Mono',monospace;font-size:10px;}
.mono11{font-family:'DM Mono',monospace;font-size:11px;}
.label9{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);}
.label10{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);}
.tx3{color:var(--tx3);}
.tx2{color:var(--tx2);}
.card-row{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:8px 12px;margin-bottom:4px;}
/* ── THINKING DOTS ── */
.tdot{animation:tdot 1.2s ease-in-out infinite;display:inline-block;font-size:14px;color:var(--tx3);}
.tdot:nth-child(2){animation-delay:.2s;}
.tdot:nth-child(3){animation-delay:.4s;}
@keyframes tdot{0%,80%,100%{opacity:.2}40%{opacity:1}}
/* ── PULSE ANIMATION ── */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
/* ── DESKTOP TWO-COLUMN LAYOUT ── */
.sidenav{display:none;}
@media(min-width:768px){
  .app{flex-direction:row;max-width:100%;}
  .sidenav{
    display:flex;flex-direction:column;
    width:200px;min-width:200px;flex-shrink:0;
    background:${hb};border-right:1px solid var(--b1);
    height:100vh;position:sticky;top:0;overflow-y:auto;
    padding:16px 0;z-index:40;
  }
  .side-top{padding:0 14px 16px;border-bottom:1px solid var(--b1);margin-bottom:8px;}
  .side-links{display:flex;flex-direction:column;gap:1px;flex:1;}
  .slink{display:flex;align-items:center;gap:10px;padding:9px 14px;border:none;background:none;cursor:pointer;width:100%;text-align:left;border-left:2px solid transparent;transition:all .15s;color:var(--tx3);font-size:13px;}
  .slink:hover{background:var(--s1);color:var(--tx2);}
  .slink.on{background:var(--s1);color:var(--tx);border-left-color:var(--primary);}
  .slink-icon{font-size:16px;line-height:1;flex-shrink:0;width:20px;text-align:center;}
  .slink-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;}
  .hdr{display:none;}
  .bnav{display:none;}
  .main-wrap{flex:1;min-width:0;display:flex;flex-direction:column;}
  .pg{padding:24px 32px 48px;max-width:720px;width:100%;}
  .review-btn{left:216px;right:auto;bottom:16px;}
}
@media(min-width:1100px){
  .sidenav{width:220px;min-width:220px;}
  .pg{max-width:800px;}
  .review-btn{left:236px;}
}
@media(max-width:767px){
  .sidenav{display:none !important;}
  .hdr{display:block;}
  .bnav{display:flex;}
  .main-wrap{flex:1;}
}
.timer-bar{position:fixed;bottom:0;left:200px;right:0;height:36px;background:var(--s1);border-top:1px solid var(--secondaryb);display:flex;align-items:center;gap:12px;padding:0 20px;z-index:200;cursor:pointer;}
.timer-bar-time{font-family:'DM Mono',monospace;font-size:14px;color:var(--secondary);letter-spacing:1px;}
.timer-bar-lbl{font-family:'DM Mono',monospace;font-size:10px;color:var(--tx2);letter-spacing:.8px;}
@media(max-width:767px){.timer-bar{left:0;bottom:56px;}}
${rpgExtras}`;
}
