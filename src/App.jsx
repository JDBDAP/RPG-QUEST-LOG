import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from "react";

const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;1,300&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;
const SettingsCtx = createContext(null);
const useSettings = () => useContext(SettingsCtx);

const DEFAULT_SETTINGS = {
  appName: "",
  profile: { name: "", setup: false },
  labels: {
    plannerTab:"Planner", questsTab:"Quests", skillsTab:"Skills",
    practiceTab:"Practice", advisorTab:"Advisor", settingsTab:"Settings", journalTab:"Journal",
    mainQuest:"Main Quest", sideQuest:"Side Quest", radiantQuest:"Radiant Quest",
    mainXp:"80", sideXp:"50", radiantXp:"30",
    daily:"Daily", weekly:"Weekly", monthly:"Monthly",
    xpName:"XP", levelName:"LVL", done:"Done", completed:"Completed",
    radiantDesc:"Recurring practices. Embodied, not completed.",
    skillsDesc:"Skills level up as you complete tagged tasks and quests.",
    comboName:"Combo",
  },
  colors: { primary:"#c8a96e", secondary:"#5b9e9e", success:"#6a9e6a", danger:"#a06060" },
  theme:  { bg:"#0c0c0c", s1:"#141414", s2:"#1a1a1a", b1:"#252525", b2:"#333333", tx:"#dedede", tx2:"#999999", tx3:"#555555" },
  xp: { globalPerLevel:600, skillPerLevel:6000, practicePerMin:1, aiScoring:true },
  fontSize: 14,
  contentWidth: 700,
};

const THEME_PRESETS = [
  { name:"Dark",     bg:"#0c0c0c", s1:"#141414", s2:"#1a1a1a", b1:"#252525", b2:"#333333", tx:"#dedede", tx2:"#999999", tx3:"#555555" },
  { name:"Midnight", bg:"#070b14", s1:"#0d1220", s2:"#131929", b1:"#1e2640", b2:"#2d3a58", tx:"#d8e0f0", tx2:"#8896b8", tx3:"#4a5470" },
  { name:"Warm",     bg:"#0f0d0b", s1:"#181410", s2:"#201c16", b1:"#2a2420", b2:"#3d3530", tx:"#e8ddd0", tx2:"#a89888", tx3:"#605548" },
  { name:"Sepia",    bg:"#1a1510", s1:"#221c14", s2:"#2a2318", b1:"#352b20", b2:"#4a3f32", tx:"#f0e8d8", tx2:"#b0a090", tx3:"#706050" },
  { name:"Dim",      bg:"#1a1a1a", s1:"#222222", s2:"#2a2a2a", b1:"#333333", b2:"#444444", tx:"#cccccc", tx2:"#888888", tx3:"#555555" },
  { name:"Forest",   bg:"#0a0f0a", s1:"#111811", s2:"#162016", b1:"#1f2e1f", b2:"#2e402e", tx:"#d8e8d0", tx2:"#88a888", tx3:"#486048" },
  { name:"Light",    bg:"#f5f5f0", s1:"#eeeeea", s2:"#e5e5e0", b1:"#d8d8d3", b2:"#c5c5c0", tx:"#1a1a1a", tx2:"#555555", tx3:"#aaaaaa" },
  { name:"Paper",    bg:"#f8f5ee", s1:"#f0ece2", s2:"#e8e3d6", b1:"#d8d2c2", b2:"#c2bba8", tx:"#2a2520", tx2:"#6a6058", tx3:"#b0a898" },
];

const PALETTES = [
  { name:"Amber",   primary:"#c8a96e", secondary:"#5b9e9e" },
  { name:"Crimson", primary:"#c86e7a", secondary:"#6e8bc8" },
  { name:"Violet",  primary:"#a06ec8", secondary:"#6ec8a0" },
  { name:"Sage",    primary:"#7aaa7a", secondary:"#aa9a5a" },
  { name:"Steel",   primary:"#7a9ec8", secondary:"#c8a06e" },
  { name:"Rose",    primary:"#c87aaa", secondary:"#7ac8b0" },
  { name:"Copper",  primary:"#c8824e", secondary:"#4ea0c8" },
  { name:"Slate",   primary:"#8898b8", secondary:"#b8a888" },
];

const SKILL_ICONS  = ["◈","◉","◎","◆","◬","✦","◌","◊","△","○","□","◇","❋","⊕","◐","◑","⬡","✧","⟡","◿"];
const SKILL_COLORS = [
  // Muted (original palette)
  "#6a8fb5","#6a9e6a","#9e6ab5","#c8a96e","#5b9e9e","#b5906a",
  "#9e6a6a","#7a9e6a","#8b6a9e","#9e8b5b","#5b7a9e","#9e7a5b",
  "#7a9e9e","#9e9e5b","#8b5b8b","#b58b6a","#6ab58b","#8b8b5b",
  // Vivid
  "#e05555","#e07a30","#e0c030","#55c255","#30b8e0","#7055e0",
  "#e055b8","#e05580","#55e0a0","#55a0e0","#c255e0","#e09030",
  // Bright / neon-ish
  "#ff6b6b","#ffa94d","#ffe066","#69db7c","#4dabf7","#cc5de8",
  "#f783ac","#74c0fc","#63e6be","#a9e34b","#ff8cc6","#f9ca24",
];
const DEFAULT_PRACTICE_TYPES = [];
const DEFAULT_SKILLS = [];
const SKILL_PRESETS = [
  { name:"Fallout S.P.E.C.I.A.L.", skills:[
    {name:"Strength",    icon:"◆", color:"#c86e6e"},
    {name:"Perception",  icon:"◎", color:"#c8a96e"},
    {name:"Endurance",   icon:"◬", color:"#6a9e6a"},
    {name:"Charisma",    icon:"◉", color:"#9e6ab5"},
    {name:"Intelligence",icon:"◈", color:"#6a8fb5"},
    {name:"Agility",     icon:"◌", color:"#5b9e9e"},
    {name:"Luck",        icon:"✦", color:"#b5906a"},
  ]},
  { name:"Disco Elysium", skills:[
    {name:"Intellect",   icon:"◈", color:"#6a8fb5"},
    {name:"Psyche",      icon:"◉", color:"#9e6ab5"},
    {name:"Physique",    icon:"◬", color:"#6a9e6a"},
    {name:"Motorics",    icon:"◎", color:"#5b9e9e"},
  ]},
  { name:"Classic RPG", skills:[
    {name:"Mind",        icon:"◈", color:"#6a8fb5"},
    {name:"Body",        icon:"◬", color:"#6a9e6a"},
    {name:"Spirit",      icon:"✦", color:"#9e6ab5"},
    {name:"Social",      icon:"◎", color:"#5b9e9e"},
    {name:"Craft",       icon:"◆", color:"#c8a96e"},
  ]},
  { name:"Magick · Elements", skills:[
    {name:"Fire",        icon:"◆", color:"#d4603a"},
    {name:"Water",       icon:"◎", color:"#4a90c8"},
    {name:"Air",         icon:"◌", color:"#a0c8d4"},
    {name:"Earth",       icon:"◬", color:"#7a9e5a"},
    {name:"Spirit",      icon:"✦", color:"#9e6ab5"},
  ]},
  { name:"Magick · Practice", skills:[
    {name:"Meditation",  icon:"◉", color:"#9e6ab5"},
    {name:"Ritual",      icon:"✦", color:"#c8a96e"},
    {name:"Divination",  icon:"◎", color:"#5b9e9e"},
    {name:"Astral",      icon:"◈", color:"#6a8fb5"},
    {name:"Alchemy",     icon:"◆", color:"#9e7a4a"},
    {name:"Chaos",       icon:"◬", color:"#c86e6e"},
  ]},
  { name:"Magick · Sephiroth (Kabbalah)", skills:[
    {name:"Kether",      icon:"✦", color:"#ffffff"},
    {name:"Chesed",      icon:"◈", color:"#6a8fb5"},
    {name:"Geburah",     icon:"◆", color:"#c86e6e"},
    {name:"Tiphareth",   icon:"◉", color:"#c8a96e"},
    {name:"Netzach",     icon:"◬", color:"#6a9e6a"},
    {name:"Hod",         icon:"◎", color:"#c8b05a"},
    {name:"Yesod",       icon:"◌", color:"#9e6ab5"},
    {name:"Malkuth",     icon:"◬", color:"#8a7a6a"},
  ]},
];
const TAB_EXPLAINERS = {
  planner:  {icon:"◎",title:"Planner",  body:"Daily, weekly, and monthly tasks. Tag them to a skill and they feed XP when completed. Switch periods at the top to plan across different time horizons.",tip:"Start small. One or two tasks per period builds a rhythm faster than a full list."},
  quests:   {icon:"◆",title:"Quests",   body:"Main Quests complete once — goals, milestones. Radiant Quests are recurring practices to embody. Completing a Radiant Quest prompts a practice session log.",tip:"If it has an end, it's Main. If it's a way of being, it's Radiant."},
  skills:   {icon:"◈",title:"Skills",   body:"The dimensions you're developing — define them yourself. XP flows in from tagged tasks, quests, and sessions. Every 6000 XP is one level, roughly 100 hours at 1 XP/min.",tip:"Use the presets for inspiration, or build from scratch."},
  practice: {icon:"◉",title:"Practice", body:"Log actual sessions. Create your own practice types to match your real vocabulary. Tag skills for XP. Journal entries trigger AI scoring beyond raw time.",tip:"Consecutive daily sessions build a streak multiplier up to 2×. Honest logging compounds."},
  advisor:  {icon:"✦",title:"Advisor",  body:"An AI that knows your full system — skills, quests, tasks, streaks, history. Ask anything or think out loud. It can create quests and tasks directly from conversation.",tip:"The more you've built in other tabs, the more useful it becomes."},
  settings: {icon:"⚙",title:"Settings", body:"Customize name, font size, theme, colors, XP rates, and tab labels. Changes save immediately. Export full data as JSON for backup.",tip:"Font size S/M/L/XL is at the top of the Profile section."},
};
const PERIODS = ["daily","weekly","monthly"];


function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function skillLv(xp,pl){ return Math.floor(xp/pl)+1; }
function skillProg(xp,pl){ return ((xp%pl)/pl)*100; }
function fmtDate(ts){ return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function todayLabel(){ return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}); }
function monthLabel(){ return new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"}); }
function dayKey(d){ return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function todayKey(){ return dayKey(new Date()); }
function getWeekDays(){
  const t=new Date(), mon=new Date(t);
  mon.setDate(t.getDate()-((t.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}
function getMultiplier(count){
  if(count>=30) return 2.0; if(count>=14) return 1.75;
  if(count>=7)  return 1.5; if(count>=3)  return 1.25;
  return 1.0;
}
function updateStreak(cur, skillId){
  if(!skillId) return cur;
  const today=todayKey(), yest=new Date();
  yest.setDate(yest.getDate()-1);
  const yKey=dayKey(yest);
  const s=cur[skillId]||{count:0,lastDay:""};
  const count=s.lastDay===today?s.count:s.lastDay===yKey?s.count+1:1;
  return {...cur,[skillId]:{count,lastDay:today}};
}
function computedTabTitle(tab,s){
  if(s.appName) return s.appName;
  const pre=s.profile.name?`${s.profile.name}\'s`:"Your";
  if(tab==="planner"||tab==="quests") return `${pre} Quests`;
  if(tab==="skills"||tab==="practice") return `${pre} Stats`;
  if(tab==="advisor") return `${pre} Quests & Stats`;
  if(tab==="settings") return `${pre} Settings`;
  return pre;
}
function deepMerge(def,saved){
  const out={...def};
  for(const k in saved){
    if(k in def && saved[k] && typeof def[k]==="object" && !Array.isArray(def[k]))
      out[k]={...def[k],...saved[k]};
    else out[k]=saved[k];
  }
  return out;
}

async function sget(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } }
async function sset(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} }

function buildCSS(C,T,FS=14){
  const t={...THEME_PRESETS[0],...T};
  const hb=t.bg.length===7?t.bg+"f5":t.bg;
  const f=FS||14; const f2=Math.round(f*0.857); const f3=Math.round(f*0.785);
  return `${GFONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:${t.bg};--s1:${t.s1};--s2:${t.s2};--b1:${t.b1};--b2:${t.b2};--b3:${t.tx3};--tx:${t.tx};--tx2:${t.tx2};--tx3:${t.tx3};--primary:${C.primary};--primaryf:${C.primary}22;--primaryb:${C.primary}40;--secondary:${C.secondary};--secondaryf:${C.secondary}18;--secondaryb:${C.secondary}38;--success:${C.success};--successf:${C.success}18;--danger:${C.danger};--dangerf:${C.danger}20;--r:5px;}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;font-weight:300;-webkit-font-smoothing:antialiased;font-size:${f}px;}
button,input,textarea,select{font-family:\'DM Sans\',sans-serif;}
.app{max-width:460px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;}
@media(min-width:768px){.app{max-width:100%;margin:0;}}
.hdr{padding:12px 18px 0;border-bottom:1px solid var(--b1);background:${hb};position:sticky;top:0;z-index:40;backdrop-filter:blur(14px);}
.hdr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;gap:10px;}
.hdr-title{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.8px;color:var(--tx2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lv-badge{font-family:\'DM Mono\',monospace;font-size:10px;color:var(--primary);background:var(--primaryf);border:1px solid var(--primaryb);border-radius:20px;padding:2px 10px;letter-spacing:1px;white-space:nowrap;flex-shrink:0;}
.xp-row{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.xp-track{flex:1;height:2px;background:var(--b1);border-radius:1px;overflow:hidden;}
.xp-fill{height:100%;background:linear-gradient(90deg,var(--secondary),var(--primary));border-radius:1px;transition:width .5s ease;}
.xp-lbl{font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tx3);white-space:nowrap;}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;display:flex;background:${hb};border-top:1px solid var(--b1);backdrop-filter:blur(14px);z-index:40;padding-bottom:env(safe-area-inset-bottom);}
.nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 10px;background:none;border:none;cursor:pointer;color:var(--tx3);transition:color .15s;}
.nbtn.on{color:var(--tx);}.nbtn:hover:not(.on){color:var(--tx2);}
.nicon{font-size:13px;line-height:1;}.nlbl{font-family:\'DM Mono\',monospace;font-size:6.5px;letter-spacing:.8px;text-transform:uppercase;}
.pg{padding:18px 18px 88px;flex:1;}
.stabs{display:flex;gap:3px;margin-bottom:18px;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:3px;}
.stab{flex:1;padding:6px 4px;border:none;border-radius:4px;background:none;cursor:pointer;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--tx3);transition:all .15s;}
.stab.on{background:var(--s2);color:var(--tx);}
.slbl{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.slbl::after{content:\'\';flex:1;height:1px;background:var(--b1);}
.gap{height:18px;}
.clist{display:flex;flex-direction:column;gap:2px;margin-bottom:4px;}
.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:10px 12px;display:flex;align-items:flex-start;gap:10px;transition:border-color .15s;}
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
.addbtn{display:flex;align-items:center;gap:6px;background:none;border:1px dashed var(--b1);border-radius:var(--r);width:100%;padding:8px 12px;color:var(--tx3);font-size:13px;font-weight:300;cursor:pointer;transition:all .15s;margin-bottom:2px;}
.addbtn:hover{border-color:var(--b2);color:var(--tx2);}
.fwrap{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:13px;margin-bottom:10px;}
.frow{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.fi{background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:var(--tx);font-size:${f2}px;font-weight:300;padding:7px 9px;outline:none;transition:border-color .15s;flex:1;min-width:80px;}
.fi:focus{border-color:var(--b3);}.fi::placeholder{color:var(--tx3);}.fi.full{min-width:100%;flex:none;width:100%;}
.fsel{background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:var(--tx2);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;padding:7px 8px;outline:none;cursor:pointer;}
.fsbtn{background:var(--s2);border:1px solid var(--b2);border-radius:4px;color:var(--tx);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 14px;cursor:pointer;transition:all .15s;width:100%;margin-top:2px;}
.fsbtn:hover{background:var(--b1);border-color:var(--b3);}.fsbtn.primary{color:var(--primary);border-color:var(--primaryb);}.fsbtn.secondary{color:var(--secondary);border-color:var(--secondaryb);}.fsbtn:disabled{opacity:.4;cursor:default;}
.exp-tog{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--tx3);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:6px 0;transition:color .15s;width:100%;}
.exp-tog:hover{color:var(--tx2);}.exp-arr{font-size:8px;transition:transform .15s;}.exp-arr.open{transform:rotate(180deg);}
.skill-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:13px;margin-bottom:6px;}
.sk-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.sk-name{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;}
.sk-meta{display:flex;align-items:center;gap:6px;}
.sk-lv{font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tx3);}.sk-lv span{color:var(--primary);}
.sk-streak{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--primary);background:var(--primaryf);border:1px solid var(--primaryb);border-radius:20px;padding:2px 8px;}
.sk-bar-wrap{height:2px;background:var(--b1);border-radius:1px;overflow:hidden;margin-bottom:5px;}
.sk-bar{height:100%;border-radius:1px;transition:width .5s ease;}
.sk-xprow{display:flex;align-items:center;justify-content:space-between;}
.sk-xplbl{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--tx3);}
.sk-delbtn{background:none;border:none;cursor:pointer;color:var(--tx3);font-size:10px;padding:2px 5px;transition:color .15s;border-radius:3px;}
.sk-delbtn:hover{color:var(--danger);}
.icon-grid{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
.icon-opt{width:32px;height:32px;background:var(--bg);border:1px solid var(--b1);border-radius:4px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.icon-opt.on{background:var(--s2);border-color:var(--b3);}
.color-grid{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.color-opt{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all .15s;}
.color-opt.on{border-color:var(--tx);}
.sk-quote{border-left:2px solid var(--primaryb);padding:11px 14px;margin-bottom:16px;background:var(--s1);border-radius:0 var(--r) var(--r) 0;}
.sk-quote-text{font-size:12px;color:var(--tx2);line-height:1.65;font-style:italic;}
.sk-quote-attr{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--tx3);margin-top:6px;letter-spacing:.8px;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:18px;}
.sbox{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:11px;text-align:center;}
.snum{font-family:\'DM Mono\',monospace;font-size:20px;color:var(--primary);line-height:1;margin-bottom:3px;}
.slb2{font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:1px;color:var(--tx3);text-transform:uppercase;}
.med-card{background:var(--s1);border:1px solid var(--b1);border-left:2px solid var(--secondary);border-radius:var(--r);padding:10px 12px;display:flex;gap:10px;margin-bottom:2px;}
.med-icon{font-size:15px;width:22px;text-align:center;flex-shrink:0;padding-top:1px;}
.med-body{flex:1;min-width:0;}
.med-name{font-size:${f2}px;font-weight:400;}
.med-sub{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--tx3);margin-top:2px;}
.med-reason{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--secondary);margin-top:3px;}
.med-journal{font-size:12px;color:var(--tx2);font-style:italic;line-height:1.5;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.med-journal.exp{display:block;}
.jrnl-btn{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--tx3);background:none;border:none;cursor:pointer;padding:3px 0;transition:color .15s;}
.jrnl-btn:hover{color:var(--tx2);}
.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;}
.topt{background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:var(--tx3);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.8px;text-transform:uppercase;padding:8px 6px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;}
.topt.on{border-color:var(--secondaryb);color:var(--secondary);background:var(--secondaryf);}
.topt:hover:not(.on){border-color:var(--b2);color:var(--tx2);}
.dur-hdr{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--tx3);margin-bottom:7px;display:flex;justify-content:space-between;}
.dur-val{color:var(--secondary);}
input[type=range]{-webkit-appearance:none;width:100%;height:2px;background:var(--b1);border-radius:1px;outline:none;margin-bottom:10px;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--secondary);cursor:pointer;border:2px solid var(--bg);}
.ai-lbl{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--secondary);letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.date-hdr{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:16px;}
.wk-day{margin-bottom:14px;}
.wk-day-lbl{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);margin-bottom:5px;}
.wk-day-lbl.today{color:var(--primary);}
.ai-intro{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px;margin-bottom:14px;}
.ai-intro-title{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--secondary);margin-bottom:5px;}
.ai-intro-body{font-size:12px;color:var(--tx2);line-height:1.6;}
.ai-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;}
.ai-chip{background:var(--bg);border:1px solid var(--b1);border-radius:20px;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.5px;color:var(--tx3);padding:4px 10px;cursor:pointer;transition:all .15s;}
.ai-chip:hover{border-color:var(--b2);color:var(--tx2);}
.ai-msgs{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;}
.ai-msg{padding:12px;border-radius:var(--r);font-size:${f2}px;line-height:1.65;}
.ai-msg.user{background:var(--s2);border:1px solid var(--b2);color:var(--tx);margin-left:20px;border-bottom-right-radius:2px;}
.ai-msg.assistant{background:var(--s1);border:1px solid var(--b1);color:var(--tx2);margin-right:20px;border-bottom-left-radius:2px;}
.ai-msg.loading{color:var(--tx3);font-style:italic;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:1px;background:var(--s1);border:1px solid var(--b1);margin-right:20px;}
.ai-actions{display:flex;flex-direction:column;gap:6px;margin-top:10px;}
.act-card{background:var(--bg);border:1px solid var(--primaryb);border-radius:var(--r);padding:10px 12px;}
.act-tool{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);margin-bottom:4px;}
.act-sum{font-size:13px;line-height:1.4;margin-bottom:2px;}
.act-detail{font-size:11px;color:var(--tx2);font-style:italic;}
.act-btns{display:flex;gap:5px;margin-top:8px;}
.abtn{flex:1;padding:6px;border-radius:4px;border:1px solid var(--b2);background:none;cursor:pointer;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--tx2);transition:all .15s;}
.abtn.ok{color:var(--success);border-color:var(--successf);}.abtn.ok:hover{background:var(--successf);}
.abtn.no:hover{background:var(--dangerf);color:var(--danger);border-color:var(--dangerf);}
.act-done{font-family:\'DM Mono\',monospace;font-size:9px;padding:6px 0;text-align:center;}
.ai-input-row{display:flex;gap:6px;}
.ai-input{flex:1;background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);color:var(--tx);font-size:13px;padding:10px 12px;outline:none;resize:none;transition:border-color .15s;line-height:1.4;min-height:42px;max-height:100px;}
.ai-input:focus{border-color:var(--b3);}
.ai-send{background:var(--s2);border:1px solid var(--secondaryb);border-radius:var(--r);color:var(--secondary);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:0 14px;cursor:pointer;transition:all .15s;flex-shrink:0;}
.ai-send:hover:not(:disabled){background:var(--secondaryf);}.ai-send:disabled{opacity:.35;cursor:default;}
.notif-btn{background:none;border:1px solid var(--secondaryb);border-radius:4px;color:var(--secondary);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:6px 10px;cursor:pointer;transition:all .15s;width:100%;margin-bottom:6px;text-align:left;}
.notif-btn:hover{background:var(--secondaryf);}
.notif-ok{font-family:\'DM Mono\',monospace;font-size:9px;color:var(--success);margin-bottom:6px;padding:6px 0;}
.sgroup{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);overflow:hidden;margin-bottom:6px;}
.sgroup-title{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);padding:10px 13px;border-bottom:1px solid var(--b1);}
.srow{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid var(--b1);}
.srow:last-child{border-bottom:none;}
.srow-label{font-size:${f2}px;font-weight:300;color:var(--tx);}
.srow-sub{font-size:${f3}px;color:var(--tx3);margin-top:2px;line-height:1.4;}
.sinput{background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:var(--tx);font-size:12px;font-weight:300;padding:5px 8px;outline:none;transition:border-color .15s;width:140px;text-align:right;}
.sinput:focus{border-color:var(--b3);}.sinput.sm{width:70px;}
.palette-grid{display:flex;flex-wrap:wrap;gap:6px;padding:12px 13px;}
.pal-opt{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:6px 8px;border-radius:4px;border:1px solid transparent;transition:all .15s;}
.pal-opt.on{border-color:var(--b3);background:var(--s2);}.pal-opt:hover:not(.on){border-color:var(--b2);}
.pal-dots{display:flex;gap:3px;}.pal-dot{width:10px;height:10px;border-radius:50%;}
.pal-name{font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:1px;color:var(--tx3);}
.theme-grid{display:flex;flex-wrap:wrap;gap:5px;padding:12px 13px;}
.theme-opt{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:6px 8px;border-radius:4px;border:1px solid transparent;transition:all .15s;}
.theme-opt.on{border-color:var(--b3);background:var(--s2);}.theme-opt:hover:not(.on){border-color:var(--b2);}
.theme-swatch{width:32px;height:20px;border-radius:3px;border:1px solid rgba(128,128,128,.15);display:flex;overflow:hidden;}
.theme-name{font-family:\'DM Mono\',monospace;font-size:8px;letter-spacing:.8px;color:var(--tx3);}
.cpick{width:40px;height:28px;background:none;border:1px solid var(--b2);border-radius:4px;cursor:pointer;padding:2px;flex-shrink:0;}
.coll-btn{width:100%;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:11px 2px;color:var(--tx2);font-size:13px;font-weight:300;text-align:left;transition:color .15s;border-bottom:1px solid var(--b1);}
.coll-btn:hover{color:var(--tx);}.coll-arr{font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tx3);}
.tog-row{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid var(--b1);}
.tog-row:last-child{border-bottom:none;}
.tog{width:38px;height:20px;border-radius:10px;background:var(--b2);border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
.tog.on{background:var(--secondary);}.tog-knob{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--tx);transition:transform .2s;}
.tog.on .tog-knob{transform:translateX(18px);}
.exp-btn{display:flex;align-items:center;gap:8px;background:none;border:1px solid var(--b1);border-radius:var(--r);width:100%;padding:10px 13px;color:var(--tx2);font-size:13px;font-weight:300;cursor:pointer;transition:all .15s;margin-bottom:6px;}
.exp-btn:hover{border-color:var(--b2);color:var(--tx);}
.save-btn{background:var(--s2);border:1px solid var(--b2);border-radius:4px;color:var(--tx);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;cursor:pointer;transition:all .15s;flex:1;}
.save-btn:hover{background:var(--b1);}
.reset-btn{background:none;border:1px solid var(--b1);border-radius:4px;color:var(--tx3);font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;cursor:pointer;transition:all .15s;}
.reset-btn:hover{border-color:var(--danger);color:var(--danger);}
.auth-note{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:13px;margin-bottom:12px;}
.auth-note-title{font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--secondary);margin-bottom:6px;}
.auth-note-body{font-size:12px;color:var(--tx2);line-height:1.6;}
.auth-note-code{font-family:\'DM Mono\',monospace;font-size:10px;color:var(--tx3);background:var(--bg);border:1px solid var(--b1);border-radius:3px;padding:2px 6px;margin:0 2px;}
.profile-setup{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;background:var(--bg);}
.ps-title{font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--primary);margin-bottom:8px;}
.ps-sub{font-size:13px;color:var(--tx2);margin-bottom:28px;line-height:1.6;max-width:280px;}
.ps-input{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);color:var(--tx);font-size:16px;font-weight:300;padding:12px 16px;outline:none;width:100%;max-width:280px;text-align:center;margin-bottom:10px;transition:border-color .15s;}
.ps-input:focus{border-color:var(--b3);}
.ps-btn{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);color:var(--tx);font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:10px 24px;cursor:pointer;transition:all .15s;width:100%;max-width:280px;}
.ps-btn:hover{background:var(--b1);}
.ps-skip{background:none;border:none;color:var(--tx3);font-size:12px;cursor:pointer;margin-top:12px;transition:color .15s;}
.ps-skip:hover{color:var(--tx2);}
.toast{position:fixed;bottom:66px;left:50%;transform:translateX(-50%) translateY(6px);background:var(--s2);border:1px solid var(--b2);border-radius:20px;padding:6px 16px;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:1px;color:var(--tx);opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;z-index:200;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
.empty{text-align:center;padding:32px 0;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:2px;color:var(--tx3);text-transform:uppercase;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100;display:flex;align-items:center;justify-content:center;}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:8px;padding:20px;max-width:300px;width:90%;}
.modal-title{font-size:14px;margin-bottom:8px;}.modal-sub{font-size:12px;color:var(--tx2);margin-bottom:16px;line-height:1.5;}
.modal-btns{display:flex;gap:8px;}
.mbtn{flex:1;padding:8px;border-radius:4px;border:1px solid var(--b2);background:none;cursor:pointer;font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--tx2);transition:all .15s;}
.mbtn:hover{background:var(--b1);}.mbtn.danger{color:var(--danger);border-color:var(--dangerf);}.mbtn.danger:hover{background:var(--dangerf);}
/* ── RESPONSIVE DESKTOP ── */
.sidenav{display:none;}
@media(min-width:768px){
  .app{max-width:100%;flex-direction:row;min-height:100vh;}
  .hdr{display:none;}
  .bnav{display:none;}
  .sidenav{display:flex;flex-direction:column;width:220px;min-height:100vh;background:${hb};border-right:1px solid var(--b1);position:sticky;top:0;height:100vh;flex-shrink:0;padding:20px 0;}
  .side-top{padding:0 18px 20px;border-bottom:1px solid var(--b1);margin-bottom:10px;}
  .side-title{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.8px;color:var(--tx2);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .side-lv{font-family:'DM Mono',monospace;font-size:10px;color:var(--primary);background:var(--primaryf);border:1px solid var(--primaryb);border-radius:20px;padding:2px 10px;letter-spacing:1px;display:inline-block;}
  .side-links{display:flex;flex-direction:column;gap:2px;padding:0 8px;}
  .slink{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;color:var(--tx3);padding:9px 10px;border-radius:var(--r);transition:all .15s;width:100%;text-align:left;}
  .slink:hover:not(.on){background:var(--s1);color:var(--tx2);}
  .slink.on{background:var(--s2);color:var(--tx);}
  .slink-icon{font-size:13px;flex-shrink:0;}
  .slink-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;}
  .main-wrap{flex:1;display:flex;justify-content:center;overflow-y:auto;}
  .pg{padding:28px 32px 40px;width:100%;max-width:var(--content-width,700px);}
}
@media(min-width:1100px){
  .pg{max-width:var(--content-width,780px);}
}

.prio-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:2px;}
.prio-high{background:#c85858;}.prio-med{background:#c8a96e;}.prio-low{background:#5b9e9e;}
.sub-progress{height:2px;background:var(--b1);border-radius:1px;margin-top:5px;overflow:hidden;}
.sub-progress-fill{height:100%;background:var(--primary);border-radius:1px;transition:width .3s;}
.card.quest-side{border-color:var(--secondaryb);}
.review-btn{position:fixed;bottom:72px;right:16px;background:var(--s2);border:1px solid var(--b2);color:var(--tx2);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;padding:7px 12px;border-radius:20px;cursor:pointer;z-index:50;transition:all .15s;box-shadow:0 2px 12px #0008;}
.review-btn:hover{background:var(--primary);color:var(--bg);border-color:var(--primary);}
@media(min-width:768px){.review-btn{bottom:20px;right:24px;}}
.journal-entry{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;margin-bottom:8px;}.journal-entry.practice-entry{border-color:var(--secondaryb);background:var(--s2);}
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
`;}


function NotifPrompt({dueDate,dueTime,title}){
  const [perm,setPerm]=useState(()=>typeof Notification!=="undefined"?Notification.permission:"unsupported");
  const req=async()=>{
    if(typeof Notification==="undefined") return;
    const r=await Notification.requestPermission(); setPerm(r);
    if(r==="granted"&&dueDate){
      const due=new Date(`${dueDate}${dueTime?"T"+dueTime:"T09:00"}`).getTime(), now=Date.now();
      if(due-3600000>now) setTimeout(()=>{try{new Notification("Quest due in 1 hour",{body:title});}catch{}},due-3600000-now);
      if(due>now) setTimeout(()=>{try{new Notification("Quest due now",{body:title});}catch{}},due-now);
    }
  };
  if(perm==="unsupported") return null;
  if(perm==="granted") return <div className="notif-ok">◎ Reminder scheduled</div>;
  return <button className="notif-btn" type="button" onClick={req}>◷ Enable due-date reminder</button>;
}

function Collapsible({question,children}){
  const [open,setOpen]=useState(false);
  return (
    <div style={{marginBottom:10}}>
      <button className="coll-btn" onClick={()=>setOpen(o=>!o)}>
        <span>{question}</span>
        <span className="coll-arr">{open?"▲":"▼"}</span>
      </button>
      {open&&<div style={{paddingTop:8}}>{children}</div>}
    </div>
  );
}

export default function App(){
  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [tab,setTab]=useState("planner");
  const [period,setPeriod]=useState("daily");
  const [tasks,setTasks]=useState([]);
  const [quests,setQuests]=useState([]);
  const [skills,setSkills]=useState(DEFAULT_SKILLS);
  const [meds,setMeds]=useState([]);
  const [practiceTypes,setPracticeTypes]=useState(DEFAULT_PRACTICE_TYPES);
  const [xp,setXp]=useState(0);
  const [streaks,setStreaks]=useState({});
  const [pendingPractice,setPendingPractice]=useState(null);
  const [toast,setToast]=useState({msg:"",on:false});
  const [confirm,setConfirm]=useState(null);
  const [showJarvis,setShowJarvis]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [seenTabs,setSeenTabs]=useState({});
  const [explainer,setExplainer]=useState(null);
  const [journal,setJournal]=useState([]);
  const [xpLog,setXpLog]=useState([]);
  const [showReview,setShowReview]=useState(false);
  const toastRef=useRef(null);

  useEffect(()=>{
    (async()=>{
      const s=await sget("cx_settings");
      if(s){
        const merged=deepMerge(DEFAULT_SETTINGS,s);
        // guard against corrupted/white theme (bg should be a dark or valid hex)
        if(!merged.theme?.bg||merged.theme.bg==="#ffffff"||merged.theme.bg==="white"||merged.theme.bg==="")
          merged.theme=DEFAULT_SETTINGS.theme;
        setSettings(merged);
      }
      const t=await sget("cx_tasks");    if(t) setTasks(t);
      const q=await sget("cx_quests");   if(q) setQuests(q);
      const sk=await sget("cx_skills");  if(sk) setSkills(sk);
      const m=await sget("cx_meds");     if(m) setMeds(m);
      const pt=await sget("cx_ptypes");  if(pt) setPracticeTypes(pt);
      const x=await sget("cx_xp");       if(x!==null) setXp(x);
      const st=await sget("cx_streaks"); if(st) setStreaks(st);
      const sv=await sget("cx_seen");    if(sv) setSeenTabs(sv);
      const jn=await sget("cx_journal"); if(jn) setJournal(jn);
      const xl=await sget("cx_xplog");   if(xl) setXpLog(xl);
      setLoaded(true);
    })();
  },[]);

  const saveSettings=async s=>{setSettings(s);await sset("cx_settings",s);};
  const handleTabChange=async id=>{
    setTab(id);
    if(!seenTabs[id]&&TAB_EXPLAINERS[id]){
      const next={...seenTabs,[id]:true};
      setSeenTabs(next); await sset("cx_seen",next);
      setExplainer(TAB_EXPLAINERS[id]);
    }
  };
  const L=settings.labels; const C=settings.colors; const TH=settings.theme;

  const showToast=useCallback(msg=>{
    if(toastRef.current) clearTimeout(toastRef.current);
    setToast({msg,on:true});
    toastRef.current=setTimeout(()=>setToast({msg:"",on:false}),2200);
  },[]);

  const saveXpLog=async(entry)=>{
    setXpLog(prev=>{const next=[entry,...prev].slice(0,100);sset("cx_xplog",next);return next;});
  };

  const award=useCallback(async(baseAmt,skillId,curXp,curSkills,curStreaks,label)=>{
    const skPerLv=settings.xp.skillPerLevel||6000;
    const streak=skillId?(curStreaks[skillId]||{count:0}):{count:0};
    const multiplier=getMultiplier(streak.count);
    const amt=Math.round(baseAmt*multiplier);
    const nx=curXp+amt; setXp(nx); await sset("cx_xp",nx);
    let leveledUp=null, newSkills=curSkills;
    if(skillId){
      newSkills=curSkills.map(s=>{
        if(s.id!==skillId) return s;
        const oldLv=skillLv(s.xp,skPerLv), newXp=s.xp+amt, newLv=skillLv(newXp,skPerLv);
        if(newLv>oldLv) leveledUp={name:s.name,level:newLv};
        return {...s,xp:newXp};
      });
      setSkills(newSkills); await sset("cx_skills",newSkills);
    }
    const sk=curSkills.find(s=>s.id===skillId);
    await saveXpLog({id:uid(),amt,label:label||"Task",skill:sk?.name||null,multiplier,created:Date.now()});
    return {amt,multiplier,leveledUp,newSkills};
  },[settings.xp.skillPerLevel]);

  const saveT=async t=>{setTasks(t);await sset("cx_tasks",t);};
  const saveQ=async q=>{setQuests(q);await sset("cx_quests",q);};
  const saveM=async m=>{setMeds(m);await sset("cx_meds",m);};
  const savePT=async t=>{setPracticeTypes(t);await sset("cx_ptypes",t);};
  const addPracticeType=async d=>{await savePT([...practiceTypes,{id:uid(),label:d.label,icon:d.icon||"◎"}]);};
  const deletePracticeType=async id=>{await savePT(practiceTypes.filter(t=>t.id!==id));};
  const saveS=async s=>{setSkills(s);await sset("cx_skills",s);};
  const reorderSkills=async newOrder=>{setSkills(newOrder);await sset("cx_skills",newOrder);};

  const saveStr=async s=>{setStreaks(s);await sset("cx_streaks",s);};

  const addTask=async d=>{
    await saveT([{id:uid(),...d,done:false,dayKey:d.period==="daily"?todayKey():null,created:Date.now()},...tasks]);
    showToast("Task added");
  };
  const toggleTask=async id=>{
    const task=tasks.find(t=>t.id===id); if(!task) return;
    await saveT(tasks.map(t=>t.id===id?{...t,done:!t.done}:t));
    if(!task.done){
      const {amt,leveledUp}=await award(task.xpVal,task.skill,xp,skills,streaks,task.title);
      showToast(`+${amt} ${L.xpName}`);
      if(leveledUp) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
    }
  };
  const deleteTask=async id=>saveT(tasks.filter(t=>t.id!==id));

  const addQuest=async d=>{
    const xpVal=d.type==="main"?Number(L.mainXp)||80:d.type==="side"?Number(L.sideXp)||50:Number(L.radiantXp)||30;
    const qSkills=d.skills||(d.skill?[d.skill]:[]);
    await saveQ([{id:uid(),...d,skills:qSkills,xpVal,done:false,priority:d.priority||"med",created:Date.now()},...quests]);
    showToast("Quest accepted");
  };
  const toggleQuest=async id=>{
    const q=quests.find(q=>q.id===id); if(!q) return;
    if(q.type==="radiant"){
      const qSkills=q.skills||[]; const primary=qSkills[0]||null;
      let newStr=streaks;
      if(primary){ newStr=updateStreak(streaks,primary); await saveStr(newStr); }
      const {amt,multiplier,leveledUp}=await award(q.xpVal,primary,xp,skills,newStr,`◉ ${q.title}`);
      const streak=newStr[primary]||{count:0};
      let msg=`+${amt} ${L.xpName}`;
      if(multiplier>1) msg+=` · ${streak.count}d ${L.comboName||"Combo"} ${multiplier}×`;
      showToast(msg);
      if(leveledUp) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      setPendingPractice({skillId:primary,questTitle:q.title});
      setTab("practice");
      return;
    }
    await saveQ(quests.map(q=>q.id===id?{...q,done:!q.done}:q));
    if(!q.done){
      const primary=(q.skills||[])[0]||null;
      const prefix=q.type==="main"?"◆":q.type==="side"?"◇":"";
      const {amt,leveledUp}=await award(q.xpVal,primary,xp,skills,streaks,`${prefix} ${q.title}`);
      showToast(`+${amt} ${L.xpName}`);
      if(leveledUp) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
    }
  };
  const deleteQuest=async id=>saveQ(quests.filter(q=>q.id!==id));
  const addSubquest=async(questId,title)=>{
    await saveQ(quests.map(q=>q.id!==questId?q:{...q,subquests:[...(q.subquests||[]),{id:uid(),title,done:false}]}));
  };
  const toggleSubquest=async(questId,subId)=>{
    await saveQ(quests.map(q=>{
      if(q.id!==questId) return q;
      return {...q,subquests:(q.subquests||[]).map(s=>s.id===subId?{...s,done:!s.done}:s)};
    }));
    showToast("Subquest updated");
  };
  const deleteSubquest=async(questId,subId)=>{
    await saveQ(quests.map(q=>q.id!==questId?q:{...q,subquests:(q.subquests||[]).filter(s=>s.id!==subId)}));
  };

  const addJournalEntry=async(entry)=>{
    const next=[{id:uid(),...entry,created:Date.now()},...journal];
    setJournal(next); await sset("cx_journal",next);
    showToast("Entry saved");
  };
  const deleteJournalEntry=async(id)=>{
    const next=journal.filter(e=>e.id!==id);
    setJournal(next); await sset("cx_journal",next);
  };

  const addSkill=async d=>{
    await saveS([...skills,{id:uid(),name:d.name,icon:d.icon,color:d.color,xp:d.startXp||0,type:d.type||"skill",parentIds:d.parentIds||[]}]);
    showToast(d.type==="subskill"?"Subskill created":"Skill created");
  };
  const addSkillBatch=async arr=>{
    const newSkills=arr.map(d=>({id:uid(),name:d.name,icon:d.icon,color:d.color,xp:d.startXp||0,customImg:d.customImg||null,type:"skill",parentIds:[]}));
    await saveS([...skills,...newSkills]);
    showToast(`Added ${newSkills.length} skills`);
  };
  // Link/unlink a subskill to a parent skill
  const linkSubskill=async(subId,parentId)=>{
    const updated=skills.map(s=>{
      if(s.id!==subId) return s;
      const already=s.parentIds?.includes(parentId);
      return {...s,parentIds:already?(s.parentIds||[]).filter(x=>x!==parentId):[...(s.parentIds||[]),parentId]};
    });
    await saveS(updated);
  };
  const deleteSkill=async id=>{
    setConfirm({msg:"Delete this skill?",sub:"All XP earned will be lost.",
      onOk:async()=>{await saveS(skills.filter(s=>s.id!==id));setConfirm(null);showToast("Skill removed");}});
  };
  const editSkill=async(id,updates)=>{
    await saveS(skills.map(s=>s.id===id?{...s,...updates}:s));
    showToast("Skill updated");
  };

  const logMed=async d=>{
    // If a subskill was selected, expand skillIds to include all parent skills
    const subId=d.subskillId||null;
    const sub=subId?skills.find(s=>s.id===subId&&s.type==="subskill"):null;
    let skillIds=d.skillIds||[];
    if(sub&&sub.parentIds?.length){
      skillIds=[...new Set([...skillIds,...sub.parentIds])];
    }
    const primary=skillIds[0]||null;
    let newStr=streaks;
    for(const sid of skillIds){ newStr=updateStreak(newStr,sid); }
    if(skillIds.length) await saveStr(newStr);
    // Award XP to all parent skills (multi-skill distribution)
    let curSkillsState=skills; let leveledUpAll=[];
    const skPerLvLocal=settings.xp.skillPerLevel||6000;
    const streak=primary?(newStr[primary]||{count:0}):{count:0};
    const multiplier=getMultiplier(streak.count);
    const amt=Math.round(d.baseXp*multiplier);
    const nx=xp+amt; setXp(nx); await sset("cx_xp",nx);
    for(const sid of skillIds){
      curSkillsState=curSkillsState.map(s=>{
        if(s.id!==sid) return s;
        const oldLv=skillLv(s.xp,skPerLvLocal),newXp=s.xp+amt,newLv=skillLv(newXp,skPerLvLocal);
        if(newLv>oldLv) leveledUpAll.push({name:s.name,level:newLv});
        return {...s,xp:newXp};
      });
    }
    if(skillIds.length){setSkills(curSkillsState);await sset("cx_skills",curSkillsState);}
    const sk=curSkillsState.find(s=>s.id===primary);
    await saveXpLog({id:uid(),amt,label:d.type+(sub?` · ${sub.name}`:""),skill:sk?.name||null,multiplier,created:Date.now()});
    const sessionCreated=d.sessionDate||Date.now();
    const session={id:uid(),type:d.type,dur:d.dur,skillIds,subskillId:subId,note:d.note,
      aiReason:d.aiReason,xpAwarded:amt,multiplier,created:sessionCreated};
    await saveM([session,...meds]);
    // Auto-save note to journal as a practice segment
    if(d.note&&d.note.trim()){
      const sk=curSkillsState.filter(s=>skillIds.includes(s.id));
      const skLabel=sk.map(s=>`${s.icon} ${s.name}`).join(", ");
      const header=`[${d.type}${skLabel?` · ${skLabel}`:""}${d.dur?` · ${d.dur}min`:""}]`;
      const next=[{id:uid(),text:`${header}\n${d.note.trim()}`,img:null,source:"practice",created:sessionCreated},...journal];
      setJournal(next); await sset("cx_journal",next);
    }
    let msg=`+${amt} ${L.xpName}`;
    if(multiplier>1) msg+=` · ${streak.count}d ${L.comboName||"Combo"} ${multiplier}×`;
    showToast(msg);
    leveledUpAll.forEach((lu,i)=>setTimeout(()=>showToast(`◆ ${lu.name} Level ${lu.level}`),(i+1)*600));
    setPendingPractice(null);
  };
  const deleteMed=async id=>saveM(meds.filter(m=>m.id!==id));

  const editTask=async(id,updates)=>{await saveT(tasks.map(t=>t.id===id?{...t,...updates}:t));showToast("Task updated");};
  const editQuest=async(id,updates)=>{await saveQ(quests.map(q=>q.id===id?{...q,...updates}:q));showToast("Quest updated");};

  const importData=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const data=JSON.parse(await file.text());
      if(data.tasks){setTasks(data.tasks);await sset("cx_tasks",data.tasks);}
      if(data.quests){setQuests(data.quests);await sset("cx_quests",data.quests);}
      if(data.skills){setSkills(data.skills);await sset("cx_skills",data.skills);}
      if(data.meds){setMeds(data.meds);await sset("cx_meds",data.meds);}
      if(data.xp!=null){setXp(data.xp);await sset("cx_xp",data.xp);}
      if(data.streaks){setStreaks(data.streaks);await sset("cx_streaks",data.streaks);}
      showToast("Data imported");
    }catch{showToast("Import failed — check JSON format");}
    e.target.value="";
  };

  const exportData=()=>{
    const blob=new Blob([JSON.stringify({tasks,quests,skills,meds,xp,streaks,settings,exported:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=`rpg-log-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const completeSetup=async name=>{
    await saveSettings({...settings,profile:{name:name.trim(),setup:true}});
  };

  const perLv=settings.xp.globalPerLevel||600;
  const skPerLv=settings.xp.skillPerLevel||6000;
  const level=Math.floor(xp/perLv)+1;
  const prog=((xp%perLv)/perLv)*100;
  const weekDays=getWeekDays();

  function periodTasks(){
    if(period==="daily") return tasks.filter(t=>t.period==="daily"&&t.dayKey===todayKey());
    if(period==="weekly") return tasks.filter(t=>t.period==="weekly");
    return tasks.filter(t=>t.period==="monthly");
  }

  const NAV=[
    {id:"planner",  icon:"□", label:L.plannerTab},
    {id:"quests",   icon:"◆", label:L.questsTab},
    {id:"skills",   icon:"◈", label:L.skillsTab},
    {id:"practice", icon:"◉", label:L.practiceTab},
    {id:"journal",  icon:"✦", label:L.journalTab},
    {id:"advisor",  icon:"◎", label:L.advisorTab},
    {id:"settings", icon:"⚙", label:L.settingsTab},
  ];

  if(!loaded) return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,height:"100vh",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,background:"#0c0c0c",color:"#555"}}>
    <span>LOADING</span>
    <button onClick={()=>{localStorage.removeItem("cx_settings");window.location.reload();}} style={{background:"none",border:"1px solid #333",borderRadius:4,color:"#444",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,padding:"6px 12px",cursor:"pointer"}}>reset theme if stuck</button>
  </div>;

  return (
    <SettingsCtx.Provider value={{settings,saveSettings}}>
      <style>{buildCSS(C,TH,settings.fontSize||14)}</style>
      <div className="app" style={{"--content-width":`${settings.contentWidth||700}px`,...(settings.images?.bg?{backgroundImage:`url(${settings.images.bg})`,backgroundSize:"cover",backgroundAttachment:"fixed",backgroundPosition:"center"}:{})}}>
        {!settings.profile.setup&&<ProfileSetup onComplete={completeSetup}/>}
        {settings.profile.setup&&<>
          {settings.images?.banner&&<div style={{width:"100%",maxHeight:80,overflow:"hidden",flexShrink:0}}><img src={settings.images.banner} alt="" style={{width:"100%",objectFit:"cover",maxHeight:80}}/></div>}
          {/* Desktop sidebar */}
          <nav className="sidenav">
            <div className="side-top">
              <div className="side-title">{computedTabTitle(tab,settings)}</div>
              <div className="side-lv">{L.levelName} {level}</div>
              <div className="xp-track" style={{margin:"10px 0 4px"}}><div className="xp-fill" style={{width:`${prog}%`}}/></div>
              <div className="xp-lbl">{xp} {L.xpName}</div>
            </div>
            <div className="side-links">
              {NAV.map(n=>(
                <button key={n.id} className={`slink ${tab===n.id?"on":""}`} onClick={()=>handleTabChange(n.id)}>
                  <span className="slink-icon">{n.icon}</span>
                  <span className="slink-lbl">{n.label}</span>
                </button>
              ))}
            </div>
          </nav>
          {/* Mobile header */}
          <header className="hdr">
            <div className="hdr-row">
              <div className="hdr-title">{computedTabTitle(tab,settings)}</div>
              <span className="lv-badge">{L.levelName} {level}</span>
            </div>
            <div className="xp-row">
              <div className="xp-track"><div className="xp-fill" style={{width:`${prog}%`}}/></div>
              <span className="xp-lbl">{xp} {L.xpName}</span>
            </div>
          </header>
          <div className="main-wrap">
          <main className="pg">
            {tab==="planner"  && <PlannerTab period={period} setPeriod={setPeriod} tasks={periodTasks()} weekDays={weekDays} allTasks={tasks} skills={skills} quests={quests} onAddTask={addTask} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} onToggleQuest={toggleQuest}/>}
            {tab==="quests"   && <QuestsTab quests={quests} skills={skills} onAdd={addQuest} onToggle={toggleQuest} onDelete={deleteQuest} onEdit={editQuest} onAddSubquest={addSubquest} onToggleSubquest={toggleSubquest} onDeleteSubquest={deleteSubquest}/>}
            {tab==="skills"   && <SkillsTab skills={skills} skPerLv={skPerLv} streaks={streaks} meds={meds} xpLog={xpLog} onAdd={addSkill} onAddBatch={addSkillBatch} onDelete={deleteSkill} onEdit={editSkill} onReorder={reorderSkills} onLink={linkSubskill}/>}
            {tab==="practice" && <PracticeTab meds={meds} skills={skills} streaks={streaks} pending={pendingPractice} practiceTypes={practiceTypes} onAddType={addPracticeType} onDeleteType={deletePracticeType} onLog={logMed} onDelete={deleteMed} onClearPending={()=>setPendingPractice(null)}/>}
            {tab==="journal"  && <JournalTab entries={journal} onAdd={addJournalEntry} onDelete={deleteJournalEntry}/>}
            {tab==="advisor"  && <AdvisorTab tasks={tasks} quests={quests} skills={skills} xp={xp} level={level} streaks={streaks} journal={journal} onAddQuest={addQuest} onAddTask={addTask} onLogMed={logMed} onEditQuest={editQuest}/>}
            {tab==="settings" && <SettingsTab showToast={showToast} onExport={exportData} onImport={importData}/>}
          </main>
          </div>
          {/* Weekly Review floating button */}
          <button className="review-btn" onClick={()=>setShowReview(true)} title="Weekly Review">◈ Review</button>
          {showReview&&<WeeklyReview tasks={tasks} quests={quests} skills={skills} meds={meds} xpLog={xpLog} onClose={()=>setShowReview(false)} onNavigate={id=>{setShowReview(false);handleTabChange(id);}}/>}
          {/* Jarvis FAB */}
          <button onClick={()=>setShowJarvis(true)} style={{position:"fixed",bottom:72,right:16,width:44,height:44,borderRadius:"50%",background:"var(--s2)",border:"1px solid var(--b2)",color:"var(--tx)",fontSize:18,cursor:"pointer",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)",transition:"all .15s"}} title="Jarvis AI">⟡</button>
          {showJarvis&&<JarvisOverlay tasks={tasks} quests={quests} skills={skills} onAddQuest={addQuest} onAddTask={addTask} onClose={()=>setShowJarvis(false)}/>}
          {/* Mobile bottom nav */}
          <nav className="bnav">
            {NAV.map(n=>(
              <button key={n.id} className={`nbtn ${tab===n.id?"on":""}`} onClick={()=>handleTabChange(n.id)}>
                <span className="nicon">{n.icon}</span>
                <span className="nlbl">{n.label}</span>
              </button>
            ))}
          </nav>
        </>}
        {explainer&&(
          <div className="overlay" onClick={()=>setExplainer(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:18,color:"var(--primary)"}}>{explainer.icon}</span>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"var(--tx)"}}>{explainer.title}</div>
              </div>
              <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>{explainer.body}</div>
              <div style={{background:"var(--s2)",borderRadius:4,padding:"8px 10px",marginBottom:14,borderLeft:"2px solid var(--primaryb)"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",color:"var(--primary)",marginBottom:3}}>tip</div>
                <div style={{fontSize:12,color:"var(--tx3)",lineHeight:1.5}}>{explainer.tip}</div>
              </div>
              <button className="fsbtn secondary" style={{margin:0}} onClick={()=>setExplainer(null)}>Got it</button>
            </div>
          </div>
        )}
        {confirm&&(
          <div className="overlay" onClick={()=>setConfirm(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-title">{confirm.msg}</div>
              <div className="modal-sub">{confirm.sub}</div>
              <div className="modal-btns">
                <button className="mbtn" onClick={()=>setConfirm(null)}>Cancel</button>
                <button className="mbtn danger" onClick={confirm.onOk}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsCtx.Provider>
  );
}

function ProfileSetup({onComplete}){
  const [name,setName]=useState("");
  return (
    <div className="profile-setup">
      <div className="ps-title">RPG Quest Log</div>
      <div className="ps-sub">Enter your name to begin. Your data stays on this device.</div>
      <input className="ps-input" placeholder="Your name..." value={name}
        onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onComplete(name)} autoFocus/>
      <button className="ps-btn" onClick={()=>onComplete(name)}>Begin</button>
      <button className="ps-skip" onClick={()=>onComplete("")}>Skip</button>
    </div>
  );
}

function QuestPlannerCard({quest,skills,onToggle}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const isRadiant=quest.type==="radiant";
  const dueFmt=quest.due?new Date(quest.due).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
  const now=Date.now();
  const overdue=quest.due&&quest.due<now&&!quest.done;
  return (
    <div className={`card quest-${quest.type} ${quest.done?"done":""}`}
      style={{marginBottom:3,borderColor:overdue?"var(--danger)":"var(--primaryb)",background:"var(--primaryf)"}}>
      <button className="chk" style={{color:"var(--primary)",borderColor:"var(--primaryb)"}}
        onClick={()=>onToggle(quest.id)}>
        {quest.done?"✓":""}
      </button>
      <div className="cbody">
        <div className={`ctitle ${quest.done?"done":""}`}>{quest.title}</div>
        <div className="cmeta">
          <span className="ctag" style={{color:"var(--primary)",borderColor:"var(--primaryb)"}}>◆ {isRadiant?"Radiant":"Quest"}</span>
          {qSkills.map(sk=><span key={sk.id} className="ctag" style={{borderColor:sk.color+"44",color:sk.color}}>{sk.icon} {sk.name}</span>)}
          <span className="ctag">{quest.xpVal} {L.xpName}</span>
          {dueFmt&&<span className="ctag" style={{color:overdue?"var(--danger)":"var(--tx3)"}}>{overdue?"⚠ due ":"due "}{dueFmt}</span>}
        </div>
      </div>
    </div>
  );
}

function PlannerTab({period,setPeriod,tasks,weekDays,allTasks,skills,quests,onAddTask,onToggle,onDelete,onEdit,onToggleQuest}){
  const {settings}=useSettings(); const L=settings.labels;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({title:"",skill:"",xpVal:20,questId:""});
  useEffect(()=>{if(skills.length&&!f.skill)setF(v=>({...v,skill:skills[0]?.id||""}));},[skills]);
  const submit=()=>{
    if(!f.title.trim()) return;
    onAddTask({title:f.title.trim(),period,skill:f.skill||null,xpVal:f.xpVal,questId:f.questId||null});
    setF(v=>({...v,title:"",questId:""})); setShowForm(false);
  };
  const activeQuests=(quests||[]).filter(q=>!q.done);

  // Helper: get quests due on a specific dayKey string (YYYY-MM-DD)
  const questsForDay=(dk)=>(quests||[]).filter(q=>q.due&&!q.done&&dayKey(new Date(q.due))===dk);
  const questsForMonth=(year,month)=>(quests||[]).filter(q=>{
    if(!q.due||q.done) return false;
    const d=new Date(q.due); return d.getFullYear()===year&&d.getMonth()===month;
  });
  const todayDk=dayKey(new Date());
  const todayQuests=questsForDay(todayDk);
  const active=tasks.filter(t=>!t.done), done=tasks.filter(t=>t.done);
  return (<>
    <div className="stabs">
      {[L.daily,L.weekly,L.monthly].map((lbl,i)=>(
        <button key={i} className={`stab ${period===PERIODS[i]?"on":""}`} onClick={()=>{setPeriod(PERIODS[i]);setShowForm(false);}}>{lbl}</button>
      ))}
    </div>
    {period==="daily"&&<div className="date-hdr">{todayLabel()}</div>}
    {period==="monthly"&&<div className="date-hdr">{monthLabel()}</div>}
    {period==="weekly"&&<div className="date-hdr">Week of {weekDays[0]?.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
    {showForm?(
      <div className="fwrap">
        <div className="frow"><input className="fi full" placeholder="What needs doing..." autoFocus value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        <div className="frow">
          <select className="fsel" value={f.skill} onChange={e=>setF(v=>({...v,skill:e.target.value}))}>
            <option value="">No skill</option>
            {skills.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
          <select className="fsel" value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:Number(e.target.value)}))}>
            {[5,10,20,30,50,80].map(v=><option key={v} value={v}>{v} {L.xpName}</option>)}
          </select>
          <button className="fsbtn" style={{width:"auto",padding:"7px 12px",marginTop:0}} onClick={()=>setShowForm(false)}>✕</button>
        </div>
        {activeQuests.length>0&&(
          <div className="frow">
            <select className="fsel" style={{flex:1}} value={f.questId} onChange={e=>setF(v=>({...v,questId:e.target.value}))}>
              <option value="">No quest link</option>
              {activeQuests.map(q=><option key={q.id} value={q.id}>◆ {q.title}</option>)}
            </select>
          </div>
        )}
        <button className="fsbtn" onClick={submit}>Add Task</button>
      </div>
    ):<button className="addbtn" onClick={()=>setShowForm(true)}><span>+</span> Add task</button>}
    {period==="weekly"?(weekDays.map((d,i)=>{
      const dk=dayKey(d), isToday=dk===dayKey(new Date()), dt=allTasks.filter(t=>t.dayKey===dk);
      const dq=questsForDay(dk);
      return (
        <div key={i} className="wk-day">
          <div className={`wk-day-lbl ${isToday?"today":""}`}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} {d.getDate()}{isToday?" · today":""}</div>
          {dt.length===0&&dq.length===0?<div style={{fontSize:12,color:"var(--tx3)",paddingLeft:2}}>—</div>:<>
            {dq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest}/>)}
            <div className="clist">{dt.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div>
          </>}
        </div>
      );
    })):(
      <>
        {todayQuests.length>0&&period==="daily"&&<>
          <div className="slbl" style={{marginBottom:6}}>◆ Quests due today</div>
          {todayQuests.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest}/>)}
          {(active.length>0||done.length>0)&&<div className="gap"/>}
        </>}
        {period==="monthly"&&(()=>{
          const now=new Date(); const mq=questsForMonth(now.getFullYear(),now.getMonth());
          return mq.length>0?<><div className="slbl" style={{marginBottom:6}}>◆ Quests this month</div>
            {mq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest}/>)}
            {(active.length>0||done.length>0)&&<div className="gap"/>}</>:null;
        })()}
        {active.length===0&&done.length===0&&todayQuests.length===0&&<div className="empty">No tasks yet</div>}
        <div className="clist">{active.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div>
        {done.length>0&&<><div className="gap"/><div className="slbl">{L.done}</div>
          <div className="clist">{done.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div></>}
      </>
    )}
  </>);
}

function QuestsTab({quests,skills,onAdd,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest}){
  const {settings}=useSettings(); const L=settings.labels;
  const [form,setForm]=useState(null);
  const [search,setSearch]=useState("");
  const [filterPrio,setFilterPrio]=useState("");
  const [f,setF]=useState({title:"",skillIds:[],note:"",dueDate:"",type:"main",priority:"med",color:null});
  const [qXpSug,setQXpSug]=useState(null);
  const [qXpLoad,setQXpLoad]=useState(false);
  const openForm=t=>{ setForm(t); setF({title:"",skillIds:[],note:"",dueDate:"",type:t,priority:"med",color:null}); setQXpSug(null); };
  const toggleQSkill=id=>setF(v=>{const next=v.skillIds.includes(id)?v.skillIds.filter(x=>x!==id):[...v.skillIds,id];const auto=next.length>0?(skills.find(s=>s.id===next[0])?.color)||null:null;return {...v,skillIds:next,color:v.color!==null?v.color:auto};});
  const submit=()=>{
    if(!f.title.trim()) return;
    const due=f.dueDate?new Date(f.dueDate+"T09:00").getTime():null;
    onAdd({title:f.title.trim(),type:form,skills:f.skillIds,note:f.note.trim(),due,priority:f.priority,color:f.color||null});
    setForm(null); setQXpSug(null);
  };
  const suggestNewQuestXp=async()=>{
    if(!f.title.trim()) return;
    setQXpLoad(true); setQXpSug(null);
    const typeLabel=form==="main"?"main quest":form==="side"?"side quest":"radiant/repeatable quest";
    try{
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:`Quest in a gamified life tracker: "${f.title}"${f.note?`. Intention: "${f.note}"`:""}. Type: ${typeLabel}. Suggest fair XP (main=60-120, side=30-70, radiant=20-40 per run). Reply ONLY with JSON, no markdown: {"xp": NUMBER, "reason": "one short sentence"}`}]})});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"";
      const m=txt.match(/\{[\s\S]*\}/);
      if(m) setQXpSug(JSON.parse(m[0]));
    }catch(e){setQXpSug({xp:null,reason:"Couldn't reach AI."});}
    setQXpLoad(false);
  };
  const filterQ=q=>{
    if(search&&!q.title.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterPrio&&q.priority!==filterPrio) return false;
    return true;
  };
  const mainA=quests.filter(q=>q.type==="main"&&!q.done&&filterQ(q));
  const mainD=quests.filter(q=>q.type==="main"&&q.done&&filterQ(q));
  const side=quests.filter(q=>q.type==="side"&&filterQ(q));
  const radiant=quests.filter(q=>q.type==="radiant"&&filterQ(q));
  return (<>
    <div className="search-row">
      <input className="search-input" placeholder="Search quests..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select className="fsel" style={{width:"auto"}} value={filterPrio} onChange={e=>setFilterPrio(e.target.value)}>
        <option value="">All</option>
        <option value="high">High</option>
        <option value="med">Med</option>
        <option value="low">Low</option>
      </select>
    </div>
    <div className="slbl">{L.mainQuest}s</div>
    {form==="main"?(<div className="fwrap">
      <div className="frow"><input className="fi full" autoFocus placeholder="Quest title..." value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      {skills.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {skills.map(s=><button key={s.id} onClick={()=>toggleQSkill(s.id)} style={{background:f.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${f.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:f.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>{s.icon} {s.name}</button>)}
      </div>}
      <div className="frow">
        <select className="fsel" value={f.priority} onChange={e=>setF(v=>({...v,priority:e.target.value}))}>
          <option value="high">⬤ High</option>
          <option value="med">⬤ Med</option>
          <option value="low">⬤ Low</option>
        </select>
        <input className="fi" type="date" style={{colorScheme:"dark",width:140}} value={f.dueDate} onChange={e=>setF(v=>({...v,dueDate:e.target.value}))}/>
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setForm(null)}>✕</button>
      </div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:44,fontFamily:"inherit",fontSize:12,marginBottom:4,width:"100%",boxSizing:"border-box"}}/>
      <div style={{marginBottom:6}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setF(v=>({...v,color:c}))} style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"2px solid var(--tx)":"2px solid transparent",flexShrink:0}}/>)}
          <div onClick={()=>setF(v=>({...v,color:null}))} style={{width:18,height:18,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!f.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Auto from skill">∅</div>
        </div>
      </div>
            <button className="fsbtn secondary" style={{marginBottom:4}} onClick={suggestNewQuestXp} disabled={qXpLoad||!f.title.trim()}>
        {qXpLoad?"thinking...":"⟡ AI XP opinion"}
      </button>
      {qXpSug&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
        {qXpSug.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>+{qXpSug.xp} XP</span> — {qXpSug.reason}</>:qXpSug.reason}
      </div>}
            <button className="fsbtn" onClick={submit}>{`Accept · +${L.mainXp} ${L.xpName}`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("main")}><span>+</span> New {L.mainQuest.toLowerCase()}</button>}
    <div className="clist">{mainA.map(q=><QuestCard key={q.id} quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest}/>)}</div>
    {mainD.length>0&&<><div className="gap"/><div className="slbl">{L.completed}</div>
      <div className="clist">{mainD.map(q=><QuestCard key={q.id} quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest}/>)}</div></>}
    {quests.filter(q=>q.type==="main").length===0&&form!=="main"&&<div className="empty">No {L.mainQuest.toLowerCase()}s yet</div>}
    <div className="gap"/>
    <div className="slbl">{L.sideQuest}s</div>
    <p style={{fontSize:12,color:"var(--tx2)",fontStyle:"italic",marginBottom:12,lineHeight:1.5}}>Optional objectives. Complete for bonus XP, no pressure.</p>
    {form==="side"?(<div className="fwrap">
      <div className="frow"><input className="fi full" autoFocus placeholder="Quest title..." value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      {skills.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {skills.map(s=><button key={s.id} onClick={()=>toggleQSkill(s.id)} style={{background:f.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${f.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:f.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>{s.icon} {s.name}</button>)}
      </div>}
      <div className="frow">
        <select className="fsel" value={f.priority} onChange={e=>setF(v=>({...v,priority:e.target.value}))}>
          <option value="high">⬤ High</option>
          <option value="med">⬤ Med</option>
          <option value="low">⬤ Low</option>
        </select>
        <input className="fi" type="date" style={{colorScheme:"dark",width:140}} value={f.dueDate} onChange={e=>setF(v=>({...v,dueDate:e.target.value}))}/>
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setForm(null)}>✕</button>
      </div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:44,fontFamily:"inherit",fontSize:12,marginBottom:4,width:"100%",boxSizing:"border-box"}}/>
      <div style={{marginBottom:6}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setF(v=>({...v,color:c}))} style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"2px solid var(--tx)":"2px solid transparent",flexShrink:0}}/>)}
          <div onClick={()=>setF(v=>({...v,color:null}))} style={{width:18,height:18,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!f.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Auto from skill">∅</div>
        </div>
      </div>
            <button className="fsbtn secondary" style={{marginBottom:4}} onClick={suggestNewQuestXp} disabled={qXpLoad||!f.title.trim()}>
        {qXpLoad?"thinking...":"⟡ AI XP opinion"}
      </button>
      {qXpSug&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
        {qXpSug.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>+{qXpSug.xp} XP</span> — {qXpSug.reason}</>:qXpSug.reason}
      </div>}
            <button className="fsbtn secondary" onClick={submit}>{`Accept · +${L.sideXp} ${L.xpName}`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("side")}><span>+</span> New {L.sideQuest.toLowerCase()}</button>}
    <div className="clist">{side.map(q=><QuestCard key={q.id} quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest}/>)}</div>
    {side.length===0&&form!=="side"&&<div className="empty">No {L.sideQuest.toLowerCase()}s yet</div>}
    <div className="gap"/>
    <div className="slbl">{L.radiantQuest}s</div>
    <p style={{fontSize:12,color:"var(--tx2)",fontStyle:"italic",marginBottom:12,lineHeight:1.5}}>{L.radiantDesc}</p>
    {form==="radiant"?(<div className="fwrap">
      <div className="frow"><input className="fi full" autoFocus placeholder="Quest title..." value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      {skills.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {skills.map(s=><button key={s.id} onClick={()=>toggleQSkill(s.id)} style={{background:f.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${f.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:f.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>{s.icon} {s.name}</button>)}
      </div>}
      <div className="frow">
        <select className="fsel" value={f.priority} onChange={e=>setF(v=>({...v,priority:e.target.value}))}>
          <option value="high">⬤ High</option>
          <option value="med">⬤ Med</option>
          <option value="low">⬤ Low</option>
        </select>
        <input className="fi" type="date" style={{colorScheme:"dark",width:140}} value={f.dueDate} onChange={e=>setF(v=>({...v,dueDate:e.target.value}))}/>
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setForm(null)}>✕</button>
      </div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:44,fontFamily:"inherit",fontSize:12,marginBottom:4,width:"100%",boxSizing:"border-box"}}/>
      <div style={{marginBottom:6}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setF(v=>({...v,color:c}))} style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"2px solid var(--tx)":"2px solid transparent",flexShrink:0}}/>)}
          <div onClick={()=>setF(v=>({...v,color:null}))} style={{width:18,height:18,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!f.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Auto from skill">∅</div>
        </div>
      </div>
            <button className="fsbtn secondary" style={{marginBottom:4}} onClick={suggestNewQuestXp} disabled={qXpLoad||!f.title.trim()}>
        {qXpLoad?"thinking...":"⟡ AI XP opinion"}
      </button>
      {qXpSug&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
        {qXpSug.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>+{qXpSug.xp} XP</span> — {qXpSug.reason}</>:qXpSug.reason}
      </div>}
            <button className="fsbtn secondary" onClick={submit}>{`Commit · +${L.radiantXp} ${L.xpName} per completion`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("radiant")}><span>+</span> New {L.radiantQuest.toLowerCase()}</button>}
    <div className="clist">{radiant.map(q=><QuestCard key={q.id} quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest}/>)}</div>
    {radiant.length===0&&form!=="radiant"&&<div className="empty">No {L.radiantQuest.toLowerCase()}s yet</div>}
  </>);
}

const SKILL_ICONS_EXTRA = ["◈","◉","◎","◆","◬","✦","◌","◊","△","○","□","◇","❋","⊕","◐","◑","⬡","✧","⟡","◿","⚔","🧠","💪","🎯","🎨","📚","🎵","🌱","⚡","🔥","💎","🏆","🎭","🔬","🌟","✍","🎸","🏋","🧘","💻","🗺","🎲","⚙","🛡","🌊","🦾","🧩","🎤","📖","🌙"];

function SkillsTab({skills,skPerLv,streaks,meds,xpLog,onAdd,onAddBatch,onDelete,onEdit,onReorder,onLink}){
  const {settings}=useSettings(); const L=settings.labels;
  const mainSkills=skills.filter(s=>s.type!=="subskill");
  const subSkills=skills.filter(s=>s.type==="subskill");

  // view state
  const [viewMode,setViewMode]=useState("grid");
  const [expandedId,setExpandedId]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [ef,setEf]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],customImg:null});

  // add form state (shared, type toggled)
  const [showForm,setShowForm]=useState(false);
  const [formType,setFormType]=useState("skill");
  const [showPresets,setShowPresets]=useState(false);
  const [f,setF]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],startLevel:1,customImg:null});

  // drag state — two modes:
  //   "reorder": dragging within same section to reorder
  //   "link":    dragging a subskill onto a skill to link/unlink
  const [dragId,setDragId]=useState(null);
  const [dragType,setDragType]=useState(null); // "skill"|"subskill"
  const [dragOverId,setDragOverId]=useState(null);
  const [linkTarget,setLinkTarget]=useState(null); // skill id being hovered for linking

  // 14-day activity map
  const activityMap=useMemo(()=>{
    const map={}; const now=Date.now(); const DAY=86400000;
    skills.forEach(s=>{
      const days=[];
      for(let i=13;i>=0;i--){
        const ds=new Date(now-i*DAY); ds.setHours(0,0,0,0);
        const de=new Date(ds); de.setHours(23,59,59,999);
        const mins=meds.filter(m=>(m.skillIds||[]).includes(s.id)&&m.created>=ds.getTime()&&m.created<=de.getTime()).reduce((a,m)=>a+m.dur,0);
        days.push(mins);
      }
      map[s.id]=days;
    });
    return map;
  },[skills,meds]);

  const submit=()=>{
    if(!f.name.trim()) return;
    const startXp=(Math.max(1,Number(f.startLevel)||1)-1)*skPerLv;
    onAdd({name:f.name.trim(),icon:f.icon,color:f.color,startXp,customImg:f.customImg||null,type:formType,parentIds:[]});
    setF({name:"",icon:"◈",color:SKILL_COLORS[0],startLevel:1,customImg:null}); setShowForm(false);
  };
  const openEdit=s=>{setEf({name:s.name,icon:s.icon,color:s.color,customImg:s.customImg||null});setEditingId(s.id);};
  const submitEdit=()=>{
    if(!ef.name.trim()) return;
    onEdit(editingId,{name:ef.name.trim(),icon:ef.icon,color:ef.color,customImg:ef.customImg||null});
    setEditingId(null);
  };
  const handleImg=(e,setter)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setter(v=>({...v,customImg:ev.target.result,icon:"img"}));
    reader.readAsDataURL(file);
  };
  const applyPreset=async p=>{
    await onAddBatch(p.skills.map(s=>({name:s.name,icon:s.icon,color:s.color,startXp:0})));
    setShowPresets(false);
  };

  // ── drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart=(e,id,type)=>{
    setDragId(id); setDragType(type);
    e.dataTransfer.effectAllowed="move";
    setTimeout(()=>{const el=document.getElementById("sk-"+id);if(el)el.style.opacity="0.35";},0);
  };
  const handleDragEnd=()=>{
    const el=document.getElementById("sk-"+dragId);if(el)el.style.opacity="1";
    setDragId(null); setDragType(null); setDragOverId(null); setLinkTarget(null);
  };
  const handleDragOverSkill=(e,id)=>{
    e.preventDefault();
    if(dragType==="subskill") setLinkTarget(id);
    else setDragOverId(id);
  };
  const handleDragOverSub=(e,id)=>{
    e.preventDefault();
    if(dragType==="subskill") setDragOverId(id);
  };
  const handleDropOnSkill=(e,targetId)=>{
    e.preventDefault();
    if(dragType==="subskill"&&dragId&&targetId){
      onLink(dragId,targetId); // toggle link
    } else if(dragType==="skill"&&dragId&&dragId!==targetId){
      const arr=[...mainSkills];
      const from=arr.findIndex(s=>s.id===dragId);
      const to=arr.findIndex(s=>s.id===targetId);
      if(from!==-1&&to!==-1){const [m]=arr.splice(from,1);arr.splice(to,0,m);onReorder([...arr,...subSkills]);}
    }
    handleDragEnd();
  };
  const handleDropOnSub=(e,targetId)=>{
    e.preventDefault();
    if(dragType==="subskill"&&dragId&&dragId!==targetId){
      const arr=[...subSkills];
      const from=arr.findIndex(s=>s.id===dragId);
      const to=arr.findIndex(s=>s.id===targetId);
      if(from!==-1&&to!==-1){const [m]=arr.splice(from,1);arr.splice(to,0,m);onReorder([...mainSkills,...arr]);}
    }
    handleDragEnd();
  };

  // ── shared form renderer ───────────────────────────────────────────────────
  const renderForm=()=>(<div className="fwrap">
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      {["skill","subskill"].map(t=>(
        <button key={t} onClick={()=>setFormType(t)}
          style={{flex:1,padding:"6px 0",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",
            background:formType===t?"var(--primary)":"var(--bg)",color:formType===t?"#000":"var(--tx3)",
            border:`1px solid ${formType===t?"var(--primary)":"var(--b2)"}`,borderRadius:3,cursor:"pointer"}}>
          {t}
        </button>
      ))}
    </div>
    <div className="frow"><input className="fi full" placeholder={formType==="subskill"?"e.g. Breathwork, HIIT, Focus blocks...":"e.g. Guitar, Spanish, CS2..."} autoFocus value={f.name} onChange={e=>setF(v=>({...v,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
    {formType==="skill"&&<div className="frow" style={{alignItems:"center",gap:8}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--tx3)",flexShrink:0}}>Starting {L.levelName}</div>
      <input className="fi" type="number" min={1} max={99} style={{maxWidth:65,textAlign:"center"}} value={f.startLevel} onChange={e=>setF(v=>({...v,startLevel:e.target.value}))}/>
      <div style={{fontSize:11,color:"var(--tx3)",fontStyle:"italic",flex:1}}>{Number(f.startLevel)>1?`Pre-loads ${((Number(f.startLevel)||1)-1)*skPerLv} ${L.xpName}`:"Starting fresh"}</div>
    </div>}
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:7,marginTop:4}}>Icon</div>
    <div className="icon-grid">{SKILL_ICONS_EXTRA.map(ic=><button key={ic} className={`icon-opt ${f.icon===ic?"on":""}`} onClick={()=>setF(v=>({...v,icon:ic,customImg:null}))}>{ic}</button>)}</div>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Or upload image</div>
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
      {f.customImg?<img src={f.customImg} style={{width:32,height:32,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>:<span style={{fontSize:11,color:"var(--tx3)"}}>No image</span>}
      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e,setF)}/>
      <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
      {f.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,customImg:null,icon:"◈"}))}>✕</button>}
    </label>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:7}}>Color</div>
    <div className="color-grid">{SKILL_COLORS.map(c=><div key={c} className={`color-opt ${f.color===c?"on":""}`} style={{background:c}} onClick={()=>setF(v=>({...v,color:c}))}/>)}</div>
    <button className="fsbtn" onClick={submit}>Create {formType}</button>
  </div>);

  // ── skill card renderer ────────────────────────────────────────────────────
  const renderSkillCard=(s,i,section)=>{
    const lv=skillLv(s.xp,skPerLv),pg=skillProg(s.xp,skPerLv),cur=s.xp%skPerLv;
    const streak=streaks[s.id]||{count:0}; const mult=getMultiplier(streak.count);
    const days=activityMap[s.id]||[]; const maxMins=Math.max(...days,1);
    const isExpanded=expandedId===s.id;
    const isLinkHover=linkTarget===s.id&&dragType==="subskill";
    const isReorderHover=dragOverId===s.id&&dragType===section;
    const linked=section==="skill"?subSkills.filter(ss=>(ss.parentIds||[]).includes(s.id)):[];
    const parents=section==="subskill"?(s.parentIds||[]).map(pid=>skills.find(sk=>sk.id===pid)).filter(Boolean):[];

    if(viewMode==="list"){
      return (
        <div key={s.id} id={"sk-"+s.id}
          draggable onDragStart={e=>handleDragStart(e,s.id,section)}
          onDragOver={e=>section==="skill"?handleDragOverSkill(e,s.id):handleDragOverSub(e,s.id)}
          onDrop={e=>section==="skill"?handleDropOnSkill(e,s.id):handleDropOnSub(e,s.id)}
          onDragEnd={handleDragEnd}
          onClick={()=>setExpandedId(isExpanded?null:s.id)}
          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
            background:"var(--s1)",border:`1px solid ${isLinkHover?s.color:isReorderHover?s.color+"44":"var(--b1)"}`,
            borderRadius:"var(--r)",marginBottom:4,cursor:"pointer",transition:"border-color .15s",
            borderStyle:isLinkHover?"dashed":"solid"}}>
          <span style={{color:"var(--tx3)",fontSize:9,flexShrink:0}}>⠿</span>
          {s.customImg?<img src={s.customImg} style={{width:14,height:14,borderRadius:2,objectFit:"cover"}}/>:<span style={{color:s.color,fontSize:13,flexShrink:0}}>{s.icon}</span>}
          <span style={{flex:1,fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx)"}}>{s.name}</span>
          {streak.count>=3&&<span className="sk-streak" style={{fontSize:8}}>{streak.count}d{mult>1?` ${mult}×`:""}</span>}
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",flexShrink:0}}>{L.levelName} {lv}</span>
          <div style={{width:60,height:4,background:"var(--b1)",borderRadius:2,flexShrink:0}}>
            <div style={{width:`${pg}%`,height:"100%",background:s.color,borderRadius:2}}/>
          </div>
          {section==="subskill"&&parents.length>0&&<div style={{display:"flex",gap:3}}>
            {parents.map(p=><span key={p.id} style={{color:p.color,fontSize:10}} title={p.name}>{p.icon}</span>)}
          </div>}
          <button className="sk-delbtn" style={{marginLeft:2}} onClick={e=>{e.stopPropagation();openEdit(s);}}>✎</button>
          <button className="sk-delbtn" onClick={e=>{e.stopPropagation();onDelete(s.id);}}>✕</button>
        </div>
      );
    }

    // grid card
    return (
      <div key={s.id} id={"sk-"+s.id}
        draggable onDragStart={e=>handleDragStart(e,s.id,section)}
        onDragOver={e=>section==="skill"?handleDragOverSkill(e,s.id):handleDragOverSub(e,s.id)}
        onDrop={e=>section==="skill"?handleDropOnSkill(e,s.id):handleDropOnSub(e,s.id)}
        onDragEnd={handleDragEnd}
        style={{transition:"transform .12s",transform:isReorderHover?(i<(dragOverId?mainSkills.findIndex(x=>x.id===dragOverId):0)?"translateY(-4px)":"translateY(4px)"):"none"}}>
        <div className="skill-card" style={{borderColor:isLinkHover?s.color:isReorderHover?s.color+"44":"",borderStyle:isLinkHover?"dashed":"solid",cursor:"default"}}>
          <div className="sk-hdr">
            <div className="sk-name" style={{gap:5}}>
              <span style={{color:"var(--tx3)",fontSize:9,cursor:"grab",userSelect:"none",flexShrink:0}} title="Drag to reorder">⠿</span>
              {s.customImg?<img src={s.customImg} style={{width:14,height:14,borderRadius:2,objectFit:"cover"}}/>:<span style={{color:s.color,fontSize:14}}>{s.icon}</span>}
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
            </div>
            <div className="sk-meta">
              {streak.count>=3&&<span className="sk-streak">{streak.count}d{mult>1?` ${mult}×`:""}</span>}
              <div className="sk-lv">{L.levelName} <span>{lv}</span></div>
              <button className="sk-delbtn" style={{marginLeft:2}} onClick={()=>openEdit(s)}>✎</button>
              <button className="sk-delbtn" onClick={()=>onDelete(s.id)}>✕</button>
            </div>
          </div>
          <div className="sk-bar-wrap"><div className="sk-bar" style={{width:`${pg}%`,background:s.color}}/></div>
          <div className="sk-xprow">
            <span className="sk-xplbl">{cur}/{skPerLv} {L.xpName}</span>
            <span className="sk-xplbl">{s.xp} total</span>
          </div>
          {/* parent tags for subskills */}
          {section==="subskill"&&(<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:5}}>
            {parents.length===0
              ? <span style={{fontSize:9,color:"var(--tx3)",fontStyle:"italic"}}>not linked — drag onto a skill</span>
              : parents.map(p=><span key={p.id} style={{fontSize:9,color:p.color,background:p.color+"18",border:`1px solid ${p.color}44`,borderRadius:10,padding:"1px 6px"}}>{p.icon} {p.name}</span>)}
          </div>)}
          {/* expand toggle */}
          <button onClick={()=>setExpandedId(isExpanded?null:s.id)}
            style={{background:"none",border:"none",width:"100%",textAlign:"center",color:"var(--tx3)",fontSize:9,cursor:"pointer",padding:"4px 0 0",letterSpacing:1}}>
            {isExpanded?"▲ less":"▼ more"}
          </button>
          {isExpanded&&(<div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--b1)"}}>
            {/* 14-day chart */}
            <div style={{display:"flex",alignItems:"flex-end",gap:2,height:24}}>
              {days.map((m,di)=>{
                const h=m===0?2:Math.max(4,Math.round((m/maxMins)*22));
                return <div key={di} title={`${m}min`} style={{flex:1,height:h,borderRadius:1,background:di===13?s.color:s.color+"55",transition:"height .2s"}}/>;
              })}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginTop:2,marginBottom:6,textAlign:"right"}}>14d activity</div>
            {/* linked items */}
            {section==="skill"&&linked.length>0&&(<>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",color:"var(--tx3)",marginBottom:4}}>Subskills</div>
              {linked.map(ss=><div key={ss.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",borderBottom:"1px solid var(--b1)"}}>
                <span style={{color:ss.color,fontSize:11}}>{ss.icon}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx2)",flex:1}}>{ss.name}</span>
                <button onClick={()=>onLink(ss.id,s.id)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:9}} title="Unlink">✕</button>
              </div>)}
            </>)}
            {section==="skill"&&linked.length===0&&<div style={{fontSize:9,color:"var(--tx3)",fontStyle:"italic"}}>No subskills linked. Drag a subskill here.</div>}
          </div>)}
        </div>
      </div>
    );
  };

  return (<>
    <div className="slbl">{L.skillsTab}</div>
    <div className="sk-quote">
      <div className="sk-quote-text">"Every shortcut you take, every session you skip, every number you inflate — you're not fooling the system. You're just lying to the only person whose opinion of you actually matters."</div>
      <div className="sk-quote-attr">— The only opponent on this stat sheet is you</div>
    </div>
    {/* toolbar */}
    <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
      {!showForm&&<><button className="addbtn" style={{flex:1,margin:0}} onClick={()=>{setFormType("skill");setShowForm(true);}}><span>+</span> Skill</button>
      <button className="addbtn" style={{flex:1,margin:0,borderColor:"var(--b2)",color:"var(--tx3)"}} onClick={()=>{setFormType("subskill");setShowForm(true);}}><span>+</span> Subskill</button>
      <button className="addbtn" style={{flex:"none",margin:0,padding:"0 10px",borderColor:"var(--b2)",color:"var(--tx3)"}} onClick={()=>setShowPresets(v=>!v)}>presets</button></>}
      <button onClick={()=>setViewMode(v=>v==="grid"?"list":"grid")}
        style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",flexShrink:0}}>
        {viewMode==="grid"?"≡ list":"▦ grid"}
      </button>
    </div>

    {showForm&&<>{renderForm()}<button className="fsbtn" style={{marginTop:4}} onClick={()=>setShowForm(false)}>Cancel</button></>}

    {showPresets&&!showForm&&(
      <div className="fwrap" style={{marginBottom:10}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:10}}>Skill presets</div>
        {SKILL_PRESETS.map(p=>(
          <div key={p.name} style={{background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:4,padding:"10px 12px",marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,color:"var(--tx2)",marginBottom:7}}>{p.name}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{p.skills.map(s=><span key={s.name} style={{color:s.color,fontSize:11}}>{s.icon} {s.name}</span>)}</div>
            <button className="fsbtn secondary" style={{margin:0,padding:"6px 12px",width:"auto",fontSize:10}} onClick={()=>applyPreset(p)}>Add these skills</button>
          </div>
        ))}
        <button className="fsbtn" style={{marginTop:4}} onClick={()=>setShowPresets(false)}>Close</button>
      </div>
    )}

    {/* edit form */}
    {editingId&&(()=>{
      const es=skills.find(s=>s.id===editingId); if(!es) return null;
      return (<div className="fwrap" style={{marginBottom:12}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:10}}>Edit {es.type||"skill"}</div>
        <input className="fi full" value={ef.name} onChange={e=>setEf(v=>({...v,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitEdit()}/>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:7,marginTop:8}}>Icon</div>
        <div className="icon-grid">{SKILL_ICONS_EXTRA.map(ic=><button key={ic} className={`icon-opt ${ef.icon===ic?"on":""}`} onClick={()=>setEf(v=>({...v,icon:ic,customImg:null}))}>{ic}</button>)}</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Or upload image</div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
          {ef.customImg?<img src={ef.customImg} style={{width:32,height:32,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>:<span style={{fontSize:11,color:"var(--tx3)"}}>No image</span>}
          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e,setEf)}/>
          <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
          {ef.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setEf(v=>({...v,customImg:null,icon:"◈"}))}>✕ clear</button>}
        </label>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:7}}>Color</div>
        <div className="color-grid">{SKILL_COLORS.map(c=><div key={c} className={`color-opt ${ef.color===c?"on":""}`} style={{background:c}} onClick={()=>setEf(v=>({...v,color:c}))}/>)}</div>
        <div style={{display:"flex",gap:6}}>
          <button className="fsbtn" style={{flex:1,marginTop:4}} onClick={submitEdit}>Save</button>
          <button className="fsbtn" style={{flex:"none",width:"auto",padding:"8px 12px",marginTop:4}} onClick={()=>setEditingId(null)}>Cancel</button>
        </div>
      </div>);
    })()}

    {/* ── SKILLS section ───────────────────────────────────────────── */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)"}}>Skills</div>
      <div style={{fontSize:9,color:"var(--tx3)"}}>{mainSkills.length} total</div>
    </div>
    {mainSkills.length===0&&!showForm&&<div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:12,textAlign:"center",marginBottom:10,fontSize:11,color:"var(--tx3)"}}>No skills yet — create one above or load a preset</div>}
    <div style={viewMode==="grid"?{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}:{marginBottom:16}}>
      {mainSkills.map((s,i)=>renderSkillCard(s,i,"skill"))}
    </div>

    {/* ── SUBSKILLS section ─────────────────────────────────────────── */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,marginTop:4}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)"}}>Subskills</div>
      <div style={{fontSize:9,color:"var(--tx3)"}}>{subSkills.length} total · drag onto a skill to link</div>
    </div>
    {subSkills.length===0&&<div style={{background:"var(--s1)",border:"1px dashed var(--b1)",borderRadius:"var(--r)",padding:12,textAlign:"center",marginBottom:10,fontSize:11,color:"var(--tx3)"}}>Subskills are cross-disciplinary practices — create one then drag it onto any skill to link XP</div>}
    <div style={viewMode==="grid"?{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}:{marginBottom:12}}>
      {subSkills.map((s,i)=>renderSkillCard(s,i,"subskill"))}
    </div>

    {/* XP log */}
    {xpLog&&xpLog.length>0&&<>
      <div className="gap"/>
      <div className="slbl">Recent XP</div>
      <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"4px 12px"}}>
        {xpLog.slice(0,20).map(e=>(
          <div key={e.id} className="xp-log-row">
            <span className="xp-log-amt">+{e.amt}{e.multiplier>1?` ${e.multiplier}×`:""}</span>
            <span className="xp-log-label">{e.label}</span>
            {e.skill&&<span className="ctag" style={{fontSize:9}}>{e.skill}</span>}
            <span className="xp-log-time">{new Date(e.created).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          </div>
        ))}
      </div>
    </>}
  </>);
}

function PracticeTab({meds,skills,streaks,pending,practiceTypes,onAddType,onDeleteType,onLog,onDelete,onClearPending}){
  const {settings}=useSettings(); const L=settings.labels;
  const ppm=settings.xp.practicePerMin||1;
  const aiEnabled=settings.xp.aiScoring!==false;
  const [showForm,setShowForm]=useState(false);
  const [showTypeForm,setShowTypeForm]=useState(false);
  const [scoring,setScoring]=useState(false);
  const [xpPreview,setXpPreview]=useState(null);
  const [xpPrevLoad,setXpPrevLoad]=useState(false);
  const [newType,setNewType]=useState({label:"",icon:"◎"});
  const [f,setF]=useState({typeId:"",skillIds:[],subskillId:null,dur:15,note:"",sessionDate:"",sessionTime:"",showDate:false});

  const toggleSkill=id=>setF(v=>({...v,skillIds:v.skillIds.includes(id)?v.skillIds.filter(s=>s!==id):[...v.skillIds,id]}));

  useEffect(()=>{
    if(practiceTypes.length&&!f.typeId) setF(v=>({...v,typeId:practiceTypes[0].id}));
  },[practiceTypes]);

  useEffect(()=>{
    if(pending){
      const sids=pending.skillId?[pending.skillId]:[];
      setF(v=>({...v,skillIds:sids}));
      setShowForm(true);
    }
  },[pending]);

  const submit=async()=>{
    if(!f.typeId) return;
    const ptype=practiceTypes.find(t=>t.id===f.typeId);
    let baseXp=f.dur*ppm, aiReason=null;
    if(f.note.trim()&&aiEnabled){
      setScoring(true);
      try{
        const skNames=f.skillIds.map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean).join(", ")||"General";
        const res=await fetch("/api/chat",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:80,
            messages:[{role:"user",content:`Score a practice session for XP. Time-based would be ${baseXp}.\nType: ${ptype?.label}, Duration: ${f.dur}min, Skills: ${skNames}\nJournal: "${f.note}"\nReturn JSON only, no markdown: {"xp":number,"reason":"12 words max"}`}]
          })
        });
        const data=await res.json();
        const _ptxt=data.choices?.[0]?.message?.content||"{}";
        const parsed=JSON.parse(_ptxt.replace(/```json|```/g,"").trim());
        if(parsed.xp) baseXp=Math.max(1,Math.round(parsed.xp));
        if(parsed.reason) aiReason=parsed.reason;
      }catch{}
      setScoring(false);
    }
    let sessionDate=null;
    if(f.showDate&&f.sessionDate) sessionDate=new Date(`${f.sessionDate}${f.sessionTime?"T"+f.sessionTime:"T12:00"}`).getTime();
    await onLog({type:f.typeId,skillIds:f.skillIds,subskillId:f.subskillId,dur:f.dur,note:f.note.trim(),baseXp,aiReason,sessionDate});
    setF(v=>({...v,note:"",sessionDate:"",sessionTime:"",showDate:false}));
    setShowForm(false);
  };

  const previewXp=async()=>{
    const ptype=practiceTypes.find(t=>t.id===f.typeId);
    if(!ptype) return;
    setXpPrevLoad(true); setXpPreview(null);
    const baseXp=f.dur*ppm;
    const skNames=f.skillIds.map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean).join(", ")||"General";
    try{
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:100,
          messages:[{role:"user",content:`Evaluate a practice session for a gamified life tracker. Time-based XP would be ${baseXp}.
Type: ${ptype.label}, Duration: ${f.dur}min, Skills: ${skNames}${f.note.trim()?`
Journal: "${f.note}"`:""}
Suggest fair XP and a short reason. Reply ONLY with JSON, no markdown: {"xp": NUMBER, "reason": "max 15 words"}`}]})});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"";
      const m=txt.match(/\{[\s\S]*\}/);
      if(m) setXpPreview(JSON.parse(m[0]));
      else setXpPreview({xp:baseXp,reason:"Couldn't parse AI response."});
    }catch(e){setXpPreview({xp:null,reason:"Couldn't reach AI."});}
    setXpPrevLoad(false);
  };
  const submitNewType=async()=>{
    if(!newType.label.trim()) return;
    await onAddType({label:newType.label.trim(),icon:newType.icon});
    setNewType({label:"",icon:"◎"}); setShowTypeForm(false);
  };

  const [analysisOpen,setAnalysisOpen]=useState(false);
  const [analysis,setAnalysis]=useState(null);
  const [analysing,setAnalysing]=useState(false);

  const runAnalysis=async()=>{
    setAnalysing(true); setAnalysisOpen(true);
    try{
      const recent=meds.slice(0,30);
      const summary=recent.map(m=>{
        const ptype=practiceTypes.find(t=>t.id===m.type)||{label:m.type};
        const skNames=(m.skillIds||[]).map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean).join(", ");
        return `${ptype.label} ${m.dur}min${skNames?" ("+skNames+")":""}${m.note?" — "+m.note.slice(0,60):""}`;
      }).join("\n");
      const totalMinsA=recent.reduce((a,m)=>a+m.dur,0);
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,
          messages:[{role:"user",content:`Analyze these practice sessions and give honest, direct feedback in 3-4 sentences. Note patterns, gaps, what's working, and one concrete suggestion. Be specific, not generic.\n\nTotal: ${recent.length} sessions, ${totalMinsA} minutes\n\n${summary}`}]
        })
      });
      const data=await res.json();
      setAnalysis(data.choices?.[0]?.message?.content||"No analysis returned.");
    }catch{ setAnalysis("Analysis failed — check your connection."); }
    setAnalysing(false);
  };

  const primary=f.skillIds[0]||null;
  const streak=streaks[primary]||{count:0}; const mult=getMultiplier(streak.count);
  const estXp=Math.round(f.dur*ppm*mult);
  const totalMins=meds.reduce((a,m)=>a+m.dur,0);

  return (<>
    <div className="stats">
      <div className="sbox"><div className="snum">{meds.length}</div><div className="slb2">Sessions</div></div>
      <div className="sbox"><div className="snum">{totalMins}</div><div className="slb2">Minutes</div></div>
      <div className="sbox"><div className="snum">{practiceTypes.length}</div><div className="slb2">Types</div></div>
    </div>
    {pending&&!showForm&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",padding:"12px",marginBottom:12}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--secondary)",marginBottom:5}}>◉ Log your session</div>
        <div style={{fontSize:13,color:"var(--tx2)",marginBottom:10}}>Completed: {pending.questTitle}</div>
        <div style={{display:"flex",gap:6}}>
          <button className="fsbtn secondary" style={{margin:0}} onClick={()=>setShowForm(true)}>Log session</button>
          <button className="fsbtn" style={{margin:0,width:"auto",padding:"8px 12px"}} onClick={onClearPending}>Skip</button>
        </div>
      </div>
    )}
    {showForm?(
      <div className="fwrap">
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:8}}>Practice type</div>
        <div className="type-grid">
          {practiceTypes.map(t=>(
            <button key={t.id} className={`topt ${f.typeId===t.id?"on":""}`} onClick={()=>setF(v=>({...v,typeId:t.id}))}>
              <span>{t.icon}</span><span style={{flex:1,textAlign:"left"}}>{t.label}</span>
              {practiceTypes.length>1&&<span style={{fontSize:9,opacity:.5,marginLeft:2}} onClick={e=>{e.stopPropagation();onDeleteType(t.id);if(f.typeId===t.id)setF(v=>({...v,typeId:practiceTypes.find(x=>x.id!==t.id)?.id||""}));}}>✕</span>}
            </button>
          ))}
          {!showTypeForm&&<button className="topt" style={{borderStyle:"dashed"}} onClick={()=>setShowTypeForm(true)}><span>+</span><span>New type</span></button>}
        </div>
        {showTypeForm&&(
          <div style={{display:"flex",gap:5,marginBottom:8,alignItems:"center"}}>
            <select className="fsel" value={newType.icon} onChange={e=>setNewType(v=>({...v,icon:e.target.value}))}>
              {SKILL_ICONS.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
            <input className="fi" placeholder="Type name..." autoFocus value={newType.label}
              onChange={e=>setNewType(v=>({...v,label:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&submitNewType()}/>
            <button className="fsbtn" style={{width:"auto",padding:"7px 10px",margin:0}} onClick={submitNewType}>Add</button>
            <button className="fsbtn" style={{width:"auto",padding:"7px 10px",margin:0}} onClick={()=>setShowTypeForm(false)}>✕</button>
          </div>
        )}
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5}}>Skills (optional)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
          {skills.filter(s=>s.type!=="subskill").map(s=>(
            <button key={s.id} onClick={()=>toggleSkill(s.id)}
              style={{background:f.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${f.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:f.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>
        {skills.filter(s=>s.type==="subskill").length>0&&<>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:5,marginTop:4}}>Or log a subskill <span style={{fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(XP goes to all linked skills)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {skills.filter(s=>s.type==="subskill").map(s=>{
              const isSelected=f.subskillId===s.id;
              const parents=(s.parentIds||[]).map(pid=>skills.find(sk=>sk.id===pid)).filter(Boolean);
              return (
                <button key={s.id}
                  onClick={()=>setF(v=>({...v,subskillId:isSelected?null:s.id,skillIds:isSelected?v.skillIds:(s.parentIds||[])}))}
                  style={{background:isSelected?s.color+"22":"var(--bg)",border:`1px solid ${isSelected?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:isSelected?s.color:"var(--tx3)",transition:"all .15s",display:"flex",alignItems:"center",gap:4}}>
                  <span>{s.icon} {s.name}</span>
                  {parents.length>0&&<span style={{opacity:.6}}>{parents.map(p=>p.icon).join("")}</span>}
                </button>
              );
            })}
          </div>
        </>}
        <div className="dur-hdr">
          <span>Duration</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" min={1} max={600} value={f.dur}
              onChange={e=>setF(v=>({...v,dur:Math.max(1,Math.min(600,Number(e.target.value)||1))}))}
              style={{width:46,background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:3,color:"var(--tx)",fontSize:11,fontFamily:"'DM Mono',monospace",padding:"2px 5px",textAlign:"center",outline:"none"}}/>
            <span className="dur-val">min · +{estXp} {L.xpName}{mult>1&&<span style={{color:"var(--primary)"}}> · {streak.count}d {mult}×</span>}</span>
          </div>
        </div>
        <input type="range" min={1} max={240} value={Math.min(f.dur,240)} onChange={e=>setF(v=>({...v,dur:Number(e.target.value)}))}/>
        <textarea className="fi full" placeholder={`Journal (optional)${aiEnabled?" — triggers AI scoring":""}...`}
          style={{minHeight:72,resize:"vertical",marginBottom:8}} value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))}/>
        {f.note.trim()&&aiEnabled&&<div className="ai-lbl">✦ Advisor will score this session</div>}
        <button className="exp-tog" onClick={()=>setF(v=>({...v,showDate:!v.showDate}))}>
          <span className={`exp-arr ${f.showDate?"open":""}`}>▼</span>
          <span>{f.showDate&&f.sessionDate?`When: ${f.sessionDate}`:"When was this? (optional)"}</span>
        </button>
        {f.showDate&&(
          <div className="frow" style={{marginTop:6}}>
            <input className="fi" type="date" style={{colorScheme:"dark"}} value={f.sessionDate} onChange={e=>setF(v=>({...v,sessionDate:e.target.value}))}/>
            <input className="fi" type="time" style={{colorScheme:"dark",maxWidth:100}} value={f.sessionTime} onChange={e=>setF(v=>({...v,sessionTime:e.target.value}))}/>
          </div>
        )}
        <button className="fsbtn secondary" style={{marginTop:6,marginBottom:2}} onClick={previewXp} disabled={xpPrevLoad||!f.typeId}>
          {xpPrevLoad?"thinking...":"⟡ AI XP preview"}
        </button>
        {xpPreview&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
          {xpPreview.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>~{xpPreview.xp} XP</span> — {xpPreview.reason}<br/><span style={{fontSize:10,color:"var(--tx3)"}}>Final XP calculated on log (journal scoring may adjust)</span></>:xpPreview.reason}
        </div>}
        <button className="fsbtn secondary" style={{marginTop:4}} onClick={submit} disabled={scoring||!f.typeId}>
          {scoring?"✦ Scoring...":"Log Session"}
        </button>
      </div>
    ):<button className="addbtn" onClick={()=>{onClearPending();setShowForm(true)}}><span>+</span> Log practice session</button>}
    {practiceTypes.length===0&&!showForm&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"16px",textAlign:"center",marginTop:8}}>
        <div style={{fontSize:24,marginBottom:8}}>◉</div>
        <div style={{fontSize:13,color:"var(--tx2)",marginBottom:4}}>No practice types yet</div>
        <div style={{fontSize:11,color:"var(--tx3)",lineHeight:1.6}}>Practice types are the names you give your actual activities — Meditation, Ritual, Study, Training, whatever fits. Create them yourself so logging feels honest, not approximate. Hit Log session above to add your first one.</div>
      </div>
    )}
    <div className="gap"/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div className="slbl" style={{margin:0}}>practice log</div>
      {meds.length>=3&&<button onClick={runAnalysis} disabled={analysing} style={{background:"none",border:"1px solid var(--secondaryb)",borderRadius:4,color:"var(--secondary)",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",padding:"4px 9px",cursor:"pointer",opacity:analysing?.6:1}}>
        {analysing?"analysing...":"✦ analyse"}
      </button>}
    </div>
    {analysisOpen&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"var(--secondary)",marginBottom:8}}>✦ Session analysis</div>
        {analysing?<div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic"}}>Reading your sessions...</div>
          :<div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{analysis}</div>}
        <button onClick={()=>{setAnalysisOpen(false);setAnalysis(null);}} style={{background:"none",border:"none",color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,cursor:"pointer",marginTop:8,padding:0}}>dismiss</button>
      </div>
    )}
    {meds.length===0&&<div className="empty">No sessions logged</div>}
    {meds.map(m=>{
      const ptype=practiceTypes.find(t=>t.id===m.type)||{label:m.type,icon:"◎"};
      const mSkills=(m.skillIds||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
      return <MedCard key={m.id} med={m} ptype={ptype} mSkills={mSkills} onDelete={onDelete}/>;
    })}
  </>);
}

function MedCard({med,ptype,mSkills,onDelete}){
  const {settings}=useSettings(); const L=settings.labels;
  const [expanded,setExpanded]=useState(false);
  const ppm=settings.xp.practicePerMin||1;
  const primaryColor=mSkills[0]?.color||"var(--secondary)";
  return (
    <div className="med-card">
      <div className="med-icon" style={{color:primaryColor}}>{ptype.icon}</div>
      <div className="med-body">
        <div className="med-name">{ptype.label}</div>
        <div className="med-sub">
          {med.dur} min · +{med.xpAwarded||med.dur*ppm} {L.xpName}{med.multiplier>1&&` · ${med.multiplier}×`}
          {mSkills.map(s=><span key={s.id} style={{marginLeft:4,color:s.color}}>{s.icon} {s.name}</span>)}
        </div>
        {med.aiReason&&<div className="med-reason">✦ {med.aiReason}</div>}
        {med.note&&<>
          <div className={`med-journal ${expanded?"exp":""}`}>{med.note}</div>
          <button className="jrnl-btn" onClick={()=>setExpanded(e=>!e)}>{expanded?"▲ less":"▼ more"}</button>
        </>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{fmtDate(med.created)}</div>
        <button className="delbtn" onClick={()=>onDelete(med.id)}>✕</button>
      </div>
    </div>
  );
}

function buildAdvisorTools(skills,quests){
  const sn=skills.map(s=>`${s.id}=${s.name}`).join(",")||"none";
  const qn=(quests||[]).filter(q=>!q.done).map(q=>`${q.id}="${q.title}"`).join(",")||"none";
  return [
    {name:"add_quest",description:"Add a new quest",input_schema:{type:"object",properties:{title:{type:"string"},type:{type:"string",enum:["main","radiant"]},skillId:{type:"string",description:`Optional skills: ${sn}`},note:{type:"string"},dueDate:{type:"string"},dueTime:{type:"string"}},required:["title","type"]}},
    {name:"update_quest",description:`Update an existing quest — set due date, change title, add a note. Active quests: ${qn}`,input_schema:{type:"object",properties:{questId:{type:"string",description:"ID of quest to update"},dueDate:{type:"string",description:"YYYY-MM-DD"},dueTime:{type:"string",description:"HH:MM (optional)"},title:{type:"string"},note:{type:"string"}},required:["questId"]}},
    {name:"add_task",description:"Add a task",input_schema:{type:"object",properties:{title:{type:"string"},period:{type:"string",enum:["daily","weekly","monthly"]},skillId:{type:"string",description:`Optional skills: ${sn}`},xpVal:{type:"number"}},required:["title","period"]}},
    {name:"log_session",description:"Log a practice session",input_schema:{type:"object",properties:{type:{type:"string",enum:["mindfulness","presence","grounding","visualization","ritual","breathwork","contemplation","open"]},duration:{type:"number"},skillId:{type:"string",description:`Optional skills: ${sn}`},note:{type:"string"},backlogDate:{type:"string"}},required:["type","duration"]}},
  ];
}

function JarvisOverlay({tasks,quests,skills,onAddQuest,onAddTask,onClose}){
  const [input,setInput]=useState("");
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Online."}]);
  const [loading,setLoading]=useState(false);
  const inputRef=useRef(null);
  const msgEndRef=useRef(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async()=>{
    const txt=input.trim(); if(!txt||loading) return;
    const next=[...msgs,{role:"user",content:txt}];
    setMsgs(next); setInput(""); setLoading(true);
    try{
      const activeQuests=quests.filter(q=>!q.done).map(q=>`${q.title} (${q.type})`).slice(0,10).join(", ")||"none";
      const doneCount=quests.filter(q=>q.done).length;
      const skillNames=skills.map(s=>`${s.name} lv${Math.floor(s.xp/100)+1}`).join(", ")||"none";
      const taskCount=tasks.filter(t=>!t.done).length;

      const systemPrompt=`You are JARVIS — an AI embedded in The Codex, a personal gamified life tracker. You are not a chatbot. You are a co-pilot.

CODEX STATE:
- Active quests: ${activeQuests}
- Completed quests: ${doneCount}
- Skills: ${skillNames}
- Pending tasks: ${taskCount}

PERSONALITY RULES — follow these exactly:
1. When asked a question, ANSWER IT. Give your actual opinion. Be direct. Be concise. Do not hedge.
2. You have personality. Dry wit is fine. Bluntness is fine. Padding is not.
3. NEVER offer to add things to the tracker unprompted. NEVER say "would you like me to add that?" NEVER suggest logging something. If they want it added, they will ask.
4. NEVER open with "I" as the first word. Vary sentence structure.
5. Keep responses under 4 sentences unless the user asks for detail.

ADDING ITEMS — only when user explicitly says "add", "create", "log", "track", or similar:
Append this exact format at the very end, after your message text, on its own line:
ACTIONS:{"actions":[{"type":"add_task","title":"...","xpVal":20}]}
or: ACTIONS:{"actions":[{"type":"add_quest","title":"...","note":"...","questType":"main"}]}
Types: add_task (fields: title, xpVal 5-100), add_quest (fields: title, note, questType: main/side/radiant)

If not adding anything, do NOT include ACTIONS at all.`;

      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,
          system:systemPrompt,
          messages:next.map(m=>({role:m.role,content:m.content}))})
      });
      const data=await res.json();
      const raw=data.choices?.[0]?.message?.content||"...";
      let display=raw;
      const actionMatch=raw.match(/ACTIONS:(\{[\s\S]*\})/);
      if(actionMatch){
        try{
          const parsed=JSON.parse(actionMatch[1]);
          for(const a of parsed.actions||[]){
            if(a.type==="add_task") await onAddTask({title:a.title,xpVal:Number(a.xpVal)||20,skill:null});
            if(a.type==="add_quest") await onAddQuest({title:a.title,note:a.note||"",type:a.questType||"main",due:"",skills:[]});
          }
        }catch(e){}
        display=raw.split("ACTIONS:")[0].trim();
      }
      setMsgs(v=>[...v,{role:"assistant",content:display||"Done."}]);
    }catch(e){setMsgs(v=>[...v,{role:"assistant",content:"Error — check console."}]);}
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 80px"}}>
      <div style={{width:"min(500px,95vw)",background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"60vh"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--b1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"var(--tx2)"}}>⟡ Jarvis</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"85%",
              background:m.role==="user"?"var(--s2)":"var(--bg)",
              border:"1px solid var(--b1)",borderRadius:6,padding:"8px 12px",
              fontSize:12,color:"var(--tx)",lineHeight:1.5,fontFamily:"'DM Mono',monospace"}}>
              {m.content}
            </div>
          ))}
          {loading&&<div style={{alignSelf:"flex-start",fontSize:11,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontStyle:"italic"}}>...</div>}
          <div ref={msgEndRef}/>
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid var(--b1)",display:"flex",gap:8}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Add a task, quest, or just ask..."
            style={{flex:1,background:"var(--bg)",border:"1px solid var(--b2)",borderRadius:4,
              padding:"8px 10px",color:"var(--tx)",fontFamily:"'DM Mono',monospace",fontSize:11,outline:"none"}}/>
          <button onClick={send} disabled={loading||!input.trim()}
            style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:4,
              padding:"8px 14px",color:"var(--tx)",fontFamily:"'DM Mono',monospace",
              fontSize:9,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",
              opacity:loading||!input.trim()?.5:1}}>Send</button>
        </div>
      </div>
    </div>
  );
}


function AdvisorTab({tasks,quests,skills,xp,level,streaks,onAddQuest,onAddTask,onLogMed,onEditQuest}){
  const {settings}=useSettings(); const L=settings.labels;
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const QUICK=["What should I focus on today?","Which skill needs the most attention?",
    "Help me break down my biggest quest","Am I overloaded right now?","Give me a 30-minute win"];

  function buildCtx(){
    const at=tasks.filter(t=>!t.done).slice(0,10);
    const aq=quests.filter(q=>!q.done).slice(0,8);
    const skPerLv=settings.xp.skillPerLevel||6000;
    const topStr=Object.entries(streaks).sort((a,b)=>b[1].count-a[1].count).slice(0,3)
      .map(([id,s])=>`${skills.find(sk=>sk.id===id)?.name||id}: ${s.count}d`).join(", ");
    return `You are a direct planning advisor inside the user\'s RPG quest log.\nLEVEL: ${level} (${xp} XP)${topStr?"\nSTREAKS: "+topStr:""}\nTASKS (${at.length} active): ${at.map(t=>`"${t.title}" [${t.period}, ${skills.find(s=>s.id===t.skill)?.name||"no skill"}, ${t.xpVal}xp]`).join("; ")||"none"}\nQUESTS (${aq.length} active): ${aq.map(q=>`"${q.title}" [${q.type}${q.due?", due "+new Date(q.due).toLocaleDateString():""}]`).join("; ")||"none"}\nSKILLS: ${[...skills].sort((a,b)=>b.xp-a.xp).map(s=>`${s.name} Lv${Math.floor(s.xp/skPerLv)+1}`).join(", ")||"none"}\nBe direct. Reference actual task names. 3-5 sentences max unless breaking something down.`;
  }

  const executeAction=async(action)=>{
    if(action.tool==="add_quest"){
      const due=action.input.dueDate?new Date(`${action.input.dueDate}${action.input.dueTime?"T"+action.input.dueTime:"T09:00"}`).getTime():null;
      await onAddQuest({title:action.input.title,type:action.input.type,skill:action.input.skillId||null,note:action.input.note||"",due});
    } else if(action.tool==="update_quest"){
      const updates={};
      if(action.input.dueDate) updates.due=new Date(`${action.input.dueDate}${action.input.dueTime?"T"+action.input.dueTime:"T09:00"}`).getTime();
      if(action.input.title) updates.title=action.input.title;
      if(action.input.note!==undefined) updates.note=action.input.note;
      await onEditQuest(action.input.questId,updates);
    } else if(action.tool==="add_task"){
      await onAddTask({title:action.input.title,period:action.input.period,skill:action.input.skillId||null,xpVal:action.input.xpVal||20});
    } else if(action.tool==="log_session"){
      const sessionDate=action.input.backlogDate?new Date(action.input.backlogDate+"T12:00").getTime():null;
      await onLogMed({type:action.input.type,dur:action.input.duration,skillId:action.input.skillId||null,note:action.input.note||"",baseXp:action.input.duration*(settings.xp.practicePerMin||1),aiReason:null,sessionDate});
    }
  };

  const handleConfirm=async(msgIdx,actionId,accept)=>{
    setMsgs(prev=>prev.map((m,i)=>{
      if(i!==msgIdx||!m.actions) return m;
      return {...m,actions:m.actions.map(a=>a.id===actionId?{...a,status:accept?"accepted":"cancelled"}:a)};
    }));
    if(accept){
      const action=msgs[msgIdx]?.actions?.find(a=>a.id===actionId);
      if(action) await executeAction(action);
    }
  };

  const send=async(text)=>{
    const msg=(text||input).trim(); if(!msg||loading) return;
    setInput(""); setLoading(true);
    const history=[...msgs.map(m=>({role:m.role,content:m.content})),{role:"user",content:msg}];
    setMsgs(prev=>[...prev,{role:"user",content:msg}]);
    try{
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          system:buildCtx(),tools:buildAdvisorTools(skills,quests),messages:history}),
      });
      const data=await res.json();
      // Groq returns OpenAI format; tool_calls in message if tools used
      const msg=data.choices?.[0]?.message||{};
      const toolCalls=msg.tool_calls||[];
      const replyText=msg.content||"";
      if(toolCalls.length>0){
        const actions=toolCalls.map(tc=>({
          id:tc.id,
          tool:tc.function?.name,
          input:(()=>{try{return JSON.parse(tc.function?.arguments||"{}");}catch{return {};}})(),
          status:"pending"
        }));
        setMsgs(prev=>[...prev,{role:"assistant",content:replyText||"Here\'s what I\'d like to add:",actions}]);
      } else {
        setMsgs(prev=>[...prev,{role:"assistant",content:replyText||"Something went wrong."}]);
      }
    }catch{
      setMsgs(prev=>[...prev,{role:"assistant",content:"Connection failed. Try again."}]);
    }
    setLoading(false);
  };

  return (<>
    {msgs.length===0&&<>
      <div className="ai-intro">
        <div className="ai-intro-title">✦ {L.advisorTab}</div>
        <div className="ai-intro-body">Has full access to your quests, tasks, and skill data. Can add quests, log sessions, and schedule tasks — confirm before anything is written.</div>
      </div>
      <div className="ai-chips">{QUICK.map((q,i)=><button key={i} className="ai-chip" onClick={()=>send(q)}>{q}</button>)}</div>
    </>}
    <div className="ai-msgs">
      {msgs.map((m,mi)=>(
        <div key={mi} className={`ai-msg ${m.role}`}>
          {m.content}
          {m.actions&&(
            <div className="ai-actions">
              {m.actions.map(a=>(
                <ActionCard key={a.id} action={a} skills={skills}
                  onAccept={()=>handleConfirm(mi,a.id,true)}
                  onCancel={()=>handleConfirm(mi,a.id,false)}/>
              ))}
            </div>
          )}
        </div>
      ))}
      {loading&&<div className="ai-msg loading">◈ thinking...</div>}
      <div ref={bottomRef}/>
    </div>
    <div className="ai-input-row">
      <textarea className="ai-input" placeholder="Ask your advisor..." value={input}
        onChange={e=>setInput(e.target.value)} rows={1}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
      <button className="ai-send" disabled={!input.trim()||loading} onClick={()=>send()}>Send</button>
    </div>
  </>);
}

function ActionCard({action,skills,onAccept,onCancel}){
  const sk=skills.find(s=>s.id===action.input.skillId);
  let summary="", detail="";
  if(action.tool==="add_quest"){
    summary=`[${action.input.type}] "${action.input.title}"`;
    detail=[sk?`→ ${sk.name}`:null,action.input.note,action.input.dueDate?`due ${action.input.dueDate}`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="update_quest"){
    summary=`Update quest`;
    detail=[action.input.title?`rename → "${action.input.title}"`:null,action.input.dueDate?`set due ${action.input.dueDate}`:null,action.input.note?`note: ${action.input.note}`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="add_task"){
    summary=`[${action.input.period}] "${action.input.title}"`;
    detail=[sk?`→ ${sk.name}`:null,action.input.xpVal?`${action.input.xpVal}xp`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="log_session"){
    summary=`${action.input.type} · ${action.input.duration}min`;
    detail=[sk?`→ ${sk.name}`:null,action.input.note,action.input.backlogDate?`(${action.input.backlogDate})`:null].filter(Boolean).join(" · ");
  }
  if(action.status==="accepted") return <div className="act-done" style={{color:"var(--success)"}}>✓ {summary} — added</div>;
  if(action.status==="cancelled") return <div className="act-done" style={{color:"var(--tx3)"}}>✕ {summary} — skipped</div>;
  return (
    <div className="act-card">
      <div className="act-tool">{action.tool.replace(/_/g," ")}</div>
      <div className="act-sum">{summary}</div>
      {detail&&<div className="act-detail">{detail}</div>}
      <div className="act-btns">
        <button className="abtn ok" onClick={onAccept}>Accept</button>
        <button className="abtn no" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function SettingsTab({showToast,onExport,onImport}){
  const {settings,saveSettings}=useSettings();
  const importRef=useRef(null);
  const [draft,setDraft]=useState(()=>JSON.parse(JSON.stringify(settings)));
  const setLabel=(k,v)=>setDraft(d=>({...d,labels:{...d.labels,[k]:v}}));
  const setColor=(k,v)=>setDraft(d=>({...d,colors:{...d.colors,[k]:v}}));
  const setThm  =(k,v)=>setDraft(d=>({...d,theme:{...d.theme,[k]:v}}));
  const setXpCfg=(k,v)=>setDraft(d=>({...d,xp:{...d.xp,[k]:typeof v==="boolean"?v:(Number(v)||1)}}));
  const applyPal=p=>setDraft(d=>({...d,colors:{...d.colors,primary:p.primary,secondary:p.secondary}}));
  const applyThm=t=>setDraft(d=>({...d,theme:{bg:t.bg,s1:t.s1,s2:t.s2,b1:t.b1,b2:t.b2,tx:t.tx,tx2:t.tx2,tx3:t.tx3}}));
  const save =async()=>{await saveSettings(draft);showToast("Settings saved");};
  const reset=async()=>{await saveSettings(DEFAULT_SETTINGS);setDraft(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));showToast("Reset to defaults");};

  const SRow=({label,sub,value,onChange,type="text",sm=false})=>(
    <div className="srow">
      <div style={{flex:1}}><div className="srow-label">{label}</div>{sub&&<div className="srow-sub">{sub}</div>}</div>
      <input className={`sinput ${sm?"sm":""}`} type={type} value={value} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
  const CPick=({label,sub,val,onChange})=>(
    <div className="srow">
      <div style={{flex:1}}><div className="srow-label">{label}</div>{sub&&<div className="srow-sub">{sub}</div>}</div>
      <input type="color" className="cpick" value={val} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
  const Tog=({label,sub,val,onChange})=>(
    <div className="tog-row">
      <div style={{flex:1}}><div className="srow-label">{label}</div>{sub&&<div className="srow-sub">{sub}</div>}</div>
      <button className={`tog ${val?"on":""}`} onClick={()=>onChange(!val)}><div className="tog-knob"/></button>
    </div>
  );

  return (<div style={{paddingBottom:8}}>
    <div className="slbl">Profile</div>
    <div className="sgroup">
      <div className="srow">
        <div style={{flex:1}}><div className="srow-label">Name</div></div>
        <input className="sinput" value={draft.profile.name} onChange={e=>setDraft(d=>({...d,profile:{...d.profile,name:e.target.value}}))}/>
      </div>
      <div className="srow">
        <div style={{flex:1}}><div className="srow-label">Font size</div>
          <div className="srow-sub">Scales content and input text</div></div>
        <div style={{display:"flex",gap:4}}>
          {[{l:"S",v:12},{l:"M",v:14},{l:"L",v:16},{l:"XL",v:18}].map(({l,v})=>(
            <button key={v} onClick={()=>setDraft(d=>({...d,fontSize:v}))}
              style={{width:30,height:28,borderRadius:4,border:`1px solid ${draft.fontSize===v?"var(--b3)":"var(--b1)"}`,background:draft.fontSize===v?"var(--s2)":"var(--bg)",color:draft.fontSize===v?"var(--tx)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,cursor:"pointer",transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="srow">
        <div style={{flex:1}}><div className="srow-label">Content width</div>
          <div className="srow-sub">How wide the main content area is on desktop</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="range" min={500} max={1100} step={50} value={draft.contentWidth||700}
            onChange={e=>setDraft(d=>({...d,contentWidth:Number(e.target.value)}))}
            style={{width:90,accentColor:"var(--primary)"}}/>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",minWidth:36}}>{draft.contentWidth||700}px</span>
        </div>
      </div>
      <div className="srow">
        <div style={{flex:1}}><div className="srow-label">App name</div>
          <div className="srow-sub">Blank = context-aware title per tab</div></div>
        <input className="sinput" value={draft.appName} placeholder="Auto" onChange={e=>setDraft(d=>({...d,appName:e.target.value}))}/>
      </div>
    </div>
    <div className="gap"/>
    <Collapsible question="Want to change the base theme and colors?">
      <div className="sgroup">
        <div className="sgroup-title">Theme presets</div>
        <div className="theme-grid">
          {THEME_PRESETS.map(p=>(
            <div key={p.name} className={`theme-opt ${draft.theme?.bg===p.bg?"on":""}`} onClick={()=>applyThm(p)}>
              <div className="theme-swatch"><div style={{width:11,background:p.s1}}/><div style={{flex:1,background:p.bg}}/></div>
              <div className="theme-name">{p.name}</div>
            </div>
          ))}
        </div>
        <CPick label="Background" sub="Main page background" val={draft.theme?.bg||"#0c0c0c"} onChange={v=>setThm("bg",v)}/>
        <CPick label="Surface"    sub="Cards and panels"     val={draft.theme?.s1||"#141414"} onChange={v=>setThm("s1",v)}/>
        <CPick label="Border"     sub="Lines and dividers"   val={draft.theme?.b1||"#252525"} onChange={v=>setThm("b1",v)}/>
        <CPick label="Text"       sub="Primary text"         val={draft.theme?.tx||"#dedede"} onChange={v=>setThm("tx",v)}/>
        <CPick label="Muted text" sub="Labels, metadata"     val={draft.theme?.tx2||"#999999"} onChange={v=>setThm("tx2",v)}/>
      </div>
    </Collapsible>
    <Collapsible question="Want to change accent colors?">
      <div className="sgroup">
        <div className="sgroup-title">Presets</div>
        <div className="palette-grid">
          {PALETTES.map(p=>(
            <div key={p.name} className={`pal-opt ${draft.colors.primary===p.primary?"on":""}`} onClick={()=>applyPal(p)}>
              <div className="pal-dots"><div className="pal-dot" style={{background:p.primary}}/><div className="pal-dot" style={{background:p.secondary}}/></div>
              <div className="pal-name">{p.name}</div>
            </div>
          ))}
        </div>
        <CPick label="Primary"   sub="XP bar, level, main quests"  val={draft.colors.primary}   onChange={v=>setColor("primary",v)}/>
        <CPick label="Secondary" sub="Radiant, practice, advisor"   val={draft.colors.secondary} onChange={v=>setColor("secondary",v)}/>
        <CPick label="Success"   sub="Checkmarks"                   val={draft.colors.success}   onChange={v=>setColor("success",v)}/>
      </div>
    </Collapsible>
    <Collapsible question="Want to rename the navigation tabs?">
      <div className="sgroup">
        {[["plannerTab","Planner"],["questsTab","Quests"],["skillsTab","Skills"],["practiceTab","Practice"],["advisorTab","Advisor"],["settingsTab","Settings"]]
          .map(([k,l])=><SRow key={k} label={l} value={draft.labels[k]} onChange={v=>setLabel(k,v)}/>)}
      </div>
    </Collapsible>
    <Collapsible question="Want to rename quests and radiant quests?">
      <div className="sgroup">
        <SRow label="Main quest name"     value={draft.labels.mainQuest}    onChange={v=>setLabel("mainQuest",v)}/>
        <SRow label="Main quest XP"       value={draft.labels.mainXp}       onChange={v=>setLabel("mainXp",v)} sm/>
        <SRow label="Radiant quest name"  value={draft.labels.radiantQuest} onChange={v=>setLabel("radiantQuest",v)}/>
        <SRow label="Radiant quest XP"    value={draft.labels.radiantXp}    onChange={v=>setLabel("radiantXp",v)} sm/>
        <SRow label="Radiant description" value={draft.labels.radiantDesc}  onChange={v=>setLabel("radiantDesc",v)}/>
      </div>
    </Collapsible>
    <Collapsible question="Want to rename planner periods or other terms?">
      <div className="sgroup">
        <SRow label="Daily"      value={draft.labels.daily}     onChange={v=>setLabel("daily",v)}/>
        <SRow label="Weekly"     value={draft.labels.weekly}    onChange={v=>setLabel("weekly",v)}/>
        <SRow label="Monthly"    value={draft.labels.monthly}   onChange={v=>setLabel("monthly",v)}/>
        <SRow label="Done"       value={draft.labels.done}      onChange={v=>setLabel("done",v)}/>
        <SRow label="Completed"  value={draft.labels.completed} onChange={v=>setLabel("completed",v)}/>
        <SRow label="XP name"    sub="e.g. XP, Essence, Points" value={draft.labels.xpName}    onChange={v=>setLabel("xpName",v)} sm/>
        <SRow label="Level name" sub="e.g. LVL, Rank, Stage"    value={draft.labels.levelName} onChange={v=>setLabel("levelName",v)} sm/>
        <SRow label="Combo name" sub="e.g. Combo, Streak, Chain" value={draft.labels.comboName||"Combo"} onChange={v=>setLabel("comboName",v)} sm/>
      </div>
    </Collapsible>
    <Collapsible question="Want to adjust XP, leveling, or practice scoring?">
      <div className="sgroup">
        <SRow label="Skill XP per level"  sub="6000 = Level 100 at 10,000 hrs" type="number" sm value={draft.xp.skillPerLevel}  onChange={v=>setXpCfg("skillPerLevel",v)}/>
        <SRow label="Global XP per level" sub="Default 600"                     type="number" sm value={draft.xp.globalPerLevel} onChange={v=>setXpCfg("globalPerLevel",v)}/>
        <SRow label="Practice XP per min" sub="Default 1"                       type="number" sm value={draft.xp.practicePerMin} onChange={v=>setXpCfg("practicePerMin",v)}/>
        <Tog label="AI session scoring" sub="Journal entries trigger AI XP scoring" val={draft.xp.aiScoring!==false} onChange={v=>setXpCfg("aiScoring",v)}/>
      </div>
    </Collapsible>
    <div className="gap"/>
    <Collapsible question="Custom Images">
      <p style={{fontSize:11,color:"var(--tx3)",marginBottom:14,lineHeight:1.6}}>
        Upload PNG/JPG images for backgrounds and banners. Stored locally, keep under 2MB each.
      </p>
      <CustomImageUploader label="App Background" aspectHint="any ratio — covers full background"
        value={draft.images?.bg||null}
        onChange={v=>setDraft(d=>({...d,images:{...(d.images||{}),bg:v}}))}/>
      <CustomImageUploader label="Header Banner / Logo" aspectHint="wide ~800x120px"
        value={draft.images?.banner||null}
        onChange={v=>setDraft(d=>({...d,images:{...(d.images||{}),banner:v}}))}/>
    </Collapsible>
    <div className="gap"/>
    <div className="slbl">data</div>
    <button className="exp-btn" onClick={onExport}><span>↓</span> Export all data as JSON</button>
    <button className="exp-btn" onClick={()=>importRef.current?.click()}><span>↑</span> Import data from JSON</button>
    <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={onImport}/>
    <div className="auth-note">
      <div className="auth-note-title">Cross-device sync</div>
      <div className="auth-note-body">Data stored locally on this device. Deploy with <span className="auth-note-code">Supabase</span> + <span className="auth-note-code">Vercel</span> for sign-in and sync.</div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:4}}>
      <button className="save-btn" onClick={save}>Save Settings</button>
      <button className="reset-btn" onClick={reset}>Reset</button>
    </div>
  </div>);
}

function TaskCard({task,skills,quests,onToggle,onDelete,onEdit}){
  const {settings}=useSettings(); const L=settings.labels;
  const sk=skills.find(s=>s.id===task.skill);
  const linkedQuest=task.questId?(quests||[]).find(q=>q.id===task.questId):null;
  const [editing,setEditing]=useState(false);
  const [f,setF]=useState({title:task.title,skill:task.skill||"",xpVal:task.xpVal});
  const save=()=>{
    if(!f.title.trim()) return;
    onEdit(task.id,{title:f.title.trim(),skill:f.skill||null,xpVal:Number(f.xpVal)||20});
    setEditing(false);
  };
  if(editing) return (
    <div className="fwrap" style={{marginBottom:2}}>
      <div className="frow"><input className="fi full" autoFocus value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&save()}/></div>
      <div className="frow">
        <select className="fsel" value={f.skill} onChange={e=>setF(v=>({...v,skill:e.target.value}))}>
          <option value="">No skill</option>
          {skills.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
        <select className="fsel" value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:e.target.value}))}>
          {[5,10,20,30,50,80].map(v=><option key={v} value={v}>{v} {L.xpName}</option>)}
        </select>
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setEditing(false)}>✕</button>
      </div>
      <button className="fsbtn" onClick={save}>Save</button>
    </div>
  );
  return (
    <div className={`card ${task.done?"done":""}`}>
      <button className={`chk ${task.done?"on":""}`} onClick={()=>onToggle(task.id)}>{task.done?"✓":""}</button>
      <div className="cbody">
        <div className={`ctitle ${task.done?"done":""}`}>{task.title}</div>
        <div className="cmeta">
          {sk&&<span className="ctag" style={{borderColor:sk.color+"44",color:sk.color}}>{sk.icon} {sk.name}</span>}
          <span className="ctag">{task.xpVal} {L.xpName}</span>
          {linkedQuest&&<span className="ctag" style={{borderColor:"var(--primaryb)",color:"var(--primary)"}}>◆ {linkedQuest.title}</span>}
        </div>
      </div>
      <button className="delbtn" onClick={()=>setEditing(true)} title="Edit">✎</button>
      <button className="delbtn" onClick={()=>onDelete(task.id)}>✕</button>
    </div>
  );
}

function QuestCard({quest,skills,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const [editing,setEditing]=useState(false);
  const [showSubs,setShowSubs]=useState(false);
  const [newSub,setNewSub]=useState("");
  const defaultQColor=(sIds)=>{ const s=skills.find(sk=>sk.id===(sIds||[])[0]); return s?s.color:null; };
  const [ef,setEf]=useState({title:quest.title,note:quest.note||"",dueDate:quest.due?new Date(quest.due).toISOString().split("T")[0]:"",skillIds:quest.skills||[],color:quest.color||defaultQColor(quest.skills)||null,priority:quest.priority||"med"});
  const [xpSuggestion,setXpSuggestion]=useState(null);
  const [xpLoading,setXpLoading]=useState(false);
  const toggleESkill=id=>setEf(v=>{
    const next=v.skillIds.includes(id)?v.skillIds.filter(x=>x!==id):[...v.skillIds,id];
    const autoColor=!quest.color&&next.length>0?defaultQColor(next):v.color;
    return {...v,skillIds:next,color:autoColor};
  });
  const saveEdit=()=>{
    if(!ef.title.trim()) return;
    const due=ef.dueDate?new Date(ef.dueDate+"T09:00").getTime():null;
    onEdit(quest.id,{title:ef.title.trim(),note:ef.note.trim(),due,skills:ef.skillIds,color:ef.color||null,priority:ef.priority});
    setEditing(false); setXpSuggestion(null);
  };
  const suggestQuestXp=async()=>{
    if(!ef.title.trim()) return;
    setXpLoading(true); setXpSuggestion(null);
    try{
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:`This quest in a gamified life tracker: "${ef.title}"${ef.note?`. Intention: "${ef.note}"`:""}. Type: ${quest.type}. Suggest a fair XP reward (typical range: main=60-120, side=30-70, radiant=20-40 per run). Reply with ONLY a JSON object, no markdown: {"xp": NUMBER, "reason": "one short sentence"}`}]})});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"";
      const parsed=JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0]||"{}");
      if(parsed.xp) setXpSuggestion(parsed);
    }catch(e){setXpSuggestion({xp:null,reason:"Couldn't reach AI."});}
    setXpLoading(false);
  };
  const submitSub=()=>{
    if(!newSub.trim()) return;
    onAddSubquest(quest.id,newSub.trim());
    setNewSub("");
  };
  const subs=quest.subquests||[];
  const subsDone=subs.filter(s=>s.done).length;
  const isRadiant=quest.type==="radiant";
  const now=Date.now();
  const overdue=quest.due&&!quest.done&&quest.due<now;
  const dueSoon=quest.due&&!quest.done&&quest.due>now&&quest.due-now<86400000;
  const dueFmt=quest.due?new Date(quest.due).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;

  if(editing) return (
    <div className="fwrap" style={{marginBottom:2}}>
      <div className="frow"><input className="fi full" autoFocus value={ef.title} onChange={e=>setEf(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&saveEdit()}/></div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={ef.note} onChange={e=>setEf(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:48,fontFamily:"inherit",fontSize:12,marginBottom:6}}/>
      {skills.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {skills.map(s=><button key={s.id} onClick={()=>toggleESkill(s.id)} style={{background:ef.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${ef.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:ef.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>{s.icon} {s.name}</button>)}
      </div>}
      <div className="frow" style={{alignItems:"center",gap:6}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--tx3)",flexShrink:0}}>Priority</div>
        {["high","med","low"].map(p=>(
          <button key={p} onClick={()=>setEf(v=>({...v,priority:p}))} style={{background:ef.priority===p?"var(--s2)":"var(--bg)",border:`1px solid ${ef.priority===p?"var(--b3)":"var(--b1)"}`,borderRadius:4,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:ef.priority===p?({high:"#e05555",med:"var(--primary)",low:"var(--tx3)"}[p]):"var(--tx3)",transition:"all .15s",textTransform:"uppercase"}}>
            {p}
          </button>
        ))}
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0,flexShrink:0,marginLeft:"auto"}} onClick={()=>{setEditing(false);setXpSuggestion(null);}}>✕</button>
      </div>
      <div className="frow">
        <input className="fi" type="date" style={{colorScheme:"dark"}} value={ef.dueDate} onChange={e=>setEf(v=>({...v,dueDate:e.target.value}))}/>
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--tx3)",marginBottom:6}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setEf(v=>({...v,color:c}))} style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",border:ef.color===c?"2px solid var(--tx)":"2px solid transparent",transition:"all .15s"}}/>)}
          <div onClick={()=>setEf(v=>({...v,color:null}))} style={{width:20,height:20,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!ef.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Default">∅</div>
        </div>
      </div>
      <button className="fsbtn secondary" style={{marginTop:4,marginBottom:2}} onClick={suggestQuestXp} disabled={xpLoading||!ef.title.trim()}>
        {xpLoading?"thinking...":"⟡ AI XP opinion"}
      </button>
      {xpSuggestion&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
        {xpSuggestion.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>+{xpSuggestion.xp} XP</span> — {xpSuggestion.reason}</>:xpSuggestion.reason}
      </div>}
      <button className="fsbtn" onClick={saveEdit}>Save</button>
    </div>
  );

  return (
    <div style={{marginBottom:4}}>
      <div className={`card quest-${quest.type} ${quest.done?"done":""}`}
        style={(()=>{
          const qc=quest.color||(qSkills[0]?.color)||null;
          if(overdue) return {borderColor:"var(--danger)"};
          if(dueSoon) return {borderColor:"var(--primary)"};
          if(qc) return {borderColor:qc,borderLeftWidth:3};
          return {};
        })()}>
        <button className="chk" style={isRadiant?{color:"var(--secondary)",borderColor:"var(--secondaryb)"}:{}}
          onClick={()=>onToggle(quest.id)}>
          {isRadiant?"◉":quest.done?"✓":""}
        </button>
        <div className="cbody">
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {quest.priority&&<span className={`prio-dot prio-${quest.priority||"med"}`} title={`Priority: ${quest.priority}`}/>}
            <span className={`ctitle ${quest.done&&!isRadiant?"done":""}`}>{quest.title}</span>
          </div>
          {subs.length>0&&<div className="sub-progress"><div className="sub-progress-fill" style={{width:`${subs.length?Math.round(subsDone/subs.length*100):0}%`}}/></div>}
          {quest.note&&<div className="cnote">{quest.note}</div>}
          <div className="cmeta">
            {qSkills.map(sk=><span key={sk.id} className="ctag" style={{borderColor:sk.color+"44",color:sk.color}}>{sk.icon} {sk.name}</span>)}
            <span className="ctag">{quest.xpVal} {L.xpName}{isRadiant?" / run":""}</span>
            {dueFmt&&<span className="ctag" style={{
              color:overdue?"var(--danger)":dueSoon?"var(--primary)":"var(--tx3)",
              borderColor:overdue?"var(--dangerf)":dueSoon?"var(--primaryb)":"var(--b1)"
            }}>{overdue?"⚠ ":"◷ "}{dueFmt}</span>}
            {quest.done&&!isRadiant&&<span className="ctag" style={{color:"var(--success)",borderColor:"var(--successf)"}}>✓</span>}
            <button onClick={()=>setShowSubs(v=>!v)}
              style={{background:"none",border:"1px solid var(--b1)",borderRadius:20,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:.8,color:subs.length&&subsDone===subs.length?"var(--success)":showSubs?"var(--primary)":"var(--tx3)",transition:"all .15s"}}>
              {subs.length>0?`${subsDone}/${subs.length} steps`:"+ steps"}
            </button>
          </div>
        </div>
        <button className="delbtn" onClick={()=>setEditing(true)} title="Edit">✎</button>
        <button className="delbtn" onClick={()=>onDelete(quest.id)}>✕</button>
      </div>
      {showSubs&&(
        <div style={{marginLeft:12,marginTop:2,borderLeft:"2px solid var(--b1)",paddingLeft:10}}>
          {subs.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0",borderBottom:"1px solid var(--b1)"}}>
              <button className={`chk ${s.done?"on":""}`} style={{width:14,height:14,fontSize:8,flexShrink:0,minWidth:14}} onClick={()=>onToggleSubquest(quest.id,s.id)}>{s.done?"✓":""}</button>
              <span style={{flex:1,fontSize:12,color:s.done?"var(--tx3)":"var(--tx)",textDecoration:s.done?"line-through":"none"}}>{s.title}</span>
              <button className="delbtn" style={{fontSize:9}} onClick={()=>onDeleteSubquest(quest.id,s.id)}>✕</button>
            </div>
          ))}
          <div style={{display:"flex",gap:5,paddingTop:6}}>
            <input className="fi" placeholder="Add step..." value={newSub}
              onChange={e=>setNewSub(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submitSub()}
              style={{fontSize:11,padding:"4px 8px",flex:1}}/>
            <button className="fsbtn" style={{width:"auto",padding:"4px 12px",margin:0,fontSize:11}} onClick={submitSub}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JOURNAL TAB ────────────────────────────────────────────────────────────
function JournalTab({entries,onAdd,onDelete}){
  const {settings}=useSettings();
  const [text,setText]=useState("");
  const [img,setImg]=useState(null);
  const [ocring,setOcring]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [filter,setFilter]=useState("all"); // "all" | "practice" | "manual"
  const [story,setStory]=useState("");
  const [genning,setGenning]=useState(false);
  const [showStory,setShowStory]=useState(false);
  const fileRef=useRef();

  const handleImg=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      const b64=ev.target.result;
      setImg(b64);
      setOcring(true);
      try{
        const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"llama-3.2-11b-vision-preview",max_tokens:1000,
            messages:[{role:"user",content:[
              {type:"image_url",image_url:{url:b64}},
              {type:"text",text:"Transcribe all handwritten or printed text from this journal page exactly as written. Return only the transcribed text, no commentary."}
            ]}]
          })
        });
        const data=await res.json();
        const extracted=data?.choices?.[0]?.message?.content||data?.content?.[0]?.text||"";
        if(extracted) setText(prev=>prev+(prev?"\n\n":"")+extracted.trim());
      }catch{ /* OCR failed silently */ }
      finally{ setOcring(false); }
    };
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const submit=()=>{
    if(!text.trim()&&!img) return;
    onAdd({text:text.trim(),img:img||null,source:"manual"});
    setText(""); setImg(null); setShowForm(false);
  };

  const practiceEntries=entries.filter(e=>e.source==="practice");
  const canGenStory=practiceEntries.length>=3;

  const generateStory=async()=>{
    setGenning(true); setShowStory(true);
    try{
      const corpus=practiceEntries.slice(0,30).map(e=>{
        const d=new Date(e.created).toLocaleDateString("en-US",{month:"short",day:"numeric"});
        return `[${d}] ${e.text}`;
      }).join("\n\n");
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile",max_tokens:1200,
          messages:[{role:"user",content:`You are a mystical chronicler. Based on the following practice journal entries, write a cohesive, evocative narrative (3-4 paragraphs) that weaves together the practitioner's journey — the patterns, the breakthroughs, the texture of their practice. Write in second person ("you"), present tense, like a living story. Make it feel meaningful and earned, not generic.\n\nJournal entries:\n${corpus}\n\nWrite the narrative now:`}]
        })
      });
      const data=await res.json();
      const msg=data?.choices?.[0]?.message?.content||data?.content?.[0]?.text||"";
      setStory(msg);
    }catch{ setStory("Couldn't reach the advisor. Try again when connected."); }
    finally{ setGenning(false); }
  };

  const filtered=filter==="all"?entries:entries.filter(e=>e.source===filter);
  const fmt=ts=>new Date(ts).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

  return (<>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div className="slbl" style={{margin:0}}>Journal</div>
      <button className="addbtn" style={{margin:0,padding:"5px 14px"}} onClick={()=>setShowForm(v=>!v)}>
        {showForm?"Cancel":"+ New Entry"}
      </button>
    </div>

    {/* Filter tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16}}>
      {[["all","All"],["manual","Written"],["practice","Practice"]].map(([v,label])=>(
        <button key={v} onClick={()=>setFilter(v)}
          style={{padding:"4px 12px",borderRadius:20,fontSize:11,border:"1px solid var(--b2)",
            background:filter===v?"var(--primaryb)":"var(--s1)",
            color:filter===v?"var(--primary)":"var(--tx3)",cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>
          {label} {v==="practice"&&practiceEntries.length>0&&<span style={{opacity:.7}}>({practiceEntries.length})</span>}
        </button>
      ))}
    </div>

    {/* AI Story button */}
    {practiceEntries.length>0&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,color:"var(--primary)",fontFamily:"'DM Mono',monospace",letterSpacing:1,marginBottom:2}}>✦ CHRONICLE</div>
            <div style={{fontSize:11,color:"var(--tx3)"}}>
              {canGenStory?"Weave your practice entries into a narrative.":"Log 3+ practice sessions with notes to unlock."}
            </div>
          </div>
          {canGenStory&&(
            <button className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10}}
              onClick={generateStory} disabled={genning}>
              {genning?"◌ Weaving...":"Generate"}
            </button>
          )}
        </div>
        {showStory&&story&&(
          <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--b1)"}}>
            <div style={{fontSize:13,color:"var(--tx)",lineHeight:1.85,whiteSpace:"pre-wrap",fontStyle:"italic"}}>{story}</div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="fsbtn" style={{width:"auto",padding:"5px 12px",margin:0,fontSize:10}} onClick={generateStory} disabled={genning}>Regenerate</button>
              <button className="fsbtn" style={{width:"auto",padding:"5px 12px",margin:0,fontSize:10,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}} onClick={()=>setShowStory(false)}>Hide</button>
            </div>
          </div>
        )}
        {showStory&&genning&&!story&&(
          <div style={{marginTop:12,fontSize:12,color:"var(--tx3)",fontStyle:"italic"}}>Gathering threads...</div>
        )}
      </div>
    )}

    {/* New entry form */}
    {showForm&&(
      <div className="fwrap" style={{marginBottom:16}}>
        {img&&<img src={img} className="journal-img" alt="attached"/>}
        <textarea className="fi full" placeholder="Write your entry... or attach a photo of your paper journal below."
          value={text} onChange={e=>setText(e.target.value)}
          style={{minHeight:120,resize:"vertical",lineHeight:1.7}}/>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button className="fsbtn" style={{width:"auto",padding:"7px 14px",margin:0,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}}
            onClick={()=>fileRef.current?.click()}>
            {ocring?"◌ Reading image...":"📷 Attach / OCR Photo"}
          </button>
          <a href="https://lens.google.com" target="_blank" rel="noreferrer"
            style={{fontSize:11,color:"var(--tx3)",textDecoration:"underline"}}>or Google Lens (free)</a>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
        </div>
        <button className="fsbtn" onClick={submit}>Save Entry</button>
      </div>
    )}

    {filtered.length===0&&(
      <div className="empty">
        {filter==="practice"?"No practice notes yet. Add a note when logging a session.":"No entries yet."}
      </div>
    )}

    {filtered.map(e=>(
      <div key={e.id} className={`journal-entry${e.source==="practice"?" practice-entry":""}`}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div className="journal-date">{fmt(e.created)}</div>
            {e.source==="practice"&&<span style={{fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:1,color:"var(--secondary)",border:"1px solid var(--secondaryb)",borderRadius:10,padding:"1px 6px"}}>PRACTICE</span>}
          </div>
          <button className="delbtn" style={{fontSize:9}} onClick={()=>onDelete(e.id)}>✕</button>
        </div>
        {e.img&&<img src={e.img} className="journal-img" alt="journal page"/>}
        {e.text&&<div className="journal-text">{e.text}</div>}
      </div>
    ))}
  </>);
}

// ─── WEEKLY REVIEW MODAL ────────────────────────────────────────────────────
function WeeklyReview({tasks,quests,skills,meds,xpLog,onClose,onNavigate}){
  const {settings}=useSettings(); const L=settings.labels;
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);

  const weekAgo=Date.now()-7*86400000;
  const recentTasks=tasks.filter(t=>t.done&&t.created>weekAgo);
  const recentQuests=quests.filter(q=>q.done&&q.created>weekAgo);
  const recentMeds=meds.filter(m=>m.created>weekAgo);
  const recentXp=(xpLog||[]).filter(e=>e.created>weekAgo).reduce((s,e)=>s+e.amt,0);
  const activeStreaks=Object.entries(
    skills.reduce((acc,sk)=>{acc[sk.id]={name:sk.name,count:0};return acc;},{})
  );

  const runReview=async()=>{
    setLoading(true);
    try{
      const summary={
        tasksCompleted:recentTasks.length,
        questsCompleted:recentQuests.length,
        practiceSessionsLogged:recentMeds.length,
        totalMinutesPracticed:recentMeds.reduce((s,m)=>s+(m.dur||0),0),
        xpEarned:recentXp,
        questTitles:recentQuests.map(q=>q.title).slice(0,5),
        skills:skills.map(s=>({name:s.name,level:Math.floor(s.xp/6000)+1}))
      };
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile",max_tokens:800,
          messages:[{role:"user",content:`You are a supportive RPG life coach doing a weekly review. Be encouraging, specific, and concise. Here's the player's week:\n\n${JSON.stringify(summary,null,2)}\n\nGive a 3-paragraph weekly review: (1) wins this week, (2) patterns you notice, (3) one concrete focus for next week. Keep it personal and motivating.`}]
        })
      });
      const data=await res.json();
      const msg=data?.choices?.[0]?.message?.content||data?.content?.[0]?.text||"";
      setAnalysis(msg);
    }catch{ setAnalysis("Couldn't connect to advisor. Try again."); }
    finally{ setLoading(false); }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div className="review-modal">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2,color:"var(--primary)"}}>WEEKLY REVIEW</div>
          <button className="delbtn" onClick={onClose}>✕</button>
        </div>

        <div className="review-section">
          <div className="slbl" style={{margin:"0 0 10px"}}>This Week's Stats</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              ["Tasks done",recentTasks.length],
              ["Quests completed",recentQuests.length],
              ["Practice sessions",recentMeds.length],
              ["XP earned",recentXp],
              ["Minutes practiced",recentMeds.reduce((s,m)=>s+(m.dur||0),0)],
            ].map(([label,val])=>(
              <div key={label} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"10px 14px"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:"var(--primary)"}}>{val}</div>
                <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {recentQuests.length>0&&(
          <div className="review-section">
            <div className="slbl" style={{margin:"0 0 8px"}}>Quests Completed</div>
            {recentQuests.map(q=>(
              <div key={q.id} style={{fontSize:12,color:"var(--tx2)",padding:"3px 0",borderBottom:"1px solid var(--b1)"}}>◆ {q.title}</div>
            ))}
          </div>
        )}

        <div className="review-section">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div className="slbl" style={{margin:0}}>AI Analysis</div>
            {!analysis&&<button className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10}} onClick={runReview} disabled={loading}>
              {loading?"◌ Analysing...":"Get Review"}
            </button>}
          </div>
          {analysis?(
            <div style={{fontSize:13,color:"var(--tx)",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{analysis}</div>
          ):(
            <div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic"}}>Click "Get Review" for an AI-powered analysis of your week.</div>
          )}
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          {["quests","skills","practice","journal"].map(t=>(
            <button key={t} className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}}
              onClick={()=>onNavigate(t)}>
              Go to {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOM IMAGES SUPPORT ──────────────────────────────────────────────────
// CustomImageUploader: reusable component for uploading images as base64
function CustomImageUploader({label,value,onChange,aspectHint}){
  const ref=useRef();
  const handleFile=e=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(file.size>2*1024*1024){ alert("Image too large. Please use an image under 2MB."); return; }
    const reader=new FileReader();
    reader.onload=ev=>onChange(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value="";
  };
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:"var(--tx2)",marginBottom:6}}>{label}{aspectHint&&<span style={{color:"var(--tx3)",marginLeft:6}}>({aspectHint})</span>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {value&&<img src={value} alt={label} style={{width:48,height:48,objectFit:"cover",borderRadius:"var(--r)",border:"1px solid var(--b1)"}}/>}
        <button className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}}
          onClick={()=>ref.current?.click()}>
          {value?"Change image":"Upload image"}
        </button>
        {value&&<button className="delbtn" style={{fontSize:9}} onClick={()=>onChange(null)}>Remove</button>}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{display:"none"}} onChange={handleFile}/>
      </div>
    </div>
  );
}
