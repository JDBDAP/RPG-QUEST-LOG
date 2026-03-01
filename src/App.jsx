import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from "react";
import AuthScreen from "./AuthScreen";
import { supabase, getSession, onAuthChange, signOut, loadUserData, saveField, migrateLocalStorage } from "./supabase";

const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;1,300&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;
const SettingsCtx = createContext(null);
const COOLDOWN_OPTIONS=[
  {label:"Instant",ms:0},
  {label:"15 min",ms:15*60*1000},
  {label:"30 min",ms:30*60*1000},
  {label:"1 hr",ms:60*60*1000},
  {label:"2 hr",ms:2*60*60*1000},
  {label:"4 hr",ms:4*60*60*1000},
  {label:"6 hr",ms:6*60*60*1000},
  {label:"8 hr",ms:8*60*60*1000},
  {label:"12 hr",ms:12*60*60*1000},
  {label:"24 hr",ms:24*60*60*1000},
];

// ── Drag-to-reorder hook (HTML5 drag API — desktop + Android Chrome) ──────────
function useDrag({items, onReorder, idKey="id"}){
  const [activeId,setActiveId]=useState(null);
  const [overId,setOverId]=useState(null);
  const dragId=useRef(null);

  const getProps=(id)=>({
    draggable:true,
    onDragStart:(e)=>{
      dragId.current=id; setActiveId(id);
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",String(id));
    },
    onDragOver:(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect="move";
      if(dragId.current&&dragId.current!==id) setOverId(id);
    },
    onDragLeave:(e)=>{ if(!e.currentTarget.contains(e.relatedTarget)) setOverId(v=>v===id?null:v); },
    onDrop:(e)=>{
      e.preventDefault();
      const from=items.findIndex(x=>x[idKey]===dragId.current);
      const to=items.findIndex(x=>x[idKey]===id);
      if(from!==-1&&to!==-1&&from!==to){
        const arr=[...items];
        const[m]=arr.splice(from,1); arr.splice(to,0,m);
        onReorder(arr);
      }
      dragId.current=null; setActiveId(null); setOverId(null);
    },
    onDragEnd:()=>{ dragId.current=null; setActiveId(null); setOverId(null); },
    style:{
      opacity:activeId===id?0.4:1,
      outline:overId===id&&activeId!==id?"2px dashed var(--primary)":"none",
      outlineOffset:2,
      cursor:"grab",
      transition:"opacity .1s",
    }
  });
  return {getProps, activeId, overId};
}

// Renders skill icon — image if customImg, otherwise text icon
// sz = pixel size, For text-only contexts use s.customImg ? "◈" : s.icon
function SkIcon({s, sz=14, style={}}){
  if(!s) return null;
  if(s.customImg) return <img src={s.customImg} style={{width:sz,height:sz,borderRadius:2,objectFit:"cover",flexShrink:0,...style}}/>;
  return <span style={{color:s.color,fontSize:sz,lineHeight:1,flexShrink:0,...style}}>{s.icon}</span>;
}
// For contexts that can't render JSX (option text etc) — just show name without broken icon
function skillLabel(s){ return s.customImg ? s.name : `${s.icon} ${s.name}`; }
const useSettings = () => useContext(SettingsCtx);

const DEFAULT_SETTINGS = {
  appName: "",
  profile: { name: "", setup: false, public: false, friendCode: "", digestEnabled: false },
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
const SKILL_CATEGORIES = [
  {id:"fitness",    label:"Fitness",      icon:"💪"},
  {id:"creativity", label:"Creativity",   icon:"✦"},
  {id:"spirituality",label:"Spirituality",icon:"◉"},
  {id:"learning",   label:"Learning",     icon:"◎"},
  {id:"finance",    label:"Finance",      icon:"◆"},
  {id:"social",     label:"Social",       icon:"◈"},
  {id:"productivity",label:"Productivity",icon:"□"},
  {id:"other",      label:"Other",        icon:"◇"},
];
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
function radiantAvailable(q){
  if(q.type!=="radiant") return true;
  const cd=q.cooldown??60*60*1000;
  if(cd===0||!q.lastDone) return true;
  return Date.now()-q.lastDone >= cd;
}
function radiantCooldownLabel(q){
  if(!q.lastDone||radiantAvailable(q)) return null;
  const cd=q.cooldown??60*60*1000;
  const ms=cd-(Date.now()-q.lastDone);
  const mins=Math.ceil(ms/60000);
  return mins>=60?`${Math.ceil(mins/60)}h`:`${mins}m`;
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

// ── COMMUNITY / MULTIPLAYER STORAGE ────────────────────────────────────────
function genFriendCode(userId){
  // deterministic short code from userId
  let h=0;
  for(let i=0;i<userId.length;i++) h=(Math.imul(31,h)+userId.charCodeAt(i))|0;
  return (Math.abs(h)%1000000).toString().padStart(6,"0");
}

async function communitySet(userId,data){
  try{ await window.storage.set("profile:"+userId,JSON.stringify(data),true); }catch(e){console.warn("community write",e);}
}
async function communityGet(userId){
  try{ const r=await window.storage.get("profile:"+userId,true); return r?JSON.parse(r.value):null; }catch{ return null; }
}
async function communityList(){
  try{
    const r=await window.storage.list("profile:",true);
    if(!r?.keys) return [];
    const results=await Promise.all(r.keys.map(async k=>{
      try{ const v=await window.storage.get(k,true); return v?JSON.parse(v.value):null; }catch{ return null; }
    }));
    return results.filter(Boolean);
  }catch(e){ console.warn("community list",e); return []; }
}
async function communityDelete(userId){
  try{ await window.storage.delete("profile:"+userId,true); }catch{}
}

// Map cx_ keys to Supabase column names
const KEY_MAP={
  cx_settings:"settings", cx_tasks:"tasks", cx_quests:"quests",
  cx_skills:"skills", cx_meds:"meds", cx_ptypes:"practice_types",
  cx_xp:"xp", cx_streaks:"streaks", cx_seen:"seen_tabs",
  cx_journal:"journal", cx_xplog:"xp_log",
};
// Save to both localStorage (offline cache) and Supabase (if logged in)
async function dbSet(k,v,userId){
  await sset(k,v);
  if(userId&&supabase){ const col=KEY_MAP[k]; if(col) await saveField(userId,col,v); }
}

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
.empty-state{text-align:center;padding:24px 16px;border:1px dashed var(--b2);border-radius:var(--r);margin-bottom:8px;}
.es-icon{font-size:22px;margin-bottom:8px;opacity:.4;}
.es-title{font-family:\'DM Mono\',monospace;font-size:11px;color:var(--tx2);margin-bottom:6px;letter-spacing:.5px;}
.es-desc{font-size:11px;color:var(--tx3);line-height:1.6;max-width:280px;margin:0 auto;}
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
/* ── Utility classes to replace repeated inline styles ── */
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
  const [session,setSession]=useState(null);
  const [userId,setUserId]=useState(null);
  const [showAuth,setShowAuth]=useState(false);
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
  const [aiMemory,setAiMemory]=useState({facts:[],patterns:[],updated:0});
  const [toast,setToast]=useState({msg:"",on:false});
  const [confirm,setConfirm]=useState(null);
  const [showJarvis,setShowJarvis]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [seenTabs,setSeenTabs]=useState({});
  const [explainer,setExplainer]=useState(null);
  const [journal,setJournal]=useState([]);
  const [xpLog,setXpLog]=useState([]);
  const [showReview,setShowReview]=useState(false);
  const [friends,setFriends]=useState([]); // [{userId,name,code}]
  const [communityProfiles,setCommunityProfiles]=useState([]);
  const [myFriendCode,setMyFriendCode]=useState("");
  const toastRef=useRef(null);

  // Load data from Supabase if logged in, otherwise localStorage
  const loadData=async(uid)=>{
    if(uid&&supabase){
      // Check if user has existing Supabase data
      const db=await loadUserData(uid);
      if(!db){
        // First login — migrate localStorage to Supabase
        await migrateLocalStorage(uid);
        // Load again after migration
        const migrated=await loadUserData(uid);
        if(migrated) return applyData(migrated,true);
      } else {
        return applyData(db,true);
      }
    }
    // Guest / no Supabase data — fall back to localStorage
    const s=await sget("cx_settings");
    if(s){
      const merged=deepMerge(DEFAULT_SETTINGS,s);
      if(!merged.theme?.bg||merged.theme.bg==="#ffffff"||merged.theme.bg==="white"||merged.theme.bg==="")
        merged.theme=DEFAULT_SETTINGS.theme;
      setSettings(merged);
    }
    const t=await sget("cx_tasks");    if(t) setTasks(t);
    const q=await sget("cx_quests");   if(q) setQuests(q);
    const sk=await sget("cx_skills");  if(sk) setSkills(sk);
    const m=await sget("cx_meds");     if(m) setMeds(m);
    const pt=await sget("cx_ptypes");  if(pt){setPracticeTypes(pt);window.__practiceTypes=pt;}
    const x=await sget("cx_xp");       if(x!==null) setXp(x);
    const st=await sget("cx_streaks"); if(st) setStreaks(st);
    const sv=await sget("cx_seen");    if(sv) setSeenTabs(sv);
    const jn=await sget("cx_journal"); if(jn) setJournal(jn);
    const xl=await sget("cx_xplog");   if(xl) setXpLog(xl);
    const fr=await sget("cx_friends"); if(fr) setFriends(fr);
    const am=await sget("cx_aimem");   if(am) setAiMemory(am);
    setLoaded(true);
  };

  const applyData=(db,fromSupabase)=>{
    if(db.settings){
      const merged=deepMerge(DEFAULT_SETTINGS,db.settings);
      if(!merged.theme?.bg||merged.theme.bg==="#ffffff"||merged.theme.bg==="white"||merged.theme.bg==="")
        merged.theme=DEFAULT_SETTINGS.theme;
      setSettings(merged);
    }
    if(db.tasks)          setTasks(db.tasks);
    if(db.quests)         setQuests(db.quests);
    if(db.skills)         setSkills(db.skills);
    if(db.meds)           setMeds(db.meds);
    if(db.practice_types) setPracticeTypes(db.practice_types);
    if(db.xp!=null)       setXp(db.xp);
    if(db.streaks)        setStreaks(db.streaks);
    if(db.seen_tabs)      setSeenTabs(db.seen_tabs);
    if(db.journal)        setJournal(db.journal);
    if(db.xp_log)         setXpLog(db.xp_log);
    setLoaded(true);
  };

  useEffect(()=>{
    // Check for existing session on mount
    (async()=>{
      const s=await getSession();
      if(s){ setSession(s); setUserId(s.user.id); await loadData(s.user.id); }
      else { await loadData(null); }
    })();
    // Listen for auth changes (login/logout from another tab etc)
    const unsub=onAuthChange(async s=>{
      if(s){ setSession(s); setUserId(s.user.id); setMyFriendCode(genFriendCode(s.user.id)); setShowAuth(false); await loadData(s.user.id); }
      else { setSession(null); setUserId(null); }
    });
    return unsub;
  },[]);

  const saveSettings=async s=>{setSettings(s);await dbSet("cx_settings",s,userId);};
  const handleSignOut=async()=>{
    await signOut();
    setSession(null); setUserId(null);
    // Clear state so next user starts fresh
    setTasks([]); setQuests([]); setSkills([]); setMeds([]);
    setPracticeTypes(DEFAULT_PRACTICE_TYPES); setXp(0);
    setStreaks({}); setJournal([]); setXpLog([]);
    setSettings(DEFAULT_SETTINGS);
  };
  const handleTabChange=async id=>{
    setTab(id);
    if(!seenTabs[id]&&TAB_EXPLAINERS[id]){
      const next={...seenTabs,[id]:true};
      setSeenTabs(next); await dbSet("cx_seen",next,userId);
      setExplainer(TAB_EXPLAINERS[id]);
    }
  };
  const L=settings.labels; const C=settings.colors; const TH=settings.theme;
  const css=useMemo(()=>buildCSS(C,TH,settings.fontSize||14),[C,TH,settings.fontSize]);

  const showToast=useCallback(msg=>{
    if(toastRef.current) clearTimeout(toastRef.current);
    setToast({msg,on:true});
    toastRef.current=setTimeout(()=>setToast({msg:"",on:false}),2200);
  },[]);

  const saveXpLog=async(entry)=>{
    setXpLog(prev=>{const next=[entry,...prev].slice(0,100);dbSet("cx_xplog",next,userId);return next;});
  };

  const award=useCallback(async(baseAmt,skillId,curXp,curSkills,curStreaks,label,questId)=>{
    const skPerLv=settings.xp.skillPerLevel||6000;
    const streak=skillId?(curStreaks[skillId]||{count:0}):{count:0};
    const multiplier=getMultiplier(streak.count);
    const amt=Math.round(baseAmt*multiplier);
    const nx=curXp+amt; setXp(nx); await dbSet("cx_xp",nx,userId);
    let leveledUp=null, newSkills=curSkills;
    if(skillId){
      newSkills=curSkills.map(s=>{
        if(s.id!==skillId) return s;
        const oldLv=skillLv(s.xp,skPerLv), newXp=s.xp+amt, newLv=skillLv(newXp,skPerLv);
        if(newLv>oldLv) leveledUp={name:s.name,level:newLv};
        return {...s,xp:newXp};
      });
      setSkills(newSkills); await dbSet("cx_skills",newSkills,userId);
    }
    const sk=curSkills.find(s=>s.id===skillId);
    await saveXpLog({id:uid(),amt,label:label||"Task",skill:sk?.name||null,skillId:skillId||null,questId:questId||null,multiplier,created:Date.now()});
    return {amt,multiplier,leveledUp,newSkills};
  },[settings.xp.skillPerLevel]);

  const saveT=useCallback(async t=>{setTasks(t);await dbSet("cx_tasks",t,userId);},[userId]);
  const saveQ=useCallback(async q=>{setQuests(q);await dbSet("cx_quests",q,userId);},[userId]);
  const saveM=useCallback(async m=>{setMeds(m);await dbSet("cx_meds",m,userId);},[userId]);
  const savePT=useCallback(async t=>{setPracticeTypes(t);await dbSet("cx_ptypes",t,userId);},[userId]);
  const addPracticeType=useCallback(async d=>{await savePT([...practiceTypes,{id:uid(),label:d.label,icon:d.icon||"◎"}]);},[savePT,practiceTypes]);
  const deletePracticeType=useCallback(async id=>{await savePT(practiceTypes.filter(t=>t.id!==id));},[savePT,practiceTypes]);
  const saveS=useCallback(async s=>{setSkills(s);await dbSet("cx_skills",s,userId);},[userId]);
  const reorderSkills=useCallback(async newOrder=>{setSkills(newOrder);await dbSet("cx_skills",newOrder,userId);},[userId]);
  const saveStr=useCallback(async s=>{setStreaks(s);await dbSet("cx_streaks",s,userId);},[userId]);

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
    const xpVal=d.xpVal||( d.type==="main"?Number(L.mainXp)||80:d.type==="side"?Number(L.sideXp)||50:Number(L.radiantXp)||30 );
    const qSkills=d.skills||(d.skill?[d.skill]:[]);
    await saveQ([{id:uid(),...d,skills:qSkills,xpVal,done:false,priority:d.priority||"med",cooldown:d.type==="radiant"?(d.cooldown??60*60*1000):undefined,created:Date.now()},...quests]);
    showToast("Quest accepted");
  };
  const toggleQuest=async id=>{
    const q=quests.find(q=>q.id===id); if(!q) return;
    // Chain lock: can't complete if prerequisite quest isn't done
    if(!q.done&&q.unlocksAfter){
      const prereq=quests.find(p=>p.id===q.unlocksAfter);
      if(prereq&&!prereq.done){showToast(`🔒 Complete "${prereq.title}" first`);return;}
    }
    if(q.type==="radiant"){
      if(!radiantAvailable(q)){
        showToast(`Available in ${radiantCooldownLabel(q)}`); return;
      }
      const qSkills=q.skills||[]; const primary=qSkills[0]||null;
      let newStr=streaks;
      if(primary){ newStr=updateStreak(streaks,primary); await saveStr(newStr); }
      const {amt,multiplier,leveledUp}=await award(q.xpVal,primary,xp,skills,newStr,`◉ ${q.title}`,q.id);
      const streak=newStr[primary]||{count:0};
      // Store lastDone timestamp on the quest
      await saveQ(quests.map(qq=>qq.id===id?{...qq,lastDone:Date.now()}:qq));
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
      const {amt,leveledUp}=await award(q.xpVal,primary,xp,skills,streaks,`${prefix} ${q.title}`,q.id);
      showToast(`+${amt} ${L.xpName}`);
      if(leveledUp) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      setPendingPractice({skillId:primary,questTitle:q.title,questType:q.type});
      setTab("practice");
    }
  };
  const deleteQuest=async id=>saveQ(quests.filter(q=>q.id!==id));
  const addSubquest=async(questId,title,xpVal=10)=>{
    await saveQ(quests.map(q=>q.id!==questId?q:{...q,subquests:[...(q.subquests||[]),{id:uid(),title,xpVal,done:false}]}));
  };
  const toggleSubquest=async(questId,subId)=>{
    const parentQ=quests.find(q=>q.id===questId);
    const sub=(parentQ?.subquests||[]).find(s=>s.id===subId);
    const wasUndone=sub&&!sub.done;
    if(wasUndone&&sub.xpVal){
      const primary=(parentQ.skills||[])[0]||null;
      const {amt,leveledUp}=await award(sub.xpVal,primary,xp,skills,streaks,`◇ ${sub.title}`);
      showToast(`+${amt} ${settings.labels.xpName}`);
      if(leveledUp) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
    }
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
    setJournal(next); await dbSet("cx_journal",next,userId);
    showToast("Entry saved");
  };
  const deleteJournalEntry=async(id)=>{
    const next=journal.filter(e=>e.id!==id);
    setJournal(next); await dbSet("cx_journal",next,userId);
  };

  // ── COMMUNITY FUNCTIONS ──────────────────────────────────────────────────
  const publishProfile=async(overrideSettings)=>{
    if(!userId) return;
    const s=overrideSettings||settings;
    if(!s.profile.public){ await communityDelete(userId); return; }
    const pubSkills=skills.filter(sk=>sk.published);
    const pubQuests=quests.filter(q=>q.published);
    const radiantStats=pubQuests.filter(q=>q.type==="radiant").map(q=>{
      const sessions=(meds||[]).filter(m=>m.questId===q.id);
      return {id:q.id,title:q.title,color:q.color,completions30:sessions.filter(m=>m.created>Date.now()-30*86400000).length,notesPublic:q.notesPublic||false,note:q.notesPublic?q.note:"",intention:q.intention||""};
    });
    const profileData={
      userId, code:genFriendCode(userId),
      name:s.profile.public?s.profile.name:"Anonymous",
      level:Math.floor(xp/(settings.xp.globalPerLevel||600))+1,
      xp, totalPractice:(meds||[]).length,
      journalCount:(journal||[]).length,
      streaks,
      publishedAt:Date.now(),
      skills:[...pubSkills,...skills.filter(sk=>sk.type==="subskill"&&sk.published)].map(sk=>{
        const streak=streaks[sk.id]?.count||0;
        const lv=Math.floor((sk.xp||0)/(settings.xp.skillPerLevel||6000))+1;
        return {id:sk.id,name:sk.name,icon:sk.icon,color:sk.color,category:sk.category||"other",intention:sk.intention||"",level:lv,streak,notesPublic:sk.notesPublic||false,xp:sk.xp||0,type:sk.type||"skill",parentIds:sk.parentIds||[]};
      }),
      radiantQuests:radiantStats,
    };
    await communitySet(userId,profileData);
  };

  const addFriend=async(code)=>{
    const trimCode=code.trim();
    if(!trimCode) return;
    // Search community for this code
    const all=await communityList();
    const found=all.find(p=>p.code===trimCode);
    if(!found){ showToast("Friend code not found"); return; }
    if(found.userId===userId){ showToast("That's your own code!"); return; }
    if(friends.find(f=>f.userId===found.userId)){ showToast("Already friends"); return; }
    const next=[...friends,{userId:found.userId,name:found.name,code:trimCode,addedAt:Date.now()}];
    setFriends(next); await sset("cx_friends",next);
    showToast(`Added ${found.name||"friend"}`);
  };

  const removeFriend=async(fUserId)=>{
    const next=friends.filter(f=>f.userId!==fUserId);
    setFriends(next); await sset("cx_friends",next);
  };

  const refreshCommunity=async()=>{
    const all=await communityList();
    setCommunityProfiles(all);
  };

  const editSkillPublish=async(skillId,patch)=>{
    const next=skills.map(sk=>sk.id===skillId?{...sk,...patch}:sk);
    await saveS(next);
    setTimeout(publishProfile,100);
  };

  const editQuestPublish=async(questId,patch)=>{
    const next=quests.map(q=>q.id===questId?{...q,...patch}:q);
    await saveQ(next);
    setTimeout(publishProfile,100);
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
    const nx=xp+amt; setXp(nx); await dbSet("cx_xp",nx,userId);
    for(const sid of skillIds){
      curSkillsState=curSkillsState.map(s=>{
        if(s.id!==sid) return s;
        const oldLv=skillLv(s.xp,skPerLvLocal),newXp=s.xp+amt,newLv=skillLv(newXp,skPerLvLocal);
        if(newLv>oldLv) leveledUpAll.push({name:s.name,level:newLv});
        return {...s,xp:newXp};
      });
    }
    if(skillIds.length){setSkills(curSkillsState);await dbSet("cx_skills",curSkillsState,userId);}
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
      setJournal(next); await dbSet("cx_journal",next,userId);
    }
    let msg=`+${amt} ${L.xpName}`;
    if(multiplier>1) msg+=` · ${streak.count}d ${L.comboName||"Combo"} ${multiplier}×`;
    showToast(msg);
    leveledUpAll.forEach((lu,i)=>setTimeout(()=>showToast(`◆ ${lu.name} Level ${lu.level}`),(i+1)*600));
    setPendingPractice(null);
  };
  const deleteMed=async id=>saveM(meds.filter(m=>m.id!==id));
  const editMed=async(id,updates)=>saveM(meds.map(m=>m.id===id?{...m,...updates}:m));

  const editTask=async(id,updates)=>{await saveT(tasks.map(t=>t.id===id?{...t,...updates}:t));showToast("Task updated");};
  const editQuest=async(id,updates)=>{await saveQ(quests.map(q=>q.id===id?{...q,...updates}:q));showToast("Quest updated");};

  const importData=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const data=JSON.parse(await file.text());
      if(data.tasks){setTasks(data.tasks);await dbSet("cx_tasks",data.tasks,userId);}
      if(data.quests){setQuests(data.quests);await dbSet("cx_quests",data.quests,userId);}
      if(data.skills){setSkills(data.skills);await dbSet("cx_skills",data.skills,userId);}
      if(data.meds){setMeds(data.meds);await dbSet("cx_meds",data.meds,userId);}
      if(data.xp!=null){setXp(data.xp);await dbSet("cx_xp",data.xp,userId);}
      if(data.streaks){setStreaks(data.streaks);await dbSet("cx_streaks",data.streaks,userId);}
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
  // weekDays only changes at midnight — memoize so it doesn't rebuild every render
  const weekDays=useMemo(()=>getWeekDays(),[]);
  // periodTasks filters tasks array — memoize on actual deps
  const periodTasks=useMemo(()=>{
    if(period==="daily") return tasks.filter(t=>t.period==="daily"&&t.dayKey===todayKey());
    if(period==="weekly") return tasks.filter(t=>t.period==="weekly");
    return tasks.filter(t=>t.period==="monthly");
  },[tasks,period]);
  // Must be before any conditional returns — hooks cannot be after early returns
  const ctxValue=useMemo(()=>({settings,saveSettings}),[settings,saveSettings]);

  const NAV=[
    {id:"planner",  icon:"□", label:L.plannerTab},
    {id:"quests",   icon:"◆", label:L.questsTab},
    {id:"skills",   icon:"◈", label:L.skillsTab},
    {id:"practice", icon:"◉", label:L.practiceTab},
    {id:"journal",  icon:"✦", label:L.journalTab},
    {id:"advisor",  icon:"◎", label:L.advisorTab},
    {id:"community",icon:"⬡", label:"Community"},
    {id:"settings", icon:"⚙", label:L.settingsTab},
  ];

  if(!loaded) return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,height:"100vh",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,background:"#0c0c0c",color:"#555"}}>
    <span>LOADING</span>
    <button onClick={()=>{localStorage.removeItem("cx_settings");window.location.reload();}} style={{background:"none",border:"1px solid #333",borderRadius:4,color:"#444",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,padding:"6px 12px",cursor:"pointer"}}>reset theme if stuck</button>
  </div>;

  if(showAuth) return <AuthScreen onAuth={async s=>{
    if(s){ setSession(s); setUserId(s.user.id); setShowAuth(false); await loadData(s.user.id); }
    else { setShowAuth(false); }
  }}/>;


  return (
    <SettingsCtx.Provider value={ctxValue}>
      <style>{css}</style>
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
              <div className="row-gap8">
                <span className="lv-badge">{L.levelName} {level}</span>
                {userId&&<button onClick={handleSignOut} title="Sign out" style={{background:"none",border:"none",cursor:"pointer",color:"var(--tx3)",fontSize:11,padding:"2px 4px",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>↪ out</button>}
                {!userId&&<button onClick={()=>setShowAuth(true)} title="Sign in" style={{background:"none",border:"none",cursor:"pointer",color:"var(--tx2,#999999)",fontSize:9,padding:"2px 4px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textDecoration:"underline"}}>sign in</button>}
              </div>
            </div>
            <div className="xp-row">
              <div className="xp-track"><div className="xp-fill" style={{width:`${prog}%`}}/></div>
              <span className="xp-lbl">{xp} {L.xpName}</span>
            </div>
          </header>
          <div className="main-wrap">
          <main className="pg">
            {tab==="planner"  && <PlannerTab period={period} setPeriod={setPeriod} tasks={periodTasks} weekDays={weekDays} allTasks={tasks} skills={skills} quests={quests} onAddTask={addTask} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} onToggleQuest={toggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>}
            {tab==="quests"   && <QuestsTab quests={quests} skills={skills} onAdd={addQuest} onToggle={toggleQuest} onDelete={deleteQuest} onEdit={editQuest} onAddSubquest={addSubquest} onToggleSubquest={toggleSubquest} onDeleteSubquest={deleteSubquest} onReorder={q=>saveQ(q)} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>}
            {tab==="skills"   && <SkillsTab skills={skills} skPerLv={skPerLv} streaks={streaks} meds={meds} xpLog={xpLog} onAdd={addSkill} onAddBatch={addSkillBatch} onDelete={deleteSkill} onEdit={editSkill} onReorder={reorderSkills} onLink={linkSubskill} onAward={async(skillId,amt,reason)=>{const {leveledUp}=await award(amt,skillId,xp,skills,streaks,`✦ ${reason}`);showToast(`+${amt} ${settings.labels.xpName}`);if(leveledUp)setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);}}/>}
            {tab==="practice" && <PracticeTab meds={meds} skills={skills} streaks={streaks} pending={pendingPractice} practiceTypes={practiceTypes} onAddType={addPracticeType} onDeleteType={deletePracticeType} onLog={logMed} onDelete={deleteMed} onEdit={editMed} onClearPending={()=>setPendingPractice(null)}/>}
            {tab==="journal"  && <JournalTab entries={journal} onAdd={addJournalEntry} onDelete={deleteJournalEntry}/>}
            {tab==="advisor"  && <AdvisorTab tasks={tasks} quests={quests} skills={skills} xp={xp} level={level} streaks={streaks} journal={journal} onAddQuest={addQuest} onAddTask={addTask} onLogMed={logMed} onEditQuest={editQuest} aiMemory={aiMemory} onUpdateMemory={async(m)=>{setAiMemory(m);await dbSet("cx_aimem",m,userId);}}/>}
            {tab==="settings" && <SettingsTab showToast={showToast} onExport={exportData} onImport={importData} userId={userId} onSignIn={()=>setShowAuth(true)} onSignOut={handleSignOut}/>}
            {tab==="community" && <CommunityTab userId={userId} settings={settings} skills={skills} quests={quests} meds={meds} journal={journal} streaks={streaks} xp={xp} friends={friends} myFriendCode={myFriendCode} profiles={communityProfiles} onPublishProfile={publishProfile} onAddFriend={addFriend} onRemoveFriend={removeFriend} onRefresh={refreshCommunity} onEditSkillPublish={editSkillPublish} onEditQuestPublish={editQuestPublish} onSaveSettings={saveSettings} showToast={showToast}/>}
          </main>
          </div>
          {/* Weekly Review floating button */}
          <button className="review-btn" onClick={()=>setShowReview(true)} title="Weekly Review">◈ Review</button>
          {showReview&&<WeeklyReview tasks={tasks} quests={quests} skills={skills} meds={meds} xpLog={xpLog} journal={journal} settings={settings} onClose={()=>setShowReview(false)} onNavigate={id=>{setShowReview(false);handleTabChange(id);}}/>}
          {/* Jarvis FAB */}
          <button onClick={()=>setShowJarvis(true)} style={{position:"fixed",bottom:72,right:16,width:44,height:44,borderRadius:"50%",background:"var(--s2)",border:"1px solid var(--b2)",color:"var(--tx)",fontSize:18,cursor:"pointer",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)",transition:"all .15s"}} title="Jarvis AI">⟡</button>
          {showJarvis&&<JarvisOverlay tasks={tasks} quests={quests} skills={skills} onAddQuest={addQuest} onAddTask={addTask} onLogMed={logMed} onClose={()=>setShowJarvis(false)}/>}
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

function QuestPlannerCard({quest,skills,onToggle,radiantAvailable,radiantCooldownLabel,locked,prereqTitle}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const isRadiant=quest.type==="radiant";
  const rAvail=isRadiant&&radiantAvailable?radiantAvailable(quest):true;
  const rCool=isRadiant&&radiantCooldownLabel?radiantCooldownLabel(quest):null;
  const dueFmt=quest.due?new Date(quest.due).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
  const now=Date.now();
  const overdue=quest.due&&quest.due<now&&!quest.done;
  return (
    <div className={`card quest-${quest.type} ${quest.done?"done":""}`}
      style={{marginBottom:3,borderColor:locked?"var(--b1)":overdue?"var(--danger)":"var(--primaryb)",background:locked?"var(--bg)":"var(--primaryf)",opacity:locked?.55:1}}>
      <button className="chk" style={locked?{color:"var(--tx3)",borderColor:"var(--b1)",cursor:"not-allowed"}:{color:"var(--primary)",borderColor:"var(--primaryb)"}}
        onClick={()=>onToggle(quest.id)} title={locked?`Locked — complete "${prereqTitle}" first`:undefined}>
        {locked?"🔒":quest.done?"✓":""}
      </button>
      <div className="cbody">
        {locked&&<div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginBottom:2}}>after: {prereqTitle}</div>}
        <div className={`ctitle ${quest.done?"done":locked?"":""}`} style={locked?{color:"var(--tx3)"}:{}}>{quest.title}</div>
        <div className="cmeta">
          <span className="ctag" style={{color:"var(--primary)",borderColor:"var(--primaryb)"}}>◆ {isRadiant?"Radiant":"Quest"}</span>
          {qSkills.map(sk=><span key={sk.id} className="ctag" style={{borderColor:sk.color+"44",color:sk.color,display:"inline-flex",alignItems:"center",gap:3}}><SkIcon s={sk} sz={10}/>{sk.name}</span>)}
          <span className="ctag">{quest.xpVal} {L.xpName}</span>
          {dueFmt&&<span className="ctag" style={{color:overdue?"var(--danger)":"var(--tx3)"}}>{overdue?"⚠ due ":"due "}{dueFmt}</span>}
        </div>
      </div>
    </div>
  );
}

function PlannerTab({period,setPeriod,tasks,weekDays,allTasks,skills,quests,onAddTask,onToggle,onDelete,onEdit,onToggleQuest,radiantAvailable,radiantCooldownLabel}){
  const {settings}=useSettings(); const L=settings.labels;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({title:"",skill:"",xpVal:20,questId:"",recurrenceDays:[]});
  const WDAY_LABELS=["Mo","Tu","We","Th","Fr","Sa","Su"];
  const toggleWday=i=>setF(v=>({...v,recurrenceDays:v.recurrenceDays.includes(i)?v.recurrenceDays.filter(x=>x!==i):[...v.recurrenceDays,i]}));
  useEffect(()=>{if(skills.length&&!f.skill)setF(v=>({...v,skill:skills[0]?.id||""}));},[skills]);
  const submit=()=>{
    if(!f.title.trim()) return;
    onAddTask({title:f.title.trim(),period,skill:f.skill||null,xpVal:f.xpVal,questId:f.questId||null,recurrenceDays:period==="weekly"&&f.recurrenceDays.length?f.recurrenceDays:null});
    setF(v=>({...v,title:"",questId:"",recurrenceDays:[]})); setShowForm(false);
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
  const availableRadiant=(quests||[]).filter(q=>q.type==="radiant"&&(radiantAvailable?radiantAvailable(q):true));
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
            {skills.map(s=><option key={s.id} value={s.id}>{skillLabel(s)}</option>)}
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
        {period==="weekly"&&<div style={{marginBottom:8}}>
          <div className="label9" style={{marginBottom:5}}>Repeat on days <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(optional)</span></div>
          <div style={{display:"flex",gap:4}}>
            {WDAY_LABELS.map((d,i)=>(
              <button key={i} onClick={()=>toggleWday(i)}
                style={{flex:1,padding:"4px 0",borderRadius:3,border:`1px solid ${f.recurrenceDays.includes(i)?"var(--primary)":"var(--b2)"}`,background:f.recurrenceDays.includes(i)?"var(--primaryf)":"var(--bg)",color:f.recurrenceDays.includes(i)?"var(--primary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",transition:"all .15s"}}>
                {d}
              </button>
            ))}
          </div>
        </div>}
        <button className="fsbtn" onClick={submit}>Add Task</button>
      </div>
    ):<button className="addbtn" onClick={()=>setShowForm(true)}><span>+</span> Add task</button>}
    {period==="weekly"?(weekDays.map((d,i)=>{
      const dk=dayKey(d), isToday=dk===dayKey(new Date()), dayIdx=i; // 0=Mon..6=Sun
      const dt=[...new Map([...allTasks.filter(t=>t.dayKey===dk),...allTasks.filter(t=>t.period==="weekly"&&(t.recurrenceDays||[]).includes(dayIdx))].map(t=>[t.id,t])).values()];
      const dq=questsForDay(dk);
      return (
        <div key={i} className="wk-day">
          <div className={`wk-day-lbl ${isToday?"today":""}`}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} {d.getDate()}{isToday?" · today":""}</div>
          {dt.length===0&&dq.length===0?<div style={{fontSize:12,color:"var(--tx3)",paddingLeft:2}}>—</div>:<>
            {dq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>)}
            <div className="clist">{dt.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div>
          </>}
        </div>
      );
    })):(
      <>
        {(todayQuests.length>0||availableRadiant.length>0)&&period==="daily"&&<>
          {todayQuests.length>0&&<>
            <div className="slbl" style={{marginBottom:6}}>◆ Quests due today</div>
            {todayQuests.map(q=>{
              const prereq=(quests||[]).find(p=>p.id===q.unlocksAfter);
              const locked=prereq&&!prereq.done;
              return <QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} locked={locked} prereqTitle={prereq?.title}/>;
            })}
          </>}
          {availableRadiant.length>0&&<>
            <div className="slbl" style={{marginBottom:6,marginTop:todayQuests.length?8:0}}>◉ Ready to practice</div>
            {availableRadiant.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>)}
          </>}
          {(active.length>0||done.length>0)&&<div className="gap"/>}
        </>}
        {period==="monthly"&&(()=>{
          const now=new Date(); const mq=questsForMonth(now.getFullYear(),now.getMonth());
          return mq.length>0?<><div className="slbl" style={{marginBottom:6}}>◆ Quests this month</div>
            {mq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>)}
            {(active.length>0||done.length>0)&&<div className="gap"/>}</>:null;
        })()}
        {active.length===0&&done.length===0&&todayQuests.length===0&&(
      <div className="empty-state">
        <div className="es-icon">☐</div>
        <div className="es-title">No tasks yet</div>
        <div className="es-desc">Tasks are small repeatable actions — daily, weekly, monthly. Link them to skills and quests to build momentum toward your bigger goals.</div>
      </div>
    )}
        <div className="clist">{active.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div>
        {done.length>0&&<><div className="gap"/><div className="slbl">{L.done}</div>
          <div className="clist">{done.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div></>}
      </>
    )}
  </>);
}

function QuestsTab({quests,skills,onAdd,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest,onReorder,radiantAvailable,radiantCooldownLabel}){
  const {settings}=useSettings(); const L=settings.labels;
  const [form,setForm]=useState(null);
  const [search,setSearch]=useState("");
  const [filterPrio,setFilterPrio]=useState("");
  const [sortBy,setSortBy]=useState("manual"); // "manual" | "priority" | "due"
  const [f,setF]=useState({title:"",skillIds:[],note:"",dueDate:"",type:"main",priority:"med",color:null,cooldown:60*60*1000});
  const [qXpSug,setQXpSug]=useState(null);
  const [qXpLoad,setQXpLoad]=useState(false);
  const openForm=t=>{ setForm(t); setF({title:"",skillIds:[],note:"",dueDate:"",type:t,priority:"med",color:null,cooldown:60*60*1000}); setQXpSug(null); };
  const toggleQSkill=id=>setF(v=>{const next=v.skillIds.includes(id)?v.skillIds.filter(x=>x!==id):[...v.skillIds,id];const auto=next.length>0?(skills.find(s=>s.id===next[0])?.color)||null:null;return {...v,skillIds:next,color:v.color!==null?v.color:auto};});
  const submit=()=>{
    if(!f.title.trim()) return;
    const due=f.dueDate?new Date(f.dueDate+"T09:00").getTime():null;
    onAdd({title:f.title.trim(),type:form,skills:f.skillIds,note:f.note.trim(),due,priority:f.priority,color:f.color||null,xpVal:qXpSug?.xp||null,cooldown:f.cooldown});
    setForm(null); setQXpSug(null);
  };
  const suggestNewQuestXp=async()=>{
    if(!f.title.trim()) return;
    setQXpLoad(true); setQXpSug(null);
    const typeLabel=form==="main"?"main quest":form==="side"?"side quest":"radiant/repeatable quest";
    try{
      const _qp='Quest in a gamified life tracker: "'+f.title+'"'+(f.note?'. Intention: "'+f.note+'"':'')+'. Type: '+typeLabel+'. Priority: '+(f.priority||'med')+'. XP scale: 6000 XP = 1 level. Judge SCOPE: radiant/daily=20-60, side/hours-days=100-800, main/weeks-months=600-8000, impactful main=8000-20000, life-defining quest=20000-30000 (hard cap). Use high end sparingly — most mains should be 600-4000. Reply ONLY with JSON: {"xp":number,"reason":"one sentence"}.';
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:_qp}]
        })});
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
  const PRIO_ORDER={"high":0,"med":1,"low":2};
  const sortQ=arr=>{
    if(sortBy==="priority") return [...arr].sort((a,b)=>(PRIO_ORDER[a.priority||"med"]||1)-(PRIO_ORDER[b.priority||"med"]||1));
    if(sortBy==="due") return [...arr].sort((a,b)=>(a.due||Infinity)-(b.due||Infinity));
    return arr;
  };
  const mainA=sortQ(quests.filter(q=>q.type==="main"&&!q.done&&filterQ(q)));
  const mainD=sortQ(quests.filter(q=>q.type==="main"&&q.done&&filterQ(q)));
  const side=sortQ(quests.filter(q=>q.type==="side"&&filterQ(q)));
  const radiant=sortQ(quests.filter(q=>q.type==="radiant"&&filterQ(q)));

  // Quest drag-to-reorder via pointer events (mobile + desktop)
  const {getProps:getQDragProps}=useDrag({items:quests,onReorder,idKey:"id"});
  return (<>
    <div className="search-row">
      <input className="search-input" placeholder="Search quests..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select className="fsel" style={{width:"auto"}} value={filterPrio} onChange={e=>setFilterPrio(e.target.value)}>
        <option value="">All</option>
        <option value="high">High</option>
        <option value="med">Med</option>
        <option value="low">Low</option>
      </select>
      <button onClick={()=>setSortBy(v=>v==="manual"?"priority":v==="priority"?"due":"manual")}
        style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,padding:"5px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:sortBy!=="manual"?"var(--primary)":"var(--tx3)",flexShrink:0,whiteSpace:"nowrap"}}
        title="Sort order">
        {sortBy==="manual"?"⇅ manual":sortBy==="priority"?"⬤ priority":"◷ due date"}
      </button>
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
        <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setForm(null)}>✕</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div className="label9" style={{flexShrink:0}}>Resets after</div>
        <select className="fsel" style={{flex:1}} value={f.cooldown} onChange={e=>setF(v=>({...v,cooldown:Number(e.target.value)}))}>
          {COOLDOWN_OPTIONS.map(o=><option key={o.ms} value={o.ms}>{o.label}</option>)}
        </select>
      </div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:44,fontFamily:"inherit",fontSize:12,marginBottom:4,width:"100%",boxSizing:"border-box"}}/>
      <div style={{marginBottom:6}}>
        <div className="label9" style={{marginBottom:5}}>Quest color</div>
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
            <button className="fsbtn" onClick={submit}>{qXpSug?.xp?`Accept · +${qXpSug.xp} ${L.xpName} (AI)`:`Accept · +${L.mainXp} ${L.xpName}`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("main")}><span>+</span> New {L.mainQuest.toLowerCase()}</button>}
    <div className="clist">{mainA.map(q=>(
      <div key={q.id} {...getQDragProps(q.id)}>
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>
      </div>
    ))}</div>
    {mainD.length>0&&<><div className="gap"/><div className="slbl">{L.completed}</div>
      <div className="clist">{mainD.map(q=>(
      <div key={q.id} {...getQDragProps(q.id)}>
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>
      </div>
    ))}</div></>}
    {quests.filter(q=>q.type==="main").length===0&&form!=="main"&&(
      <div className="empty-state">
        <div className="es-icon">◆</div>
        <div className="es-title">No {L.mainQuest.toLowerCase()}s yet</div>
        <div className="es-desc">Main quests are your big goals. Add one to anchor your practice.</div>
        <button className="fsbtn" style={{width:"auto",padding:"8px 16px",margin:"8px auto 0"}} onClick={()=>openForm("main")}>+ Add Quest</button>
      </div>
    )}
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
        <div className="label9" style={{marginBottom:5}}>Quest color</div>
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
            <button className="fsbtn secondary" onClick={submit}>{qXpSug?.xp?`Accept · +${qXpSug.xp} ${L.xpName} (AI)`:`Accept · +${L.sideXp} ${L.xpName}`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("side")}><span>+</span> New {L.sideQuest.toLowerCase()}</button>}
    <div className="clist">{side.map(q=>(
      <div key={q.id} {...getQDragProps(q.id)}>
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>
      </div>
    ))}</div>
    {side.length===0&&form!=="side"&&(
      <div className="empty-state">
        <div className="es-icon">◇</div>
        <div className="es-title">No {L.sideQuest.toLowerCase()}s yet</div>
        <div className="es-desc">Side quests are smaller tasks and experiments — books to read, habits to try, skills to learn. Lower stakes, still worth tracking.</div>
        <button className="fsbtn" style={{width:"auto",padding:"8px 16px",margin:"8px auto 0"}} onClick={()=>openForm("side")}>+ Add Side Quest</button>
      </div>
    )}
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
        <div className="label9" style={{marginBottom:5}}>Quest color</div>
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
            <button className="fsbtn secondary" onClick={submit}>{qXpSug?.xp?`Commit · +${qXpSug.xp} ${L.xpName} per run (AI)`:`Commit · +${L.radiantXp} ${L.xpName} per run`}</button>
    </div>)
      :<button className="addbtn" onClick={()=>openForm("radiant")}><span>+</span> New {L.radiantQuest.toLowerCase()}</button>}
    <div className="clist">{radiant.map(q=>(
      <div key={q.id} {...getQDragProps(q.id)}>
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel}/>
      </div>
    ))}</div>
    {radiant.length===0&&form!=="radiant"&&(
      <div className="empty-state">
        <div className="es-icon">◉</div>
        <div className="es-title">No {L.radiantQuest.toLowerCase()}s yet</div>
        <div className="es-desc">Radiant quests repeat. Meditate daily, stretch every morning, drink water. Each completion awards XP and resets after 1 hour.</div>
        <button className="fsbtn" style={{width:"auto",padding:"8px 16px",margin:"8px auto 0"}} onClick={()=>openForm("radiant")}>+ Add Radiant Quest</button>
      </div>
    )}
  </>);
}

const SKILL_ICONS_EXTRA = ["◈","◉","◎","◆","◬","✦","◌","◊","△","○","□","◇","❋","⊕","◐","◑","⬡","✧","⟡","◿","⚔","🧠","💪","🎯","🎨","📚","🎵","🌱","⚡","🔥","💎","🏆","🎭","🔬","🌟","✍","🎸","🏋","🧘","💻","🗺","🎲","⚙","🛡","🌊","🦾","🧩","🎤","📖","🌙"];

// GitHub-style 90-day streak heatmap
function HeatMap({days, color}){
  const maxVal=Math.max(...days,1);
  // 13 weeks x 7 days = 91 cells, use last 90
  const cells=[...days].slice(-90);
  // pad to multiple of 7
  while(cells.length%7!==0) cells.unshift(0);
  const weeks=[];
  for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
  const dayLabels=["S","M","T","W","T","F","S"];
  return (
    <div style={{overflowX:"auto",marginTop:6}}>
      <div style={{display:"flex",gap:2,alignItems:"flex-start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:2,marginRight:2,paddingTop:0}}>
          {dayLabels.map((d,i)=>(
            <div key={i} style={{height:10,fontSize:7,color:"var(--tx3)",lineHeight:"10px",width:8,textAlign:"center"}}>{i%2===0?d:""}</div>
          ))}
        </div>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{display:"flex",flexDirection:"column",gap:2}}>
            {week.map((val,di)=>{
              const intensity=val===0?0:Math.max(0.15,val/maxVal);
              const bg=val===0?"var(--b1)":`${color}${Math.round(intensity*255).toString(16).padStart(2,"0")}`;
              const title=val?`${val} min`:"No activity";
              return <div key={di} title={title} style={{width:10,height:10,borderRadius:2,background:bg,transition:"background .1s"}}/>;
            })}
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:4,marginTop:4,alignItems:"center"}}>
        <span style={{fontSize:7,color:"var(--tx3)"}}>less</span>
        {[0,.25,.5,.75,1].map(v=>(
          <div key={v} style={{width:10,height:10,borderRadius:2,background:v===0?"var(--b1)":`${color}${Math.round(v*255).toString(16).padStart(2,"0")}`}}/>
        ))}
        <span style={{fontSize:7,color:"var(--tx3)"}}>more</span>
      </div>
    </div>
  );
}


function StreakCalendar({skillId, meds, color}){
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

  // build map: date number -> minutes
  const minMap = {};
  meds.forEach(m => {
    if(!(m.skillIds||[]).includes(skillId)) return;
    const d = new Date(m.created||m.sessionDate||0);
    if(d.getFullYear()===year && d.getMonth()===month) {
      const day = d.getDate();
      minMap[day] = (minMap[day]||0) + m.dur;
    }
  });
  const maxMins = Math.max(...Object.values(minMap), 1);
  const DAY_LABELS = ["S","M","T","W","T","F","S"];
  const cells = [];
  // pad to start on correct dow
  for(let i=0;i<firstDow;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const today = now.getDate();
  const monthName = now.toLocaleDateString("en-US",{month:"short",year:"numeric"});
  return (
    <div style={{marginTop:4}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"var(--tx3)",marginBottom:4}}>{monthName}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {DAY_LABELS.map((l,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:7,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",paddingBottom:2}}>{l}</div>
        ))}
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const mins = minMap[d]||0;
          const isToday = d===today;
          const intensity = mins===0?0:Math.max(0.18, mins/maxMins);
          const bg = mins===0?"var(--b1)":`${color}${Math.round(intensity*255).toString(16).padStart(2,"0")}`;
          return (
            <div key={i} title={mins?`${d}: ${mins} min`:`${d}: no activity`}
              style={{aspectRatio:"1",borderRadius:2,background:bg,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:7,color:isToday?"var(--tx)":"transparent",
                fontFamily:"'DM Mono',monospace",
                border:isToday?"1px solid var(--tx3)":"1px solid transparent",
                transition:"background .1s"}}>
              {isToday?d:""}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function SkillDiscussPanel({skill,skPerLv,streaks,meds,onGrant,onClose}){
  const lv=skillLv(skill.xp,skPerLv);
  const streak=streaks[skill.id]||{count:0};
  const recentSessions=meds.filter(m=>(m.skillIds||[m.skillId]).filter(Boolean).includes(skill.id)).slice(0,12);
  const [msgs,setMsgs]=useState([{role:"assistant",content:`What have you been working on with ${skill.name} lately? Walk me through it — be specific.`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [pendingGrant,setPendingGrant]=useState(null);
  const [granted,setGranted]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const buildSys=()=>{
    const recentDesc=recentSessions.length
      ? recentSessions.map(m=>`${m.type||"session"} ${m.dur}min${m.note?` ("${m.note.slice(0,60)}")`:""}`).join("; ")
      : "none logged yet";
    return `You are an XP evaluator inside a gamified skill tracker. The user wants to discuss their real-world progress in "${skill.name}" and receive fair XP.

SKILL STATE:
- Name: ${skill.name} | Type: ${skill.type||"skill"}
- Level: ${lv} | Total XP: ${skill.xp} | 1 level = ${skPerLv} XP (~100 hours of genuine work)
- Intention: ${skill.intention||"not set"}
- Current streak: ${streak.count} days
- Already-logged sessions (don't re-award these): ${recentDesc}

YOUR ROLE:
Have a genuine conversation to understand what the user has actually accomplished BEYOND what's already logged. Ask follow-up questions when claims are vague. Be direct, not interrogative — you're a coach, not a cop.

XP SCALE:
- Single focused session not yet logged: 30–80 XP
- Breakthrough insight or skill unlock: 100–500 XP  
- Consistent week of work beyond logged: 200–700 XP
- Month of dedicated practice: 500–2500 XP
- Major milestone (first performance, shipped project, test passed): 1000–5000 XP
- Life-changing mastery achievement: 5000–20000 XP (use rarely)

ANTI-GAMING RULES:
- Ask: what specifically, when, how long, what was the outcome
- If they're vague after one follow-up, halve your estimate
- Never award for work already in logged sessions
- If the story doesn't add up to the XP they're hinting at, say so directly
- You can ask clarifying questions across multiple turns

When you're confident — end your message with this exact format on its own line:
GRANT:{"xp":NUMBER,"reason":"one sentence max 15 words"}

Only include GRANT when you have enough info to be fair. It's fine to take 2-4 turns first.`;
  };

  const send=async(txt)=>{
    const msg=(txt||input).trim(); if(!msg||loading) return;
    setInput(""); setLoading(true);
    const history=[...msgs.map(m=>({role:m.role,content:m.content})),{role:"user",content:msg}];
    setMsgs(v=>[...v,{role:"user",content:msg}]);
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:400,messages:[{role:"system",content:buildSys()},...history]})});
      const data=await res.json();
      const raw=data.choices?.[0]?.message?.content||"";
      const grantMatch=raw.match(/GRANT:({"xp":\s*\d+[^}]*})/);
      let display=raw;
      if(grantMatch){
        try{
          const g=JSON.parse(grantMatch[1]);
          if(g.xp>0) setPendingGrant(g);
        }catch{}
        display=raw.replace(/GRANT:\{[^}]+\}/,"").trim();
      }
      setMsgs(v=>[...v,{role:"assistant",content:display||"..."}]);
    }catch{setMsgs(v=>[...v,{role:"assistant",content:"Connection failed."}]);}
    setLoading(false);
  };

  const accept=async()=>{
    if(!pendingGrant||granted) return;
    setGranted(true);
    await onGrant(pendingGrant.xp,pendingGrant.reason);
    setMsgs(v=>[...v,{role:"assistant",content:`✦ Granted +${pendingGrant.xp} XP for: ${pendingGrant.reason}`}]);
    setPendingGrant(null);
  };

  const skColor=skill.color||"var(--primary)";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 70px"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"min(480px,95vw)",background:"var(--s1)",border:`1px solid ${skColor}44`,borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"70vh",boxShadow:"0 8px 40px rgba(0,0,0,.5)"}}>
        {/* header */}
        <div style={{padding:"12px 14px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:10,background:"var(--bg)"}}>
          <SkIcon s={skill} sz={16}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx)",letterSpacing:.5}}>{skill.name}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginTop:1}}>Lv {lv} · {skill.xp} XP total · discuss progress for XP</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:16,lineHeight:1,padding:4}}>✕</button>
        </div>
        {/* messages */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",
              background:m.role==="user"?"var(--s2)":"var(--bg)",
              border:`1px solid ${m.role==="user"?"var(--b2)":"var(--b1)"}`,
              borderRadius:6,padding:"8px 11px",fontSize:12,color:"var(--tx)",lineHeight:1.55,fontFamily:"inherit"}}>
              {m.content}
            </div>
          ))}
          {loading&&<div style={{alignSelf:"flex-start",fontSize:11,color:"var(--tx3)",fontStyle:"italic",fontFamily:"'DM Mono',monospace"}}>thinking...</div>}
          {pendingGrant&&!granted&&(
            <div style={{alignSelf:"stretch",background:"var(--s2)",border:`1px solid ${skColor}55`,borderRadius:6,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:skColor,fontWeight:"bold",marginBottom:2}}>+{pendingGrant.xp} XP</div>
                <div style={{fontSize:11,color:"var(--tx2)",lineHeight:1.4}}>{pendingGrant.reason}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={accept} style={{background:skColor,border:"none",borderRadius:4,color:"#fff",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer",padding:"6px 12px",letterSpacing:.5}}>Accept</button>
                <button onClick={()=>setPendingGrant(null)} style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer",padding:"6px 10px"}}>Discuss more</button>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        {/* input */}
        <div style={{padding:"10px 14px",borderTop:"1px solid var(--b1)",display:"flex",gap:8,background:"var(--bg)"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Describe what you've done..."
            rows={2}
            style={{flex:1,background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:4,padding:"7px 10px",color:"var(--tx)",fontFamily:"inherit",fontSize:12,resize:"none",outline:"none",lineHeight:1.4}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading}
            style={{background:skColor,border:"none",borderRadius:4,color:"#fff",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer",padding:"0 14px",letterSpacing:.5,opacity:!input.trim()||loading?0.4:1,transition:"opacity .15s",flexShrink:0}}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function SkAiCatBtn({name,intention,onAssign}){
  const [loading,setLoading]=useState(false);
  const suggest=async()=>{
    if(!name.trim()) return;
    setLoading(true);
    try{
      const catList=SKILL_CATEGORIES.map(c=>c.id).join(", ");
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:30,
          messages:[{role:"user",content:`Skill: "${name}"${intention?`. Intention: "${intention}"`:""}.\nAssign to exactly one category from: ${catList}.\nReply with ONLY the category id, nothing else.`}]})});
      const data=await res.json();
      const txt=(data.choices?.[0]?.message?.content||data.content?.[0]?.text||"").trim().toLowerCase();
      const valid=SKILL_CATEGORIES.find(c=>txt.includes(c.id));
      if(valid) onAssign(valid.id);
    }catch(e){}
    setLoading(false);
  };
  return (
    <button onClick={suggest} disabled={loading||!name.trim()}
      style={{background:"none",border:"1px solid var(--b2)",borderRadius:"var(--r)",color:"var(--tx3)",fontSize:8,padding:"2px 6px",cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:.5,opacity:loading?.5:1}}>
      {loading?"◌":"⟡"} AI
    </button>
  );
}

function SkillsTab({skills,skPerLv,streaks,meds,xpLog,onAdd,onAddBatch,onDelete,onEdit,onReorder,onLink,onAward}){
  const {settings}=useSettings(); const L=settings.labels;
  const mainSkills=skills.filter(s=>s.type!=="subskill");
  const subSkills=skills.filter(s=>s.type==="subskill");

  // view state
  const [viewMode,setViewMode]=useState("grid");
  const [expandedId,setExpandedId]=useState(null);
  const [calViewIds,setCalViewIds]=useState(new Set()); // skill IDs showing calendar view
  const toggleCalView=id=>setCalViewIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const [discussSkillId,setDiscussSkillId]=useState(null);
  const [collapsedGroups,setCollapsedGroups]=useState(new Set());
  const toggleGroup=id=>setCollapsedGroups(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const [editingId,setEditingId]=useState(null);
  const [ef,setEf]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],customImg:null,intention:"",category:"other",published:false,notesPublic:false});

  // add form state (shared, type toggled)
  const [showForm,setShowForm]=useState(false);
  const [formType,setFormType]=useState("skill");
  const [showPresets,setShowPresets]=useState(false);
  const [f,setF]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],startLevel:1,customImg:null});

  // drag state — HTML5 drag API (fixes pointer-capture bug)
  const [dragId,setDragId]=useState(null);
  const [dragType,setDragType]=useState(null); // "skill"|"subskill"
  const [dragOverId,setDragOverId]=useState(null);
  const [linkTarget,setLinkTarget]=useState(null);
  const skDragRef=useRef({id:null,type:null});

  const getSkDragProps=(id,section)=>({
    draggable:true,
    onDragStart:(e)=>{
      skDragRef.current={id,type:section};
      setDragId(id); setDragType(section);
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",id);
    },
    onDragOver:(e)=>{
      e.preventDefault();
      const {id:fromId,type:fromType}=skDragRef.current;
      if(!fromId||fromId===id) return;
      if(fromType==="subskill"&&section==="skill") setLinkTarget(id);
      else if(fromType===section){ setDragOverId(id); setLinkTarget(null); }
    },
    onDragLeave:(e)=>{
      if(!e.currentTarget.contains(e.relatedTarget)){
        setDragOverId(v=>v===id?null:v);
        setLinkTarget(v=>v===id?null:v);
      }
    },
    onDrop:(e)=>{
      e.preventDefault();
      const {id:fromId,type:fromType}=skDragRef.current;
      if(!fromId||fromId===id) return;
      if(fromType==="subskill"&&section==="skill"){
        onLink(fromId,id);
      } else if(fromType===section){
        const arr=section==="skill"?[...mainSkills]:[...subSkills];
        const from=arr.findIndex(s=>s.id===fromId);
        const to=arr.findIndex(s=>s.id===id);
        if(from!==-1&&to!==-1&&from!==to){
          const[m]=arr.splice(from,1); arr.splice(to,0,m);
          onReorder(section==="skill"?[...arr,...subSkills]:[...mainSkills,...arr]);
        }
      }
      skDragRef.current={id:null,type:null};
      setDragId(null); setDragType(null); setDragOverId(null); setLinkTarget(null);
    },
    onDragEnd:()=>{
      skDragRef.current={id:null,type:null};
      setDragId(null); setDragType(null); setDragOverId(null); setLinkTarget(null);
    },
    style:{
      opacity:dragId===id?0.4:1,
      outline:(dragType==="subskill"&&linkTarget===id)?`2px dashed ${(skills.find(s=>s.id===id)||{}).color||"var(--primary)"}`:
               (dragOverId===id&&dragType===section)?"2px dashed var(--primary)":"none",
      outlineOffset:2,
      cursor:"grab",
      transition:"opacity .1s",
    }
  });

  // activity map — 90 days for heatmap, 14-day slice for bar chart
  const activityMap=useMemo(()=>{
    const map={}; const now=Date.now(); const DAY=86400000;
    skills.forEach(s=>{
      const days=[];
      for(let i=89;i>=0;i--){
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
  const openEdit=s=>{setEf({name:s.name,icon:s.icon,color:s.color,customImg:s.customImg||null,intention:s.intention||"",category:s.category||"other",published:s.published||false,notesPublic:s.notesPublic||false});setEditingId(s.id);};
  const submitEdit=()=>{
    if(!ef.name.trim()) return;
    onEdit(editingId,{name:ef.name.trim(),icon:ef.icon,color:ef.color,customImg:ef.customImg||null,intention:ef.intention||"",category:ef.category||"other",published:ef.published||false,notesPublic:ef.notesPublic||false});
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
      <div className="label9" style={{flexShrink:0}}>Starting {L.levelName}</div>
      <input className="fi" type="number" min={1} max={99} style={{maxWidth:65,textAlign:"center"}} value={f.startLevel} onChange={e=>setF(v=>({...v,startLevel:e.target.value}))}/>
      <div style={{fontSize:11,color:"var(--tx3)",fontStyle:"italic",flex:1}}>{Number(f.startLevel)>1?`Pre-loads ${((Number(f.startLevel)||1)-1)*skPerLv} ${L.xpName}`:"Starting fresh"}</div>
    </div>}
    <div className="label9" style={{marginBottom:7,marginTop:4}}>Icon</div>
    <div className="icon-grid">{SKILL_ICONS_EXTRA.map(ic=><button key={ic} className={`icon-opt ${f.icon===ic?"on":""}`} onClick={()=>setF(v=>({...v,icon:ic,customImg:null}))}>{ic}</button>)}</div>
    <div className="label9" style={{marginBottom:5}}>Or upload image</div>
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
      {f.customImg?<img src={f.customImg} style={{width:32,height:32,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>:<span style={{fontSize:11,color:"var(--tx3)"}}>No image</span>}
      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e,setF)}/>
      <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
      {f.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,customImg:null,icon:"◈"}))}>✕</button>}
    </label>
    <div className="label9" style={{marginBottom:7}}>Color</div>
    <div className="color-grid">{SKILL_COLORS.map(c=><div key={c} className={`color-opt ${f.color===c?"on":""}`} style={{background:c}} onClick={()=>setF(v=>({...v,color:c}))}/>)}</div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,marginBottom:8}}>
      <div className="label9" style={{flexShrink:0}}>Custom</div>
      <input type="color" value={f.color||"#888888"} onChange={e=>setF(v=>({...v,color:e.target.value}))}
        style={{width:32,height:24,padding:0,border:"1px solid var(--b2)",borderRadius:3,background:"none",cursor:"pointer"}}/>
      <div style={{width:18,height:18,borderRadius:"50%",background:f.color||"var(--tx3)",border:"1px solid var(--b2)",flexShrink:0}}/>
      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{f.color}</span>
    </div>
    <button className="fsbtn" onClick={submit}>Create {formType}</button>
  </div>);

  // ── skill card renderer ────────────────────────────────────────────────────
  const renderSkillCard=(s,i,section)=>{
    const lv=skillLv(s.xp,skPerLv),pg=skillProg(s.xp,skPerLv),cur=s.xp%skPerLv;
    const streak=streaks[s.id]||{count:0}; const mult=getMultiplier(streak.count);
    const allDays=activityMap[s.id]||[]; const days=allDays.slice(-14); const maxMins=Math.max(...days,1);
    const isExpanded=expandedId===s.id;
    const isLinkHover=linkTarget===s.id&&dragType==="subskill";
    const isReorderHover=dragOverId===s.id&&dragType===section;
    const linked=section==="skill"?subSkills.filter(ss=>(ss.parentIds||[]).includes(s.id)):[];
    const parents=section==="subskill"?(s.parentIds||[]).map(pid=>skills.find(sk=>sk.id===pid)).filter(Boolean):[];

    if(viewMode==="list"){
      return (
        <div key={s.id} id={"sk-"+s.id}
          {...getSkDragProps(s.id,section)}
          onClick={()=>setExpandedId(isExpanded?null:s.id)}
          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
            background:"var(--s1)",border:`1px solid ${isLinkHover?s.color:"var(--b1)"}`,
            borderRadius:"var(--r)",marginBottom:4,
            borderStyle:isLinkHover?"dashed":"solid",
            ...getSkDragProps(s.id,section).style}}>
          <span style={{color:"var(--tx3)",fontSize:9,flexShrink:0,cursor:"grab",userSelect:"none"}} title="Drag to reorder">⠿</span>
          <SkIcon s={s} sz={13}/>
          <span style={{flex:1,fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx)"}}>{s.name}</span>
          {streak.count>=3&&<span className="sk-streak" style={{fontSize:8}}>{streak.count}d{mult>1?` ${mult}×`:""}</span>}
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",flexShrink:0}}>{L.levelName} {lv}</span>
          <div style={{width:60,height:4,background:"var(--b1)",borderRadius:2,flexShrink:0}}>
            <div style={{width:`${pg}%`,height:"100%",background:s.color,borderRadius:2}}/>
          </div>
          {section==="subskill"&&parents.length>0&&<div style={{display:"flex",gap:3}}>
            {parents.map(p=><SkIcon key={p.id} s={p} sz={12} style={{marginRight:2}} />)}
          </div>}
          <button className="sk-delbtn" style={{marginLeft:2}} onClick={e=>{e.stopPropagation();openEdit(s);}}>✎</button>
          <button className="sk-delbtn" onClick={e=>{e.stopPropagation();onDelete(s.id);}}>✕</button>
        </div>
      );
    }

    // grid card
    if(editingId===s.id){
      return (
        <div key={s.id} id={"sk-"+s.id} style={{gridColumn:"1 / -1"}}>
          <div className="fwrap" style={{marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div className="label9">Edit {s.type||"skill"}</div>
              <button onClick={()=>setEditingId(null)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
            </div>
            <input className="fi full" value={ef.name} onChange={e=>setEf(v=>({...v,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitEdit()} style={{marginBottom:8}}/>
            <div className="label9" style={{marginBottom:4,marginTop:2}}>Intention</div>
            <textarea className="fi full" rows={2} placeholder="e.g. build consistent meditation practice..." value={ef.intention} onChange={e=>setEf(v=>({...v,intention:e.target.value}))} style={{resize:"vertical",lineHeight:1.4,marginBottom:8}}/>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div className="label9">Category</div>
              <SkAiCatBtn name={ef.name} intention={ef.intention} onAssign={cat=>setEf(v=>({...v,category:cat}))}/>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {SKILL_CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setEf(v=>({...v,category:cat.id}))}
                  style={{padding:"3px 8px",borderRadius:"var(--r)",border:`1px solid ${ef.category===cat.id?"var(--primary)":"var(--b2)"}`,background:ef.category===cat.id?"var(--primaryf)":"var(--s2)",color:ef.category===cat.id?"var(--primary)":"var(--tx2)",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,paddingTop:4,borderTop:"1px solid var(--b1)"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flex:1}}>
                <input type="checkbox" checked={ef.published||false} onChange={e=>setEf(v=>({...v,published:e.target.checked}))} style={{accentColor:"var(--primary)"}}/>
                <span style={{fontSize:11,color:"var(--tx2)"}}>Publish to community</span>
              </label>
              {ef.published&&<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={ef.notesPublic||false} onChange={e=>setEf(v=>({...v,notesPublic:e.target.checked}))} style={{accentColor:"var(--primary)"}}/>
                <span style={{fontSize:11,color:"var(--tx2)"}}>Share notes</span>
              </label>}
            </div>
            <div className="label9" style={{marginBottom:6}}>Icon</div>
            <div className="icon-grid" style={{marginBottom:8}}>{SKILL_ICONS_EXTRA.map(ic=><button key={ic} className={`icon-opt ${ef.icon===ic?"on":""}`} onClick={()=>setEf(v=>({...v,icon:ic,customImg:null}))}>{ic}</button>)}</div>
            <div className="label9" style={{marginBottom:5}}>Color</div>
            <div className="color-grid" style={{marginBottom:8}}>{SKILL_COLORS.map(col=><div key={col} className={`color-opt ${ef.color===col?"on":""}`} style={{background:col}} onClick={()=>setEf(v=>({...v,color:col}))}/>)}</div>
            <div style={{display:"flex",gap:6}}>
              <button className="fsbtn" style={{flex:1,marginTop:4}} onClick={submitEdit}>Save</button>
            </div>
          </div>
        </div>
      );
    }
    // normal card
    return (
      <div key={s.id} id={"sk-"+s.id}
        {...getSkDragProps(s.id,section)}>
        <div className="skill-card" style={{borderColor:isLinkHover?s.color:isReorderHover?s.color+"44":"",borderStyle:isLinkHover?"dashed":"solid",cursor:"default"}}>
          <div className="sk-hdr">
            <div className="sk-name" style={{gap:5}}>
              <span style={{color:"var(--tx3)",fontSize:9,cursor:"grab",userSelect:"none",flexShrink:0}} title="Drag to reorder">⠿</span>
              <SkIcon s={s} sz={14}/>
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
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setExpandedId(isExpanded?null:s.id)}
              style={{background:"none",border:"none",flex:1,textAlign:"center",color:"var(--tx3)",fontSize:9,cursor:"pointer",padding:"4px 0 0",letterSpacing:1}}>
              {isExpanded?"▲ less":"▼ more"}
            </button>
            <button onClick={()=>setDiscussSkillId(s.id)}
              title="Discuss progress with AI for XP"
              style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,color:"var(--tx3)",fontSize:8,cursor:"pointer",padding:"3px 6px",letterSpacing:.8,fontFamily:"'DM Mono',monospace",marginTop:4,flexShrink:0,transition:"all .15s"}}
              onMouseEnter={e=>e.currentTarget.style.color="var(--primary)"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--tx3)"}>
              ⟡ discuss
            </button>
          </div>
          {isExpanded&&(<div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--b1)"}}>
            {/* activity view with toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",color:"var(--tx3)"}}>
                {calViewIds.has(s.id)?"this month":"90 day activity"}
              </div>
              <button onClick={()=>toggleCalView(s.id)}
                style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,padding:"2px 6px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:7,letterSpacing:.8,color:"var(--tx3)",textTransform:"uppercase"}}>
                {calViewIds.has(s.id)?"⊞ grid":"⊟ cal"}
              </button>
            </div>
            {calViewIds.has(s.id)
              ? <StreakCalendar skillId={s.id} meds={meds} color={s.color}/>
              : <HeatMap days={activityMap[s.id]||[]} color={s.color}/>
            }
            <div style={{marginBottom:6}}/>
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
            {/* per-skill XP history */}
            {(()=>{
              const skLog=(xpLog||[]).filter(e=>e.skillId===s.id).slice(0,8);
              if(!skLog.length) return null;
              return (<>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",color:"var(--tx3)",marginTop:8,marginBottom:4}}>XP History</div>
                {skLog.map(e=>{
                  const linked=e.questId?xpLog.find(x=>x.id===e.id):null;
                  return (<div key={e.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 0",borderBottom:"1px solid var(--b1)"}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:s.color,flexShrink:0,fontWeight:"bold"}}>+{e.amt}</span>
                    {e.multiplier>1&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)"}}>{e.multiplier}×</span>}
                    <span style={{fontSize:10,color:"var(--tx2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",flexShrink:0}}>{new Date(e.created).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  </div>);
                })}
              </>);
            })()}
          </div>)}
        </div>
      </div>
    );
  };

  const discussSkill = skills.find(s=>s.id===discussSkillId);
  return (<>
    {discussSkillId&&discussSkill&&<SkillDiscussPanel skill={discussSkill} skPerLv={skPerLv} streaks={streaks} meds={meds} onGrant={async(amt,reason)=>{await onAward(discussSkillId,amt,reason);}} onClose={()=>setDiscussSkillId(null)}/>}
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
      <div className="fwrap" style={{marginBottom:10,maxHeight:320,overflowY:"auto"}}>
        <div className="label9" style={{marginBottom:10}}>Skill presets</div>
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


    {/* ── SKILLS section ───────────────────────────────────────────── */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
      <div className="label9">Skills</div>
      <div style={{fontSize:9,color:"var(--tx3)"}}>{mainSkills.length} total</div>
    </div>
    {mainSkills.length===0&&!showForm&&(
      <div className="empty-state">
        <div className="es-icon">◈</div>
        <div className="es-title">No skills yet</div>
        <div className="es-desc">Skills track your growth over time. Add one above, or load a preset to get started. XP flows here from every practice session and quest.</div>
      </div>
    )}
    {(()=>{
      // Group skills by category
      const grouped=SKILL_CATEGORIES.map(cat=>({
        cat,
        skills:mainSkills.filter(s=>(s.category||"other")===cat.id)
      })).filter(g=>g.skills.length>0);
      if(!grouped.length) return null;
      return grouped.map(({cat,skills:gskills})=>{
        const collapsed=collapsedGroups.has(cat.id);
        return (
          <div key={cat.id} style={{marginBottom:10}}>
            <button onClick={()=>toggleGroup(cat.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:collapsed?0:6}}>
              <span style={{fontSize:11}}>{cat.icon}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.2,textTransform:"uppercase",color:"var(--tx3)",flex:1,textAlign:"left"}}>{cat.label}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginRight:4}}>{gskills.length}</span>
              <span style={{fontSize:9,color:"var(--tx3)",transition:"transform .15s",display:"inline-block",transform:collapsed?"rotate(-90deg)":"rotate(0deg)"}}>▾</span>
            </button>
            {!collapsed&&(
              <div style={viewMode==="grid"?{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}:{display:"block"}}>
                {gskills.map((s,i)=>renderSkillCard(s,i,"skill"))}
              </div>
            )}
          </div>
        );
      });
    })()}

    {/* ── SUBSKILLS section ─────────────────────────────────────────── */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,marginTop:4}}>
      <div className="label9">Subskills</div>
      <div style={{fontSize:9,color:"var(--tx3)"}}>{subSkills.length} total · drag onto a skill to link</div>
    </div>
    {subSkills.length===0&&<div style={{background:"var(--s1)",border:"1px dashed var(--b1)",borderRadius:"var(--r)",padding:12,textAlign:"center",marginBottom:10,fontSize:11,color:"var(--tx3)"}}>Subskills are cross-disciplinary practices — create one then drag it onto any skill to link XP</div>}
    <div style={viewMode==="grid"?{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}:{marginBottom:12}}>
      {subSkills.map((s,i)=>renderSkillCard(s,i,"subskill"))}
    </div>


  </>);
}

function PracticeTab({meds,skills,streaks,pending,practiceTypes,onAddType,onDeleteType,onLog,onDelete,onEdit,onClearPending}){
  const {settings}=useSettings(); const L=settings.labels;
  const ppm=settings.xp.practicePerMin||1;
  const aiEnabled=settings.xp.aiScoring!==false;
  const [showForm,setShowForm]=useState(false);
  const [showTypeForm,setShowTypeForm]=useState(false);
  const [scoring,setScoring]=useState(false);
  const [xpPreview,setXpPreview]=useState(null);
  const [xpPrevLoad,setXpPrevLoad]=useState(false);
  const [newType,setNewType]=useState({label:"",icon:"◎"});
  const [f,setF]=useState({typeId:"",skillIds:[],subskillIds:[],dur:15,note:"",sessionDate:"",sessionTime:"",showDate:false});

  const toggleSkill=id=>setF(v=>({...v,skillIds:v.skillIds.includes(id)?v.skillIds.filter(s=>s!==id):[...v.skillIds,id]}));

  useEffect(()=>{
    if(practiceTypes.length&&!f.typeId) setF(v=>({...v,typeId:practiceTypes[0].id}));
  },[practiceTypes]);

  useEffect(()=>{
    if(pending){
      const sids=pending.skillId?[pending.skillId]:[];
      setF(v=>({...v,skillIds:sids,subskillIds:[]}));
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
          body:JSON.stringify({max_tokens:80,
            messages:[{role:"user",content:`Practice session scoring. XP scale: 6000 XP = 1 level.\nBaseline: ${baseXp} XP (${f.dur}min). Type: ${ptype?.label}, Skills: ${skNames}.\nJournal: "${f.note}"\nJudge quality: routine=~baseline, focused=1.5-3x, breakthrough=3-10x. Never cap at 100.\nJSON only: {"xp":number,"reason":"12 words max"}`}]
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
    await onLog({type:f.typeId,skillIds:f.skillIds,subskillIds:f.subskillIds,dur:f.dur,note:f.note.trim(),baseXp,aiReason,sessionDate});
    setF(v=>({...v,note:"",subskillIds:[],sessionDate:"",sessionTime:"",showDate:false}));
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
        body:JSON.stringify({max_tokens:300,
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
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--secondary)",marginBottom:5}}>◉ Journal this session</div>
        <div style={{fontSize:13,color:"var(--tx2)",marginBottom:10}}>◉ {pending.questTitle}</div>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <button className="fsbtn secondary" style={{margin:0}} onClick={()=>setShowForm(true)}>Log session</button>
          <button className="fsbtn" style={{margin:0,width:"auto",padding:"8px 12px"}} onClick={onClearPending}>Skip</button>
        </div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>Couldn't complete it? <button onClick={onClearPending} style={{background:"none",border:"none",color:"var(--secondary)",textDecoration:"underline",cursor:"pointer",fontSize:10,padding:0}}>Dismiss</button> — XP was already awarded.</div>
      </div>
    )}
    {showForm?(
      <div className="fwrap">
        <div className="label9" style={{marginBottom:8}}>Practice type</div>
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
        <div className="label9" style={{marginBottom:5}}>Skills (optional)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
          {skills.filter(s=>s.type!=="subskill").map(s=>(
            <button key={s.id} onClick={()=>toggleSkill(s.id)}
              style={{background:f.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${f.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:f.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>
        {skills.filter(s=>s.type==="subskill").length>0&&<>
          <div className="label9" style={{marginBottom:5,marginTop:4}}>Or log a subskill <span style={{fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(XP goes to all linked skills)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {skills.filter(s=>s.type==="subskill").map(s=>{
              const isSelected=(f.subskillIds||[]).includes(s.id);
              const parents=(s.parentIds||[]).map(pid=>skills.find(sk=>sk.id===pid)).filter(Boolean);
              return (
                <button key={s.id}
                  onClick={()=>setF(v=>{
                    const isNowSel=v.subskillIds.includes(s.id);
                    const next=isNowSel?v.subskillIds.filter(x=>x!==s.id):[...v.subskillIds,s.id];
                    // merge all parent IDs from selected subskills
                    const allParents=[...new Set(next.flatMap(sid=>{const sk=skills.find(x=>x.id===sid);return sk?.parentIds||[];}))];
                    return {...v,subskillIds:next,skillIds:[...new Set([...v.skillIds,...allParents])]};
                  })}
                  style={{background:isSelected?s.color+"22":"var(--bg)",border:`1px solid ${isSelected?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:isSelected?s.color:"var(--tx3)",transition:"all .15s",display:"flex",alignItems:"center",gap:4}}>
                  <span><SkIcon s={s} sz={10}/> {s.name}</span>
                  {parents.length>0&&<span style={{opacity:.6}}>{parents.map(p=><SkIcon key={p.id} s={p} sz={9}/>)}</span>}
                </button>
              );
            })}
          </div>
        </>}
        <div className="dur-hdr">
          <span>Duration</span>
          <div className="row-gap6">
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
    {meds.length===0&&(
      <div className="empty-state">
        <div className="es-icon">◎</div>
        <div className="es-title">No sessions logged yet</div>
        <div className="es-desc">Log your first practice session — meditation, movement, study, anything you do intentionally. XP is awarded based on time and reflection quality.</div>
      </div>
    )}
    {meds.map(m=>{
      const ptype=practiceTypes.find(t=>t.id===m.type)||{label:m.type,icon:"◎"};
      const mSkills=(m.skillIds||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
      return <MedCard key={m.id} med={m} ptype={ptype} mSkills={mSkills} skills={skills} onDelete={onDelete} onEdit={onEdit}/>;
    })}
  </>);
}

function MedCard({med,ptype,mSkills,skills,onDelete,onEdit}){
  const {settings}=useSettings(); const L=settings.labels;
  const [expanded,setExpanded]=useState(false);
  const [editing,setEditing]=useState(false);
  const [ef,setEf]=useState({note:med.note||"",xpAwarded:med.xpAwarded||med.dur*(settings.xp.practicePerMin||1),dur:med.dur,typeId:med.type});
  const [rescoring,setRescoring]=useState(false);
  const ppm=settings.xp.practicePerMin||1;
  const primaryColor=mSkills[0]?.color||"var(--secondary)";
  const rescore=async()=>{
    if(!ef.note.trim()) return;
    setRescoring(true);
    try{
      const skNames=mSkills.map(s=>s.name).join(", ")||"General";
      const baseXp=med.dur*ppm;
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:80,messages:[{role:"user",content:`Practice session scoring. XP scale: 6000 XP = 1 level.\nBaseline: ${baseXp} XP (${med.dur} min).\nType: ${ptype?.label}, Skills: ${skNames}\nJournal: "${ef.note}"\nScore for quality/depth: routine=~baseline, focused=1.5-3x, breakthrough=3-10x. Never cap at 100.\nJSON only: {"xp":number,"reason":"12 words max"}`}]})});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"{}";
      const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
      if(parsed.xp) setEf(v=>({...v,xpAwarded:Math.max(1,Math.round(parsed.xp)),aiReason:parsed.reason||""}));
    }catch{}
    setRescoring(false);
  };
  const save=()=>{
    onEdit(med.id,{note:ef.note,xpAwarded:Number(ef.xpAwarded)||med.dur*ppm,aiReason:ef.aiReason!==undefined?ef.aiReason:med.aiReason,dur:Number(ef.dur)||med.dur,type:ef.typeId||med.type});
    setEditing(false);
  };
  if(editing) return (
    <div className="med-card" style={{flexDirection:"column",gap:8}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
        <div className="med-icon" style={{color:primaryColor}}>{ptype?.icon||"◎"}</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx2)",flex:1}}>Edit session</div>
        <button className="delbtn" style={{color:"var(--success)"}} onClick={save}>✓ Save</button>
        <button className="delbtn" onClick={()=>setEditing(false)}>✕</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:4}}>
        <div style={{flex:1}}>
          <div className="label9" style={{marginBottom:3}}>Duration (min)</div>
          <input type="number" className="fi" value={ef.dur} min={1}
            onChange={e=>setEf(v=>({...v,dur:Number(e.target.value),xpAwarded:Number(e.target.value)*ppm}))}/>
        </div>
        {skills?.length>0&&<div style={{flex:2}}>
          <div className="label9" style={{marginBottom:3}}>Practice type</div>
          <select className="fsel" value={ef.typeId} onChange={e=>setEf(v=>({...v,typeId:e.target.value}))}>
            {(window.__practiceTypes||[]).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>}
      </div>
      <textarea className="fi" rows={3} placeholder="Edit journal..." value={ef.note}
        onChange={e=>setEf(v=>({...v,note:e.target.value}))}
        style={{resize:"vertical",minHeight:56,fontFamily:"inherit",fontSize:12}}/>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>XP:</span>
        <input type="number" className="fi" style={{width:64}} value={ef.xpAwarded}
          onChange={e=>setEf(v=>({...v,xpAwarded:Number(e.target.value)}))}/>
        <button className="fsbtn secondary" style={{margin:0,flex:1,fontSize:10}}
          onClick={rescore} disabled={rescoring||!ef.note.trim()}>
          {rescoring?"scoring...":"⟡ Re-score with AI"}
        </button>
      </div>
      {ef.aiReason&&<div className="med-reason">✦ {ef.aiReason}</div>}
    </div>
  );
  return (
    <div className="med-card">
      <div className="med-icon" style={{color:primaryColor}}>{ptype.icon}</div>
      <div className="med-body">
        <div className="med-name">{ptype.label}</div>
        <div className="med-sub">
          {med.dur} min · +{med.xpAwarded||med.dur*ppm} {L.xpName}{med.multiplier>1&&` · ${med.multiplier}×`}
          {mSkills.map(s=><span key={s.id} style={{marginLeft:4,color:s.color,display:"inline-flex",alignItems:"center",gap:3}}><SkIcon s={s} sz={11}/>{s.name}</span>)}
        </div>
        {med.aiReason&&<div className="med-reason">✦ {med.aiReason}</div>}
        {med.note&&<>
          <div className={`med-journal ${expanded?"exp":""}`}>{med.note}</div>
          <button className="jrnl-btn" onClick={()=>setExpanded(e=>!e)}>{expanded?"▲ less":"▼ more"}</button>
        </>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{fmtDate(med.created)}</div>
        <button className="delbtn" onClick={()=>setEditing(true)} title="Edit">✎</button>
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

function JarvisOverlay({tasks,quests,skills,onAddQuest,onAddTask,onClose,onLogMed}){
  const {settings}=useSettings();
  const [input,setInput]=useState("");
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Online."}]);
  const [loading,setLoading]=useState(false);
  const inputRef=useRef(null);
  const msgEndRef=useRef(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const executeAction=async(action)=>{
    if(action.tool==="add_quest"){
      const due=action.input.dueDate?new Date(action.input.dueDate+"T09:00").getTime():null;
      await onAddQuest({title:action.input.title,type:action.input.type||"main",note:action.input.note||"",due,skills:[]});
    } else if(action.tool==="add_task"){
      await onAddTask({title:action.input.title,period:action.input.period||"daily",xpVal:action.input.xpVal||20,skill:null});
    } else if(action.tool==="log_session"&&onLogMed){
      await onLogMed({type:action.input.type||"open",dur:Number(action.input.duration)||20,note:action.input.note||"",skillIds:[],baseXp:Number(action.input.duration)*((settings?.xp?.practicePerMin)||1),aiReason:null,sessionDate:null});
    }
  };
  const handleConfirm=async(msgIdx,actionId,accept)=>{
    setMsgs(prev=>prev.map((m,i)=>{
      if(i!==msgIdx||!m.actions) return m;
      return {...m,actions:m.actions.map(a=>a.id===actionId?{...a,status:accept?"accepted":"cancelled"}:a)};
    }));
    if(accept){const action=msgs[msgIdx]?.actions?.find(a=>a.id===actionId);if(action)await executeAction(action);}
  };

  const send=async()=>{
    const txt=input.trim(); if(!txt||loading) return;
    const history=[...msgs.filter(m=>!m.actions).map(m=>({role:m.role,content:m.content})),{role:"user",content:txt}];
    setMsgs(v=>[...v,{role:"user",content:txt}]); setInput(""); setLoading(true);
    try{
      const tools=buildAdvisorTools(skills,quests);
      const activeQuests=quests.filter(q=>!q.done).map(q=>'"'+q.title+'" ('+q.type+')').slice(0,10).join(", ")||"none";
      const skPerLvLocal=settings?.xp?.skillPerLevel||6000;
      const skillList=skills.map(s=>s.name+' Lv'+(Math.floor(s.xp/skPerLvLocal)+1)).join(", ")||"none";
      const sys="You are JARVIS — a sharp AI co-pilot in a gamified life tracker. Be direct and concise.\nActive quests: "+activeQuests+"\nSkills: "+skillList+"\nPending tasks: "+tasks.filter(t=>!t.done).length+"\nWhen user wants to add/create/schedule something, use the appropriate tool. Otherwise just reply in 1-3 sentences.";
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:600,messages:[{role:"system",content:sys},...history],tools})
      });
      const data=await res.json();
      const msg=data.choices?.[0]?.message||{};
      const toolCalls=msg.tool_calls||[];
      const replyText=msg.content||"";
      if(toolCalls.length>0){
        const actions=toolCalls.map(tc=>({id:tc.id,tool:tc.function?.name,input:(()=>{try{return JSON.parse(tc.function?.arguments||"{}");}catch{return {};}})(),status:"pending"}));
        setMsgs(v=>[...v,{role:"assistant",content:replyText||"Here's what I'd add:",actions}]);
      } else {
        setMsgs(v=>[...v,{role:"assistant",content:replyText||"..."}]);
      }
    }catch(e){setMsgs(v=>[...v,{role:"assistant",content:"Error."}]);}
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
            <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"90%"}}>
              {m.content&&<div style={{background:m.role==="user"?"var(--s2)":"var(--bg)",
                border:"1px solid var(--b1)",borderRadius:6,padding:"8px 12px",
                fontSize:12,color:"var(--tx)",lineHeight:1.5,fontFamily:"'DM Mono',monospace",marginBottom:m.actions?.length?4:0}}>
                {m.content}
              </div>}
              {m.actions&&<div style={{display:"flex",flexDirection:"column",gap:4}}>
                {m.actions.map(a=>(
                  <ActionCard key={a.id} action={a} skills={skills}
                    onAccept={()=>handleConfirm(i,a.id,true)}
                    onCancel={()=>handleConfirm(i,a.id,false)}/>
                ))}
              </div>}
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


function AdvisorTab({tasks,quests,skills,xp,level,streaks,onAddQuest,onAddTask,onLogMed,onEditQuest,aiMemory,onUpdateMemory}){
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
    const memFacts=(aiMemory?.facts||[]).slice(-8).join("\n")||"none yet";
    const memPatterns=(aiMemory?.patterns||[]).slice(-5).join(", ")||"unknown";
    return `You are a direct planning advisor inside the user's RPG quest log. You have persistent memory of this user.\nLEVEL: ${level} (${xp} XP)${topStr?"\nSTREAKS: "+topStr:""}\nTASKS (${at.length} active): ${at.map(t=>`"${t.title}" [${t.period}, ${skills.find(s=>s.id===t.skill)?.name||"no skill"}, ${t.xpVal}xp]`).join("; ")||"none"}\nQUESTS (${aq.length} active): ${aq.map(q=>`"${q.title}" [${q.type}${q.due?", due "+new Date(q.due).toLocaleDateString():""}]`).join("; ")||"none"}\nSKILLS: ${[...skills].sort((a,b)=>b.xp-a.xp).map(s=>`${s.name} Lv${Math.floor(s.xp/skPerLv)+1}`).join(", ")||"none"}\nMEMORY - known facts:\n${memFacts}\nObserved patterns: ${memPatterns}\nBe direct. Reference actual task names. 3-5 sentences unless breaking something down. If you learn new facts about this user, append MEMORY_UPDATE:{"facts":["fact"],"patterns":["pattern"]} as the very last line.`;
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
        body:JSON.stringify({max_tokens:1000,
          messages:[{role:"system",content:buildCtx()},...history]}),
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
        let displayText=replyText||"Something went wrong.";
        const memMatch=replyText&&replyText.match(/MEMORY_UPDATE:(\{[\s\S]*?\})/);
        if(memMatch&&onUpdateMemory){
          try{
            const upd=JSON.parse(memMatch[1]);
            const prev=aiMemory||{facts:[],patterns:[],updated:0};
            const merged={facts:[...new Set([...(prev.facts||[]),...(upd.facts||[])])].slice(-20),patterns:[...new Set([...(prev.patterns||[]),...(upd.patterns||[])])].slice(-10),updated:Date.now()};
            onUpdateMemory(merged);
          }catch{}
          displayText=replyText.split("MEMORY_UPDATE:")[0].trim();
        }
        setMsgs(prev=>[...prev,{role:"assistant",content:displayText}]);
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
      {aiMemory?.facts?.length>0&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:6,padding:"8px 12px",marginBottom:8,fontSize:10,color:"var(--tx3)"}}>
        <div style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontSize:9,marginBottom:4}}>✦ ADVISOR MEMORY</div>
        {(aiMemory.facts||[]).slice(-3).map((f,i)=><div key={i}>· {f}</div>)}
        {(aiMemory.facts||[]).length>3&&<div style={{marginTop:2}}>+{aiMemory.facts.length-3} more facts stored</div>}
        <button onClick={()=>onUpdateMemory&&onUpdateMemory({facts:[],patterns:[],updated:0})} style={{marginTop:4,background:"none",border:"none",color:"var(--tx3)",fontSize:9,cursor:"pointer",padding:0}}>clear memory</button>
      </div>}
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

function SettingsTab({showToast,onExport,onImport,userId,onSignIn,onSignOut}){
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
    {/* Account */}
    <div className="slbl" style={{marginBottom:8}}>Account</div>
    <div className="fwrap" style={{marginBottom:18}}>
      {userId
        ? <div className="row-sb">
            <span style={{fontSize:11,color:"var(--tx2)",fontFamily:"'DM Mono',monospace"}}>Signed in</span>
            <button className="fsbtn" style={{width:"auto",padding:"6px 16px",margin:0}} onClick={onSignOut}>Sign Out</button>
          </div>
        : <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginBottom:4}}>Sign in to sync your data across devices</div>
            <button className="fsbtn" style={{margin:0}} onClick={onSignIn}>Sign In / Create Account</button>
          </div>
      }
    </div>
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
        <div className="row-gap8">
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
          {skills.map(s=><option key={s.id} value={s.id}>{skillLabel(s)}</option>)}
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
          {task.recurrenceDays?.length>0&&<span className="ctag" style={{color:"var(--tx3)"}}>↻ {["Mo","Tu","We","Th","Fr","Sa","Su"].filter((_,i)=>task.recurrenceDays.includes(i)).join("/")}</span>}
        </div>
      </div>
      <button className="delbtn" onClick={()=>setEditing(true)} title="Edit">✎</button>
      <button className="delbtn" onClick={()=>onDelete(task.id)}>✕</button>
    </div>
  );
}

function QuestCard({quest,skills,quests,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest,radiantAvailable,radiantCooldownLabel}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const prereq=(quests||[]).find(q=>q.id===quest.unlocksAfter)||null;
  const isLocked=!quest.done&&prereq&&!prereq.done;
  const [editing,setEditing]=useState(false);
  const [showSubs,setShowSubs]=useState(false);
  const [newSub,setNewSub]=useState("");
  const defaultQColor=(sIds)=>{ const s=skills.find(sk=>sk.id===(sIds||[])[0]); return s?s.color:null; };
  const [ef,setEf]=useState({title:quest.title,note:quest.note||"",dueDate:quest.due?new Date(quest.due).toISOString().split("T")[0]:"",skillIds:quest.skills||[],color:quest.color||defaultQColor(quest.skills)||null,priority:quest.priority||"med",cooldown:quest.cooldown??60*60*1000,published:quest.published||false,notesPublic:quest.notesPublic||false,xpVal:quest.xpVal??null,type:quest.type,unlocksAfter:quest.unlocksAfter||""});
  const [xpSuggestion,setXpSuggestion]=useState(null);
  const [xpLoading,setXpLoading]=useState(false);
  const [subXpSug,setSubXpSug]=useState(null);
  const [subXpLoad,setSubXpLoad]=useState(false);
  const [editSubId,setEditSubId]=useState(null);
  const [editSubVal,setEditSubVal]=useState("");
  const toggleESkill=id=>setEf(v=>{
    const next=v.skillIds.includes(id)?v.skillIds.filter(x=>x!==id):[...v.skillIds,id];
    const autoColor=!quest.color&&next.length>0?defaultQColor(next):v.color;
    return {...v,skillIds:next,color:autoColor};
  });
  const saveEdit=()=>{
    if(!ef.title.trim()) return;
    const due=ef.dueDate?new Date(ef.dueDate+"T09:00").getTime():null;
    const newXp=xpSuggestion?.xp??(ef.xpVal!==null?ef.xpVal:quest.xpVal);
    onEdit(quest.id,{title:ef.title.trim(),note:ef.note.trim(),due,skills:ef.skillIds,color:ef.color||null,priority:ef.priority,cooldown:ef.type==="radiant"?ef.cooldown:undefined,published:ef.published||false,notesPublic:ef.notesPublic||false,xpVal:newXp,type:ef.type,unlocksAfter:ef.unlocksAfter||null});
    setEditing(false); setXpSuggestion(null);
  };
  const suggestQuestXp=async()=>{
    if(!ef.title.trim()) return;
    setXpLoading(true); setXpSuggestion(null);
    try{
      const _eqp='Quest in a gamified life tracker: "'+ef.title+'"'+(ef.note?'. Intention: "'+ef.note+'"':'')+'. Type: '+quest.type+', Priority: '+(ef.priority||'med')+'. XP scale: 6000 XP = 1 level. Judge SCOPE: radiant/daily=20-60, side/hours-days=100-800, main/weeks-months=600-8000, impactful main=8000-20000, life-defining=20000-30000 (5 level max, use rarely). Most mains should be 600-4000. Reply ONLY with JSON: {"xp":number,"reason":"one sentence"}.';
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:_eqp}]
        })});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"";
      const parsed=JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0]||"{}");
      if(parsed.xp) setXpSuggestion(parsed);
    }catch(e){setXpSuggestion({xp:null,reason:"Couldn't reach AI."});}
    setXpLoading(false);
  };
  const suggestSubXp=async(title)=>{
    if(!title.trim()) return;
    setSubXpLoad(true); setSubXpSug(null);
    try{
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:80,
          messages:[{role:"user",content:`Subquest/step in a gamified life tracker. Parent quest: "${quest.title}" (${quest.type}). Subquest: "${title}". Suggest fair XP for completing this one step (range 5-40). Reply ONLY with JSON: {"xp": NUMBER, "reason": "max 8 words"}`}]})});
      const data=await res.json();
      const txt=data.choices?.[0]?.message?.content||"";
      const m=txt.match(/\{[\s\S]*\}/);
      if(m) setSubXpSug(JSON.parse(m[0]));
    }catch(e){setSubXpSug({xp:10,reason:"Default XP"});}
    setSubXpLoad(false);
  };
  const submitSub=()=>{
    if(!newSub.trim()) return;
    onAddSubquest(quest.id,newSub.trim(),subXpSug?.xp||10);
    setNewSub(""); setSubXpSug(null);
  };
  const subs=quest.subquests||[];
  const subsDone=subs.filter(s=>s.done).length;
  const isRadiant=quest.type==="radiant";
  const rAvail=isRadiant&&radiantAvailable?radiantAvailable(quest):true;
  const rCool=isRadiant&&radiantCooldownLabel?radiantCooldownLabel(quest):null;
  const now=Date.now();
  const overdue=quest.due&&!quest.done&&quest.due<now;
  const dueSoon=quest.due&&!quest.done&&quest.due>now&&quest.due-now<86400000;
  const dueFmt=quest.due?new Date(quest.due).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
  const chainUnlocks=quest.done?(quests||[]).filter(q=>q.unlocksAfter===quest.id&&!q.done):[];

  if(editing) return (
    <div className="fwrap" style={{marginBottom:2}}>
      <div className="frow"><input className="fi full" autoFocus value={ef.title} onChange={e=>setEf(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&saveEdit()}/></div>
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={ef.note} onChange={e=>setEf(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:48,fontFamily:"inherit",fontSize:12,marginBottom:6}}/>
      {skills.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {skills.map(s=><button key={s.id} onClick={()=>toggleESkill(s.id)} style={{background:ef.skillIds.includes(s.id)?s.color+"22":"var(--bg)",border:`1px solid ${ef.skillIds.includes(s.id)?s.color+"66":"var(--b2)"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:ef.skillIds.includes(s.id)?s.color:"var(--tx3)",transition:"all .15s"}}>{s.icon} {s.name}</button>)}
      </div>}
      <div className="frow" style={{alignItems:"center",gap:6}}>
        <div className="label9" style={{flexShrink:0}}>Priority</div>
        {["high","med","low"].map(p=>(
          <button key={p} onClick={()=>setEf(v=>({...v,priority:p}))} style={{background:ef.priority===p?"var(--s2)":"var(--bg)",border:`1px solid ${ef.priority===p?"var(--b3)":"var(--b1)"}`,borderRadius:4,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:ef.priority===p?({high:"#e05555",med:"var(--primary)",low:"var(--tx3)"}[p]):"var(--tx3)",transition:"all .15s",textTransform:"uppercase"}}>
            {p}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
          <input type="number" title="XP reward"
            value={ef.xpVal??""} placeholder="xp"
            onChange={e=>setEf(v=>({...v,xpVal:e.target.value===""?null:Number(e.target.value)}))}
            style={{width:52,background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:4,padding:"4px 6px",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)",textAlign:"center",outline:"none"}}/>
          <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0,flexShrink:0}} onClick={()=>{setEditing(false);setXpSuggestion(null);}}>✕</button>
        </div>
      </div>
      <div className="frow">
        <input className="fi" type="date" style={{colorScheme:"dark"}} value={ef.dueDate} onChange={e=>setEf(v=>({...v,dueDate:e.target.value}))}/>
      </div>
      {ef.dueDate&&quest.type!=="radiant"&&<NotifPrompt dueDate={ef.dueDate} title={ef.title}/>}
      {quest.type==="radiant"&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div className="label9" style={{flexShrink:0}}>Resets after</div>
        <select className="fsel" style={{flex:1}} value={ef.cooldown} onChange={e=>setEf(v=>({...v,cooldown:Number(e.target.value)}))}>
          {COOLDOWN_OPTIONS.map(o=><option key={o.ms} value={o.ms}>{o.label}</option>)}
        </select>
      </div>}
      {(quests||[]).filter(q=>q.id!==quest.id&&q.type!=="radiant"&&!q.done).length>0&&(
        <div style={{marginBottom:8}}>
          <div className="label9" style={{marginBottom:4}}>Unlocks after <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(optional chain)</span></div>
          <select className="fsel" style={{flex:1,width:"100%"}} value={ef.unlocksAfter||""} onChange={e=>setEf(v=>({...v,unlocksAfter:e.target.value||null}))}>
            <option value="">None — available immediately</option>
            {(quests||[]).filter(q=>q.id!==quest.id&&q.type!=="radiant"&&!q.done).map(q=>(
              <option key={q.id} value={q.id}>{q.type==="main"?"◆":"◇"} {q.title}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{marginBottom:8}}>
        <div className="label9" style={{marginBottom:6}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setEf(v=>({...v,color:c}))} style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",border:ef.color===c?"2px solid var(--tx)":"2px solid transparent",transition:"all .15s"}}/>)}
          <div onClick={()=>setEf(v=>({...v,color:null}))} style={{width:20,height:20,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!ef.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Default">∅</div>
        </div>
      </div>

      <button className="fsbtn secondary" style={{marginTop:4,marginBottom:2}} onClick={suggestQuestXp} disabled={xpLoading||!ef.title.trim()}>
        {xpLoading?"thinking...":"⟡ AI XP opinion"}
      </button>
      {xpSuggestion&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5,cursor:"pointer"}} onClick={()=>xpSuggestion.xp&&setEf(v=>({...v,xpVal:xpSuggestion.xp}))} title="Click to apply to XP field">
        {xpSuggestion.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>+{xpSuggestion.xp} XP</span> — {xpSuggestion.reason} <span style={{color:"var(--tx3)",fontSize:9}}>(click to apply)</span></>:xpSuggestion.reason}
      </div>}
      {(()=>{
        const prereqs=quests.filter(q=>q.id!==quest.id&&!q.done&&!q.unlocksAfter);
        if(prereqs.length===0) return null;
        return (<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div className="label9" style={{flexShrink:0}}>Unlocks after</div>
          <select className="fsel" style={{flex:1}} value={ef.unlocksAfter} onChange={e=>setEf(v=>({...v,unlocksAfter:e.target.value}))}>
            <option value="">Always available</option>
            {prereqs.map(q=><option key={q.id} value={q.id}>{q.type==="main"?"◆":q.type==="side"?"◇":"◉"} {q.title}</option>)}
          </select>
          {ef.unlocksAfter&&<button onClick={()=>setEf(v=>({...v,unlocksAfter:""}))} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11,flexShrink:0}}>✕</button>}
        </div>);
      })()}
      <div style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderTop:"1px solid var(--b1)",marginBottom:6}}>
        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flex:1}}>
          <input type="checkbox" checked={ef.published||false} onChange={e=>setEf(v=>({...v,published:e.target.checked}))} style={{accentColor:"var(--primary)"}}/>
          <span style={{fontSize:11,color:"var(--tx2)"}}>Publish to community</span>
        </label>
        {ef.published&&<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
          <input type="checkbox" checked={ef.notesPublic||false} onChange={e=>setEf(v=>({...v,notesPublic:e.target.checked}))} style={{accentColor:"var(--primary)"}}/>
          <span style={{fontSize:11,color:"var(--tx2)"}}>Share notes</span>
        </label>}
      </div>
      <button className="fsbtn" onClick={saveEdit}>Save</button>
    </div>
  );

  return (
    <div style={{marginBottom:4}}>
      <div className={`card quest-${quest.type} ${quest.done&&!isRadiant?"done":""}`}
        style={(()=>{
          const qc=quest.color||(qSkills[0]?.color)||null;
          if(overdue) return {borderColor:"var(--danger)"};
          if(dueSoon) return {borderColor:"var(--primary)"};
          if(qc) return {borderColor:qc,borderLeftWidth:3};
          return {};
        })()}>
        <button className="chk" style={isLocked?{color:"var(--tx3)",borderColor:"var(--b1)",opacity:.5,cursor:"not-allowed"}:isRadiant?{color:rAvail?"var(--secondary)":"var(--tx3)",borderColor:rAvail?"var(--secondaryb)":"var(--b1)",fontSize:rCool?7:undefined}:{}}
          onClick={()=>onToggle(quest.id)} title={isLocked?`Locked — complete "${prereq?.title}" first`:rCool?`Available in ${rCool}`:undefined}>
          {isLocked?"🔒":isRadiant?(rCool?rCool:"◉"):quest.done?"✓":""}
        </button>
        <div className="cbody" style={isLocked?{opacity:.6}:{}}>
          <div className="row-gap4">
            {isLocked&&<span style={{fontSize:8,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>after: {prereq?.title}</span>}
            {!isLocked&&quest.priority&&<span className={`prio-dot prio-${quest.priority||"med"}`} title={`Priority: ${quest.priority}`}/>}
            <span className={`ctitle ${isLocked?"":quest.done&&!isRadiant?"done":""}`} style={isLocked?{color:"var(--tx3)"}:{}}>{quest.title}</span>
          </div>
          {subs.length>0&&<div className="sub-progress"><div className="sub-progress-fill" style={{width:`${subs.length?Math.round(subsDone/subs.length*100):0}%`}}/></div>}
          {quest.note&&<div className="cnote">{quest.note}</div>}
          <div className="cmeta">
            {qSkills.map(sk=><span key={sk.id} className="ctag" style={{borderColor:sk.color+"44",color:sk.color,display:"inline-flex",alignItems:"center",gap:3}}><SkIcon s={sk} sz={10}/>{sk.name}</span>)}
            <span className="ctag">{quest.xpVal} {L.xpName}{isRadiant?" / run":""}</span>
            {isRadiant&&<span className="ctag" style={{color:"var(--secondary)",borderColor:"var(--secondaryb)"}}>◉ {COOLDOWN_OPTIONS.find(o=>o.ms===(quest.cooldown??60*60*1000))?.label||"1 hr"}</span>}
            {quest.done&&chainUnlocks.length>0&&<span className="ctag" style={{color:"var(--primary)",borderColor:"var(--primaryf)"}}>▶ Unlocks: {chainUnlocks.map(q=>q.title).join(", ")}</span>}
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
              {editSubId===s.id
                ? <input className="fi" autoFocus value={editSubVal}
                    onChange={e=>setEditSubVal(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==="Enter"&&editSubVal.trim()){
                        onEdit(quest.id,{subquests:(quest.subquests||[]).map(sq=>sq.id===s.id?{...sq,title:editSubVal.trim()}:sq)});
                        setEditSubId(null);
                      }
                      if(e.key==="Escape") setEditSubId(null);
                    }}
                    onBlur={()=>{
                      if(editSubVal.trim()) onEdit(quest.id,{subquests:(quest.subquests||[]).map(sq=>sq.id===s.id?{...sq,title:editSubVal.trim()}:sq)});
                      setEditSubId(null);
                    }}
                    style={{flex:1,fontSize:11,padding:"2px 6px"}}/>
                : <span style={{flex:1,fontSize:12,color:s.done?"var(--tx3)":"var(--tx)",textDecoration:s.done?"line-through":"none",cursor:"text"}}
                    onDoubleClick={()=>{setEditSubId(s.id);setEditSubVal(s.title);}}>{s.title}</span>
              }
              {s.xpVal&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:s.done?"var(--tx3)":"var(--primary)",flexShrink:0}}>+{s.xpVal}</span>}
              <button className="delbtn" style={{fontSize:9}} onClick={()=>onDeleteSubquest(quest.id,s.id)}>✕</button>
            </div>
          ))}
          <div style={{display:"flex",gap:5,paddingTop:6,flexDirection:"column"}}>
            <div style={{display:"flex",gap:5}}>
              <input className="fi" placeholder="Add step..." value={newSub}
                onChange={e=>{setNewSub(e.target.value);setSubXpSug(null);}}
                onKeyDown={e=>e.key==="Enter"&&(newSub.trim()&&!subXpSug?suggestSubXp(newSub):submitSub())}
                style={{fontSize:11,padding:"4px 8px",flex:1}}/>
              <button className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9,opacity:.7}}
                onClick={()=>suggestSubXp(newSub)} disabled={!newSub.trim()||subXpLoad} title="AI XP estimate">
                {subXpLoad?"...":"⟡"}
              </button>
              <button className="fsbtn" style={{width:"auto",padding:"4px 12px",margin:0,fontSize:11}} onClick={submitSub} disabled={!newSub.trim()}>+</button>
            </div>
            {subXpSug&&<div style={{fontSize:10,color:"var(--tx3)",paddingLeft:2,display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace"}}>+{subXpSug.xp} XP</span>
              <span>{subXpSug.reason}</span>
              <button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:9,padding:0}} onClick={()=>setSubXpSug(null)}>✕</button>
            </div>}
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

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY TAB - Wave 2 Multiplayer
// ═══════════════════════════════════════════════════════════════════════════
function CommunityTab({userId,settings,skills,quests,meds,journal,streaks,xp,friends,myFriendCode,profiles,onPublishProfile,onAddFriend,onRemoveFriend,onRefresh,onEditSkillPublish,onEditQuestPublish,onSaveSettings,showToast}){
  const L=settings.labels;
  const [view,setView]=useState("board"); // board | profile | friends
  const [loading,setLoading]=useState(false);
  const [friendInput,setFriendInput]=useState("");
  const [filterCat,setFilterCat]=useState("all");
  const [filterFriends,setFilterFriends]=useState(false);
  const [profilePublic,setProfilePublic]=useState(settings.profile.public||false);

  const level=Math.floor(xp/(settings.xp.globalPerLevel||600))+1;
  const friendIds=new Set(friends.map(f=>f.userId));

  // compute badges for a profile
  const getBadges=(profile)=>{
    const badges=[];
    // Immaculate: any skill with 7+ day streak
    if(Object.values(profile.streaks||{}).some(s=>s.count>=7)) badges.push({id:"immaculate",icon:"◆",label:"Immaculate",tip:"7+ day streak on a skill"});
    // Verified: has journal entries
    if((profile.journalCount||0)>=5) badges.push({id:"verified",icon:"✦",label:"Chronicler",tip:"5+ journal entries"});
    // Practitioner: 10+ practice sessions
    if((profile.totalPractice||0)>=10) badges.push({id:"practitioner",icon:"◉",label:"Practitioner",tip:"10+ practice sessions"});
    return badges;
  };

  const refresh=async()=>{
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  useEffect(()=>{ refresh(); },[]);

  const togglePublic=async(val)=>{
    setProfilePublic(val);
    const next={...settings,profile:{...settings.profile,public:val}};
    await onSaveSettings(next);
    await onPublishProfile(next);
    showToast(val?"Profile published":"Profile hidden");
  };

  const filteredProfiles=profiles.filter(p=>{
    if(p.userId===userId) return false; // don't show self
    if(filterFriends&&!friendIds.has(p.userId)) return false;
    if(filterCat!=="all"&&!p.skills?.some(s=>s.category===filterCat)) return false;
    return true;
  });

  // Build my published data preview
  const myPubSkills=skills.filter(s=>s.published&&s.type!=="subskill");
  const myPubSubskills=skills.filter(s=>s.published&&s.type==="subskill");
  const myPubQuests=quests.filter(q=>q.published);
  const [bulkLoading,setBulkLoading]=useState(false);

  const bulkCategorize=async()=>{
    const uncategorized=skills.filter(s=>!s.category||s.category==="other");
    if(!uncategorized.length){showToast("All skills already categorized");return;}
    setBulkLoading(true);
    const catList=SKILL_CATEGORIES.map(c=>c.id).join(", ");
    for(const sk of uncategorized){
      try{
        const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({max_tokens:20,
            messages:[{role:"user",content:`Skill: "${sk.name}"${sk.intention?`. Intention: "${sk.intention}"`:""}.
Assign to exactly one category from: ${catList}.
Reply with ONLY the category id.`}]})});
        const data=await res.json();
        const txt=(data.choices?.[0]?.message?.content||data.content?.[0]?.text||"").trim().toLowerCase();
        const valid=SKILL_CATEGORIES.find(c=>txt.includes(c.id));
        if(valid) await onEditSkillPublish(sk.id,{category:valid.id});
      }catch(e){}
    }
    setBulkLoading(false);
    showToast(`Categorized ${uncategorized.length} skills`);
  };

  return (
    <div style={{padding:"0 0 80px"}}>
      {/* Sub-nav */}
      <div style={{display:"flex",gap:4,padding:"12px 0 0",marginBottom:16}}>
        {[["board","⬡ Board"],["profile","◈ My Profile"],["friends","◉ Friends"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setView(id)}
            style={{flex:1,padding:"7px 0",borderRadius:"var(--r)",border:`1px solid ${view===id?"var(--primary)":"var(--b1)"}`,background:view===id?"var(--primaryf)":"var(--s1)",color:view===id?"var(--primary)":"var(--tx2)",fontSize:10,fontFamily:"'DM Mono',monospace",letterSpacing:.5,cursor:"pointer"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── BOARD VIEW ── */}
      {view==="board"&&(<>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <button onClick={refresh} disabled={loading} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",color:"var(--tx2)",fontSize:10,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            {loading?"◌":"↺"} Refresh
          </button>
          <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
            <input type="checkbox" checked={filterFriends} onChange={e=>setFilterFriends(e.target.checked)} style={{accentColor:"var(--primary)"}}/>
            <span style={{fontSize:10,color:"var(--tx2)"}}>Friends only</span>
          </label>
          <div style={{flex:1}}/>
          <span style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>{filteredProfiles.length} practitioners</span>
        </div>

        {/* Category filter */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
          <button onClick={()=>setFilterCat("all")} style={{padding:"3px 8px",borderRadius:"var(--r)",border:`1px solid ${filterCat==="all"?"var(--primary)":"var(--b2)"}`,background:filterCat==="all"?"var(--primaryf)":"var(--s2)",color:filterCat==="all"?"var(--primary)":"var(--tx3)",fontSize:9,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>All</button>
          {SKILL_CATEGORIES.map(cat=>(
            <button key={cat.id} onClick={()=>setFilterCat(filterCat===cat.id?"all":cat.id)}
              style={{padding:"3px 8px",borderRadius:"var(--r)",border:`1px solid ${filterCat===cat.id?"var(--primary)":"var(--b2)"}`,background:filterCat===cat.id?"var(--primaryf)":"var(--s2)",color:filterCat===cat.id?"var(--primary)":"var(--tx3)",fontSize:9,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {filteredProfiles.length===0?(
          <div className="empty-state">
            <div className="es-icon">⬡</div>
            <div className="es-title">{loading?"Loading...":"No practitioners yet"}</div>
            <div className="es-desc">Publish your profile and share your friend code to see others here. The community board shows skills, streaks, and practice consistency.</div>
          </div>
        ):(
          filteredProfiles.map(profile=>(
            <CommunityCard key={profile.userId} profile={profile} isFriend={friendIds.has(profile.userId)} badges={getBadges(profile)} filterCat={filterCat}/>
          ))
        )}
      </>)}

      {/* ── MY PROFILE VIEW ── */}
      {view==="profile"&&(<>
        <div className="fwrap" style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"var(--tx3)",marginBottom:10,textTransform:"uppercase"}}>Profile Visibility</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"var(--tx)"}}>{settings.profile.name||"Anonymous"}</span>
            <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",color:"var(--tx3)",background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:3,padding:"2px 6px",cursor:"pointer"}}
              title="Click to copy"
              onClick={()=>{if(myFriendCode){navigator.clipboard?.writeText(myFriendCode);showToast("Code copied!");}}}>
              CODE: {myFriendCode||"—"} ⧉
            </span>
            {getBadges({streaks,journalCount:journal.length,totalPractice:meds.length}).map(b=>(
              <span key={b.id} title={b.tip} style={{fontSize:9,color:"var(--primary)",fontFamily:"'DM Mono',monospace"}}>{b.icon} {b.label}</span>
            ))}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12}}>
            <input type="checkbox" checked={profilePublic} onChange={e=>togglePublic(e.target.checked)} style={{accentColor:"var(--primary)",width:14,height:14}}/>
            <div>
              <div style={{fontSize:12,color:"var(--tx)"}}>Public profile</div>
              <div style={{fontSize:10,color:"var(--tx3)"}}>Visible on the community board. Unpublished skills and quests are always private.</div>
            </div>
          </label>
          {!userId&&<div style={{fontSize:11,color:"var(--danger)",padding:"8px 0"}}>Sign in to publish your profile and connect with others.</div>}
        </div>

        {/* Published skills */}
        {/* Bulk categorize */}
        {skills.some(s=>!s.category||s.category==="other")&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:12}}>
            <span style={{fontSize:11,color:"var(--tx2)",flex:1}}>{skills.filter(s=>!s.category||s.category==="other").length} skills uncategorized</span>
            <button onClick={bulkCategorize} disabled={bulkLoading}
              style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:"var(--r)",color:"var(--primary)",fontSize:10,padding:"4px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
              {bulkLoading?"◌ AI working...":"⟡ AI categorize all"}
            </button>
          </div>
        )}

        <div className="slbl">Published Skills ({myPubSkills.length})</div>
        {myPubSkills.length===0?(
          <div style={{fontSize:12,color:"var(--tx3)",padding:"8px 0 12px",fontStyle:"italic"}}>No skills published. Edit a skill to publish it to the community.</div>
        ):(
          myPubSkills.map(sk=>{
            const cat=SKILL_CATEGORIES.find(c=>c.id===sk.category)||SKILL_CATEGORIES[7];
            const lv=Math.floor((sk.xp||0)/(settings.xp.skillPerLevel||6000))+1;
            const streak=streaks[sk.id]?.count||0;
            return (
              <div key={sk.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:6}}>
                <span style={{fontSize:16}}>{sk.icon==="img"?<img src={sk.customImg} style={{width:18,height:18,borderRadius:3,objectFit:"cover"}}/>:sk.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"var(--tx)"}}>{sk.name}</div>
                  <div style={{fontSize:10,color:"var(--tx3)"}}>{cat.icon} {cat.label} · Lv{lv}{streak>0?` · ${streak}d streak`:""}</div>
                  {sk.intention&&<div style={{fontSize:10,color:"var(--tx2)",fontStyle:"italic",marginTop:1}}>"{sk.intention}"</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <span style={{fontSize:9,color:sk.notesPublic?"var(--success)":"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>{sk.notesPublic?"notes: on":"notes: off"}</span>
                  <button className="delbtn" style={{fontSize:9}} onClick={()=>onEditSkillPublish(sk.id,{published:false})}>unpublish</button>
                </div>
              </div>
            );
          })
        )}

        {/* Published quests */}
        {myPubSubskills.length>0&&<>
          <div className="slbl" style={{marginTop:12}}>Published Subskills ({myPubSubskills.length})</div>
          {myPubSubskills.map(sk=>{
            const parents=(sk.parentIds||[]).map(pid=>skills.find(s=>s.id===pid)).filter(Boolean);
            const cat=SKILL_CATEGORIES.find(c=>c.id===sk.category)||SKILL_CATEGORIES[7];
            const lv=Math.floor((sk.xp||0)/(settings.xp.skillPerLevel||6000))+1;
            return (
              <div key={sk.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:5,marginLeft:12,borderLeft:`2px solid var(--b2)`}}>
                <span style={{fontSize:14}}>{sk.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--tx)"}}>{sk.name}</div>
                  <div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>
                    {cat.icon} {cat.label} · Lv{lv}
                    {parents.length>0&&<> · {parents.map(p=>`${p.icon} ${p.name}`).join(", ")}</>}
                  </div>
                </div>
                <button className="delbtn" style={{fontSize:9}} onClick={()=>onEditSkillPublish(sk.id,{published:false})}>unpublish</button>
              </div>
            );
          })}
        </>}
        <div className="slbl" style={{marginTop:14}}>Published Quests ({myPubQuests.length})</div>
        {myPubQuests.length===0?(
          <div style={{fontSize:12,color:"var(--tx3)",padding:"8px 0 12px",fontStyle:"italic"}}>No quests published. Edit a quest to publish it.</div>
        ):(
          myPubQuests.map(q=>(
            <div key={q.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:6}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:q.color||"var(--primary)",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"var(--tx)"}}>{q.title}</div>
                <div style={{fontSize:10,color:"var(--tx3)"}}>{q.type} quest</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                <span style={{fontSize:9,color:q.notesPublic?"var(--success)":"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>{q.notesPublic?"notes: on":"notes: off"}</span>
                <button className="delbtn" style={{fontSize:9}} onClick={()=>onEditQuestPublish(q.id,{published:false})}>unpublish</button>
              </div>
            </div>
          ))
        )}

        <div style={{marginTop:16,padding:"10px 12px",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)"}}>
          <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginBottom:4}}>STATS VISIBLE WHEN PUBLISHED</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[["Level",level],["Total Practice",meds.length],["Journal Entries",journal.length],["Active Streaks",Object.values(streaks).filter(s=>s.count>0).length]].map(([lbl,val])=>(
              <div key={lbl} style={{fontSize:10,color:"var(--tx2)"}}>{lbl}: <span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace"}}>{val}</span></div>
            ))}
          </div>
        </div>
      </>)}

      {/* ── FRIENDS VIEW ── */}
      {view==="friends"&&(<>
        <div className="fwrap" style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"var(--tx3)",marginBottom:8,textTransform:"uppercase"}}>Add Friend</div>
          <div style={{fontSize:11,color:"var(--tx2)",marginBottom:6}}>Your code: <span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",letterSpacing:2,cursor:"pointer",borderBottom:"1px dashed var(--primaryb)"}} title="Click to copy" onClick={()=>{if(myFriendCode){navigator.clipboard?.writeText(myFriendCode);showToast("Code copied!");} }}>{myFriendCode||"—"}</span> <span style={{fontSize:10,color:"var(--tx3)"}}>(tap to copy)</span></div>
          <div style={{display:"flex",gap:6}}>
            <input className="fi" placeholder="Enter friend's 6-digit code" value={friendInput} onChange={e=>setFriendInput(e.target.value.replace(/\D/g,"").slice(0,6))}
              onKeyDown={e=>e.key==="Enter"&&onAddFriend(friendInput).then(()=>setFriendInput(""))}
              style={{flex:1,letterSpacing:2,fontFamily:"'DM Mono',monospace"}}/>
            <button className="fsbtn" style={{width:"auto",padding:"0 14px",margin:0}} onClick={()=>onAddFriend(friendInput).then(()=>setFriendInput(""))}>Add</button>
          </div>
        </div>

        <div className="slbl">Friends ({friends.length})</div>
        {friends.length===0?(
          <div className="empty-state">
            <div className="es-icon">◉</div>
            <div className="es-title">No friends yet</div>
            <div className="es-desc">Share your 6-digit code with others or enter theirs above. Friends can see each other on the board with the friends-only filter.</div>
          </div>
        ):(
          friends.map(f=>{
            const profile=profiles.find(p=>p.userId===f.userId);
            return (
              <div key={f.userId} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"var(--primaryf)",border:"1px solid var(--primaryb)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--primary)",fontFamily:"'DM Mono',monospace",flexShrink:0}}>
                  {(f.name||"?")[0]?.toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"var(--tx)"}}>{f.name||"Anonymous"}</div>
                  {profile?(
                    <div style={{fontSize:10,color:"var(--tx3)"}}>Lv{profile.level} · {profile.totalPractice} sessions · {profile.journalCount} journal</div>
                  ):(
                    <div style={{fontSize:10,color:"var(--tx3)"}}>Not published yet</div>
                  )}
                </div>
                <button className="delbtn" onClick={()=>onRemoveFriend(f.userId)}>remove</button>
              </div>
            );
          })
        )}
      </>)}
    </div>
  );
}

function CommunityCard({profile,isFriend,badges,filterCat}){
  const [expanded,setExpanded]=useState(false);
  const allProfileSkills=profile.skills||[];
  const mainProfileSkills=allProfileSkills.filter(s=>s.type!=="subskill");
  const subProfileSkills=allProfileSkills.filter(s=>s.type==="subskill");
  const relevantSkills=(filterCat==="all"?mainProfileSkills:mainProfileSkills.filter(s=>s.category===filterCat));
  const displaySkills=(relevantSkills||[]).slice(0,expanded?99:4);

  return (
    <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",marginBottom:10,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 12px",cursor:"pointer",display:"flex",gap:10,alignItems:"center"}} onClick={()=>setExpanded(!expanded)}>
        <div style={{width:36,height:36,borderRadius:"50%",background:"var(--primaryf)",border:"1px solid var(--primaryb)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--primary)",fontFamily:"'DM Mono',monospace",flexShrink:0}}>
          {(profile.name||"?")[0]?.toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <span style={{fontSize:13,color:"var(--tx)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.name||"Anonymous"}</span>
            {isFriend&&<span style={{fontSize:8,color:"var(--secondary)",fontFamily:"'DM Mono',monospace",background:"var(--secondaryf)",border:"1px solid var(--secondaryb)",borderRadius:3,padding:"1px 4px",flexShrink:0}}>friend</span>}
            {badges.map(b=><span key={b.id} title={b.tip} style={{fontSize:8,color:"var(--primary)",fontFamily:"'DM Mono',monospace",background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:3,padding:"1px 4px",flexShrink:0}}>{b.icon} {b.label}</span>)}
          </div>
          <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>
            Lv{profile.level} · {profile.totalPractice} sessions · {profile.journalCount} journal
          </div>
        </div>
        <span style={{fontSize:11,color:"var(--tx3)"}}>{expanded?"▲":"▼"}</span>
      </div>

      {/* Skill pills — always visible */}
      {(relevantSkills||[]).length>0&&(
        <div style={{padding:"0 12px 10px",display:"flex",flexWrap:"wrap",gap:4}}>
          {displaySkills.map(sk=>{
            const cat=SKILL_CATEGORIES.find(cc=>cc.id===sk.category)||SKILL_CATEGORIES[7];
            return (
              <div key={sk.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"var(--s2)",border:`1px solid ${sk.color}44`,borderRadius:10,fontSize:9,fontFamily:"'DM Mono',monospace"}}>
                <span style={{color:sk.color}}>{sk.icon==="img"?"◈":sk.icon}</span>
                <span style={{color:"var(--tx2)"}}>{sk.name}</span>
                <span style={{color:"var(--tx3)"}}>Lv{sk.level}</span>
                {sk.streak>=3&&<span style={{color:sk.color}}>↑{sk.streak}d</span>}
              </div>
            );
          })}
          {!expanded&&(relevantSkills||[]).length>4&&<span style={{fontSize:9,color:"var(--tx3)",padding:"3px 0",cursor:"pointer"}} onClick={()=>setExpanded(true)}>+{(relevantSkills||[]).length-4} more</span>}
        </div>
      )}

      {/* Expanded: radiant quests + intentions */}
      {expanded&&(<>
        {subProfileSkills.length>0&&(
          <div style={{padding:"6px 12px 10px",borderTop:"1px solid var(--b1)"}}>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:1.5,color:"var(--tx3)",textTransform:"uppercase",marginBottom:6}}>Subskills</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {subProfileSkills.map(sk=>{
                const parents=(sk.parentIds||[]).map(pid=>(relevantSkills||[]).find(s=>s.id===pid)).filter(Boolean);
                return (
                  <div key={sk.id} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 7px",background:"var(--bg)",border:`1px solid ${sk.color}33`,borderRadius:10,fontSize:9,fontFamily:"'DM Mono',monospace"}}>
                    <span style={{color:sk.color}}>{sk.icon==="img"?"◈":sk.icon}</span>
                    <span style={{color:"var(--tx3)"}}>{sk.name}</span>
                    {parents.length>0&&<span style={{color:"var(--tx3)",opacity:.6}}>↳{parents.map(p=>p.name).join(",")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(profile.radiantQuests||[]).length>0&&(
          <div style={{padding:"8px 12px 10px",borderTop:"1px solid var(--b1)"}}>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:1.5,color:"var(--tx3)",textTransform:"uppercase",marginBottom:6}}>Radiant Practices</div>
            {profile.radiantQuests.map(rq=>(
              <div key={rq.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid var(--b1)"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:rq.color||"var(--primary)",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--tx)"}}>{rq.title}</div>
                  {rq.intention&&<div style={{fontSize:10,color:"var(--tx3)",fontStyle:"italic"}}>"{rq.intention}"</div>}
                  {rq.notesPublic&&rq.note&&<div style={{fontSize:10,color:"var(--tx2)",marginTop:2}}>{rq.note}</div>}
                </div>
                <span style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{rq.completions30}× / 30d</span>
              </div>
            ))}
          </div>
        )}
        {(profile.skills||[]).filter(sk=>sk.intention).length>0&&(
          <div style={{padding:"8px 12px 10px",borderTop:"1px solid var(--b1)"}}>
            <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:1.5,color:"var(--tx3)",textTransform:"uppercase",marginBottom:6}}>Intentions</div>
            {(profile.skills||[]).filter(sk=>sk.intention).map(sk=>(
              <div key={sk.id} style={{fontSize:11,color:"var(--tx2)",padding:"3px 0",borderBottom:"1px solid var(--b1)"}}>
                <span style={{color:"var(--tx3)"}}>{sk.name}: </span>"{sk.intention}"
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}

function WeeklyReview({tasks,quests,skills,meds,xpLog,journal,settings,onClose,onNavigate}){
  const L=settings.labels;
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
      const skPerLv=6000;
      const practiceBySkill={};
      recentMeds.forEach(m=>{
        (m.skillIds||[m.skill]).filter(Boolean).forEach(sid=>{
          practiceBySkill[sid]=(practiceBySkill[sid]||0)+(m.dur||0);
        });
      });
      const skillContext=skills.filter(s=>s.type!=="subskill").map(s=>({
        name:s.name, level:Math.floor((s.xp||0)/skPerLv)+1,
        intention:s.intention||null,
        minutesThisWeek:practiceBySkill[s.id]||0,
      }));
      // sessions with notes for quality signal
      const sessionNotes=recentMeds.filter(m=>m.note&&m.note.length>10).map(m=>({
        skill:skills.find(s=>(m.skillIds||[]).includes(s.id)||m.skill===s.id)?.name||"Unknown",
        dur:m.dur, note:m.note.slice(0,120),
        aiReason:m.aiReason||null
      })).slice(0,6);
      // streaks
      const activeStreaks=Object.entries(xpLog&&xpLog.length?{}:{}).length; // basic
      // week pattern
      const dayActivity={};
      recentMeds.forEach(m=>{
        const d=new Date(m.created).toLocaleDateString("en",{weekday:"short"});
        dayActivity[d]=(dayActivity[d]||0)+1;
      });
      const summary={
        playerName:settings?.profile?.name||"Player",
        tasksCompleted:recentTasks.length,
        questsCompleted:recentQuests.length,
        practiceSessionsLogged:recentMeds.length,
        totalMinutesPracticed:recentMeds.reduce((s,m)=>s+(m.dur||0),0),
        xpEarned:recentXp,
        questsCompleted_titles:recentQuests.map(q=>q.title).slice(0,5),
        radiantQuestsActive:quests.filter(q=>q.type==="radiant"&&!q.done).map(q=>q.title),
        skills:skillContext,
        sessionNotes,
        dayActivity,
        journalEntriesThisWeek:journal.filter(j=>j.created>weekAgo).length,
      };
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile",max_tokens:1000,
          messages:[{role:"user",content:`You are a grounded, direct life coach doing a weekly rewind for ${summary.playerName}. You have full context about their week. Be specific, personal, and honest — not just cheerleading. Acknowledge real struggles and patterns.

Week data:
${JSON.stringify(summary,null,2)}

Write a weekly rewind in exactly this structure:
**⬡ WINS THIS WEEK**
[2-3 specific things they actually did — reference real session notes, quest titles, skills if available]

**◉ PATTERNS**
[What does this week reveal about their habits? Be honest. What showed up consistently? What was avoided? What do the practice notes say about quality vs just showing up?]

**◆ ONE FOCUS FOR NEXT WEEK**
[One specific, concrete thing — not generic advice. Based on their intentions and where they fell short or can build momentum.]

Keep it under 350 words. Be like a coach who read the actual notes, not a bot reciting stats.`}]
        })
      });
      const data=await res.json();
      const msg=data?.choices?.[0]?.message?.content||data?.content?.[0]?.text||"";
      setAnalysis(msg);
    }catch(e){ setAnalysis("Couldn't connect to advisor. Try again."); }
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
