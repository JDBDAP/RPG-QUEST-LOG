import { useState, useRef, useCallback } from "react";
import { saveField } from "./supabase";
import { KEY_MAP } from "./constants";

// ── ID & DATE UTILS ───────────────────────────────────────────────────────────
export function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
export function skillLv(xp,pl){ return Math.floor(xp/pl)+1; }
export function skillProg(xp,pl){ return ((xp%pl)/pl)*100; }
export function fmtDate(ts){ return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
export function todayLabel(){ return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}); }
export function monthLabel(){ return new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"}); }
export function dayKey(d){ return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
export function todayKey(){ return dayKey(new Date()); }

export function getWeekDays(){
  const today=new Date();
  const dow=today.getDay(); // 0=Sun
  const mon=new Date(today); mon.setDate(today.getDate()-((dow+6)%7));
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}

// ── QUEST / RADIANT HELPERS ───────────────────────────────────────────────────
export function radiantAvailable(q){
  if(q.type!=="radiant") return false;
  if(!q.lastDone) return true;
  const cd=q.cooldown??60*60*1000;
  return Date.now()-q.lastDone>=cd;
}
export function radiantCooldownLabel(q){
  if(!q.lastDone) return "";
  const cd=q.cooldown??60*60*1000;
  const rem=cd-(Date.now()-q.lastDone);
  if(rem<=0) return "";
  const h=Math.floor(rem/3600000), m=Math.floor((rem%3600000)/60000);
  return h>0?`${h}h ${m}m`:`${m}m`;
}

// ── XP MULTIPLIER (streak-based) ──────────────────────────────────────────────
export function getMultiplier(count){
  if(count>=30) return 2.0;
  if(count>=14) return 1.75;
  if(count>=7)  return 1.5;
  if(count>=3)  return 1.25;
  return 1.0;
}

// ── STREAK ────────────────────────────────────────────────────────────────────
export function updateStreak(cur, skillId){
  const now=new Date(); const today=dayKey(now);
  const prev=cur[skillId]||{count:0,lastDate:null};
  const yesterday=new Date(now); yesterday.setDate(now.getDate()-1);
  const yKey=dayKey(yesterday);
  let count=prev.lastDate===today?prev.count
    :prev.lastDate===yKey?prev.count+1:1;
  return {...cur,[skillId]:{count,lastDate:today}};
}

// ── COMPUTED TAB TITLE ────────────────────────────────────────────────────────
export function computedTabTitle(tab,s){
  if(tab==="planner")  return s.labels?.plannerTab||"Planner";
  if(tab==="quests")   return s.labels?.questsTab||"Quests";
  if(tab==="skills")   return s.labels?.skillsTab||"Skills";
  if(tab==="journal")  return s.labels?.journalTab||"Journal";
  if(tab==="advisor")  return s.labels?.advisorTab||"Advisor";
  if(tab==="settings") return s.labels?.settingsTab||"Settings";
  return tab;
}

// ── SETTINGS DEEP MERGE ───────────────────────────────────────────────────────
export function deepMerge(def, saved){
  if(!saved) return {...def};
  const out={...def};
  for(const k of Object.keys(def)){
    if(saved[k]!==undefined){
      if(typeof def[k]==="object"&&def[k]!==null&&!Array.isArray(def[k])){
        out[k]=deepMerge(def[k],saved[k]);
      } else {
        out[k]=saved[k];
      }
    }
  }
  // Preserve any extra keys from saved not in defaults (e.g. custom fields)
  for(const k of Object.keys(saved)){
    if(!(k in def)) out[k]=saved[k];
  }
  return out;
}

// ── COMMUNITY ─────────────────────────────────────────────────────────────────
export function genFriendCode(userId){
  let h=0;
  for(let i=0;i<userId.length;i++) h=(Math.imul(31,h)+userId.charCodeAt(i))|0;
  return (Math.abs(h)%1000000).toString().padStart(6,"0");
}
export async function communitySet(userId,data){
  try{ await window.storage.set("profile:"+userId,JSON.stringify(data),true); }catch(e){console.warn("community write",e);}
}
export async function communityGet(userId){
  try{ const r=await window.storage.get("profile:"+userId,true); return r?JSON.parse(r.value):null; }catch{ return null; }
}
export async function communityList(){
  try{
    const r=await window.storage.list("profile:",true);
    if(!r?.keys) return [];
    const results=await Promise.all(r.keys.map(async k=>{
      try{ const v=await window.storage.get(k,true); return v?JSON.parse(v.value):null; }catch{ return null; }
    }));
    return results.filter(Boolean);
  }catch(e){ console.warn("community list",e); return []; }
}
export async function communityDelete(userId){
  try{ await window.storage.delete("profile:"+userId,true); }catch{}
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
export async function sget(k){
  try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; }
}
export async function sset(k,v){
  try{ localStorage.setItem(k,JSON.stringify(v)); }catch{}
}
// Write to localStorage (offline cache) + Supabase if logged in
export async function dbSet(k,v,userId){
  await sset(k,v);
  if(userId){
    try{
      const col=KEY_MAP[k];
      if(col) await saveField(userId,col,v);
    }catch(e){ console.warn("dbSet supabase error",e); }
  }
}

// ── IMAGE COMPRESSION ─────────────────────────────────────────────────────────
export function compressImage(file, maxPx=200, quality=0.82){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxPx/Math.max(img.width,img.height));
        const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",quality));
      };
      img.onerror=reject; img.src=ev.target.result;
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}
export function compressBanner(file, maxW=800, maxH=240, quality=0.80){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width,maxH/img.height);
        const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",quality));
      };
      img.onerror=reject; img.src=ev.target.result;
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}

// ── DRAG-TO-REORDER HOOK ──────────────────────────────────────────────────────
export function useDrag({items, onReorder, idKey="id"}){
  const [activeId,setActiveId]=useState(null);
  const [overId,setOverId]=useState(null);
  const dragId=useRef(null);
  const getProps=useCallback((id)=>({
    draggable:true,
    onDragStart:(e)=>{
      dragId.current=id; setActiveId(id);
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",String(id));
    },
    onDragOver:(e)=>{
      e.preventDefault(); e.dataTransfer.dropEffect="move";
      if(dragId.current&&dragId.current!==id) setOverId(id);
    },
    onDragLeave:(e)=>{ if(!e.currentTarget.contains(e.relatedTarget)) setOverId(v=>v===id?null:v); },
    onDrop:(e)=>{
      e.preventDefault();
      const from=items.findIndex(x=>x[idKey]===dragId.current);
      const to=items.findIndex(x=>x[idKey]===id);
      if(from!==-1&&to!==-1&&from!==to){
        const arr=[...items]; const[m]=arr.splice(from,1); arr.splice(to,0,m); onReorder(arr);
      }
      dragId.current=null; setActiveId(null); setOverId(null);
    },
    onDragEnd:()=>{ dragId.current=null; setActiveId(null); setOverId(null); },
    style:{
      opacity:activeId===id?0.4:1,
      outline:overId===id&&activeId!==id?"2px dashed var(--primary)":"none",
      outlineOffset:2, cursor:"grab", transition:"opacity .1s",
    }
  }),[items,onReorder,idKey,activeId,overId]);
  return {getProps, activeId, overId};
}
