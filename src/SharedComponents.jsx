import React, { useState } from "react";
import { useSettings, SKILL_MILESTONES } from "./constants";

// ── SKILL ICON ────────────────────────────────────────────────────────────────
// Renders skill icon — image if customImg set, otherwise text symbol
// sz = pixel size. For text-only contexts: s.customImg ? "◈" : s.icon
export function SkIcon({s, sz=14, style={}}){
  if(!s) return null;
  if(s.customImg) return <img src={s.customImg} style={{width:sz,height:sz,borderRadius:2,objectFit:"cover",flexShrink:0,...style}}/>;
  return <span style={{color:s.color,fontSize:sz,lineHeight:1,flexShrink:0,...style}}>{s.icon}</span>;
}
// For contexts that can't render JSX (option text, etc)
export function skillLabel(s){ return s.customImg ? s.name : `${s.icon} ${s.name}`; }

// ── NOTIFICATION PROMPT ───────────────────────────────────────────────────────
export function NotifPrompt({dueDate,dueTime,title}){
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

// ── COLLAPSIBLE SETTINGS SECTION ──────────────────────────────────────────────
export function Collapsible({question,children}){
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

// ── FLOATING XP NUMBERS ───────────────────────────────────────────────────────
export function FloatXP({floats}){
  if(!floats.length) return null;
  return <>{floats.map(f=>(
    <div key={f.id} className="xp-float" style={{"--fx":`${f.xOff}px`}}>+{f.amt}</div>
  ))}</>;
}

// ── MILESTONE OVERLAY ─────────────────────────────────────────────────────────
export function MilestoneOverlay({milestone,onClose}){
  const {settings}=useSettings();
  if(!milestone) return null;
  const m=SKILL_MILESTONES[milestone.level]||{title:`Level ${milestone.level}`,sub:"",glyph:"◆",big:false};
  if(m.big) return (
    <div className="overlay" onClick={onClose}>
      <div className="milestone-modal big" onClick={e=>e.stopPropagation()}>
        <div className="ms-glyph big" style={{color:milestone.color||"var(--primary)"}}>{m.glyph}</div>
        <div className="ms-level">Level {milestone.level}</div>
        <div className="ms-skill" style={{color:milestone.color||"var(--primary)"}}>{milestone.name}</div>
        <div className="ms-title big">{m.title}</div>
        <div className="ms-sub big">{m.sub}</div>
        <div className="ms-bar"><div className="ms-bar-fill" style={{background:milestone.color||"var(--primary)"}}/></div>
        <button className="fsbtn primary" style={{margin:"8px 0 0",width:"auto",padding:"10px 28px"}} onClick={onClose}>Continue</button>
      </div>
    </div>
  );
  return (
    <div className="overlay" onClick={onClose}>
      <div className="milestone-modal" onClick={e=>e.stopPropagation()}>
        <div className="ms-row">
          <div className="ms-glyph" style={{color:milestone.color||"var(--primary)"}}>{m.glyph}</div>
          <div>
            <div className="ms-skill">{milestone.name} · <span style={{color:milestone.color||"var(--primary)"}}>Level {milestone.level}</span></div>
            <div className="ms-title">{m.title}</div>
          </div>
        </div>
        <div className="ms-sub">{m.sub}</div>
        <button className="fsbtn" style={{margin:"10px 0 0"}} onClick={onClose}>✓ Nice</button>
      </div>
    </div>
  );
}
