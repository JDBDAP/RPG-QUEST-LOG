import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AuthScreen from "./AuthScreen";
import { supabase, getSession, onAuthChange, signOut, loadUserData, saveField, migrateLocalStorage } from "./supabase";

// ── MODULE IMPORTS (replaces ~850 lines of inline constants/utils/CSS) ────────
import {
  SettingsCtx, useSettings,
  DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_PRACTICE_TYPES,
  THEME_PRESETS, PALETTES, SKILL_ICONS, SKILL_ICONS_EXTRA,
  SKILL_CATEGORIES, SKILL_COLORS, SKILL_PRESETS, SKILL_MILESTONES,
  TAB_EXPLAINERS, PERIODS, WDAY_LABELS, TIME_BLOCKS, COOLDOWN_OPTIONS, KEY_MAP,
} from "./constants";

import {
  uid, skillLv, skillProg, fmtDate, todayLabel, monthLabel,
  dayKey, todayKey, getWeekDays,
  radiantAvailable, radiantCooldownLabel,
  getMultiplier, updateStreak, computedTabTitle, deepMerge,
  genFriendCode, communitySet, communityGet, communityList, communityDelete,
  sget, sset, dbSet,
  compressImage, compressBanner,
  useDrag,
} from "./utils";

import { buildCSS } from "./buildCSS";
import { toGroqTools, buildAdvisorTools } from "./aiHelpers";
import { FloatXP, MilestoneOverlay, Collapsible, NotifPrompt, SkIcon, skillLabel } from "./SharedComponents";
import {
  WeeklyReview, CommunityTab, CommunityCard,
  StreakRescueBanner, QuestBreakdownModal, SkillGapModal,
  FocusTimer, ProfileModal, ShareCard, CustomImageUploader,
} from "./Modals";

// ── SHARED AI FETCH HELPER ────────────────────────────────────────────────────
// Wraps /api/chat, throws a readable error if Groq returns an error response
async function aiCall(payload){
  const res=await fetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),
  });
  const data=await res.json();
  if(data?.error) throw new Error(data.error.message||`API error ${res.status}`);
  return data;
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
  const [showProfile,setShowProfile]=useState(false);
  const [journalSubTab,setJournalSubTab]=useState("log"); // log | entries | history
  const [focusTimer,setFocusTimer]=useState(null); // null | {skillId, startMs, running}
  const [focusElapsed,setFocusElapsed]=useState(0);
  const [nudge,setNudge]=useState(null); // {taskId, skillId, skillName}
  const [xpFlash,setXpFlash]=useState(false);
  const [floats,setFloats]=useState([]);
  const [milestone,setMilestone]=useState(null);
  const [advisorLog,setAdvisorLog]=useState([]);
  const [dailyBriefing,setDailyBriefing]=useState(null); // {text, date, loading}
  const [streakRescue,setStreakRescue]=useState(null); // {skillId, skillName, streak, suggestion}
  const [showBreakdown,setShowBreakdown]=useState(null); // questId to break down
  const [showSkillGap,setShowSkillGap]=useState(false);
  const [showMorningRitual,setShowMorningRitual]=useState(false); // morning planning overlay
  const [dayGrades,setDayGrades]=useState({}); // {[dateStr]: {output,practice,body,mind,note}}
  const [inlineNote,setInlineNote]=useState(null); // {questId, questTitle} for post-completion note
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
    const al=await sget("cx_advisor"); if(al) setAdvisorLog(al);
    const dg=await sget("cx_grades");  if(dg) setDayGrades(dg);
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

  // Trigger AI features after data is loaded
  useEffect(()=>{
    if(!loaded||!skills.length) return;
    generateBriefing(tasks,quests,skills,streaks,settings);
    checkStreakRescue(skills,streaks,tasks);
    // Show morning ritual if first open today and setup done
    if(settings.profile.setup){
      const todayStr=new Date().toDateString();
      const lastRitual=localStorage.getItem("cx_last_ritual");
      if(lastRitual!==todayStr) setShowMorningRitual(true);
    }
  },[loaded]); // only on initial load

  const saveDayGrades=async(grades)=>{
    setDayGrades(grades);
    await dbSet("cx_grades",grades,userId);
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
  // Focus timer tick
  useEffect(()=>{
    if(!focusTimer?.running) return;
    const iv=setInterval(()=>setFocusElapsed(Math.floor((Date.now()-focusTimer.startMs)/1000)),1000);
    return ()=>clearInterval(iv);
  },[focusTimer?.running, focusTimer?.startMs]);

  const startFocus=(skillId)=>{ const now=Date.now(); setFocusTimer({skillId,startMs:now,running:true}); setFocusElapsed(0); };
  const stopFocus=()=>{
    if(!focusTimer) return;
    const mins=Math.max(1,Math.round(focusElapsed/60));
    const sk=skills.find(s=>s.id===focusTimer.skillId);
    setPendingPractice({skillId:focusTimer.skillId,questTitle:null,prefillDur:mins});
    setFocusTimer(null); setFocusElapsed(0);
    setTab("journal"); setJournalSubTab("log");
  };
  const cancelFocus=()=>{ setFocusTimer(null); setFocusElapsed(0); };

  // ── DAILY BRIEFING ────────────────────────────────────────────────────────
  const generateBriefing=useCallback(async(tasksSnap,questsSnap,skillsSnap,streaksSnap,settingsSnap)=>{
    const todayStr=new Date().toDateString();
    const stored=localStorage.getItem("cx_briefing");
    if(stored){const p=JSON.parse(stored); if(p.date===todayStr&&p.text){setDailyBriefing(p);return;}}
    setDailyBriefing({text:"",date:todayStr,loading:true});
    try{
      const skPerLv=settingsSnap?.xp?.skillPerLevel||6000;
      const overdue=questsSnap.filter(q=>!q.done&&q.due&&q.due<Date.now());
      const dueToday=questsSnap.filter(q=>!q.done&&q.due&&new Date(q.due).toDateString()===todayStr);
      const atRisk=Object.entries(streaksSnap||{})
        .filter(([id,s])=>s.count>2&&s.lastDate&&new Date(s.lastDate).toDateString()!==todayStr)
        .map(([id,s])=>({name:skillsSnap.find(sk=>sk.id===id)?.name||id,count:s.count}));
      const topSkills=[...skillsSnap].filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,4)
        .map(s=>`${s.name} Lv${Math.floor((s.xp||0)/skPerLv)+1}`);
      const activeTasks=tasksSnap.filter(t=>!t.done&&t.period==="daily").slice(0,6).map(t=>t.title);
      const activeQuests=questsSnap.filter(q=>!q.done).slice(0,5).map(q=>`${q.title} [${q.type}]`);
      const prompt=`Daily briefing for ${settingsSnap?.profile?.name||"the player"}.
Today: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}
Skills: ${topSkills.join(", ")||"none"}
Active tasks today: ${activeTasks.join(", ")||"none"}
Active quests: ${activeQuests.join(", ")||"none"}
Overdue quests: ${overdue.map(q=>q.title).join(", ")||"none"}
Due today: ${dueToday.map(q=>q.title).join(", ")||"none"}
Streaks at risk (not done today): ${atRisk.map(s=>`${s.name} (${s.count}d)`).join(", ")||"none"}

Write a sharp, useful morning briefing in exactly this format (under 120 words total):
**TODAY'S FOCUS:** [1 sentence — the single most important thing]
**WATCH OUT:** [1 thing at risk — overdue quest, streak, or blocked task. Skip if nothing critical]
**WIN AVAILABLE:** [1 specific quick win from their tasks or radiant quests]`;
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:250,messages:[{role:"user",content:prompt}]})});
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      const text=data.choices?.[0]?.message?.content||"Could not generate briefing.";
      const result={text,date:todayStr,loading:false};
      setDailyBriefing(result);
      localStorage.setItem("cx_briefing",JSON.stringify(result));
    }catch{
      setDailyBriefing({text:"Could not connect.",date:todayStr,loading:false});
    }
  },[]);

  // ── STREAK RESCUE ────────────────────────────────────────────────────────
  const checkStreakRescue=useCallback(async(skillsSnap,streaksSnap,tasksSnap)=>{
    const hour=new Date().getHours();
    if(hour<18) return; // only after 6pm
    const todayStr=new Date().toDateString();
    const endangered=Object.entries(streaksSnap||{})
      .filter(([id,s])=>s.count>=3&&s.lastDate&&new Date(s.lastDate).toDateString()!==todayStr)
      .map(([id,s])=>({id,name:skillsSnap.find(sk=>sk.id===id)?.name||id,count:s.count}));
    if(!endangered.length) return;
    const target=endangered.sort((a,b)=>b.count-a.count)[0];
    const alreadyRescued=localStorage.getItem(`cx_rescue_${todayStr}_${target.id}`);
    if(alreadyRescued) return;
    try{
      const relatedTasks=tasksSnap.filter(t=>t.skill===target.id).map(t=>t.title).slice(0,3);
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:80,messages:[{role:"user",content:`A ${target.count}-day streak for "${target.name}" is about to break. Suggest ONE minimal action (2-5 min) to keep it alive. Related tasks: ${relatedTasks.join(", ")||"none"}. Reply in one short sentence, no intro.`}]})});
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      const suggestion=data.choices?.[0]?.message?.content||`Do one small ${target.name} action to protect your streak.`;
      setStreakRescue({skillId:target.id,skillName:target.name,count:target.count,suggestion});
    }catch{}
  },[]);

  const handleTabChange=async id=>{
    // Redirect old "practice" and "community" tab ids
    if(id==="practice"){ setTab("journal"); setJournalSubTab("log"); return; }
    if(id==="community"){ setShowProfile(true); return; }
    setTab(id);
    if(!seenTabs[id]&&TAB_EXPLAINERS[id]){
      const next={...seenTabs,[id]:true};
      setSeenTabs(next); await dbSet("cx_seen",next,userId);
      setExplainer(TAB_EXPLAINERS[id]);
    }
  };
  const L=settings.labels; const C=settings.colors; const TH=settings.theme;
  const css=useMemo(()=>buildCSS(C,TH,settings.fontSize||14,settings.uiMode||"rpg"),[C,TH,settings.fontSize,settings.uiMode]);

  const showToast=useCallback(msg=>{
    if(toastRef.current) clearTimeout(toastRef.current);
    setToast({msg,on:true});
    toastRef.current=setTimeout(()=>setToast({msg:"",on:false}),2200);
  },[]);

  const spawnFloat=useCallback((amt)=>{
    const id=uid();
    const xOff=(Math.random()-.5)*44;
    setFloats(prev=>[...prev.slice(-4),{id,amt,xOff}]);
    setTimeout(()=>setFloats(prev=>prev.filter(f=>f.id!==id)),1150);
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
    setXpFlash(true); setTimeout(()=>setXpFlash(false),500);
    let leveledUp=null, skillMilestone=null, newSkills=curSkills;
    if(skillId){
      newSkills=curSkills.map(s=>{
        if(s.id!==skillId) return s;
        const oldLv=skillLv(s.xp,skPerLv), newXp=s.xp+amt, newLv=skillLv(newXp,skPerLv);
        if(newLv>oldLv){
          leveledUp={name:s.name,level:newLv};
          if(SKILL_MILESTONES[newLv]) skillMilestone={name:s.name,level:newLv,color:s.color||"var(--primary)"};
        }
        return {...s,xp:newXp};
      });
      setSkills(newSkills); await dbSet("cx_skills",newSkills,userId);
    }
    const sk=curSkills.find(s=>s.id===skillId);
    await saveXpLog({id:uid(),amt,label:label||"Task",skill:sk?.name||null,skillId:skillId||null,questId:questId||null,multiplier,created:Date.now()});
    return {amt,multiplier,leveledUp,newSkills,milestone:skillMilestone};
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

  // Wire up quick-add quest event from PlannerTab — use ref to avoid stale closure
  const addQuestRef=useRef(null);
  useEffect(()=>{
    const handler=(e)=>{ if(addQuestRef.current) addQuestRef.current(e.detail); };
    window.addEventListener("cx:addquest",handler);
    return ()=>window.removeEventListener("cx:addquest",handler);
  },[]);

  const addTask=async d=>{
    const newTask={id:uid(),...d,done:false,dayKey:d.period==="daily"?todayKey():null,created:Date.now()};
    setTasks(prev=>{const next=[newTask,...prev];dbSet("cx_tasks",next,userId);return next;});
    showToast("Task added");
  };
  const toggleTask=async id=>{
    const task=tasks.find(t=>t.id===id); if(!task) return;
    await saveT(tasks.map(t=>t.id===id?{...t,done:!t.done}:t));
    if(!task.done){
      const {amt,leveledUp,milestone:ms}=await award(task.xpVal,task.skill,xp,skills,streaks,task.title);
      spawnFloat(amt);
      showToast(`+${amt} ${L.xpName}`);
      if(leveledUp&&!ms) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      if(ms) setMilestone(ms);
    }
  };
  const deleteTask=async id=>saveT(tasks.filter(t=>t.id!==id));

  const addQuest=async d=>{
    const xpVal=d.xpVal||( d.type==="main"?Number(L.mainXp)||80:d.type==="side"?Number(L.sideXp)||50:Number(L.radiantXp)||30 );
    const qSkills=d.skills||(d.skill?[d.skill]:[]);
    const newQuest={id:uid(),...d,skills:qSkills,xpVal,done:false,priority:d.priority||"med",cooldown:d.type==="radiant"?(d.cooldown??60*60*1000):undefined,created:Date.now()};
    // Use functional update to always get latest quests state, never stale closure
    setQuests(prev=>{
      const next=[newQuest,...prev];
      dbSet("cx_quests",next,userId);
      return next;
    });
    showToast("Quest accepted");
  };
  // Keep ref current so event listener always calls latest version
  addQuestRef.current=addQuest;
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
      const {amt,multiplier,leveledUp,milestone:ms}=await award(q.xpVal,primary,xp,skills,newStr,`◉ ${q.title}`,q.id);
      const streak=newStr[primary]||{count:0};
      // Store lastDone timestamp on the quest
      await saveQ(quests.map(qq=>qq.id===id?{...qq,lastDone:Date.now()}:qq));
      let msg=`+${amt} ${L.xpName}`;
      if(multiplier>1) msg+=` · ${streak.count}d ${L.comboName||"Combo"} ${multiplier}×`;
      spawnFloat(amt);
      showToast(msg);
      if(leveledUp&&!ms) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      if(ms) setMilestone(ms);
      setPendingPractice({skillId:primary,questTitle:q.title,questId:q.id,questType:"radiant"});
      setTab("journal"); setJournalSubTab("log");
      return;
    }
    await saveQ(quests.map(q=>q.id===id?{...q,done:!q.done}:q));
    if(!q.done){
      const primary=(q.skills||[])[0]||null;
      const prefix=q.type==="main"?"◆":q.type==="side"?"◇":"";
      const {amt,leveledUp,milestone:ms}=await award(q.xpVal,primary,xp,skills,streaks,`${prefix} ${q.title}`,q.id);
      spawnFloat(amt);
      showToast(`+${amt} ${L.xpName}`);
      if(leveledUp&&!ms) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      if(ms) setMilestone(ms);
      // Show inline note instead of redirecting to log tab
      setInlineNote({questId:id,questTitle:q.title,questType:q.type});
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
      const {amt,leveledUp,milestone:ms}=await award(sub.xpVal,primary,xp,skills,streaks,`◇ ${sub.title}`);
      spawnFloat(amt);
      showToast(`+${amt} ${settings.labels.xpName}`);
      if(leveledUp&&!ms) setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);
      if(ms) setMilestone(ms);
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
  const awardFromJournal=async(skillAwards)=>{
    // skillAwards: [{skillId, xp, reason}]
    if(!skillAwards?.length) return;
    let curXp=xp, curSkills=skills, newStr=streaks;
    const skPerLvLocal=settings.xp.skillPerLevel||6000;
    const leveled=[];
    for(const a of skillAwards){
      if(!a.skillId||!a.xp) continue;
      newStr=updateStreak(newStr,a.skillId);
      const streak=newStr[a.skillId]||{count:0};
      const mult=getMultiplier(streak.count);
      const amt=Math.round(a.xp*mult);
      curXp+=amt;
      curSkills=curSkills.map(s=>{
        if(s.id!==a.skillId) return s;
        const oldLv=skillLv(s.xp,skPerLvLocal),newXp=s.xp+amt,newLv=skillLv(newXp,skPerLvLocal);
        if(newLv>oldLv) leveled.push({name:s.name,level:newLv});
        return {...s,xp:newXp};
      });
      await saveXpLog({id:uid(),amt,label:`✦ ${a.reason||"Journal"}`,skill:curSkills.find(s=>s.id===a.skillId)?.name||null,multiplier:mult,created:Date.now()});
    }
    setXp(curXp); await dbSet("cx_xp",curXp,userId);
    setSkills(curSkills); await dbSet("cx_skills",curSkills,userId);
    await saveStr(newStr);
    // Float the total awarded
    const totalAmt=skillAwards.reduce((s,a)=>s+(a.xp||0),0);
    if(totalAmt) spawnFloat(totalAmt);
    leveled.forEach((lu,i)=>{
      if(SKILL_MILESTONES[lu.level]){
        setTimeout(()=>setMilestone({...lu,color:curSkills.find(s=>s.name===lu.name)?.color||"var(--primary)"}),(i+1)*400);
      } else {
        setTimeout(()=>showToast(`◆ ${lu.name} Level ${lu.level}`),(i+1)*600);
      }
    });
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
      level:Math.floor((skills||[]).reduce((a,s)=>a+(s.xp||0),0)/(settings.xp.globalPerLevel||6000))+1,
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
    const newSkill={id:uid(),name:d.name,icon:d.icon,color:d.color,xp:d.startXp||0,type:d.type||"skill",parentIds:d.parentIds||[]};
    setSkills(prev=>{const next=[...prev,newSkill];dbSet("cx_skills",next,userId);return next;});
    showToast(d.type==="subskill"?"Subskill created":"Skill created");
  };
  const addSkillBatch=async arr=>{
    const newSkills=arr.map(d=>({id:uid(),name:d.name,icon:d.icon,color:d.color,xp:d.startXp||0,customImg:d.customImg||null,type:"skill",parentIds:[]}));
    setSkills(prev=>{const next=[...prev,...newSkills];dbSet("cx_skills",next,userId);return next;});
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
    // Handle both subskillId (singular legacy) and subskillIds (array from form)
    const subIds=d.subskillIds?.length?d.subskillIds:(d.subskillId?[d.subskillId]:[]);
    let skillIds=d.skillIds||[];
    // Expand subskill parentIds into skillIds
    for(const subId of subIds){
      const sub=skills.find(s=>s.id===subId&&s.type==="subskill");
      if(sub?.parentIds?.length) skillIds=[...new Set([...skillIds,...sub.parentIds])];
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
    const subLabel=subIds.map(sid=>skills.find(s=>s.id===sid)?.name).filter(Boolean).join(", ");
    await saveXpLog({id:uid(),amt,label:d.type+(subLabel?` · ${subLabel}`:""),skill:sk?.name||null,multiplier,created:Date.now()});
    const sessionCreated=d.sessionDate||Date.now();
    const session={id:uid(),type:d.type||"session",dur:d.dur,skillIds,subskillIds:subIds,note:d.note,
      aiReason:d.aiReason,xpAwarded:amt,multiplier,created:sessionCreated};
    await saveM([session,...meds]);
    // Auto-save to journal: always if quest, only if note otherwise
    if(d.note&&d.note.trim()||d.questId){
      const sk=curSkillsState.filter(s=>skillIds.includes(s.id));
      const skLabel=sk.map(s=>`${s.icon} ${s.name}`).join(", ");
      const questPfx=d.questTitle?`[${d.questType==="radiant"?"◉":"◆"} ${d.questTitle}] `:"";
      const header=`${questPfx}[${d.type}${skLabel?` · ${skLabel}`:""}${d.dur?` · ${d.dur}min`:""}]`;
      const body=d.note&&d.note.trim()?`${header}\n${d.note.trim()}`:header;
      const next=[{id:uid(),text:body,img:null,source:"practice",questId:d.questId||null,created:sessionCreated},...journal];
      setJournal(next); await dbSet("cx_journal",next,userId);
    }
    let msg=`+${amt} ${L.xpName}`;
    if(multiplier>1) msg+=` · ${streak.count}d ${L.comboName||"Combo"} ${multiplier}×`;
    spawnFloat(amt);
    showToast(msg);
    leveledUpAll.forEach((lu,i)=>{
      if(SKILL_MILESTONES[lu.level]){
        setTimeout(()=>setMilestone({...lu,color:curSkillsState.find(s=>s.name===lu.name)?.color||"var(--primary)"}),(i+1)*400);
      } else {
        setTimeout(()=>showToast(`◆ ${lu.name} Level ${lu.level}`),(i+1)*600);
      }
    });
    setPendingPractice(null);
    // Proactive advisor suggestion: if skill has no active quest linked, nudge after 2s
    if(primary){
      const hasLinkedQuest=quests.some(q=>!q.done&&(q.skills||[]).includes(primary));
      if(!hasLinkedQuest){
        setTimeout(()=>showToast(`◈ No quest for ${curSkillsState.find(s=>s.id===primary)?.name||"this skill"} yet — add one in Quests`),2200);
      }
    }
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
      if(data.practiceTypes){setPracticeTypes(data.practiceTypes);await dbSet("cx_ptypes",data.practiceTypes,userId);}
      if(data.xp!=null){setXp(data.xp);await dbSet("cx_xp",data.xp,userId);}
      if(data.streaks){setStreaks(data.streaks);await dbSet("cx_streaks",data.streaks,userId);}
      showToast("Data imported");
    }catch{showToast("Import failed — check JSON format");}
    e.target.value="";
  };

  const exportData=(fmt="json")=>{
    const payload={tasks,quests,skills,meds,practiceTypes,xp,streaks,settings,exported:new Date().toISOString()};
    if(fmt==="xml"){
      const toXml=(obj,tag)=>{
        if(Array.isArray(obj)) return obj.map(item=>toXml(item,"item")).join("");
        if(obj===null||obj===undefined) return `<${tag}/>`;
        if(typeof obj==="object"){
          const inner=Object.entries(obj).map(([k,v])=>toXml(v,k)).join("");
          return `<${tag}>${inner}</${tag}>`;
        }
        const str=String(obj).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        return `<${tag}>${str}</${tag}>`;
      };
      const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<codex>\n${Object.entries(payload).map(([k,v])=>toXml(v,k)).join("\n")}\n</codex>`;
      const blob=new Blob([xml],{type:"application/xml"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download=`codex-export-${new Date().toISOString().split("T")[0]}.xml`; a.click();
    } else {
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download=`codex-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
    }
  };
  const completeSetup=async name=>{
    await saveSettings({...settings,profile:{name:name.trim(),setup:true}});
  };

  const perLv=settings.xp.globalPerLevel||6000;
  const skPerLv=settings.xp.skillPerLevel||6000;
  // Char level = derived from sum of all skill XP so it stays coherent with skill levels
  const totalSkillXp=skills.reduce((a,s)=>a+(s.xp||0),0);
  const level=Math.floor(totalSkillXp/perLv)+1;
  const prog=((totalSkillXp%perLv)/perLv)*100;
  // weekDays only changes at midnight — memoize so it doesn't rebuild every render
  const weekDays=useMemo(()=>getWeekDays(),[]);
  // periodTasks filters tasks array — memoize on actual deps
  const periodTasks=useMemo(()=>{
    if(period==="daily") return tasks.filter(t=>t.period==="daily"&&t.dayKey===todayKey());
    if(period==="weekly") return tasks.filter(t=>t.period==="weekly");
    if(period==="monthly") return tasks.filter(t=>t.period==="monthly");
    return tasks.filter(t=>t.period==="yearly");
  },[tasks,period]);
  // Must be before any conditional returns — hooks cannot be after early returns
  const ctxValue=useMemo(()=>({settings,saveSettings}),[settings,saveSettings]);

  const NAV=[
    {id:"planner",  icon:"□", label:L.plannerTab},
    {id:"quests",   icon:"◆", label:L.questsTab},
    {id:"skills",   icon:"◈", label:L.skillsTab},
    {id:"journal",  icon:"✦", label:"Log"},
    {id:"advisor",  icon:"◎", label:L.advisorTab},
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
      <div className={`app${settings.compact?" compact":""}`} style={{"--content-width":`${settings.contentWidth||700}px`,...(settings.images?.bg?{backgroundImage:`url(${settings.images.bg})`,backgroundSize:"cover",backgroundAttachment:"fixed",backgroundPosition:"center"}:{})}}>
        {!settings.profile.setup&&<ProfileSetup onComplete={completeSetup}/>}
        {settings.profile.setup&&<>
          {settings.images?.banner&&<div style={{width:"100%",maxHeight:80,overflow:"hidden",flexShrink:0}}><img src={settings.images.banner} alt="" style={{width:"100%",objectFit:"cover",maxHeight:80}}/></div>}
          {/* Desktop sidebar */}
          <nav className="sidenav">
            <div className="side-top">
              <div className="side-title">{computedTabTitle(tab,settings)}</div>
              <div className="side-lv">{L.levelName} {level}</div>
              <div className="xp-track" style={{margin:"10px 0 4px"}}><div className={`xp-fill${xpFlash?" pulse":""}`} style={{width:`${prog}%`}}/></div>
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
            {/* Sidebar profile button */}
            <div style={{marginTop:"auto",padding:"16px 8px 0",borderTop:"1px solid var(--b1)"}}>
              <button className="slink" onClick={()=>setShowProfile(true)} style={{color:"var(--tx2)"}}>
                <span className="slink-icon">◎</span>
                <span className="slink-lbl">Profile</span>
              </button>
            </div>
          </nav>
          {/* Mobile header */}
          <header className="hdr">
            <div className="hdr-row">
              <div className="hdr-title">{computedTabTitle(tab,settings)}</div>
              <div className="row-gap8">
                <button onClick={()=>setShowProfile(true)} className="lv-badge" style={{cursor:"pointer",background:"var(--primaryf)",border:"1px solid var(--primaryb)"}}>
                  {L.levelName} {level}
                </button>
              </div>
            </div>
            <button onClick={()=>setShowProfile(true)} className="xp-row" style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
              <div className="xp-track"><div className={`xp-fill${xpFlash?" pulse":""}`} style={{width:`${prog}%`}}/></div>
              <span className="xp-lbl">{xp} {L.xpName}</span>
            </button>
          </header>
          <div className="main-wrap">
          <main className="pg">
            {tab==="planner"  && <PlannerTab period={period} setPeriod={setPeriod} tasks={periodTasks} weekDays={weekDays} allTasks={tasks} skills={skills} quests={quests} onAddTask={addTask} onToggle={(id)=>{
              const t=tasks.find(x=>x.id===id);
              toggleTask(id);
              if(t&&!t.done&&t.skill){
                const sk=skills.find(s=>s.id===t.skill);
                if(sk) setNudge({taskId:id,skillId:t.skill,skillName:sk.name});
              }
            }} onDelete={deleteTask} onEdit={editTask} onToggleQuest={toggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} nudge={nudge} onDismissNudge={()=>setNudge(null)} onAcceptNudge={()=>{if(nudge){setPendingPractice({skillId:nudge.skillId});setNudge(null);setTab("journal");setJournalSubTab("log");}}} dailyBriefing={dailyBriefing} onRefreshBriefing={()=>{localStorage.removeItem("cx_briefing");generateBriefing(tasks,quests,skills,streaks,settings);}} onOpenBreakdown={qid=>setShowBreakdown(qid)} onOpenSkillGap={()=>setShowSkillGap(true)}/>}
            {tab==="quests"   && <QuestsTab quests={quests} skills={skills} onAdd={addQuest} onToggle={toggleQuest} onDelete={deleteQuest} onEdit={editQuest} onAddSubquest={addSubquest} onToggleSubquest={toggleSubquest} onDeleteSubquest={deleteSubquest} onReorder={q=>saveQ(q)} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={qid=>setShowBreakdown(qid)}/>}
            {tab==="skills"   && <SkillsTab skills={skills} skPerLv={skPerLv} streaks={streaks} meds={meds} xpLog={xpLog} onAdd={addSkill} onAddBatch={addSkillBatch} onDelete={deleteSkill} onEdit={editSkill} onReorder={reorderSkills} onLink={linkSubskill} onStartFocus={startFocus} onAward={async(skillId,amt,reason)=>{const {leveledUp,milestone:ms}=await award(amt,skillId,xp,skills,streaks,`✦ ${reason}`);spawnFloat(amt);showToast(`+${amt} ${settings.labels.xpName}`);if(leveledUp&&!ms)setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);if(ms)setMilestone(ms);}} onOpenSkillGap={()=>setShowSkillGap(true)}/>}
            {tab==="journal"  && <JournalTab entries={journal} skills={skills} quests={quests} meds={meds} practiceTypes={practiceTypes} streaks={streaks} pending={pendingPractice} subTab={journalSubTab} onSubTab={setJournalSubTab} onAdd={addJournalEntry} onDelete={deleteJournalEntry} onAwardXp={awardFromJournal} onEditQuest={editQuest} onLog={logMed} onDeleteMed={deleteMed} onEditMed={editMed} onAddType={addPracticeType} onDeleteType={deletePracticeType} onClearPending={()=>setPendingPractice(null)} dayGrades={dayGrades} onSaveDayGrades={saveDayGrades} xpLog={xpLog}/>}
            {tab==="advisor"  && <AdvisorTab tasks={tasks} quests={quests} skills={skills} xp={xp} level={level} streaks={streaks} journal={journal} meds={meds} onAddQuest={addQuest} onAddTask={addTask} onLogMed={logMed} onEditQuest={editQuest} onDeleteQuest={deleteQuest} onDeleteTask={deleteTask} onAddSkill={addSkill} onDeleteSkill={id=>saveS(skills.filter(s=>s.id!==id))} onAdjustSkillXp={async(skillId,amt,reason)=>{const {leveledUp,milestone:ms}=await award(amt,skillId,xp,skills,streaks,`✦ ${reason}`);spawnFloat(Math.abs(amt));showToast(`${amt>0?"+":""}${amt} ${L.xpName} → ${skills.find(s=>s.id===skillId)?.name||"skill"}`);if(leveledUp&&!ms)setTimeout(()=>showToast(`◆ ${leveledUp.name} Level ${leveledUp.level}`),500);if(ms)setMilestone(ms);}} aiMemory={aiMemory} onUpdateMemory={async(m)=>{setAiMemory(m);await dbSet("cx_aimem",m,userId);}} initialMsgs={advisorLog} onSaveMsgs={async(m)=>{setAdvisorLog(m);await dbSet("cx_advisor",m,userId);}}/>}
            {tab==="settings" && <SettingsTab showToast={showToast} onExport={exportData} onImport={importData} userId={userId} onSignIn={()=>setShowAuth(true)} onSignOut={handleSignOut}/>}
          </main>
          </div>
          {/* Weekly Review floating button */}
          <button className="review-btn" onClick={()=>setShowReview(true)} title="Weekly Review">◈ Review</button>
          {showReview&&<WeeklyReview tasks={tasks} quests={quests} skills={skills} meds={meds} xpLog={xpLog} journal={journal} settings={settings} onClose={()=>setShowReview(false)} onNavigate={id=>{setShowReview(false);handleTabChange(id);}} onAddTask={addTask}/>}
          {/* Morning planning ritual */}
          {showMorningRitual&&<MorningRitualOverlay quests={quests} tasks={tasks} skills={skills} streaks={streaks} settings={settings} briefing={dailyBriefing} onClose={()=>{setShowMorningRitual(false);localStorage.setItem("cx_last_ritual",new Date().toDateString());}} onAddTask={addTask} onToggleQuest={toggleQuest} radiantAvailable={radiantAvailable}/>}
          {/* Inline quest completion note */}
          {inlineNote&&<InlineNotePopup questId={inlineNote.questId} questTitle={inlineNote.questTitle} questType={inlineNote.questType} onClose={()=>setInlineNote(null)} onSave={async(note)=>{if(note.trim()){const next=[{id:uid(),text:`[${inlineNote.questType==="main"?"◆":"◇"} ${inlineNote.questTitle}]\n${note.trim()}`,img:null,source:"quest",questId:inlineNote.questId,created:Date.now()},...journal];setJournal(next);await dbSet("cx_journal",next,userId);}setInlineNote(null);}}/>}
          {/* Streak Rescue Banner */}
          {streakRescue&&<StreakRescueBanner rescue={streakRescue} onDismiss={()=>{localStorage.setItem(`cx_rescue_${new Date().toDateString()}_${streakRescue.skillId}`,"1");setStreakRescue(null);}} onLog={()=>{setPendingPractice({skillId:streakRescue.skillId});setStreakRescue(null);setTab("journal");setJournalSubTab("log");localStorage.setItem(`cx_rescue_${new Date().toDateString()}_${streakRescue.skillId}`,"1");}}/>}
          {/* Quest Breakdown Modal */}
          {showBreakdown&&<QuestBreakdownModal questId={showBreakdown} quests={quests} skills={skills} settings={settings} onClose={()=>setShowBreakdown(null)} onAddSubquest={addSubquest} onAddQuest={addQuest} showToast={showToast}/>}
          {/* Skill Gap Modal */}
          {showSkillGap&&<SkillGapModal quests={quests} skills={skills} tasks={tasks} settings={settings} onClose={()=>setShowSkillGap(false)} onAddTask={addTask} onEditQuest={editQuest} showToast={showToast}/>}
          {/* Focus Timer mini-bar (when running in background) */}
          {focusTimer?.running&&tab!=="focus"&&(
            <div className="timer-bar" onClick={()=>setTab("__focus__")}>
              <span className="timer-bar-time">{String(Math.floor(focusElapsed/60)).padStart(2,"0")}:{String(focusElapsed%60).padStart(2,"0")}</span>
              <span className="timer-bar-lbl">◉ {skills.find(s=>s.id===focusTimer.skillId)?.name||"Focus"}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--danger)",marginLeft:4}} onClick={e=>{e.stopPropagation();stopFocus();}}>■ stop</span>
            </div>
          )}
          {/* Full-screen focus timer */}
          {tab==="__focus__"&&<FocusTimer elapsed={focusElapsed} skillName={skills.find(s=>s.id===focusTimer?.skillId)?.name||""} onStop={stopFocus} onCancel={cancelFocus}/>}
          {/* Jarvis FAB */}
          <button onClick={()=>setShowJarvis(true)} style={{position:"fixed",bottom:72,right:16,width:44,height:44,borderRadius:"50%",background:"var(--s2)",border:"1px solid var(--b2)",color:"var(--tx)",fontSize:18,cursor:"pointer",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)",transition:"all .15s"}} title="Jarvis AI">⟡</button>
          {showJarvis&&<JarvisOverlay tasks={tasks} quests={quests} skills={skills} onAddQuest={addQuest} onAddTask={addTask} onLogMed={logMed} onClose={()=>setShowJarvis(false)}/>}
          {/* Profile modal */}
          {showProfile&&<ProfileModal settings={settings} xp={xp} level={level} prog={prog} skills={skills} streaks={streaks} meds={meds} quests={quests} journal={journal} userId={userId} myFriendCode={myFriendCode} friends={friends} profiles={communityProfiles} onSignIn={()=>setShowAuth(true)} onSignOut={handleSignOut} onClose={()=>setShowProfile(false)} onPublish={publishProfile} onAddFriend={addFriend} onRemoveFriend={removeFriend} onRefresh={refreshCommunity} onSaveSettings={saveSettings} showToast={showToast}/>}
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
      <div className={`toast ${toast.on?"on":""}`}>{toast.msg}</div>
      <FloatXP floats={floats}/>
      {milestone&&<MilestoneOverlay milestone={milestone} onClose={()=>setMilestone(null)}/>}
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

// ── AI DAY PLANNER ────────────────────────────────────────────────────────────
function DailyAIPlan({quests,tasks,skills,onAddTask}){
  const {settings}=useSettings();
  const [loading,setLoading]=useState(false);
  const [plan,setPlan]=useState(null); // [{title,timeBlock,skillId,xpVal,reason}]
  const [vibe,setVibe]=useState("grind");
  const VIBES=[{id:"grind",label:"⚔ Grind",sub:"Main quests, high XP"},{id:"focus",label:"◉ Focus",sub:"Skill practice, depth"},{id:"light",label:"◇ Light",sub:"Quick wins, admin"},{id:"open",label:"✦ Open",sub:"AI decides"}];

  const generate=async()=>{
    setLoading(true); setPlan(null);
    const skPerLv=settings.xp?.skillPerLevel||6000;
    const activeQ=quests.filter(q=>!q.done).slice(0,12).map(q=>`${q.type}: "${q.title}" [skills:${(q.skills||[]).map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean).join(",")||"none"}]`).join("; ");
    const topSkills=skills.filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,6).map(s=>s.name+" Lv"+(Math.floor((s.xp||0)/skPerLv)+1)).join(", ");
    const skillIdList=skills.map(s=>s.id+"="+s.name).join(",")||"none";
    const vibeGuide={grind:"Prioritize main quests and high-XP tasks. Fill morning with hardest items.",focus:"Prioritize skills needing practice. Mix spiritual/ritual radiant quests with skill work. Aim for depth over volume.",light:"Pick quick-win side quests and admin tasks. Nothing requiring deep focus. Under 30 min each.",open:"Balance across all types based on priority and what's been neglected."};
    try{
      const data=await aiCall({max_tokens:500,messages:[{role:"user",content:"Plan today. Vibe: "+vibe+" — "+vibeGuide[vibe]+"\n\nActive quests: "+(activeQ||"none")+"\nSkills: "+(topSkills||"none")+"\nToday's existing tasks: "+tasks.filter(t=>t.period==="daily"&&!t.done).length+" already scheduled\n\nGenerate 4-6 specific tasks for today, assigned to morning/afternoon/evening or flexible.\nReply ONLY with JSON array, no markdown:\n[{\"title\":\"task\",\"timeBlock\":\"morning|afternoon|evening|null\",\"skillId\":\"skill_id or null\",\"xpVal\":number,\"reason\":\"5 words why\"}]\nUse actual skill IDs from this list: "+skillIdList}]});
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      const m=raw.match(/\[[\s\S]*\]/);
      if(m) setPlan(JSON.parse(m[0]));
    }catch{}
    setLoading(false);
  };

  const accept=(item)=>{
    onAddTask({title:item.title,period:"daily",skill:item.skillId||null,xpVal:item.xpVal||20,questId:null,timeBlock:item.timeBlock||null,priority:"med"});
    setPlan(prev=>prev.filter(p=>p!==item));
  };
  const acceptAll=()=>{ plan.forEach(accept); };

  return(
    <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--primary)",textTransform:"uppercase"}}>⟡ AI Day Plan</div>
        {plan&&<button onClick={acceptAll} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:3,padding:"3px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--primary)",letterSpacing:.5}}>+ Add all</button>}
      </div>
      <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
        {VIBES.map(v=><button key={v.id} onClick={()=>setVibe(v.id)}
          style={{padding:"4px 10px",borderRadius:4,border:`1px solid ${vibe===v.id?"var(--primary)":"var(--b2)"}`,background:vibe===v.id?"var(--primaryf)":"var(--bg)",color:vibe===v.id?"var(--primary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer"}}>
          {v.label}
        </button>)}
      </div>
      {!plan&&<button onClick={generate} disabled={loading} style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,padding:"7px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:loading?"var(--tx3)":"var(--tx2)",width:"100%",transition:"all .15s"}}>
        {loading?"⟡ Planning…":"⟡ Plan my day"}
      </button>}
      {plan&&plan.map((item,i)=>(
        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 0",borderBottom:"1px solid var(--b1)"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:"var(--tx)",marginBottom:2}}>{item.title}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",display:"flex",gap:8}}>
              {item.timeBlock&&<span>{item.timeBlock}</span>}
              {item.skillId&&<span>{skills.find(s=>s.id===item.skillId)?.name}</span>}
              <span>+{item.xpVal} XP</span>
              {item.reason&&<span style={{fontStyle:"italic"}}>— {item.reason}</span>}
            </div>
          </div>
          <button onClick={()=>accept(item)} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:3,padding:"3px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--primary)",flexShrink:0}}>+</button>
          <button onClick={()=>setPlan(prev=>prev.filter(p=>p!==item))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--tx3)",fontSize:11,padding:"2px 2px",flexShrink:0}}>✕</button>
        </div>
      ))}
      {plan&&plan.length===0&&<div style={{fontSize:11,color:"var(--success)",fontFamily:"'DM Mono',monospace",padding:"4px 0"}}>✓ All tasks added</div>}
    </div>
  );
}

// ── AI WEEK PLANNER ───────────────────────────────────────────────────────────
function WeeklyAIPlan({quests,tasks,skills,weekDays,onAddTask}){
  const {settings}=useSettings();
  const [loading,setLoading]=useState(false);
  const [plan,setPlan]=useState(null);
  const [open,setOpen]=useState(false);
  const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const generate=async()=>{
    setLoading(true); setPlan(null);
    const skPerLv=settings.xp?.skillPerLevel||6000;
    const activeQ=quests.filter(q=>!q.done).slice(0,10).map(q=>"["+q.type+'] "'+q.title+'"').join("; ");
    const topSkills=skills.filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,5).map(s=>s.name+" Lv"+(Math.floor((s.xp||0)/skPerLv)+1)).join(", ");
    const skillIdList=skills.map(s=>s.id+"="+s.name).join(",")||"none";
    try{
      const data=await aiCall({max_tokens:700,messages:[{role:"user",content:"Plan this week. Distribute tasks across 7 days (Mon-Sun index 0-6).\n\nActive quests: "+(activeQ||"none")+"\nSkills: "+(topSkills||"none")+"\n\nGenerate 1-2 tasks per day, spread across the week. Focus on realistic distribution.\nReply ONLY with JSON array:\n[{\"title\":\"task\",\"dayIndex\":0,\"skillId\":\"id or null\",\"xpVal\":number}]\nAvailable skill IDs: "+skillIdList}]});
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      const m=raw.match(/\[[\s\S]*\]/);
      if(m) setPlan(JSON.parse(m[0]));
    }catch{}
    setLoading(false);
  };

  const accept=(item)=>{
    const targetDay=weekDays[item.dayIndex||0]||weekDays[0];
    onAddTask({title:item.title,period:"daily",skill:item.skillId||null,xpVal:item.xpVal||20,questId:null,timeBlock:null,priority:"med",dayKey:dayKey(targetDay)});
    setPlan(prev=>prev.filter(p=>p!==item));
  };

  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"1px dashed var(--b2)",borderRadius:"var(--r)",padding:"8px 14px",cursor:"pointer",color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,width:"100%",marginBottom:10,transition:"all .15s"}}>
      <span>⟡</span> AI plan this week
    </button>
  );

  return(
    <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--primary)",textTransform:"uppercase"}}>⟡ AI Week Plan</div>
        <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:12}}>✕</button>
      </div>
      {!plan&&<button onClick={generate} disabled={loading} style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,padding:"7px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:loading?"var(--tx3)":"var(--tx2)",width:"100%"}}>
        {loading?"⟡ Planning…":"⟡ Generate week plan"}
      </button>}
      {plan&&<>
        {[0,1,2,3,4,5,6].map(di=>{
          const dayItems=plan.filter(p=>p.dayIndex===di);
          if(!dayItems.length) return null;
          return(<div key={di} style={{marginBottom:8}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",letterSpacing:1,marginBottom:4}}>{DAYS[di]} {weekDays[di]?.getDate()}</div>
            {dayItems.map((item,j)=>(
              <div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:"1px solid var(--b1)"}}>
                <div style={{flex:1,fontSize:12,color:"var(--tx)"}}>{item.title}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)"}}>{item.skillId?skills.find(s=>s.id===item.skillId)?.name:""} +{item.xpVal}</div>
                <button onClick={()=>accept(item)} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:3,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--primary)",flexShrink:0}}>+</button>
                <button onClick={()=>setPlan(prev=>prev.filter(p=>p!==item))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--tx3)",fontSize:11,padding:"2px"}}>✕</button>
              </div>
            ))}
          </div>);
        })}
        {plan.length===0&&<div style={{fontSize:11,color:"var(--success)",fontFamily:"'DM Mono',monospace"}}>✓ All tasks added</div>}
      </>}
    </div>
  );
}

// ── AI MONTH PLANNER ──────────────────────────────────────────────────────────
function MonthlyAIPlan({quests,tasks,skills,onAddTask}){
  const {settings}=useSettings();
  const [loading,setLoading]=useState(false);
  const [plan,setPlan]=useState(null);
  const [open,setOpen]=useState(false);

  const generate=async()=>{
    setLoading(true); setPlan(null);
    const skPerLv=settings.xp?.skillPerLevel||6000;
    const mainQ=quests.filter(q=>!q.done&&q.type==="main").slice(0,8).map(q=>'"'+q.title+'"').join(", ");
    const topSkills=skills.filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,5).map(s=>s.name+" Lv"+(Math.floor((s.xp||0)/skPerLv)+1)).join(", ");
    const month=new Date().toLocaleString("en-US",{month:"long",year:"numeric"});
    const skillIdList=skills.map(s=>s.id+"="+s.name).join(",")||"none";
    try{
      const data=await aiCall({max_tokens:600,messages:[{role:"user",content:"Plan "+month+". Create 6-10 monthly milestones or goals derived from the active quests.\n\nMain quests: "+(mainQ||"none")+"\nSkills: "+(topSkills||"none")+"\n\nEach item should be a concrete, achievable milestone for this month — not vague.\nReply ONLY with JSON array:\n[{\"title\":\"milestone\",\"skillId\":\"id or null\",\"xpVal\":number,\"note\":\"why this month\"}]\nSkill IDs: "+skillIdList}]});
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      const m=raw.match(/\[[\s\S]*\]/);
      if(m) setPlan(JSON.parse(m[0]));
    }catch{}
    setLoading(false);
  };

  const accept=(item)=>{
    onAddTask({title:item.title,period:"monthly",skill:item.skillId||null,xpVal:item.xpVal||100,questId:null,timeBlock:null,priority:"med"});
    setPlan(prev=>prev.filter(p=>p!==item));
  };

  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"1px dashed var(--b2)",borderRadius:"var(--r)",padding:"8px 14px",cursor:"pointer",color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,width:"100%",marginBottom:10,transition:"all .15s"}}>
      <span>⟡</span> AI plan this month
    </button>
  );

  return(
    <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--primary)",textTransform:"uppercase"}}>⟡ AI Month Plan</div>
        <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:12}}>✕</button>
      </div>
      {!plan&&<button onClick={generate} disabled={loading} style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,padding:"7px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:loading?"var(--tx3)":"var(--tx2)",width:"100%"}}>
        {loading?"⟡ Planning…":"⟡ Generate month milestones"}
      </button>}
      {plan&&<>
        {plan.map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 0",borderBottom:"1px solid var(--b1)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:"var(--tx)",marginBottom:2}}>{item.title}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",display:"flex",gap:8}}>
                {item.skillId&&<span>{skills.find(s=>s.id===item.skillId)?.name}</span>}
                <span>+{item.xpVal} XP</span>
                {item.note&&<span style={{fontStyle:"italic"}}>— {item.note}</span>}
              </div>
            </div>
            <button onClick={()=>accept(item)} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:3,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--primary)",flexShrink:0}}>+</button>
            <button onClick={()=>setPlan(prev=>prev.filter(p=>p!==item))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--tx3)",fontSize:11,padding:"2px"}}>✕</button>
          </div>
        ))}
        {plan.length===0&&<div style={{fontSize:11,color:"var(--success)",fontFamily:"'DM Mono',monospace"}}>✓ All milestones added</div>}
        <button onClick={generate} style={{marginTop:8,background:"none",border:"1px solid var(--b2)",borderRadius:4,padding:"5px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)"}}>↺ Regenerate</button>
      </>}
    </div>
  );
}

function QuestPlannerCard({quest,skills,onToggle,radiantAvailable,radiantCooldownLabel,locked,prereqTitle,onOpenBreakdown}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const isRadiant=quest.type==="radiant";
  const rAvail=isRadiant&&radiantAvailable?radiantAvailable(quest):true;
  const rCool=isRadiant&&radiantCooldownLabel?radiantCooldownLabel(quest):null;
  const dueFmt=quest.due?new Date(quest.due).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
  const now=Date.now();
  const overdue=quest.due&&quest.due<now&&!quest.done;
  return (
    <div className={`card quest-${quest.type} ${quest.done&&!isRadiant?"done":""}`}
      style={{marginBottom:3,borderColor:locked?"var(--b1)":overdue?"var(--danger)":isRadiant?"var(--secondaryb)":"var(--primaryb)",background:locked?"var(--bg)":isRadiant?"var(--s2)":"var(--primaryf)",opacity:locked?.55:1}}>
      <button className="chk"
        style={locked?{color:"var(--tx3)",borderColor:"var(--b1)",cursor:"not-allowed"}
          :isRadiant?{color:rAvail?"var(--secondary)":"var(--tx3)",borderColor:rAvail?"var(--secondaryb)":"var(--b1)",fontSize:rCool?7:undefined}
          :{color:"var(--primary)",borderColor:"var(--primaryb)"}}
        onClick={()=>onToggle(quest.id)} title={locked?`Locked — complete "${prereqTitle}" first`:rCool?`Available in ${rCool}`:undefined}>
        {locked?"🔒":isRadiant?(rCool?rCool:"◉"):quest.done?"✓":""}
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

function PlannerTab({period,setPeriod,tasks,weekDays,allTasks,skills,quests,onAddTask,onToggle,onDelete,onEdit,onToggleQuest,radiantAvailable,radiantCooldownLabel,nudge,onDismissNudge,onAcceptNudge,dailyBriefing,onRefreshBriefing,onOpenBreakdown,onOpenSkillGap}){
  const {settings}=useSettings(); const L=settings.labels;
  const [showForm,setShowForm]=useState(false);
  const [qaMode,setQaMode]=useState("task");
  const [f,setF]=useState({title:"",skill:"",xpVal:20,questId:"",recurrenceDays:[],timeBlock:"",priority:"med"});
  const [qf,setQf]=useState({title:"",type:"side",note:"",priority:"med",pinToday:true,skillIds:[]});
  const [nlInput,setNlInput]=useState("");
  const [nlLoading,setNlLoading]=useState(false);
  const [collapsed,setCollapsed]=useState({overdue:false,morning:false,afternoon:false,evening:false,flexible:false,coming:true});
  const [dragId,setDragId]=useState(null);
  const [showSubForm,setShowSubForm]=useState(false);
  const [subF,setSubF]=useState({title:"",skill:"",xpVal:20,recurrenceDays:[],priority:"med"});


  const todayDk=dayKey(new Date());
  const toggleWday=i=>setF(v=>({...v,recurrenceDays:v.recurrenceDays.includes(i)?v.recurrenceDays.filter(x=>x!==i):[...v.recurrenceDays,i]}));
  const toggleSubWday=i=>setSubF(v=>({...v,recurrenceDays:v.recurrenceDays.includes(i)?v.recurrenceDays.filter(x=>x!==i):[...v.recurrenceDays,i]}));
  useEffect(()=>{if(skills.length&&!f.skill)setF(v=>({...v,skill:skills[0]?.id||""}));},[skills]);

  const submitSub=()=>{
    if(!subF.title.trim()) return;
    onAddTask({title:subF.title.trim(),period,skill:subF.skill||null,xpVal:Number(subF.xpVal)||20,questId:null,
      recurrenceDays:period==="weekly"&&subF.recurrenceDays.length?subF.recurrenceDays:null,
      timeBlock:null,priority:subF.priority||"med"});
    setSubF({title:"",skill:"",xpVal:20,recurrenceDays:[],priority:"med"});
    setShowSubForm(false);
  };

  const submit=()=>{
    if(!f.title.trim()) return;
    onAddTask({title:f.title.trim(),period,skill:f.skill||null,xpVal:f.xpVal,questId:f.questId||null,recurrenceDays:period==="weekly"&&f.recurrenceDays.length?f.recurrenceDays:null,timeBlock:f.timeBlock||null,priority:f.priority||"med"});
    setF(v=>({...v,title:"",questId:"",recurrenceDays:[],timeBlock:""})); setShowForm(false);
  };

  const submitQuest=()=>{
    if(!qf.title.trim()) return;
    window.dispatchEvent(new CustomEvent("cx:addquest",{detail:{title:qf.title.trim(),type:qf.type,note:qf.note,priority:qf.priority,skills:qf.skillIds||[]}}));
    if(qf.pinToday) onAddTask({title:qf.title.trim(),period:"daily",skill:qf.skillIds?.[0]||null,xpVal:20,questId:null,timeBlock:f.timeBlock||null,priority:qf.priority});
    setQf({title:"",type:"side",note:"",priority:"med",pinToday:true,skillIds:[]}); setShowForm(false);
  };

  const nlParse=async()=>{
    if(!nlInput.trim()) return;
    setNlLoading(true);
    try{
      const data=await aiCall({
        max_tokens:200,
        messages:[
          {role:"system",content:`Parse a natural language task into JSON only. Fields: title(string), timeBlock("morning"|"afternoon"|"evening"|null), skillName(string or null, from list: ${skills.map(s=>s.name).join(", ")||"none"}), dayOffset(int, 0=today). Reply only valid JSON.`},
          {role:"user",content:nlInput}
        ]
      });
      const txt=(data.choices?.[0]?.message?.content||"{}").replace(/```json|```/g,"").trim();
      let parsed; try{parsed=JSON.parse(txt);}catch{parsed={};}
      const matchedSkill=skills.find(s=>s.name.toLowerCase()===(parsed.skillName||"").toLowerCase());
      const targetDate=new Date(); if((parsed.dayOffset||0)>0) targetDate.setDate(targetDate.getDate()+(parsed.dayOffset||0));
      onAddTask({title:parsed.title||nlInput.trim(),period:"daily",skill:matchedSkill?.id||null,xpVal:20,questId:null,timeBlock:parsed.timeBlock||null,priority:"med",dayKey:dayKey(targetDate)});
      setNlInput("");
    }catch(e){console.error(e);}
    setNlLoading(false);
  };

  const questsForDay=(dk)=>(quests||[]).filter(q=>q.due&&!q.done&&dayKey(new Date(q.due))===dk);
  const questsForMonth=(year,month)=>(quests||[]).filter(q=>{
    if(!q.due||q.done) return false;
    const d=new Date(q.due); return d.getFullYear()===year&&d.getMonth()===month;
  });

  const doneTasks=tasks.filter(t=>t.done);
  const now=new Date();
  const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const overdueQuests=(quests||[]).filter(q=>q.due&&!q.done&&new Date(q.due)<todayStart);
  const todayQuests=questsForDay(todayDk);
  const availableRadiant=(quests||[]).filter(q=>q.type==="radiant"&&(radiantAvailable?radiantAvailable(q):true));
  const prioOrder={high:0,med:1,low:2};
  const sortByPrio=(a,b)=>((prioOrder[a.priority]??1)-(prioOrder[b.priority]??1));
  const byBlock=(blk)=>tasks.filter(t=>!t.done&&t.timeBlock===blk).sort(sortByPrio);
  const flexible=[...tasks.filter(t=>!t.done&&!t.timeBlock).sort(sortByPrio),...availableRadiant];

  const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const threeDays=new Date(); threeDays.setDate(threeDays.getDate()+3);
  const comingUp=(quests||[]).filter(q=>{if(!q.due||q.done) return false; const d=new Date(q.due); return d>=tomorrow&&d<=threeDays;});
  const activeQuests=(quests||[]).filter(q=>!q.done);

  const Block=({id,label,items,isOverdue=false})=>{
    const cnt=items.length; if(!cnt&&id!=="flexible") return null;
    const open=!collapsed[id];
    return(
      <div className="block-wrap">
        <div className="block-hdr" onClick={()=>setCollapsed(v=>({...v,[id]:!v[id]}))}>
          <span className={`block-hdr-lbl ${isOverdue?"overdue":""}`}>{label}</span>
          {cnt>0&&<span className="block-count">{cnt}</span>}
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginLeft:"auto"}}>{open?"▾":"▸"}</span>
        </div>
        {open&&<div className="block-body">
          {items.map(item=>item.type==="radiant"
            ?<QuestPlannerCard key={item.id} quest={item} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>
            :<React.Fragment key={item.id}><TaskCard task={item} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>
              {nudge?.taskId===item.id&&(
                <div className="practice-nudge">
                  <span className="nudge-text">◉ Log practice for {nudge.skillName}?</span>
                  <button className="nudge-btn nudge-yes" onClick={onAcceptNudge}>Yes</button>
                  <button className="nudge-btn nudge-no" onClick={onDismissNudge}>Skip</button>
                </div>
              )}
            </React.Fragment>
          )}
          {!cnt&&<div style={{fontSize:12,color:"var(--tx3)",padding:"4px 0 2px"}}>Nothing scheduled</div>}
        </div>}
      </div>
    );
  };

  const handleDragStart=(e,taskId)=>{ setDragId(taskId); e.dataTransfer.effectAllowed="move"; };
  const handleDrop=(e,dk)=>{
    e.preventDefault(); if(!dragId) return;
    const t=allTasks.find(x=>x.id===dragId); if(t) onEdit(dragId,{...t,dayKey:dk,period:"daily"});
    setDragId(null);
  };

  return (<>
    <div className="stabs">
      {[L.daily,L.weekly,L.monthly,L.yearly].map((lbl,i)=>(
        <button key={i} className={`stab ${period===PERIODS[i]?"on":""}`} onClick={()=>{setPeriod(PERIODS[i]);setShowForm(false);}}>{lbl}</button>
      ))}
    </div>
    {period==="daily"&&<div className="date-hdr">{todayLabel()}</div>}
    {period==="monthly"&&<div className="date-hdr">{monthLabel()}</div>}
    {period==="yearly"&&<div className="date-hdr">{new Date().getFullYear()} — Annual Goals</div>}
    {period==="weekly"&&<div className="date-hdr">Week of {weekDays[0]?.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}

    {/* Daily Briefing Panel */}
    {period==="daily"&&dailyBriefing&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--primary)",textTransform:"uppercase"}}>✦ Daily Briefing</div>
          <div style={{display:"flex",gap:6}}>
            {onOpenSkillGap&&<button onClick={onOpenSkillGap} style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:8,cursor:"pointer",padding:"2px 7px",letterSpacing:.5}} title="Skill gap analysis">◈ Gaps</button>}
            <button onClick={onRefreshBriefing} style={{background:"none",border:"none",color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:8,cursor:"pointer",padding:"2px 4px",letterSpacing:.5}} title="Regenerate">↺</button>
          </div>
        </div>
        {dailyBriefing.loading
          ? <div style={{fontSize:11,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontStyle:"italic"}}>Generating briefing…</div>
          : <div style={{fontSize:12,color:"var(--tx2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{dailyBriefing.text}</div>
        }
      </div>
    )}

    {period==="daily"&&<>
      <div className="nl-row">
        <input className="nl-input" placeholder='Quick add: "Study guitar 30min morning"' value={nlInput} onChange={e=>setNlInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nlParse()}/>
        <button className="nl-btn" onClick={nlParse} disabled={nlLoading||!nlInput.trim()}>{nlLoading?"…":"↵"}</button>
      </div>

      {showForm?(<div className="fwrap">
        <div className="qa-toggle">
          <button className={`qa-opt ${qaMode==="task"?"on":""}`} onClick={()=>setQaMode("task")}>Task</button>
          <button className={`qa-opt ${qaMode==="quest"?"on":""}`} onClick={()=>setQaMode("quest")}>Quest</button>
        </div>
        {qaMode==="task"?(<>
          <div className="frow"><input className="fi full" placeholder="What needs doing..." autoFocus value={f.title} onChange={e=>setF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          <div className="frow">
            <select className="fsel" value={f.timeBlock} onChange={e=>setF(v=>({...v,timeBlock:e.target.value}))}>
              <option value="">Flexible</option>
              {TIME_BLOCKS.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <select className="fsel" value={f.priority} onChange={e=>setF(v=>({...v,priority:e.target.value}))}>
              <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
            </select>
            <button className="fsbtn" style={{width:"auto",padding:"7px 12px",marginTop:0}} onClick={()=>setShowForm(false)}>✕</button>
          </div>
          <div className="frow">
            <select className="fsel" value={f.skill} onChange={e=>setF(v=>({...v,skill:e.target.value}))}>
              <option value="">No skill</option>
              {skills.map(s=><option key={s.id} value={s.id}>{skillLabel(s)}</option>)}
            </select>
            <select className="fsel" value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:Number(e.target.value)}))}>
              {[5,10,20,30,50,80,150,300,500].map(v=><option key={v} value={v}>{v} {L.xpName}</option>)}
            </select>
            <input type="number" className="fsel" style={{width:64}} min={1} max={30000} value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:Math.max(1,Number(e.target.value)||20)}))}/>
          </div>
          {activeQuests.length>0&&(<div className="frow"><select className="fsel" style={{flex:1}} value={f.questId} onChange={e=>setF(v=>({...v,questId:e.target.value}))}><option value="">No quest link</option>{activeQuests.map(q=><option key={q.id} value={q.id}>◆ {q.title}</option>)}</select></div>)}
          <button className="fsbtn" onClick={submit}>Add Task</button>
        </>):(<>
          <div className="frow"><input className="fi full" placeholder="Quest title..." autoFocus value={qf.title} onChange={e=>setQf(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitQuest()}/></div>
          <div className="frow">
            <select className="fsel" value={qf.type} onChange={e=>setQf(v=>({...v,type:e.target.value}))}>
              <option value="main">Main Quest</option><option value="side">Side Quest</option><option value="radiant">Radiant</option>
            </select>
            <select className="fsel" value={qf.priority} onChange={e=>setQf(v=>({...v,priority:e.target.value}))}>
              <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
            </select>
          </div>
          {skills.filter(s=>s.type!=="subskill").length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginBottom:4,letterSpacing:.8}}>LINKED SKILLS (multi-select)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {skills.filter(s=>s.type!=="subskill").map(s=>{
                  const on=(qf.skillIds||[]).includes(s.id);
                  return <button key={s.id} onClick={()=>setQf(v=>({...v,skillIds:on?(v.skillIds||[]).filter(x=>x!==s.id):[...(v.skillIds||[]),s.id]}))}
                    style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${on?"var(--primary)":"var(--b2)"}`,background:on?"var(--primaryf)":"var(--bg)",color:on?"var(--primary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer"}}>
                    {s.icon||"◈"} {s.name}
                  </button>;
                })}
              </div>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <input type="checkbox" checked={qf.pinToday} onChange={e=>setQf(v=>({...v,pinToday:e.target.checked}))} id="pin-today"/>
            <label htmlFor="pin-today" style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx2)",cursor:"pointer"}}>Add task for today</label>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="fsbtn" onClick={submitQuest}>Add Quest</button>
            <button className="fsbtn" style={{width:"auto",padding:"8px 12px"}} onClick={()=>setShowForm(false)}>✕</button>
          </div>
        </>)}
      </div>):<button className="addbtn" onClick={()=>setShowForm(true)}><span>+</span> Add task or quest</button>}

      {overdueQuests.length>0&&<>
        <div className="block-wrap">
          <div className="block-hdr" onClick={()=>setCollapsed(v=>({...v,overdue:!v.overdue}))}>
            <span className="block-hdr-lbl overdue">⚠ Overdue</span>
            <span className="block-count">{overdueQuests.length}</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginLeft:"auto"}}>{!collapsed.overdue?"▾":"▸"}</span>
          </div>
          {!collapsed.overdue&&<div className="block-body">{overdueQuests.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}</div>}
        </div>
      </>}

      {todayQuests.length>0&&<>
        <div className="slbl" style={{marginBottom:6}}>◆ Due today</div>
        {todayQuests.map(q=>{const prereq=(quests||[]).find(p=>p.id===q.unlocksAfter);const locked=prereq&&!prereq.done;return <QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} locked={locked} prereqTitle={prereq?.title} onOpenBreakdown={onOpenBreakdown}/>;})}
      </>}

      <Block id="morning"   label="🌅 Morning"   items={byBlock("morning")}/>
      <Block id="afternoon" label="☀️ Afternoon" items={byBlock("afternoon")}/>
      <Block id="evening"   label="🌙 Evening"   items={byBlock("evening")}/>

      {/* AI day planner — shown when blocks are empty to encourage use */}
      {byBlock("morning").length===0&&byBlock("afternoon").length===0&&byBlock("evening").length===0&&(
        <DailyAIPlan quests={quests} tasks={allTasks} skills={skills} onAddTask={onAddTask}/>
      )}

      <Block id="flexible" label="◈ Flexible / Unscheduled" items={[...tasks.filter(t=>!t.done&&!t.timeBlock).sort(sortByPrio),...availableRadiant]}/>

      {doneTasks.length>0&&<><div className="gap"/><div className="slbl">{L.done}</div>
        <div className="clist">{doneTasks.map(t=><TaskCard key={t.id} task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>)}</div>
      </>}

      {comingUp.length>0&&<div className="block-wrap" style={{marginTop:8}}>
        <div className="block-hdr" onClick={()=>setCollapsed(v=>({...v,coming:!v.coming}))}>
          <span className="block-hdr-lbl">◇ Coming up</span>
          <span className="block-count">{comingUp.length}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginLeft:"auto"}}>{!collapsed.coming?"▾":"▸"}</span>
        </div>
        {!collapsed.coming&&comingUp.map(q=>{
          const diff=Math.round((new Date(q.due)-now)/86400000);
          return(<div key={q.id} className="coming-up-card"><span style={{fontSize:11}}>{q.type==="main"?"◆":q.type==="radiant"?"◉":"◇"}</span><span className="coming-up-title">{q.title}</span><span className="coming-up-due">in {diff}d</span></div>);
        })}
      </div>}

      {tasks.length===0&&todayQuests.length===0&&overdueQuests.length===0&&(<div className="empty-state"><div className="es-icon">☐</div><div className="es-title">Day is clear</div><div className="es-desc">Type a task above or tap + to schedule. Try: "meditate 20min morning".</div></div>)}
    </>}

    {period==="weekly"&&<>
      {/* Week calendar overview at top */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:14}}>
        {weekDays.map((d,i)=>{
          const dk=dayKey(d), isToday=dk===dayKey(new Date());
          const dayTasks=allTasks.filter(t=>(t.dayKey===dk||(t.period==="weekly"&&(t.recurrenceDays||[]).includes(i)))&&!t.done);
          const dayQ=questsForDay(dk).filter(q=>!q.done);
          const total=dayTasks.length+dayQ.length;
          return(
            <div key={i} style={{background:isToday?"var(--primaryf)":"var(--s1)",border:`1px solid ${isToday?"var(--primaryb)":"var(--b1)"}`,borderRadius:"var(--r)",padding:"6px 4px",textAlign:"center",cursor:"default"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:isToday?"var(--primary)":"var(--tx3)",letterSpacing:.5,marginBottom:3}}>{["Mo","Tu","We","Th","Fr","Sa","Su"][i]}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:isToday?"var(--primary)":"var(--tx)",fontWeight:isToday?"bold":"normal"}}>{d.getDate()}</div>
              {total>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",marginTop:2}}>{total} item{total>1?"s":""}</div>}
            </div>
          );
        })}
      </div>

      {/* AI week planner */}
      <WeeklyAIPlan quests={quests} tasks={allTasks} skills={skills} weekDays={weekDays} onAddTask={onAddTask}/>

      {/* Radiant + undated quests */}
      {(()=>{
        const radiantQ=(quests||[]).filter(q=>q.type==="radiant"&&!q.done);
        const undatedQ=(quests||[]).filter(q=>!q.done&&q.type!=="radiant"&&!q.due);
        if(!radiantQ.length&&!undatedQ.length) return null;
        return(
          <div style={{marginBottom:12}}>
            {radiantQ.length>0&&<>
              <div className="slbl" style={{marginBottom:6}}>◉ Repeatable this week</div>
              <div className="clist" style={{marginBottom:8}}>
                {radiantQ.slice(0,8).map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}
              </div>
            </>}
            {undatedQ.length>0&&<>
              <div className="slbl" style={{marginBottom:6}}>◇ Active quests (no date)</div>
              <div className="clist" style={{marginBottom:8}}>
                {undatedQ.slice(0,6).map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}
              </div>
            </>}
          </div>
        );
      })()}

      {/* Global weekly add + per-day sections */}
      {showSubForm?(
        <div className="fwrap" style={{marginBottom:10}}>
          <div className="frow"><input className="fi full" autoFocus placeholder="Weekly recurring task..." value={subF.title} onChange={e=>setSubF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitSub()}/></div>
          <div className="frow">
            <select className="fsel" value={subF.skill} onChange={e=>setSubF(v=>({...v,skill:e.target.value}))}>
              <option value="">No skill</option>
              {skills.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
            <select className="fsel" value={subF.priority} onChange={e=>setSubF(v=>({...v,priority:e.target.value}))}>
              <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
            </select>
            <input type="number" className="fsel" style={{width:64}} min={1} max={30000} placeholder="XP" value={subF.xpVal} onChange={e=>setSubF(v=>({...v,xpVal:Math.max(1,Number(e.target.value)||20)}))}/>
            <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setShowSubForm(false)}>✕</button>
          </div>
          <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
            {WDAY_LABELS.map((d,i)=><button key={i} onClick={()=>toggleSubWday(i)}
              style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${subF.recurrenceDays.includes(i)?"var(--primary)":"var(--b2)"}`,background:subF.recurrenceDays.includes(i)?"var(--primaryf)":"var(--bg)",color:subF.recurrenceDays.includes(i)?"var(--primary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer"}}>
              {d}
            </button>)}
          </div>
          <button className="fsbtn" onClick={submitSub}>Add recurring task</button>
        </div>
      ):<button className="addbtn" style={{marginBottom:10}} onClick={()=>setShowSubForm(true)}><span>+</span> Add recurring task</button>}

      {weekDays.map((d,i)=>{
        const dk=dayKey(d), isToday=dk===dayKey(new Date()), dayIdx=i;
        const dt=[...new Map([...allTasks.filter(t=>t.dayKey===dk),...allTasks.filter(t=>t.period==="weekly"&&(t.recurrenceDays||[]).includes(dayIdx))].map(t=>[t.id,t])).values()];
        const dq=questsForDay(dk);
        return (
          <div key={i} className="wk-day" onDragOver={e=>{e.preventDefault();e.currentTarget.style.outline="1px dashed var(--primaryb)";}} onDragLeave={e=>{e.currentTarget.style.outline="none";}} onDrop={e=>{e.currentTarget.style.outline="none";handleDrop(e,dk);}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div className={`wk-day-lbl ${isToday?"today":""}`} style={{marginBottom:0}}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} {d.getDate()}{isToday?" · today":""}</div>
              <button onClick={()=>onAddTask({title:"",period:"daily",skill:null,xpVal:20,questId:null,timeBlock:null,priority:"med",dayKey:dk})}
                style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:14,padding:"0 4px",lineHeight:1,fontFamily:"'DM Mono',monospace"}}
                title={`Add task to ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}`}>+</button>
            </div>
            {dt.length===0&&dq.length===0?<div style={{fontSize:12,color:"var(--tx3)",paddingLeft:2}}>—</div>:<>
              {dq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}
              <div className="clist">{dt.map(t=><div key={t.id} draggable onDragStart={e=>handleDragStart(e,t.id)} style={{cursor:"grab"}}><TaskCard task={t} skills={skills} quests={quests||[]} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/></div>)}</div>
            </>}
          </div>
        );
      })}
    </>}

    {period==="monthly"&&(()=>{
      const now2=new Date();
      const yr=now2.getFullYear(), mo=now2.getMonth();
      const mq=questsForMonth(yr,mo);
      // Build calendar grid
      const firstDay=new Date(yr,mo,1);
      const lastDay=new Date(yr,mo+1,0);
      const startDow=(firstDay.getDay()+6)%7; // Mon=0
      const totalDays=lastDay.getDate();
      const calCells=[];
      for(let i=0;i<startDow;i++) calCells.push(null);
      for(let d=1;d<=totalDays;d++) calCells.push(d);
      while(calCells.length%7!==0) calCells.push(null);
      const today2=now2.getDate();
      const questsByDay={};
      mq.forEach(q=>{const d=new Date(q.due).getDate();(questsByDay[d]=questsByDay[d]||[]).push(q);});
      const tasksByDay={};
      allTasks.filter(t=>t.period==="monthly"||t.period==="daily").forEach(t=>{if(t.dayKey){const td=new Date(t.dayKey+"T12:00");if(td.getFullYear()===yr&&td.getMonth()===mo){const d=td.getDate();(tasksByDay[d]=tasksByDay[d]||[]).push(t);}}});
      return(<>
        {/* Calendar */}
        <div style={{marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=><div key={d} style={{textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",padding:"2px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {calCells.map((day,i)=>{
              const hasQ=day&&questsByDay[day]?.length>0;
              const hasT=day&&tasksByDay[day]?.length>0;
              const isToday2=day===today2;
              return <div key={i} style={{minHeight:32,borderRadius:4,background:day?"var(--s1)":"transparent",border:isToday2?"1px solid var(--primary)":"1px solid "+(day?"var(--b1)":"transparent"),display:"flex",flexDirection:"column",alignItems:"center",padding:"3px 2px",position:"relative"}}>
                {day&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:isToday2?"var(--primary)":"var(--tx3)",fontWeight:isToday2?"bold":"normal"}}>{day}</span>}
                {hasQ&&<span style={{width:5,height:5,borderRadius:"50%",background:"var(--primary)",marginTop:2}}/>}
                {hasT&&<span style={{width:4,height:4,borderRadius:"50%",background:"var(--secondary)",marginTop:1}}/>}
              </div>;
            })}
          </div>
        </div>
        {/* Add task */}
        {showSubForm?(
          <div className="fwrap" style={{marginBottom:10}}>
            <div className="frow"><input className="fi full" autoFocus placeholder="Monthly goal or task..." value={subF.title} onChange={e=>setSubF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitSub()}/></div>
            <div className="frow">
              <select className="fsel" value={subF.skill} onChange={e=>setSubF(v=>({...v,skill:e.target.value}))}>
                <option value="">No skill</option>
                {skills.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
              <select className="fsel" value={subF.priority} onChange={e=>setSubF(v=>({...v,priority:e.target.value}))}>
                <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
              </select>
              <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setShowSubForm(false)}>✕</button>
            </div>
            <button className="fsbtn" onClick={submitSub}>Add monthly task</button>
          </div>
        ):<button className="addbtn" style={{marginBottom:10}} onClick={()=>setShowSubForm(true)}><span>+</span> Add monthly task</button>}
        {/* AI month planner */}
        <MonthlyAIPlan quests={quests} tasks={allTasks} skills={skills} onAddTask={onAddTask}/>
        {mq.length>0&&<><div className="slbl" style={{marginBottom:6}}>◆ Quests this month</div>{mq.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}</>}
        {tasks.length>0&&<>
          <div className="slbl" style={{marginBottom:8,marginTop:12}}>◎ Monthly Tasks</div>
          {tasks.map(t=>(
            <div key={t.id} className={`card${t.done?" done":""}`} style={{marginBottom:4,opacity:t.done?.5:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" checked={!!t.done} onChange={()=>onToggle(t.id)} style={{accentColor:"var(--primary)",width:14,height:14,flexShrink:0}}/>
                <span style={{flex:1,fontSize:13,color:t.done?"var(--tx3)":"var(--tx)",textDecoration:t.done?"line-through":"none"}}>{t.title}</span>
                <button className="delbtn" onClick={()=>onDelete(t.id)}>✕</button>
              </div>
            </div>
          ))}
        </>}
        {tasks.length===0&&mq.length===0&&<div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic",padding:"8px 0",textAlign:"center"}}>No monthly tasks — add one above.</div>}
      </>);
    })()}

    {period==="yearly"&&(()=>{
      const yr=new Date().getFullYear();
      const yearQuests=(quests||[]).filter(q=>{if(!q.due)return false;const d=new Date(q.due);return d.getFullYear()===yr;});
      const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const questsByMonth={};
      yearQuests.forEach(q=>{const m=new Date(q.due).getMonth();(questsByMonth[m]=questsByMonth[m]||[]).push(q);});
      const curMo=new Date().getMonth();
      return(<>
        {/* Year calendar - month strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,marginBottom:14}}>
          {months.map((m,i)=>{
            const cnt=(questsByMonth[i]||[]).length;
            const isPast=i<curMo, isCur=i===curMo;
            return <div key={i} style={{borderRadius:4,border:`1px solid ${isCur?"var(--primary)":cnt>0?"var(--b2)":"var(--b1)"}`,background:isCur?"var(--primaryf)":"var(--s1)",padding:"5px 4px",textAlign:"center"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:isCur?"var(--primary)":isPast?"var(--tx3)":"var(--tx2)",fontWeight:isCur?"bold":"normal"}}>{m}</div>
              {cnt>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"var(--primary)",marginTop:2}}>◆{cnt}</div>}
            </div>;
          })}
        </div>
        {/* Add task */}
        {showSubForm?(
          <div className="fwrap" style={{marginBottom:10}}>
            <div className="frow"><input className="fi full" autoFocus placeholder="Annual goal..." value={subF.title} onChange={e=>setSubF(v=>({...v,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitSub()}/></div>
            <div className="frow">
              <select className="fsel" value={subF.skill} onChange={e=>setSubF(v=>({...v,skill:e.target.value}))}>
                <option value="">No skill</option>
                {skills.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
              <select className="fsel" value={subF.priority} onChange={e=>setSubF(v=>({...v,priority:e.target.value}))}>
                <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
              </select>
              <button className="fsbtn" style={{width:"auto",padding:"7px 10px",marginTop:0}} onClick={()=>setShowSubForm(false)}>✕</button>
            </div>
            <button className="fsbtn" onClick={submitSub}>Add annual goal</button>
          </div>
        ):<button className="addbtn" style={{marginBottom:10}} onClick={()=>setShowSubForm(true)}><span>+</span> Add annual goal</button>}
        {yearQuests.length>0&&<>
          <div className="slbl" style={{marginBottom:6}}>◆ Quests due this year</div>
          {yearQuests.map(q=><QuestPlannerCard key={q.id} quest={q} skills={skills} onToggle={onToggleQuest} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>)}
          <div style={{height:16}}/>
        </>}
        {tasks.length>0&&<>
          <div className="slbl" style={{marginBottom:8}}>◎ Annual Goals</div>
          {tasks.map(t=>(
            <div key={t.id} className={`card${t.done?" done":""}`} style={{marginBottom:4,opacity:t.done?.5:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" checked={!!t.done} onChange={()=>onToggle(t.id)} style={{accentColor:"var(--primary)",width:14,height:14,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:t.done?"var(--tx3)":"var(--tx)",textDecoration:t.done?"line-through":"none"}}>{t.title}</div>
                  {t.skill&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginTop:2}}>◈ {skills.find(s=>s.id===t.skill)?.name||""}</div>}
                </div>
                <button className="delbtn" onClick={()=>onDelete(t.id)}>✕</button>
              </div>
            </div>
          ))}
        </>}
        {tasks.length===0&&yearQuests.length===0&&<div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic",padding:"8px 0",textAlign:"center"}}>No annual goals — add one above.</div>}
      </>);
    })()}
  </>);
}


function QuestsTab({quests,skills,onAdd,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest,onReorder,radiantAvailable,radiantCooldownLabel,onOpenBreakdown}){
  const {settings}=useSettings(); const L=settings.labels;
  const [form,setForm]=useState(null);
  const [search,setSearch]=useState("");
  const [filterPrio,setFilterPrio]=useState("");
  const [sortBy,setSortBy]=useState("manual"); // "manual" | "priority" | "due"
  const [viewMode,setViewMode]=useState("list"); // "list" | "roadmap"
  const [f,setF]=useState({title:"",skillIds:[],note:"",dueDate:"",type:"main",priority:"med",color:null,cooldown:60*60*1000,customImg:null,banner:null});
  const [qXpSug,setQXpSug]=useState(null);
  const [qXpLoad,setQXpLoad]=useState(false);
  const openForm=t=>{ setForm(t); setF({title:"",skillIds:[],note:"",dueDate:"",type:t,priority:"med",color:null,cooldown:60*60*1000,customImg:null,banner:null}); setQXpSug(null); };
  const toggleQSkill=id=>setF(v=>{const next=v.skillIds.includes(id)?v.skillIds.filter(x=>x!==id):[...v.skillIds,id];const auto=next.length>0?(skills.find(s=>s.id===next[0])?.color)||null:null;return {...v,skillIds:next,color:v.color!==null?v.color:auto};});
  const submit=()=>{
    if(!f.title.trim()) return;
    const due=f.dueDate?new Date(f.dueDate+"T09:00").getTime():null;
    onAdd({title:f.title.trim(),type:form,skills:f.skillIds,note:f.note.trim(),due,priority:f.priority,color:f.color||null,xpVal:qXpSug?.xp||null,cooldown:f.cooldown,customImg:f.customImg||null,banner:f.banner||null});
    setForm(null); setQXpSug(null);
  };
  const handleQuestImg=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressImage(file,200,0.85); setF(v=>({...v,customImg:b64})); }
    catch{ const r=new FileReader(); r.onload=ev=>setF(v=>({...v,customImg:ev.target.result})); r.readAsDataURL(file); }
  };
  const handleQuestBanner=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressBanner(file,800,240,0.78); setF(v=>({...v,banner:b64})); }
    catch{ const r=new FileReader(); r.onload=ev=>setF(v=>({...v,banner:ev.target.result})); r.readAsDataURL(file); }
  };
  const suggestNewQuestXp=async()=>{
    if(!f.title.trim()) return;
    setQXpLoad(true); setQXpSug(null);
    const typeLabel=form==="main"?"main quest":form==="side"?"side quest":"radiant/repeatable quest";
    try{
      const _qp='Quest in a gamified life tracker: "'+f.title+'"'+(f.note?'. Intention: "'+f.note+'"':'')+'. Type: '+typeLabel+'. Priority: '+(f.priority||'med')+'. XP SCALE: 6000 XP = 1 level ≈ 100 hours real effort. SCOPE GUIDE — radiant (daily habit): 20–150 XP per run (NEVER exceed 300); side quest (hours-days): 200–1500 XP; main quest (days-weeks): 800–6000 XP; main quest worth a full level (weeks-months of real work): 6000–18000 XP; life-defining main (months-years, multiple levels): 18000–60000 XP. For main quests, if completing this quest represents genuine mastery or a major life chapter, awarding a full level or more is correct and encouraged. Reply ONLY with JSON: {"xp":number,"reason":"one sentence"}.';
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:_qp}]
        })});
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
  const [questTab, setQuestTab]=useState("main"); // "main"|"side"|"radiant"
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
      <button onClick={()=>setViewMode(v=>v==="list"?"roadmap":"list")}
        style={{background:viewMode==="roadmap"?"var(--primaryf)":"none",border:`1px solid ${viewMode==="roadmap"?"var(--primaryb)":"var(--b2)"}`,borderRadius:3,padding:"5px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:viewMode==="roadmap"?"var(--primary)":"var(--tx3)",flexShrink:0}}
        title="Roadmap view">
        ⬡ map
      </button>
    </div>
    {viewMode==="roadmap"&&<QuestRoadmap quests={quests} skills={skills}/>}
    {viewMode==="list"&&<>
    {/* Quest type sub-tabs */}
    <div className="stabs" style={{marginBottom:12}}>
      {[
        {id:"main",    label:`◆ ${L.mainQuest}s`, count:mainA.length+mainD.length},
        {id:"side",    label:`◇ Side`, count:side.length},
        {id:"radiant", label:`◉ Radiant`, count:radiant.length},
      ].map(({id,label,count})=>(
        <button key={id} className={`stab ${questTab===id?"on":""}`}
          onClick={()=>{setQuestTab(id);setForm(null);}}>
          {label}{count>0?<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,opacity:.7,marginLeft:4}}>{count}</span>:null}
        </button>
      ))}
    </div>
    {questTab==="main"&&<><div className="slbl">{L.mainQuest}s</div>
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
      <textarea className="fi" rows={2} placeholder="Intention (optional)..." value={f.note} onChange={e=>setF(v=>({...v,note:e.target.value}))} style={{resize:"vertical",minHeight:44,fontFamily:"inherit",fontSize:12,marginBottom:4,width:"100%",boxSizing:"border-box"}}/>
      <div style={{marginBottom:6}}>
        <div className="label9" style={{marginBottom:5}}>Quest color</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {SKILL_COLORS.map(c=><div key={c} onClick={()=>setF(v=>({...v,color:c}))} style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"2px solid var(--tx)":"2px solid transparent",flexShrink:0}}/>)}
          <div onClick={()=>setF(v=>({...v,color:null}))} style={{width:18,height:18,borderRadius:"50%",background:"var(--bg)",cursor:"pointer",border:!f.color?"2px solid var(--tx)":"2px solid var(--b2)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--tx3)"}} title="Auto from skill">∅</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div className="label9" style={{marginBottom:5}}>Icon <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.customImg
              ?<img src={f.customImg} style={{width:36,height:36,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{width:36,height:36,borderRadius:4,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"var(--tx3)"}}>◆</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestImg}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.customImg?"Change":"Upload"}</span>
            {f.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,customImg:null}))}>✕</button>}
          </label>
        </div>
        <div style={{flex:2}}>
          <div className="label9" style={{marginBottom:5}}>Banner <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.banner
              ?<img src={f.banner} style={{height:36,maxWidth:100,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{height:36,width:80,borderRadius:3,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>banner</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestBanner}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.banner?"Change":"Upload"}</span>
            {f.banner&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,banner:null}))}>✕</button>}
          </label>
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
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>
      </div>
    ))}</div>
    {mainD.length>0&&<><div className="gap"/><div className="slbl">{L.completed}</div>
      <div className="clist">{mainD.map(q=>(
      <div key={q.id} {...getQDragProps(q.id)}>
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>
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
    </>}
    {questTab==="side"&&<>
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
      <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div className="label9" style={{marginBottom:5}}>Icon <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.customImg
              ?<img src={f.customImg} style={{width:36,height:36,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{width:36,height:36,borderRadius:4,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"var(--tx3)"}}>◆</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestImg}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.customImg?"Change":"Upload"}</span>
            {f.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,customImg:null}))}>✕</button>}
          </label>
        </div>
        <div style={{flex:2}}>
          <div className="label9" style={{marginBottom:5}}>Banner <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.banner
              ?<img src={f.banner} style={{height:36,maxWidth:100,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{height:36,width:80,borderRadius:3,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>banner</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestBanner}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.banner?"Change":"Upload"}</span>
            {f.banner&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,banner:null}))}>✕</button>}
          </label>
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
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>
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
    </>}
    {questTab==="radiant"&&<>
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
      <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div className="label9" style={{marginBottom:5}}>Icon <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.customImg
              ?<img src={f.customImg} style={{width:36,height:36,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{width:36,height:36,borderRadius:4,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"var(--tx3)"}}>◆</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestImg}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.customImg?"Change":"Upload"}</span>
            {f.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,customImg:null}))}>✕</button>}
          </label>
        </div>
        <div style={{flex:2}}>
          <div className="label9" style={{marginBottom:5}}>Banner <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {f.banner
              ?<img src={f.banner} style={{height:36,maxWidth:100,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{height:36,width:80,borderRadius:3,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>banner</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestBanner}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{f.banner?"Change":"Upload"}</span>
            {f.banner&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,banner:null}))}>✕</button>}
          </label>
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
        <QuestCard quest={q} skills={skills} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubquest={onAddSubquest} onToggleSubquest={onToggleSubquest} onDeleteSubquest={onDeleteSubquest} quests={quests} radiantAvailable={radiantAvailable} radiantCooldownLabel={radiantCooldownLabel} onOpenBreakdown={onOpenBreakdown}/>
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
    </>}
  </>}
</>);
}

function QuestRoadmap({quests,skills}){
  // Build chains: find root quests (not unlocked by others) and follow unlocksAfter links
  const chainRoots=(quests||[]).filter(q=>!q.done||(q.done)).reduce((acc,q)=>{
    if(!(quests||[]).some(other=>other.unlocksAfter===q.id)&&q.unlocksAfter) return acc;
    if(!(quests||[]).some(other=>other.unlocksAfter===q.id)) acc.push(q);
    return acc;
  },[]);
  // Actually show all quests grouped by chain
  const chains=[];
  const visited=new Set();
  const buildChain=(q,depth=0)=>{
    if(visited.has(q.id)) return;
    visited.add(q.id);
    chains.push({q,depth});
    const children=(quests||[]).filter(other=>other.unlocksAfter===q.id);
    children.forEach(c=>buildChain(c,depth+1));
  };
  // Start from quests with no prereq
  (quests||[]).filter(q=>!q.unlocksAfter).forEach(q=>buildChain(q));
  // Add any remaining (orphans)
  (quests||[]).filter(q=>!visited.has(q.id)).forEach(q=>buildChain(q));

  if(!chains.length) return <div className="empty">No quests to map</div>;
  return(
    <div style={{marginBottom:16}}>
      <div className="slbl" style={{marginBottom:10}}>Quest Chains</div>
      {chains.map(({q,depth},i)=>{
        const isLast=i===chains.length-1||chains[i+1]?.depth<=depth;
        const sk=q.skills?.map(id=>skills.find(s=>s.id===id)).filter(Boolean)||[];
        return(
          <div key={q.id} className="roadmap-node" style={{paddingLeft:20+depth*16}}>
            {!isLast&&<div className="roadmap-line"/>}
            <div className={`roadmap-dot ${q.done?"done":q.unlocksAfter&&!(quests||[]).find(p=>p.id===q.unlocksAfter)?.done?"locked":""}`}/>
            <div className={`roadmap-card ${q.done?"done":""}`}>
              <div className="roadmap-title">{q.title}</div>
              <div className="roadmap-meta">
                <span className="ctag">{q.type}</span>
                {q.done&&<span className="ctag" style={{color:"var(--success)"}}>✓ done</span>}
                {sk.map(s=><span key={s.id} className="ctag" style={{color:s.color}}>{s.icon} {s.name}</span>)}
                {q.xpVal&&<span className="ctag" style={{color:"var(--primary)"}}>+{q.xpVal} XP</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}



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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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

function SkillsTab({skills,skPerLv,streaks,meds,xpLog,onAdd,onAddBatch,onDelete,onEdit,onReorder,onLink,onStartFocus,onAward,onOpenSkillGap}){
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
  const [ef,setEf]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],customImg:null,cardBg:null,intention:"",category:"other",published:false,notesPublic:false});

  // add form state (shared, type toggled)
  const [skillTab,setSkillTab]=useState("skills"); // "skills"|"subskills"
  const [showForm,setShowForm]=useState(false);
  const [formType,setFormType]=useState("skill");
  const [showPresets,setShowPresets]=useState(false);
  const [f,setF]=useState({name:"",icon:"◈",color:SKILL_COLORS[0],startLevel:1,customImg:null,cardBg:null});

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
    onAdd({name:f.name.trim(),icon:f.icon,color:f.color,startXp,customImg:f.customImg||null,cardBg:f.cardBg||null,type:formType,parentIds:[]});
    setF({name:"",icon:"◈",color:SKILL_COLORS[0],startLevel:1,customImg:null,cardBg:null}); setShowForm(false);
  };
  const openEdit=s=>{setEf({name:s.name,icon:s.icon,color:s.color,customImg:s.customImg||null,cardBg:s.cardBg||null,intention:s.intention||"",category:s.category||"other",published:s.published||false,notesPublic:s.notesPublic||false});setEditingId(s.id);};
  const submitEdit=()=>{
    if(!ef.name.trim()) return;
    onEdit(editingId,{name:ef.name.trim(),icon:ef.icon,color:ef.color,customImg:ef.customImg||null,cardBg:ef.cardBg||null,intention:ef.intention||"",category:ef.category||"other",published:ef.published||false,notesPublic:ef.notesPublic||false});
    setEditingId(null);
  };
  const handleImg=async(e,setter)=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressImage(file,200,0.82); setter(v=>({...v,customImg:b64,icon:"img"})); }
    catch{ const reader=new FileReader(); reader.onload=ev=>setter(v=>({...v,customImg:ev.target.result,icon:"img"})); reader.readAsDataURL(file); }
  };
  const handleSkCardBg=async(e,setter)=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressBanner(file,600,200,0.75); setter(v=>({...v,cardBg:b64})); }
    catch{ const reader=new FileReader(); reader.onload=ev=>setter(v=>({...v,cardBg:ev.target.result})); reader.readAsDataURL(file); }
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
    <div className="label9" style={{marginBottom:5}}>Card background image <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(optional)</span></div>
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
      {f.cardBg
        ?<img src={f.cardBg} style={{width:64,height:28,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>
        :<span style={{fontSize:11,color:"var(--tx3)"}}>No background</span>}
      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleSkCardBg(e,setF)}/>
      <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
      {f.cardBg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setF(v=>({...v,cardBg:null}))}>✕</button>}
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
            <div className="label9" style={{marginBottom:5}}>Icon image <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(optional, replaces icon)</span></div>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:10}}>
              {ef.customImg?<img src={ef.customImg} style={{width:32,height:32,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>:<span style={{fontSize:11,color:"var(--tx3)"}}>No image</span>}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e,setEf)}/>
              <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
              {ef.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setEf(v=>({...v,customImg:null,icon:"◈"}))}>✕ Remove</button>}
            </label>
            <div className="label9" style={{marginBottom:5}}>Card background <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(optional)</span></div>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:10}}>
              {ef.cardBg?<img src={ef.cardBg} style={{width:64,height:28,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>:<span style={{fontSize:11,color:"var(--tx3)"}}>No background</span>}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleSkCardBg(e,setEf)}/>
              <span className="fsbtn" style={{width:"auto",padding:"4px 10px",margin:0,fontSize:9}}>Choose</span>
              {ef.cardBg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setEf(v=>({...v,cardBg:null}))}>✕ Remove</button>}
            </label>
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
        <div className="skill-card" style={{
          borderColor:isLinkHover?s.color:isReorderHover?s.color+"44":"",
          borderStyle:isLinkHover?"dashed":"solid",
          cursor:"default",
          ...(s.cardBg?{
            backgroundImage:`linear-gradient(to bottom, ${s.color}10 0%, var(--s1) 60%), url(${s.cardBg})`,
            backgroundSize:"cover",
            backgroundPosition:"center top",
          }:{})
        }}>
          <div className="sk-hdr">
            <div className="sk-name" style={{gap:5}}>
              <span style={{color:"var(--tx3)",fontSize:9,cursor:"grab",userSelect:"none",flexShrink:0}} title="Drag to reorder">⠿</span>
              <SkIcon s={s} sz={14}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
            </div>
            <div className="sk-meta">
              {streak.count>=3&&<span className="sk-streak">{streak.count}d{mult>1?` ${mult}×`:""}</span>}
              {(()=>{const lastMed=meds.filter(m=>(m.skills||[m.skillId]).includes(s.id)).sort((a,b)=>b.ts-a.ts)[0];const daysSince=lastMed?Math.floor((Date.now()-lastMed.ts)/86400000):999;return daysSince>=7?<span className="stale-label" title={`${daysSince}d since last practice`}>·{daysSince}d ago</span>:null;})()}
              <div className="sk-lv">{L.levelName} <span>{lv}</span></div>
              {onStartFocus&&<button className="sk-delbtn" onClick={()=>onStartFocus(s.id)} title="Start focus timer" style={{fontSize:10}}>◉</button>}
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
    {/* skill sub-tabs */}
    <div className="stabs" style={{marginBottom:10}}>
      <button className={`stab ${skillTab==="skills"?"on":""}`} onClick={()=>{setSkillTab("skills");setShowForm(false);}}>
        ◈ Skills{mainSkills.length>0?<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,opacity:.7,marginLeft:4}}>{mainSkills.length}</span>:null}
      </button>
      <button className={`stab ${skillTab==="subskills"?"on":""}`} onClick={()=>{setSkillTab("subskills");setShowForm(false);}}>
        ◇ Subskills{subSkills.length>0?<span style={{fontFamily:"'DM Mono',monospace",fontSize:8,opacity:.7,marginLeft:4}}>{subSkills.length}</span>:null}
      </button>
    </div>
    <div className="sk-quote">
      <div className="sk-quote-text">"Every shortcut you take, every session you skip, every number you inflate — you're not fooling the system. You're just lying to the only person whose opinion of you actually matters."</div>
      <div className="sk-quote-attr">— The only opponent on this stat sheet is you</div>
    </div>
    {/* toolbar */}
    <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
      {!showForm&&skillTab==="skills"&&<><button className="addbtn" style={{flex:1,margin:0}} onClick={()=>{setFormType("skill");setShowForm(true);}}><span>+</span> Skill</button>
      <button className="addbtn" style={{flex:"none",margin:0,padding:"0 10px",borderColor:"var(--b2)",color:"var(--tx3)"}} onClick={()=>setShowPresets(v=>!v)}>presets</button></>}
      {!showForm&&skillTab==="subskills"&&<button className="addbtn" style={{flex:1,margin:0}} onClick={()=>{setFormType("subskill");setShowForm(true);}}><span>+</span> Subskill</button>}
      <button onClick={()=>setViewMode(v=>v==="grid"?"list":"grid")}
        style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,padding:"5px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",flexShrink:0}}>
        {viewMode==="grid"?"≡ list":"▦ grid"}
      </button>
      {onOpenSkillGap&&<button onClick={onOpenSkillGap} title="Skill gap analysis"
        style={{background:"none",border:"1px solid var(--b2)",borderRadius:3,padding:"5px 10px",
          cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)",flexShrink:0}}>
        ⟡ gaps
      </button>}
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
    {skillTab==="skills"&&<>
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
    </>}
    {skillTab==="subskills"&&<>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,marginTop:4}}>
      <div className="label9">Subskills</div>
      <div style={{fontSize:9,color:"var(--tx3)"}}>{subSkills.length} total · drag onto a skill to link</div>
    </div>
    {subSkills.length===0&&!showForm&&<div style={{background:"var(--s1)",border:"1px dashed var(--b1)",borderRadius:"var(--r)",padding:12,textAlign:"center",marginBottom:10,fontSize:11,color:"var(--tx3)"}}>Subskills are cross-disciplinary practices — create one then drag it onto any skill to link XP</div>}
    <div style={viewMode==="grid"?{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}:{marginBottom:12}}>
      {subSkills.map((s,i)=>renderSkillCard(s,i,"subskill"))}
    </div>
    </>}

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
  const [timeUnit,setTimeUnit]=useState("min"); // min | hr | day
  const toMin=v=>timeUnit==="hr"?Math.round(v*60):timeUnit==="day"?Math.round(v*1440):v;
  const fromMin=v=>timeUnit==="hr"?+(v/60).toFixed(2):timeUnit==="day"?+(v/1440).toFixed(3):v;
  const [f,setF]=useState({typeId:"",skillIds:[],subskillIds:[],dur:15,note:"",sessionDate:"",sessionTime:"",showDate:false});

  // openForm always resets transient state — scoring MUST be false before form opens
  const openForm=()=>{ setScoring(false); setXpPreview(null); setShowForm(true); };

  const toggleSkill=id=>setF(v=>({...v,skillIds:v.skillIds.includes(id)?v.skillIds.filter(s=>s!==id):[...v.skillIds,id]}));

  useEffect(()=>{
    if(practiceTypes.length&&!f.typeId) setF(v=>({...v,typeId:practiceTypes[0].id}));
  },[practiceTypes]);

  useEffect(()=>{
    if(pending){
      const sids=pending.skillId?[pending.skillId]:[];
      // Must reset scoring here — form may open without going through openForm()
      setScoring(false);
      setXpPreview(null);
      setF(v=>({...v,skillIds:sids,subskillIds:[],note:""}));
      setShowForm(true);
    }
  },[pending]);

  const submit=async()=>{
    if(scoring) return; // prevent double-submit
    const ptype=practiceTypes.find(t=>t.id===f.typeId);
    let baseXp=Math.max(1,f.dur*ppm), aiReason=null;
    const hasNote=typeof f.note==="string"&&f.note.trim().length>0;
    if(hasNote&&aiEnabled){
      setScoring(true);
      // Safety: never leave scoring stuck more than 15s
      const safetyTimer=setTimeout(()=>setScoring(false),15000);
      try{
        const skNames=f.skillIds.map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean).join(", ")||"General";
        const res=await fetch("/api/chat",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({max_tokens:80,
            messages:[{role:"user",content:`Practice session scoring. XP scale: 6000 XP = 1 level.\nBaseline: ${baseXp} XP (${f.dur}min). Type: ${ptype?.label||"session"}, Skills: ${skNames}.\nJournal: "${f.note.trim()}"\nJudge quality: routine=~baseline, focused=1.5-3x, breakthrough=3-10x. Never cap at 100.\nJSON only: {"xp":number,"reason":"12 words max"}`}]
          })
        });
        const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
        const raw=(data.choices?.[0]?.message?.content||"{}").replace(/```json|```/g,"").trim();
        const parsed=JSON.parse(raw);
        if(parsed.xp&&typeof parsed.xp==="number") baseXp=Math.max(1,Math.round(parsed.xp));
        if(parsed.reason) aiReason=parsed.reason;
      }catch(e){ console.warn("AI scoring failed",e); }
      clearTimeout(safetyTimer);
      setScoring(false);
    }
    let sessionDate=null;
    if(f.showDate&&f.sessionDate) sessionDate=new Date(`${f.sessionDate}${f.sessionTime?"T"+f.sessionTime:"T12:00"}`).getTime();
    await onLog({type:f.typeId,skillIds:f.skillIds,subskillIds:f.subskillIds,dur:f.dur,note:f.note.trim(),baseXp,aiReason,sessionDate,questId:pending?.questId||null,questTitle:pending?.questTitle||null});
    setScoring(false);
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      setAnalysis(data.choices?.[0]?.message?.content||"No analysis returned.");
    }catch{ setAnalysis("Analysis failed — check your connection."); }
    setAnalysing(false);
  };

  const primary=f.skillIds[0]||null;
  const streak=streaks[primary]||{count:0}; const mult=getMultiplier(streak.count);
  const estXp=Math.round(f.dur*ppm*mult);
  const totalMins=meds.reduce((a,m)=>a+m.dur,0);
  const totalDisplay=timeUnit==="hr"?`${+(totalMins/60).toFixed(1)}hr`:timeUnit==="day"?`${+(totalMins/1440).toFixed(2)}d`:`${totalMins}min`;

  return (<>
    <div className="stats">
      <div className="sbox"><div className="snum">{meds.length}</div><div className="slb2">Sessions</div></div>
      <div className="sbox" style={{cursor:"pointer"}} onClick={()=>setTimeUnit(u=>u==="min"?"hr":u==="hr"?"day":"min")} title="Click to switch units">
        <div className="snum">{totalDisplay}</div>
        <div className="slb2" style={{display:"flex",alignItems:"center",gap:3}}>Practice <span style={{fontSize:7,opacity:.5,fontFamily:"'DM Mono',monospace"}}>↻</span></div>
      </div>
      <div className="sbox"><div className="snum">{practiceTypes.length}</div><div className="slb2">Types</div></div>
    </div>
    {pending&&!showForm&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",padding:"12px",marginBottom:12}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--secondary)",marginBottom:5}}>◉ Journal this session</div>
        <div style={{fontSize:13,color:"var(--tx2)",marginBottom:10}}>◉ {pending.questTitle}</div>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <button className="fsbtn secondary" style={{margin:0}} onClick={()=>openForm()}>Log session</button>
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
            <input type="number" min={timeUnit==="day"?.001:timeUnit==="hr"?.1:1} step={timeUnit==="day"?.01:timeUnit==="hr"?.25:1}
              value={fromMin(f.dur)}
              onChange={e=>setF(v=>({...v,dur:Math.max(1,toMin(Number(e.target.value)||0))}))}
              style={{width:52,background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:3,color:"var(--tx)",fontSize:11,fontFamily:"'DM Mono',monospace",padding:"2px 5px",textAlign:"center",outline:"none"}}/>
            <div style={{display:"flex",gap:3}}>
              {["min","hr","day"].map(u=>(
                <button key={u} onClick={()=>setTimeUnit(u)}
                  style={{padding:"1px 5px",borderRadius:3,border:`1px solid ${timeUnit===u?"var(--secondary)":"var(--b2)"}`,background:timeUnit===u?"var(--secondaryf)":"none",color:timeUnit===u?"var(--secondary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:8,cursor:"pointer"}}>
                  {u}
                </button>
              ))}
            </div>
            <span className="dur-val">· +{estXp} {L.xpName}{mult>1&&<span style={{color:"var(--primary)"}}> · {streak.count}d {mult}×</span>}</span>
          </div>
        </div>
        <input type="range"
          min={timeUnit==="day"?0.1:timeUnit==="hr"?0.25:1}
          max={timeUnit==="day"?14:timeUnit==="hr"?24:240}
          step={timeUnit==="day"?0.1:timeUnit==="hr"?0.25:1}
          value={fromMin(f.dur)}
          onChange={e=>setF(v=>({...v,dur:Math.max(1,toMin(Number(e.target.value)||0))}))}/>
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
        <button className="fsbtn secondary" style={{marginTop:6,marginBottom:2}} onClick={previewXp} disabled={xpPrevLoad}>
          {xpPrevLoad?"thinking...":"⟡ AI XP preview"}
        </button>
        {xpPreview&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:4,padding:"8px 10px",marginBottom:6,fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>
          {xpPreview.xp?<><span style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontWeight:"bold"}}>~{xpPreview.xp} XP</span> — {xpPreview.reason}<br/><span style={{fontSize:10,color:"var(--tx3)"}}>Final XP calculated on log (journal scoring may adjust)</span></>:xpPreview.reason}
        </div>}
        <button className="fsbtn secondary" style={{marginTop:4}} onClick={submit} disabled={scoring}
          key={scoring?"scoring":"idle"}>
          {scoring?"✦ Scoring...":"Log Session"}
        </button>
      </div>
    ):<button className="addbtn" onClick={()=>{onClearPending();openForm();}}><span>+</span> Log practice session</button>}
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
          {med.dur>=1440?`${+(med.dur/1440).toFixed(2)}d`:med.dur>=60?`${+(med.dur/60).toFixed(1)}hr`:`${med.dur}min`} · +{med.xpAwarded||med.dur*ppm} {L.xpName}{med.multiplier>1&&` · ${med.multiplier}×`}
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

// Convert Anthropic tool format {name,description,input_schema} → OpenAI/Groq format {type:"function",function:{name,description,parameters}}
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
      await onAddQuest({title:action.input.title,type:action.input.type||"side",note:action.input.note||"",due,skills:action.input.skillIds||[]});
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
      const tools=toGroqTools(buildAdvisorTools(skills,quests,tasks));
      const activeQuests=quests.filter(q=>!q.done).map(q=>'"'+q.title+'" ('+q.type+')').slice(0,10).join(", ")||"none";
      const skPerLvLocal=settings?.xp?.skillPerLevel||6000;
      const skillList=skills.map(s=>s.name+' Lv'+(Math.floor(s.xp/skPerLvLocal)+1)).join(", ")||"none";
      const sys="You are JARVIS — a sharp AI co-pilot in a gamified life tracker. Be direct and concise.\nActive quests: "+activeQuests+"\nSkills: "+skillList+"\nPending tasks: "+tasks.filter(t=>!t.done).length+"\nWhen user wants to add/create/schedule something, use the appropriate tool. Otherwise just reply in 1-3 sentences.";
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:600,messages:[{role:"system",content:sys},...history],tools})
      });
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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


function AdvisorTab({tasks,quests,skills,xp,level,streaks,onAddQuest,onAddTask,onLogMed,onEditQuest,onDeleteQuest,onDeleteTask,onAddSkill,onDeleteSkill,onAdjustSkillXp,aiMemory,onUpdateMemory,initialMsgs,onSaveMsgs}){
  const {settings}=useSettings(); const L=settings.labels;
  const [msgs,setMsgs]=useState(initialMsgs||[]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);
  useEffect(()=>{if(msgs.length&&onSaveMsgs) onSaveMsgs(msgs);},[msgs]);

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
    const roleOverride=settings.advisorRole?.trim();
    const basePersona=roleOverride
      ? `${roleOverride}. You are operating inside a gamified life tracker as this user's planning advisor.`
      : "You are a direct planning advisor inside the user's RPG quest log. You have persistent memory of this user.";
    const xpScale=`XP SCALE (critical for add_quest/adjust_skill_xp):
- 1 skill level = ${skPerLv} XP (~100 hrs genuine effort)
- Radiant/daily habits: 20–150 XP per run (5min=20, 30min=80, 1hr=150 — HARD CAP 300 for any radiant)
- Side quest (hours-days scope): 200–1500 XP total
- Main quest (days-weeks): 800–6000 XP
- Main quest worth a full level (weeks-months of real work): 6000–18000 XP — encouraged if scope warrants it
- Life-defining quest (months-years, multiple levels): 18000–60000 XP
- Char level = total skill XP ÷ ${skPerLv} (so level reflects actual skill work)
- adjust_skill_xp adds/subtracts from a skill directly`;
    return `${basePersona}
${xpScale}
CHAR LEVEL: ${level} | TOTAL SKILL XP: ${xp}${topStr?"\nSTREAKS: "+topStr:""}
TASKS (${at.length} active): ${at.map(t=>`"${t.title}" [${t.period}, ${skills.find(s=>s.id===t.skill)?.name||"no skill"}, ${t.xpVal}xp, id:${t.id}]`).join("; ")||"none"}
QUESTS (${aq.length} active): ${aq.map(q=>`"${q.title}" [${q.type}${q.due?", due "+new Date(q.due).toLocaleDateString():""}, id:${q.id}]`).join("; ")||"none"}
SKILLS: ${[...skills].sort((a,b)=>b.xp-a.xp).map(s=>`${s.name} Lv${Math.floor((s.xp||0)/skPerLv)+1} (${s.xp||0}xp, id:${s.id})`).join(", ")||"none"}
TOOLS AVAILABLE: add_quest, update_quest, delete_quest, add_task, delete_task, add_skill, delete_skill, adjust_skill_xp, log_session
MEMORY - known facts:\n${memFacts}\nObserved patterns: ${memPatterns}
Be direct. Reference actual task/quest names and IDs. 3–5 sentences unless breaking something down. When user wants to create/edit/delete/adjust anything, use the tool — don't just describe. If you learn new facts about this user, append MEMORY_UPDATE:{"facts":["fact"],"patterns":["pattern"]} as the very last line.`;
  }

  const executeAction=async(action)=>{
    if(action.tool==="add_quest"){
      const due=action.input.dueDate?new Date(`${action.input.dueDate}T09:00`).getTime():null;
      await onAddQuest({title:action.input.title,type:action.input.type,skills:action.input.skillIds||[],note:action.input.note||"",due,priority:action.input.priority||"med"});
    } else if(action.tool==="update_quest"){
      const updates={};
      if(action.input.dueDate) updates.due=new Date(`${action.input.dueDate}T09:00`).getTime();
      if(action.input.title) updates.title=action.input.title;
      if(action.input.note!==undefined) updates.note=action.input.note;
      if(action.input.type) updates.type=action.input.type;
      if(action.input.skillIds) updates.skills=action.input.skillIds;
      if(action.input.priority) updates.priority=action.input.priority;
      await onEditQuest(action.input.questId,updates);
    } else if(action.tool==="delete_quest"){
      await onDeleteQuest(action.input.questId);
    } else if(action.tool==="add_task"){
      await onAddTask({title:action.input.title,period:action.input.period,skill:action.input.skillId||null,xpVal:action.input.xpVal||20});
    } else if(action.tool==="delete_task"){
      await onDeleteTask(action.input.taskId);
    } else if(action.tool==="add_skill"){
      await onAddSkill({name:action.input.name,icon:action.input.icon||"◈",category:action.input.category||"other"});
    } else if(action.tool==="delete_skill"){
      await onDeleteSkill(action.input.skillId);
    } else if(action.tool==="adjust_skill_xp"){
      await onAdjustSkillXp(action.input.skillId,action.input.xpAmount,action.input.reason||"Advisor adjustment");
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
      const advisorTools=toGroqTools(buildAdvisorTools(skills,quests,tasks));
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:1000,
          messages:[{role:"system",content:buildCtx()},...history],
          tools:advisorTools}),
      });
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
        <div className="ai-intro-body">Full access to your quests, tasks, and skills. Can add, edit, and delete — confirms before writing anything.</div>
      </div>
      {aiMemory?.facts?.length>0&&<div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:6,padding:"8px 12px",marginBottom:8,fontSize:10,color:"var(--tx3)"}}>
        <div style={{color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontSize:9,marginBottom:4}}>✦ ADVISOR MEMORY</div>
        {(aiMemory.facts||[]).slice(-3).map((f,i)=><div key={i}>· {f}</div>)}
        {(aiMemory.facts||[]).length>3&&<div style={{marginTop:2}}>+{aiMemory.facts.length-3} more facts stored</div>}
        <button onClick={()=>onUpdateMemory&&onUpdateMemory({facts:[],patterns:[],updated:0})} style={{marginTop:4,background:"none",border:"none",color:"var(--tx3)",fontSize:9,cursor:"pointer",padding:0}}>clear memory</button>
      </div>}

      {/* AI Power Tools */}
      <div style={{marginBottom:12}}>
        <div className="slbl" style={{marginBottom:6}}>AI TOOLS</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[
            {icon:"⚔",label:"Break a quest",sub:"Splits into subquests + XP",
             prompt:`I want to break down one of my active main quests into specific subquests with XP values. Look at my active main quests: ${quests.filter(q=>!q.done&&q.type==="main").map(q=>'"'+q.title+'"').join(", ")||"none yet"}. Pick the one that most needs structure and propose each step as a separate add_quest action I can confirm.`},
            {icon:"📅",label:"Plan my day",sub:"Optimal schedule from quests",
             prompt:`Build me an optimal plan for today. Look at my active tasks, overdue items, and quests. Tell me exactly what to do and in what order — morning, afternoon, evening. Use add_task for any specific actions you'd schedule.`},
            {icon:"⚡",label:"XP audit",sub:"Recalibrate skill levels",
             prompt:`Audit my skill XP. Skills: ${skills.map(s=>`${s.name} Lv${Math.floor((s.xp||0)/(settings.xp.skillPerLevel||6000))+1} (${s.xp||0} XP total)`).join(", ")||"none"}. 1 level = ${settings.xp.skillPerLevel||6000} XP ≈ 100 genuine hours. Look at each skill — does the level match real effort? Propose adjust_skill_xp corrections for any that are clearly off. Be conservative — only correct obvious mismatches.`},
            {icon:"🗺",label:"Suggest quests",sub:"New goals based on my gaps",
             prompt:`Based on my current skills, active quests, and what I've been working on, suggest 3 new quests I should add. Focus on gaps or logical next steps. Use add_quest for each one.`},
            {icon:"✎",label:"Edit a quest",sub:"Move, rename, link — just say it",
             prompt:`I want to edit one of my quests. I'll describe the change in plain language and you should use update_quest to apply it. My active quests: ${quests.filter(q=>!q.done).map(q=>`"${q.title}" [id:${q.id}]`).join(", ")||"none"}. What do you want to change?`},
            {icon:"🌿",label:"Skill tree check",sub:"Missing or redundant skills?",
             prompt:`Review my skill list: ${skills.map(s=>s.name).join(", ")||"none"}. Given my quests and goals, are there obvious skills missing? Use add_skill for clear additions. Flag any that seem redundant or should be merged.`},
            {icon:"🧹",label:"Clean up",sub:"Archive done, delete orphans",
             prompt:`Help me clean up. I have ${quests.filter(q=>q.done).length} completed quests and ${quests.filter(q=>!q.done).length} active ones. Review my active quests and flag any that seem abandoned, duplicated, or no longer relevant. Use delete_quest for ones I should remove, or update_quest to archive. Be selective — only the obvious ones.`},
            {icon:"🔍",label:"What's blocking me",sub:"Highest-leverage next action",
             prompt:`I have ${quests.filter(q=>!q.done).length} active quests. What's actually blocking progress right now? Identify the single highest-leverage action I could take today. Name the specific quest and the exact next step. Be direct.`},
          ].map(({icon,label,sub,prompt:p})=>(
            <button key={label} onClick={()=>send(p)}
              style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"10px 12px",cursor:"pointer",textAlign:"left",transition:"border-color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--b2)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--b1)"}>
              <div style={{fontSize:14,marginBottom:3}}>{icon}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:.8,color:"var(--tx)",marginBottom:2}}>{label}</div>
              <div style={{fontSize:10,color:"var(--tx3)",lineHeight:1.3}}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="slbl" style={{marginBottom:6}}>QUICK ASK</div>
      <div className="ai-chips">{QUICK.map((q,i)=><button key={i} className="ai-chip" onClick={()=>send(q)}>{q}</button>)}</div>
    </>}
    {msgs.length>0&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
      <button onClick={()=>{setMsgs([]);if(onSaveMsgs)onSaveMsgs([]);}} style={{background:"none",border:"none",color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,cursor:"pointer",padding:"2px 0"}}>✕ clear conversation</button>
    </div>}
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
      {loading&&<div className="ai-msg loading" style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:1}}>thinking</span>
        <span className="tdot">·</span><span className="tdot">·</span><span className="tdot">·</span>
      </div>}
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
  const sk=skills.find(s=>s.id===action.input.skillId||s.id===action.input.skillIds?.[0]);
  const linkedSkills=(action.input.skillIds||[]).map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean);
  let summary="", detail="", danger=false;

  if(action.tool==="add_quest"){
    const typeIcon=action.input.type==="main"?"◆":action.input.type==="radiant"?"◉":"◇";
    summary=`${typeIcon} Add quest: "${action.input.title}"`;
    detail=[linkedSkills.length?`→ ${linkedSkills.join(", ")}`:null,action.input.note,action.input.dueDate?`due ${action.input.dueDate}`:null,action.input.priority?`[${action.input.priority}]`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="update_quest"){
    summary=`✎ Update quest`;
    detail=[action.input.title?`rename → "${action.input.title}"`:null,action.input.type?`type → ${action.input.type}`:null,action.input.dueDate?`due → ${action.input.dueDate}`:null,action.input.note?`note: "${action.input.note}"`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="delete_quest"){
    const q=action.input.questId;
    summary=`✕ Delete quest`;
    detail=`ID: ${q}`;
    danger=true;
  } else if(action.tool==="add_task"){
    summary=`□ Add task: "${action.input.title}"`;
    detail=[`[${action.input.period}]`,sk?`→ ${sk.name}`:null,action.input.xpVal?`${action.input.xpVal}xp`:null].filter(Boolean).join(" · ");
  } else if(action.tool==="delete_task"){
    summary=`✕ Delete task`;
    detail=`ID: ${action.input.taskId}`;
    danger=true;
  } else if(action.tool==="add_skill"){
    summary=`◈ Add skill: "${action.input.name}"`;
    detail=[action.input.icon,action.input.category].filter(Boolean).join(" · ");
  } else if(action.tool==="delete_skill"){
    const targetSk=skills.find(s=>s.id===action.input.skillId);
    summary=`✕ Delete skill: "${targetSk?.name||action.input.skillId}"`;
    detail=targetSk?`${targetSk.xp||0} XP will be lost`:"";
    danger=true;
  } else if(action.tool==="adjust_skill_xp"){
    const targetSk=skills.find(s=>s.id===action.input.skillId);
    const sign=action.input.xpAmount>0?"+":"";
    summary=`✦ ${sign}${action.input.xpAmount} XP → ${targetSk?.name||action.input.skillId}`;
    detail=action.input.reason||"";
  } else if(action.tool==="log_session"){
    summary=`◉ Log: ${action.input.type} · ${action.input.duration}min`;
    detail=[sk?`→ ${sk.name}`:null,action.input.note,action.input.backlogDate?`(${action.input.backlogDate})`:null].filter(Boolean).join(" · ");
  } else {
    summary=action.tool.replace(/_/g," ");
    detail=JSON.stringify(action.input).slice(0,80);
  }

  if(action.status==="accepted") return <div className="act-done" style={{color:"var(--success)"}}>✓ {summary}</div>;
  if(action.status==="cancelled") return <div className="act-done" style={{color:"var(--tx3)"}}>✕ skipped</div>;
  return (
    <div className="act-card" style={danger?{borderColor:"var(--danger)33",background:"var(--dangerf)"}:{}}>
      <div className="act-tool" style={danger?{color:"var(--danger)"}:{}}>{action.tool.replace(/_/g," ")}</div>
      <div className="act-sum">{summary}</div>
      {detail&&<div className="act-detail">{detail}</div>}
      <div className="act-btns">
        <button className="abtn ok" onClick={onAccept}>{danger?"Confirm delete":"Accept"}</button>
        <button className="abtn no" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── AI THEME DESIGNER ───────────────────────────────────────────────────────
function AIThemeDesigner({draft,setDraft,showToast,onSave}){
  const [prompt,setPrompt]=useState("");
  const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState(null);
  const [error,setError]=useState("");

  const generate=async()=>{
    if(!prompt.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    try{
      const res=await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          max_tokens:800,
          messages:[
            {role:"system",content:"You are a UI theme designer. Return ONLY a valid JSON object — no markdown, no explanation, no code fences. The user will describe a vibe and you generate matching hex colors."},
            {role:"user",content:`Generate a cohesive dark (or light if requested) color theme for a productivity RPG app based on this vibe: "${prompt}"

Return ONLY this exact JSON shape, nothing else:
{"name":"Theme Name (2-3 words)","theme":{"bg":"#hex","s1":"#hex","s2":"#hex","b1":"#hex","b2":"#hex","tx":"#hex","tx2":"#hex","tx3":"#hex"},"colors":{"primary":"#hex","secondary":"#hex","success":"#hex","danger":"#hex"},"description":"One sentence describing the vibe"}

Rules: bg=darkest background, s1 slightly lighter (cards), s2 slightly lighter than s1 (hover states). b1=subtle border, b2=slightly brighter border. tx=high contrast readable text, tx2=secondary text 60% opacity, tx3=muted text 40% opacity. primary=vivid accent color matching the vibe, secondary=complementary accent. success=#4caf50 or similar green. danger=#e05252 or similar red. All values must be valid 6-digit hex starting with #.`}
          ]
        })
      });
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      if(data.error) throw new Error(data.error.message||"API error");
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      let parsed;
      try{parsed=JSON.parse(raw);}
      catch{
        // Try to extract JSON if there's surrounding text
        const match=raw.match(/\{[\s\S]*\}/);
        if(match) try{parsed=JSON.parse(match[0]);}catch{}
        if(!parsed) throw new Error("Couldn't parse theme — try a simpler description");
      }
      if(!parsed?.theme?.bg||!parsed?.colors?.primary) throw new Error("Incomplete theme — try again");
      // Validate all hex values
      const hexOk=v=>typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v.trim());
      const fixHex=v=>{const t=(v||"").trim();return hexOk(t)?t:null;};
      parsed.theme=Object.fromEntries(Object.entries(parsed.theme).map(([k,v])=>[k,fixHex(v)||"#111111"]));
      parsed.colors=Object.fromEntries(Object.entries(parsed.colors).map(([k,v])=>[k,fixHex(v)||"#888888"]));
      setPreview(parsed);
    }catch(e){setError(e.message||"Generation failed");}
    setLoading(false);
  };

  const apply=async()=>{
    if(!preview) return;
    // Build the updated draft
    const updated={
      theme:{bg:preview.theme.bg,s1:preview.theme.s1,s2:preview.theme.s2,b1:preview.theme.b1,b2:preview.theme.b2,tx:preview.theme.tx,tx2:preview.theme.tx2,tx3:preview.theme.tx3},
      colors:{primary:preview.colors.primary,secondary:preview.colors.secondary,success:preview.colors.success||"#4caf50",danger:preview.colors.danger||"#e05252"}
    };
    setDraft(d=>({...d,...updated}));
    // Auto-save immediately so CSS re-renders — this is why "nothing happened" before
    if(onSave) await onSave(updated);
    if(showToast) showToast(`✦ Applied "${preview.name}" — theme live`);
    setPreview(null); setPrompt("");
  };

  return(
    <div style={{padding:"4px 0 8px"}}>
      <div style={{fontSize:12,color:"var(--tx2)",marginBottom:10,lineHeight:1.6}}>
        Describe your vibe and the AI will generate a matching color theme. You can still fine-tune individual colors after.
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <input
          className="fi" style={{flex:1,minWidth:0}}
          placeholder='e.g. "dark ocean", "warm coffee shop", "neon cyberpunk", "ancient parchment"'
          value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&generate()}
        />
        <button className="fsbtn" style={{width:"auto",padding:"7px 14px",margin:0,flexShrink:0}}
          onClick={generate} disabled={loading||!prompt.trim()}>
          {loading?"…":"✦ Generate"}
        </button>
      </div>
      {error&&<div style={{fontSize:11,color:"var(--danger)",marginBottom:8,fontFamily:"'DM Mono',monospace"}}>{error}</div>}
      {preview&&(
        <div style={{background:preview.theme.bg,border:`1px solid ${preview.theme.b2}`,borderRadius:6,padding:12,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:1.5,color:preview.colors.primary,textTransform:"uppercase",marginBottom:2}}>{preview.name}</div>
              <div style={{fontSize:11,color:preview.theme.tx3}}>{preview.description}</div>
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              {[preview.theme.bg,preview.theme.s1,preview.theme.s2,preview.colors.primary,preview.colors.secondary].map((c,i)=>(
                <div key={i} title={c} style={{width:14,height:14,borderRadius:"50%",background:c,border:"1px solid #ffffff18"}}/>
              ))}
            </div>
          </div>
          {/* Mini live preview */}
          <div style={{background:preview.theme.s1,border:`1px solid ${preview.theme.b1}`,borderRadius:4,padding:"8px 10px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:2,border:`1px solid ${preview.theme.b2}`,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:preview.theme.tx,lineHeight:1.3}}>Sample quest title</div>
              <div style={{display:"flex",gap:4,marginTop:3}}>
                <span style={{fontFamily:"monospace",fontSize:8,padding:"1px 6px",borderRadius:10,border:`1px solid ${preview.theme.b1}`,color:preview.colors.primary}}>+80 XP</span>
                <span style={{fontFamily:"monospace",fontSize:8,padding:"1px 6px",borderRadius:10,border:`1px solid ${preview.theme.b1}`,color:preview.theme.tx3}}>main</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={apply} style={{flex:1,padding:"8px 12px",background:preview.colors.primary,border:"none",borderRadius:4,color:"#fff",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:1,cursor:"pointer",fontWeight:500}}>◆ Apply Live</button>
            <button onClick={()=>setPreview(null)} style={{padding:"8px 12px",background:"none",border:`1px solid ${preview.theme.b2}`,borderRadius:4,color:preview.theme.tx3,fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer"}}>✕</button>
          </div>
        </div>
      )}
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--tx3)",letterSpacing:.5,lineHeight:1.6}}>
        AI-generated themes apply to your color + background settings. Fine-tune below if needed, then Save.
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
    {/* UI Style */}
    <div className="slbl" style={{marginBottom:8}}>UI Style</div>
    <div className="fwrap" style={{marginBottom:18}}>
      <div style={{fontSize:12,color:"var(--tx3)",marginBottom:10,fontFamily:"'DM Mono',monospace",lineHeight:1.5}}>
        Choose how the app looks and feels. Saved with your other settings.
      </div>
      <div style={{display:"flex",gap:6,marginBottom:draft.uiMode==="ai"?12:0}}>
        {[
          {id:"rpg",   icon:"⟡", label:"RPG",     sub:"Glows, grain, Cinzel font"},
          {id:"minimal",icon:"◻", label:"Minimal",  sub:"Flat, clean, no effects"},
          {id:"ai",    icon:"✦", label:"AI Design", sub:"Generate from a vibe"},
        ].map(({id,icon,label,sub})=>(
          <button key={id} className={`ui-mode-btn ${draft.uiMode===id?"on":""}`}
            onClick={()=>setDraft(d=>({...d,uiMode:id}))}
            style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,padding:"9px 12px",textAlign:"left"}}>
            <span style={{fontSize:11}}>{icon} {label}</span>
            <span style={{fontSize:8,opacity:.6,letterSpacing:.3,textTransform:"none"}}>{sub}</span>
          </button>
        ))}
      </div>
      {draft.uiMode==="ai"&&<AIThemeDesigner draft={draft} setDraft={setDraft} showToast={showToast} onSave={async(themeUpdates)=>{const merged={...draft,...themeUpdates};setDraft(merged);await saveSettings(merged);}}/>}
      <div style={{borderTop:"1px solid var(--b1)",marginTop:10,paddingTop:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div className="srow-label">Compact density</div>
          <div className="srow-sub">Tighter padding on cards and lists</div>
        </div>
        <button className={`tog ${draft.compact?"on":""}`} onClick={()=>setDraft(d=>({...d,compact:!d.compact}))}><div className="tog-knob"/></button>
      </div>
    </div>
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
    <Collapsible question="Profile & appearance">
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
    </Collapsible>
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
        <SRow label="Skill XP per level"  sub="6000 = 1 level per ~100 hrs of work" type="number" sm value={draft.xp.skillPerLevel}  onChange={v=>setXpCfg("skillPerLevel",v)}/>
        <SRow label="Global XP per level" sub="Char level = total skill XP ÷ this" type="number" sm value={draft.xp.globalPerLevel} onChange={v=>setXpCfg("globalPerLevel",v)}/>
        <SRow label="Practice XP per min" sub="Default 1"                       type="number" sm value={draft.xp.practicePerMin} onChange={v=>setXpCfg("practicePerMin",v)}/>
        <Tog label="AI session scoring" sub="Journal entries trigger AI XP scoring" val={draft.xp.aiScoring!==false} onChange={v=>setXpCfg("aiScoring",v)}/>
        <div style={{background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:4,padding:"10px 12px",marginTop:8}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,color:"var(--tx3)",marginBottom:8,textTransform:"uppercase"}}>XP reference</div>
          {[
            ["Radiant (daily habit, 5 min)","20 XP"],
            ["Radiant (daily habit, 30 min)","80 XP"],
            ["Radiant (daily habit, 1 hr)","150 XP — max ~300"],
            ["Task (quick action)","10–80 XP"],
            ["Task (significant work)","80–500 XP"],
            ["Side quest (hours–days)","200–1,500 XP"],
            ["Main quest (days–weeks)","800–6,000 XP"],
            ["Main quest (weeks–months, full level)","6,000–18,000 XP"],
            ["Life-defining quest (multiple levels)","18,000–60,000 XP"],
            ["Streak bonus","1.25× (3d) → 2.0× (30d)"],
            ["Practice: focused session","1.5–3× baseline"],
            ["Practice: breakthrough","3–10× baseline"],
          ].map(([label,val])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingBottom:4,borderBottom:"1px solid var(--b1)",marginBottom:4}}>
              <span style={{fontSize:10,color:"var(--tx2)"}}>{label}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)",whiteSpace:"nowrap",marginLeft:8}}>{val}</span>
            </div>
          ))}
        </div>
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
    <Collapsible question="Want to set the Advisor's personality or role?">
      <div className="sgroup">
        <div className="srow-sub" style={{marginBottom:10,lineHeight:1.6}}>Give the Advisor a base persona — e.g. "tough but encouraging coach", "Stoic philosopher", "drill sergeant", "wise mentor". Leave blank for default behavior.</div>
        <div className="srow-label" style={{marginBottom:6}}>Advisor Role / Persona</div>
        <textarea
          className="fi full"
          rows={3}
          placeholder='e.g. "You are Marcus Aurelius — respond with Stoic wisdom, keep it brief and direct" or "Act as a tough but caring athletic coach"'
          value={draft.advisorRole||""}
          onChange={e=>setDraft(d=>({...d,advisorRole:e.target.value}))}
          style={{resize:"vertical",lineHeight:1.5,marginBottom:8,width:"100%",boxSizing:"border-box",fontFamily:"inherit",fontSize:12}}
        />
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {["Stoic philosopher","Tough love coach","Wise mentor","Drill sergeant","Zen master","Hype man","Brutally honest friend"].map(r=>(
            <button key={r} onClick={()=>setDraft(d=>({...d,advisorRole:r}))}
              style={{padding:"3px 8px",borderRadius:20,border:`1px solid ${(draft.advisorRole||"")===r?"var(--primary)":"var(--b2)"}`,background:(draft.advisorRole||"")===r?"var(--primaryf)":"var(--s2)",color:(draft.advisorRole||"")===r?"var(--primary)":"var(--tx2)",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
              {r}
            </button>
          ))}
          {draft.advisorRole&&<button onClick={()=>setDraft(d=>({...d,advisorRole:""}))}
            style={{padding:"3px 8px",borderRadius:20,border:"1px solid var(--b1)",background:"none",color:"var(--tx3)",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            ✕ clear
          </button>}
        </div>
      </div>
    </Collapsible>
    <div className="gap"/>
    <div className="slbl">data</div>
    <button className="exp-btn" onClick={()=>onExport("json")}><span>↓</span> Export as JSON</button>
    <button className="exp-btn" style={{marginTop:6}} onClick={()=>onExport("xml")}><span>↓</span> Export as XML</button>
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
        <select className="fsel" value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:Number(e.target.value)}))}>
          {[5,10,20,30,50,80,150,300,500].map(v=><option key={v} value={v}>{v} {L.xpName}</option>)}
        </select>
        <input type="number" className="fsel" style={{width:64}} min={1} max={30000} value={f.xpVal} onChange={e=>setF(v=>({...v,xpVal:Math.max(1,Number(e.target.value)||20)}))}/>
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

function QuestCard({quest,skills,quests,onToggle,onDelete,onEdit,onAddSubquest,onToggleSubquest,onDeleteSubquest,radiantAvailable,radiantCooldownLabel,onOpenBreakdown}){
  const {settings}=useSettings(); const L=settings.labels;
  const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)).filter(Boolean);
  const prereq=(quests||[]).find(q=>q.id===quest.unlocksAfter)||null;
  const isLocked=!quest.done&&prereq&&!prereq.done;
  const [editing,setEditing]=useState(false);
  const [showSubs,setShowSubs]=useState(false);
  const [newSub,setNewSub]=useState("");
  const defaultQColor=(sIds)=>{ const s=skills.find(sk=>sk.id===(sIds||[])[0]); return s?s.color:null; };
  const [ef,setEf]=useState({title:quest.title,note:quest.note||"",dueDate:quest.due?new Date(quest.due).toISOString().split("T")[0]:"",skillIds:quest.skills||[],color:quest.color||defaultQColor(quest.skills)||null,priority:quest.priority||"med",cooldown:quest.cooldown??60*60*1000,published:quest.published||false,notesPublic:quest.notesPublic||false,xpVal:quest.xpVal??null,type:quest.type,unlocksAfter:quest.unlocksAfter||"",customImg:quest.customImg||null,banner:quest.banner||null});
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
    const wasMain=quest.type!=="radiant"; const nowRadiant=ef.type==="radiant";
    onEdit(quest.id,{title:ef.title.trim(),note:ef.note.trim(),due,skills:ef.skillIds,color:ef.color||null,priority:ef.priority,cooldown:ef.type==="radiant"?ef.cooldown:undefined,published:ef.published||false,notesPublic:ef.notesPublic||false,xpVal:newXp,type:ef.type,unlocksAfter:ef.unlocksAfter||null,customImg:ef.customImg||null,banner:ef.banner||null,...(wasMain&&nowRadiant?{done:false,lastDone:null}:{})});
    setEditing(false); setXpSuggestion(null);
  };
  const handleQuestEditImg=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressImage(file,200,0.85); setEf(v=>({...v,customImg:b64})); }
    catch{ const r=new FileReader(); r.onload=ev=>setEf(v=>({...v,customImg:ev.target.result})); r.readAsDataURL(file); }
  };
  const handleQuestEditBanner=async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const b64=await compressBanner(file,800,240,0.78); setEf(v=>({...v,banner:b64})); }
    catch{ const r=new FileReader(); r.onload=ev=>setEf(v=>({...v,banner:ev.target.result})); r.readAsDataURL(file); }
  };
  const suggestQuestXp=async()=>{
    if(!ef.title.trim()) return;
    setXpLoading(true); setXpSuggestion(null);
    try{
      const _eqp='Quest in a gamified life tracker: "'+ef.title+'"'+(ef.note?'. Intention: "'+ef.note+'"':'')+'. Type: '+quest.type+', Priority: '+(ef.priority||'med')+'. XP SCALE: 6000 XP = 1 level ≈ 100 hours real effort. SCOPE GUIDE — radiant (daily): 20–150 per run (NEVER exceed 300); side (hours-days): 200–1500 total; main (days-weeks): 800–6000; main worth a full level (weeks-months): 6000–18000; life-defining (months-years, multiple levels): 18000–60000. For main quests, if this represents genuine mastery or a major life chapter, a full level or more is correct. Reply ONLY with JSON: {"xp":number,"reason":"one sentence"}.';
      const res=await fetch("/api/chat",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:120,
          messages:[{role:"user",content:_eqp}]
        })});
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
      <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div className="label9" style={{marginBottom:5}}>Icon <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {ef.customImg
              ?<img src={ef.customImg} style={{width:36,height:36,borderRadius:4,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{width:36,height:36,borderRadius:4,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"var(--tx3)"}}>◆</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestEditImg}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{ef.customImg?"Change":"Upload"}</span>
            {ef.customImg&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setEf(v=>({...v,customImg:null}))}>✕</button>}
          </label>
        </div>
        <div style={{flex:2}}>
          <div className="label9" style={{marginBottom:5}}>Banner <span style={{opacity:.5,fontWeight:"normal",textTransform:"none",letterSpacing:0}}>(opt)</span></div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            {ef.banner
              ?<img src={ef.banner} style={{height:36,maxWidth:100,borderRadius:3,objectFit:"cover",border:"1px solid var(--b2)"}}/>
              :<div style={{height:36,width:80,borderRadius:3,background:"var(--bg)",border:"1px dashed var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>banner</div>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handleQuestEditBanner}/>
            <span className="fsbtn" style={{width:"auto",padding:"4px 8px",margin:0,fontSize:9}}>{ef.banner?"Change":"Upload"}</span>
            {ef.banner&&<button style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:11}} onClick={()=>setEf(v=>({...v,banner:null}))}>✕</button>}
          </label>
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
          const base={};
          if(overdue) base.borderColor="var(--danger)";
          else if(dueSoon) base.borderColor="var(--primary)";
          else if(qc){base.borderColor=qc;base.borderLeftWidth=3;}
          if(quest.banner) base.paddingTop=0;
          return base;
        })()}>
        {/* Banner image */}
        {quest.banner&&<div style={{
          width:"calc(100% + 24px)",margin:"-0px -12px 10px",height:72,overflow:"hidden",
          borderRadius:"var(--r) var(--r) 0 0",flexShrink:0,position:"relative",
          marginTop:0,
        }}>
          <img src={quest.banner} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",opacity:.85}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.6))"}}/>
        </div>}
        <button className="chk" style={isLocked?{color:"var(--tx3)",borderColor:"var(--b1)",opacity:.5,cursor:"not-allowed"}:isRadiant?{color:rAvail?"var(--secondary)":"var(--tx3)",borderColor:rAvail?"var(--secondaryb)":"var(--b1)",fontSize:rCool?7:undefined}:{}}
          onClick={()=>onToggle(quest.id)} title={isLocked?`Locked — complete "${prereq?.title}" first`:rCool?`Available in ${rCool}`:undefined}>
          {isLocked?"🔒":isRadiant?(rCool?rCool:"◉"):quest.done?"✓":""}
        </button>
        <div className="cbody" style={isLocked?{opacity:.6}:{}}>
          <div className="row-gap4">
            {isLocked&&<span style={{fontSize:8,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>after: {prereq?.title}</span>}
            {!isLocked&&quest.priority&&<span className={`prio-dot prio-${quest.priority||"med"}`} title={`Priority: ${quest.priority}`}/>}
            {/* Quest icon */}
            {quest.customImg&&<img src={quest.customImg} style={{width:18,height:18,borderRadius:3,objectFit:"cover",flexShrink:0,border:"1px solid rgba(255,255,255,.12)"}}/>}
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
        {onOpenBreakdown&&(quest.type==="main"||quest.type==="side")&&!quest.done&&(
          <button className="delbtn" title="AI: Break into steps" onClick={()=>onOpenBreakdown(quest.id)} style={{color:"var(--primary)",opacity:.7}}>⟡</button>
        )}
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

// ─── DAY JOURNAL ─────────────────────────────────────────────────────────────
const GRADE_DIMS=[
  {id:"output", label:"Output",  desc:"Did I move things forward?",    color:"var(--primary)"},
  {id:"practice",label:"Practice",desc:"Did I do my inner work?",       color:"var(--secondary)"},
  {id:"body",   label:"Body",    desc:"Sleep, food, movement",          color:"var(--success)"},
  {id:"mind",   label:"Mind",    desc:"Focus, clarity, mental state",   color:"#9e6ab5"},
];

function DayJournalTab({meds,quests,skills,xpLog,dayGrades,onSaveDayGrades,onAdd}){
  const {settings}=useSettings();
  const todayStr=new Date().toDateString();
  const todayKey2=`${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  const grades=dayGrades||{};
  const today=grades[todayStr]||{output:0,practice:0,body:0,mind:0,note:""};
  const [draft,setDraft]=useState(today);
  const [saved,setSaved]=useState(false);
  const [aiReflect,setAiReflect]=useState(null);
  const [reflecting,setReflecting]=useState(false);

  // Auto-populate today's activity context
  const todayDone=quests.filter(q=>q.done&&q.lastDone&&new Date(q.lastDone).toDateString()===todayStr);
  const todaySessions=meds.filter(m=>new Date(m.created).toDateString()===todayStr);
  const todayXp=(xpLog||[]).filter(e=>new Date(e.created).toDateString()===todayStr).reduce((a,e)=>a+e.amt,0);

  const save=async()=>{
    const next={...grades,[todayStr]:draft};
    await onSaveDayGrades(next);
    if(draft.note?.trim()) onAdd({text:draft.note.trim(),img:null,source:"day_grade",created:Date.now()});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const getAIReflection=async()=>{
    setReflecting(true); setAiReflect(null);
    const skPerLv=settings.xp?.skillPerLevel||6000;
    try{
      const data=await aiCall({max_tokens:200,messages:[{role:"user",content:`Daily reflection for ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}.

Completed quests: ${todayDone.map(q=>q.title).join(", ")||"none"}
Sessions logged: ${todaySessions.map(m=>m.dur+"min").join(", ")||"none"}
XP earned: ${todayXp}
Self-grades (1-5): Output ${draft.output||"?"}/5, Practice ${draft.practice||"?"}/5, Body ${draft.body||"?"}/5, Mind ${draft.mind||"?"}/5
Note: ${draft.note||"none"}

Write one honest observation (2-3 sentences). Notice any gap between grades and actual activity. No cheerleading.`}]});
      setAiReflect(data.choices?.[0]?.message?.content||"");
    }catch{}
    setReflecting(false);
  };

  // Past 7 days grade history
  const last7=Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toDateString();
    return {dateStr:ds,label:i===0?"Today":i===1?"Yesterday":d.toLocaleDateString("en-US",{weekday:"short"}),grade:grades[ds]};
  }).reverse();

  return(<>
    {/* Today's context — auto-populated */}
    {(todayDone.length>0||todaySessions.length>0)&&(
      <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"10px 14px",marginBottom:12}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--tx3)",textTransform:"uppercase",marginBottom:6}}>Today's activity</div>
        {todayDone.map(q=><div key={q.id} style={{fontSize:11,color:"var(--tx2)",marginBottom:2}}>
          {q.type==="main"?"◆":q.type==="radiant"?"◉":"◇"} {q.title}
        </div>)}
        {todaySessions.map(m=>{const pt=m.type;const sk=skills.find(s=>m.skillIds?.includes(s.id));return(<div key={m.id} style={{fontSize:11,color:"var(--tx2)",marginBottom:2}}>◉ {m.dur}min{sk?` · ${sk.name}`:""}</div>);})}
        {todayXp>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)",marginTop:4}}>+{todayXp} XP today</div>}
      </div>
    )}

    {/* Grade sliders */}
    <div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"var(--primary)",textTransform:"uppercase",marginBottom:10}}>Today's grades</div>
      {GRADE_DIMS.map(dim=>(
        <div key={dim.id} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx)"}}>{dim.label}</span>
              <span style={{fontSize:9,color:"var(--tx3)",marginLeft:6}}>{dim.desc}</span>
            </div>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setDraft(v=>({...v,[dim.id]:n}))}
                  style={{width:24,height:24,borderRadius:4,border:`1px solid ${draft[dim.id]>=n?dim.color+"66":"var(--b2)"}`,background:draft[dim.id]>=n?dim.color+"22":"none",color:draft[dim.id]>=n?dim.color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer",transition:"all .1s"}}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <textarea className="fi full" placeholder="How did it actually go? (optional)" rows={2}
        style={{resize:"vertical",marginBottom:8,fontSize:12}}
        value={draft.note||""} onChange={e=>setDraft(v=>({...v,note:e.target.value}))}/>
      <div style={{display:"flex",gap:6}}>
        <button className="fsbtn primary" style={{flex:1,margin:0}} onClick={save}>
          {saved?"✓ Saved":"Save day"}
        </button>
        <button onClick={getAIReflection} disabled={reflecting}
          style={{background:"none",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",padding:"8px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:reflecting?"var(--tx3)":"var(--secondary)",letterSpacing:.5}}>
          {reflecting?"◌":"⟡"} reflect
        </button>
      </div>
      {aiReflect&&<div style={{marginTop:8,padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",fontSize:12,color:"var(--tx2)",lineHeight:1.6}}>{aiReflect}</div>}
    </div>

    {/* 7-day grade history */}
    <div style={{marginBottom:12}}>
      <div className="slbl" style={{marginBottom:8}}>past 7 days</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {last7.map(({dateStr,label,grade})=>{
          const avg=grade?Math.round((grade.output+grade.practice+grade.body+grade.mind)/4*10)/10:null;
          return(
            <div key={dateStr} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"6px 4px",textAlign:"center"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:"var(--tx3)",marginBottom:3}}>{label}</div>
              {avg!==null
                ?<div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:avg>=4?"var(--success)":avg>=3?"var(--primary)":avg>=2?"var(--secondary)":"var(--danger)",fontWeight:"bold"}}>{avg}</div>
                :<div style={{fontSize:10,color:"var(--b2)"}}>—</div>
              }
              {grade&&<div style={{display:"flex",gap:1,justifyContent:"center",marginTop:3}}>
                {GRADE_DIMS.map(d=><div key={d.id} style={{width:4,height:grade[d.id]*3,background:d.color,borderRadius:1,opacity:.7}}/>)}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  </>);
}

// ─── MORNING RITUAL OVERLAY ───────────────────────────────────────────────────
function MorningRitualOverlay({quests,tasks,skills,streaks,settings,briefing,onClose,onAddTask,onToggleQuest,radiantAvailable}){
  const {settings:s}=useSettings();
  const [step,setStep]=useState(0); // 0=briefing, 1=radiant picks, 2=priority picks, 3=confirm
  const [selectedRadiant,setSelectedRadiant]=useState([]);
  const [selectedPriority,setSelectedPriority]=useState([]);
  const [vibe,setVibe]=useState("open");
  const VIBES=[{id:"grind",label:"⚔ Grind"},{id:"focus",label:"◉ Focus"},{id:"light",label:"◇ Light"},{id:"open",label:"✦ Open"}];

  const availableRadiant=quests.filter(q=>q.type==="radiant"&&!q.done&&(radiantAvailable?radiantAvailable(q):true)).slice(0,8);
  const activeMains=quests.filter(q=>!q.done&&(q.type==="main"||q.type==="side")).slice(0,6);

  const confirm=()=>{
    // Pin selected priority items as today's tasks
    selectedPriority.forEach(qId=>{
      const q=quests.find(x=>x.id===qId);
      if(q) onAddTask({title:q.title,period:"daily",skill:(q.skills||[])[0]||null,xpVal:Math.min(80,Math.round(q.xpVal*0.05)),questId:qId,timeBlock:null,priority:"high"});
    });
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",backdropFilter:"blur(6px)",zIndex:700,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{width:"min(500px,100vw)",background:"var(--s1)",borderTop:"1px solid var(--b2)",borderRadius:"12px 12px 0 0",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"16px 18px 12px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"var(--primary)",textTransform:"uppercase",marginBottom:3}}>✦ {new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
            <div style={{fontSize:13,color:"var(--tx)"}}>{step===0?"Morning briefing":step===1?"What are you practicing today?":step===2?"What must move forward?":"Ready"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:18,padding:"4px"}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
          {step===0&&<>
            {/* Vibe selector */}
            <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
              {VIBES.map(v=><button key={v.id} onClick={()=>setVibe(v.id)}
                style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${vibe===v.id?"var(--primary)":"var(--b2)"}`,background:vibe===v.id?"var(--primaryf)":"none",color:vibe===v.id?"var(--primary)":"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer"}}>
                {v.label}
              </button>)}
            </div>
            {/* Briefing */}
            {briefing&&(
              <div style={{fontSize:12,color:"var(--tx2)",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:8}}>
                {briefing.loading?"Generating briefing…":briefing.text}
              </div>
            )}
          </>}

          {step===1&&<>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>Tap what you plan to practice today. These stay in the Quest tab — no tasks created.</div>
            {availableRadiant.length===0&&<div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic"}}>No radiant quests available right now.</div>}
            {availableRadiant.map(q=>{
              const on=selectedRadiant.includes(q.id);
              const sk=skills.find(s=>(q.skills||[]).includes(s.id));
              return(
                <button key={q.id} onClick={()=>setSelectedRadiant(prev=>on?prev.filter(x=>x!==q.id):[...prev,q.id])}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",marginBottom:6,background:on?"var(--secondaryf)":"var(--s2)",border:`1px solid ${on?"var(--secondaryb)":"var(--b1)"}`,borderRadius:"var(--r)",cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                  <span style={{fontSize:16,color:on?"var(--secondary)":"var(--tx3)"}}>◉</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"var(--tx)"}}>{q.title}</div>
                    {sk&&<div style={{fontSize:9,color:sk.color,fontFamily:"'DM Mono',monospace",marginTop:2}}>{sk.icon} {sk.name}</div>}
                  </div>
                  {on&&<span style={{color:"var(--secondary)",fontSize:14}}>✓</span>}
                </button>
              );
            })}
          </>}

          {step===2&&<>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>Pick up to 3 quests to make today's priority. They'll be pinned to your planner.</div>
            {activeMains.map(q=>{
              const on=selectedPriority.includes(q.id);
              const canAdd=on||selectedPriority.length<3;
              return(
                <button key={q.id} onClick={()=>{if(!canAdd&&!on)return;setSelectedPriority(prev=>on?prev.filter(x=>x!==q.id):[...prev,q.id]);}}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",marginBottom:6,background:on?"var(--primaryf)":"var(--s2)",border:`1px solid ${on?"var(--primaryb)":"var(--b1)"}`,borderRadius:"var(--r)",cursor:canAdd||on?"pointer":"default",opacity:!canAdd&&!on?.4:1,textAlign:"left",transition:"all .15s"}}>
                  <span style={{fontSize:14,color:on?"var(--primary)":"var(--tx3)"}}>{q.type==="main"?"◆":"◇"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"var(--tx)"}}>{q.title}</div>
                    <div style={{fontSize:9,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginTop:2}}>{q.type} · +{q.xpVal} XP</div>
                  </div>
                  {on&&<span style={{color:"var(--primary)",fontSize:14}}>✓</span>}
                </button>
              );
            })}
          </>}

          {step===3&&<>
            <div style={{fontSize:12,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>
              {selectedPriority.length>0?`${selectedPriority.length} quest${selectedPriority.length>1?"s":""} pinned to today.`:"No quests pinned — your day is open."}
              {selectedRadiant.length>0&&` ${selectedRadiant.length} practice${selectedRadiant.length>1?"s":""} intended.`}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",textAlign:"center",paddingTop:8}}>
              {vibe==="grind"&&"⚔ Grind day. Make it count."}
              {vibe==="focus"&&"◉ Focus day. Go deep."}
              {vibe==="light"&&"◇ Light day. Small wins."}
              {vibe==="open"&&"✦ Open day. Follow what calls."}
            </div>
          </>}
        </div>

        {/* Footer nav */}
        <div style={{padding:"12px 18px",borderTop:"1px solid var(--b1)",display:"flex",gap:8,flexShrink:0}}>
          {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"10px 16px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>← Back</button>}
          {step<3
            ?<button onClick={()=>setStep(s=>s+1)} style={{flex:1,background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:"var(--r)",padding:"10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,color:"var(--primary)",textTransform:"uppercase"}}>
               {step===0?"Set today's vibe →":step===1?"Choose priorities →":"Review →"}
             </button>
            :<button onClick={confirm} style={{flex:1,background:"var(--primary)",border:"none",borderRadius:"var(--r)",padding:"10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,color:"var(--bg)",textTransform:"uppercase"}}>
               ✦ Start the day
             </button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── INLINE QUEST NOTE POPUP ──────────────────────────────────────────────────
function InlineNotePopup({questTitle,questType,onClose,onSave}){
  const [note,setNote]=useState("");
  const ref=useRef(null);
  useEffect(()=>{ref.current?.focus();},[]);
  const save=()=>onSave(note);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(3px)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{width:"min(480px,100vw)",background:"var(--s1)",borderTop:"1px solid var(--b2)",borderRadius:"10px 10px 0 0",padding:"16px 18px 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:14}}>{questType==="main"?"◆":"◇"}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1.5,color:"var(--success)",textTransform:"uppercase",marginBottom:2}}>Quest complete</div>
            <div style={{fontSize:12,color:"var(--tx2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{questTitle}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <textarea ref={ref} className="fi full" placeholder="How did it go? (optional)" rows={2}
          style={{resize:"none",marginBottom:8,fontSize:13}}
          value={note} onChange={e=>setNote(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();save();}}}/>
        <div style={{display:"flex",gap:6}}>
          <button className="fsbtn primary" style={{flex:1,margin:0}} onClick={save}>
            {note.trim()?"✓ Save note":"✓ Done"}
          </button>
          <button onClick={onClose} style={{background:"none",border:"1px solid var(--b2)",borderRadius:"var(--r)",padding:"8px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ─── JOURNAL TAB ─────────────────────────────────────────────────────────────
function JournalTab({entries,skills,quests,meds,practiceTypes,streaks,pending,subTab,onSubTab,onAdd,onDelete,onAwardXp,onEditQuest,onLog,onDeleteMed,onEditMed,onAddType,onDeleteType,onClearPending,dayGrades,onSaveDayGrades,xpLog}){
  const {settings}=useSettings(); const L=settings.labels;
  return(<>
    <div className="jtab-row">
      <button className={`jtab ${subTab==="day"?"on":""}`} onClick={()=>onSubTab("day")}>◈ Day</button>
      <button className={`jtab ${subTab==="log"?"on":""}`} onClick={()=>onSubTab("log")}>◉ Log</button>
      <button className={`jtab ${subTab==="entries"?"on":""}`} onClick={()=>onSubTab("entries")}>✦ Entries</button>
      <button className={`jtab ${subTab==="history"?"on":""}`} onClick={()=>onSubTab("history")}>⊞ History</button>
    </div>
    {subTab==="day"&&<DayJournalTab meds={meds} quests={quests} skills={skills} xpLog={xpLog} dayGrades={dayGrades} onSaveDayGrades={onSaveDayGrades} onAdd={onAdd}/>}
    {subTab==="log"&&<PracticeTab meds={meds} skills={skills} streaks={streaks} pending={pending} practiceTypes={practiceTypes} onAddType={onAddType} onDeleteType={onDeleteType} onLog={onLog} onDelete={onDeleteMed} onEdit={onEditMed} onClearPending={onClearPending}/>}
    {subTab==="entries"&&<JournalEntries entries={entries} skills={skills} quests={quests} onAdd={onAdd} onDelete={onDelete} onAwardXp={onAwardXp} onEditQuest={onEditQuest}/>}
    {subTab==="history"&&<PracticeHistory meds={meds} skills={skills}/>}
  </>);
}

function PracticeHistory({meds,skills}){
  const sorted=[...(meds||[])].sort((a,b)=>b.ts-a.ts);
  if(!sorted.length) return <div className="empty">No sessions logged yet</div>;
  return(<div className="clist">{sorted.map(m=>{
    const sk=skills.find(s=>s.id===m.skillId||(m.skills||[]).includes(s.id));
    const mins=m.dur||0; const display=mins>=60?`${Math.floor(mins/60)}h ${mins%60}m`:`${mins}m`;
    return(<div key={m.id} className="med-card">
      <div className="med-icon">{sk?.icon||"◉"}</div>
      <div className="med-body">
        <div className="med-name">{sk?.name||"Practice"}</div>
        <div className="med-sub">{display} · {m.type||"session"}</div>
        <div className="med-sub" style={{color:"var(--tx3)"}}>{fmtDate(m.ts)}</div>
        {m.note&&<div className="med-journal">{m.note}</div>}
      </div>
    </div>);
  })}</div>);
}

function JournalEntries({entries,skills,quests,onAdd,onDelete,onAwardXp,onEditQuest}){
  const {settings}=useSettings(); const L=settings.labels;
  const [text,setText]=useState("");
  const [img,setImg]=useState(null);
  const [ocring,setOcring]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [aiMode,setAiMode]=useState(false); // AI journal mode
  const [aiParsing,setAiParsing]=useState(false);
  const [proposal,setProposal]=useState(null); // {skills:[{id,name,xp,reason,accepted,editXp}], quests:[{id,name,accepted}], summary}
  const [confirming,setConfirming]=useState(false);
  const [filter,setFilter]=useState("all"); // "all" | "practice" | "manual" | "ai"
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
        const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
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
    if(aiMode&&text.trim()&&(skills?.length||quests?.length)){
      parseWithAI();
    } else {
      onAdd({text:text.trim(),img:img||null,source:"manual"});
      setText(""); setImg(null); setShowForm(false);
    }
  };

  const parseWithAI=async()=>{
    if(!text.trim()) return;
    setAiParsing(true); setProposal(null);
    try{
      const skList=(skills||[]).filter(s=>s.type!=="subskill").map(s=>`${s.id}="${s.name}"`).join(", ")||"none";
      const qList=(quests||[]).filter(q=>!q.done).map(q=>`${q.id}="${q.title}"`).join(", ")||"none";
      const prompt=`You are analyzing a personal journal entry for a gamified life tracker.\n\nAvailable skills (id=name): ${skList}\nActive quests (id=title): ${qList}\n\nJournal entry:\n"${text.trim()}"\n\nAnalyze this entry and return JSON only (no markdown, no explanation):\n{\n  "skills": [{"id":"skill_id","name":"skill_name","xp":number_1_to_100,"reason":"why this skill, 8 words max"}],\n  "quests": [{"id":"quest_id","name":"quest_title"}],\n  "summary": "one sentence capturing the essence"\n}\n\nRules:\n- Only include skills genuinely reflected in the entry\n- XP should reflect time/effort described (mention of 2 hours ≈ 30-60xp, brief mention ≈ 5-15xp)\n- Only include quests clearly mentioned or worked on\n- If no skills/quests match, return empty arrays`;
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:400,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      const raw=data.choices?.[0]?.message?.content||"{}";
      const m=raw.match(/\{[\s\S]*\}/);
      const parsed=m?JSON.parse(m[0]):{skills:[],quests:[],summary:""};
      // Validate IDs exist, attach accepted/editXp state
      const validSkills=(parsed.skills||[]).filter(s=>(skills||[]).find(sk=>sk.id===s.id)).map(s=>({...s,accepted:true,editXp:s.xp}));
      const validQuests=(parsed.quests||[]).filter(q=>(quests||[]).find(qq=>qq.id===q.id)).map(q=>({...q,accepted:true}));
      setProposal({skills:validSkills,quests:validQuests,summary:parsed.summary||""});
    }catch(e){setProposal({skills:[],quests:[],summary:"Couldn't parse — try again."});}
    setAiParsing(false);
  };

  const confirmProposal=async()=>{
    if(!proposal) return;
    setConfirming(true);
    const acceptedSkills=proposal.skills.filter(s=>s.accepted&&s.editXp>0);
    const acceptedQuests=proposal.quests.filter(q=>q.accepted);
    if(acceptedSkills.length&&onAwardXp){
      await onAwardXp(acceptedSkills.map(s=>({skillId:s.id,xp:Number(s.editXp)||0,reason:s.reason})));
    }
    // Save journal entry with quest links and AI tag
    const questIds=acceptedQuests.map(q=>q.id);
    onAdd({text:text.trim(),img:img||null,source:"ai_journal",summary:proposal.summary,
      linkedSkills:acceptedSkills.map(s=>({id:s.id,name:s.name,xp:Number(s.editXp)||0})),
      linkedQuests:questIds,created:Date.now()});
    setText(""); setImg(null); setProposal(null); setShowForm(false);
    setConfirming(false);
  };

  const practiceEntries=entries.filter(e=>e.source==="practice");
  const aiEntries=entries.filter(e=>e.source==="ai_journal");
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
      const data=await res.json(); if(data?.error) throw new Error(data.error.message||"AI error");
      const msg=data?.choices?.[0]?.message?.content||data?.content?.[0]?.text||"";
      setStory(msg);
    }catch{ setStory("Couldn't reach the advisor. Try again when connected."); }
    finally{ setGenning(false); }
  };

  const filtered=filter==="all"?entries
    :filter==="ai_journal"?entries.filter(e=>e.source==="ai_journal")
    :entries.filter(e=>e.source===filter);
  const fmt=ts=>new Date(ts).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

  return (<>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div className="slbl" style={{margin:0}}>Journal</div>
      <div style={{display:"flex",gap:6}}>
        {!showForm&&<button onClick={()=>{setAiMode(true);setShowForm(true);setProposal(null);}}
          style={{margin:0,padding:"5px 12px",borderRadius:4,border:"1px solid var(--secondaryb)",background:"var(--s2)",color:"var(--secondary)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.2,textTransform:"uppercase",cursor:"pointer"}}>
          ✦ AI Entry
        </button>}
        <button className="addbtn" style={{margin:0,padding:"5px 14px"}} onClick={()=>{if(showForm){setShowForm(false);setProposal(null);setAiMode(false);}else{setAiMode(false);setShowForm(true);}}}>
          {showForm?"Cancel":"+ Write"}
        </button>
      </div>
    </div>

    {/* Filter tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {[["all","All"],["manual","Written"],["ai_journal","✦ AI"],["practice","Practice"]].map(([v,label])=>(
        <button key={v} onClick={()=>setFilter(v)}
          style={{padding:"4px 12px",borderRadius:20,fontSize:11,border:"1px solid var(--b2)",
            background:filter===v?v==="ai_journal"?"var(--secondaryf)":"var(--primaryb)":"var(--s1)",
            color:filter===v?v==="ai_journal"?"var(--secondary)":"var(--primary)":"var(--tx3)",cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:.5}}>
          {label} {v==="practice"&&practiceEntries.length>0&&<span style={{opacity:.7}}>({practiceEntries.length})</span>}
          {v==="ai_journal"&&aiEntries.length>0&&<span style={{opacity:.7}}>({aiEntries.length})</span>}
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
    {showForm&&!proposal&&(
      <div className="fwrap" style={{marginBottom:16}}>
        {aiMode&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 10px",background:"var(--s2)",border:"1px solid var(--secondaryb)",borderRadius:4}}>
          <span style={{color:"var(--secondary)",fontSize:12}}>✦</span>
          <span style={{fontSize:11,color:"var(--tx2)",lineHeight:1.5}}>Write freely about your day. AI will detect which skills and quests you worked on and suggest XP — you review before anything is awarded.</span>
        </div>}
        {img&&<img src={img} className="journal-img" alt="attached"/>}
        <textarea className="fi full"
          placeholder={aiMode?"Write about your day — what you worked on, how long, what happened. The more detail, the better the XP suggestions.":"Write your entry... or attach a photo of your paper journal below."}
          value={text} onChange={e=>setText(e.target.value)}
          style={{minHeight:aiMode?160:120,resize:"vertical",lineHeight:1.7}}/>
        {!aiMode&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button className="fsbtn" style={{width:"auto",padding:"7px 14px",margin:0,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}}
            onClick={()=>fileRef.current?.click()}>
            {ocring?"◌ Reading image...":"📷 Attach / OCR Photo"}
          </button>
          <a href="https://lens.google.com" target="_blank" rel="noreferrer"
            style={{fontSize:11,color:"var(--tx3)",textDecoration:"underline"}}>or Google Lens (free)</a>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
        </div>}
        <button className="fsbtn" style={{marginTop:8,background:aiMode?"var(--secondaryf)":undefined,color:aiMode?"var(--secondary)":undefined,border:aiMode?"1px solid var(--secondaryb)":undefined}}
          onClick={submit} disabled={aiParsing}>
          {aiParsing?"✦ Reading entry...":aiMode?"✦ Analyse & Suggest XP":"Save Entry"}
        </button>
      </div>
    )}

    {/* AI proposal review */}
    {proposal&&(
      <div className="fwrap" style={{marginBottom:16,border:"1px solid var(--secondaryb)",background:"var(--s2)"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"var(--secondary)",marginBottom:10}}>✦ Review XP proposal</div>
        {proposal.summary&&<div style={{fontSize:12,color:"var(--tx2)",fontStyle:"italic",marginBottom:12,lineHeight:1.6,padding:"8px 10px",background:"var(--bg)",borderRadius:4,border:"1px solid var(--b1)"}}>{proposal.summary}</div>}

        {proposal.skills.length>0&&<>
          <div className="label9" style={{marginBottom:8}}>Skills detected</div>
          {proposal.skills.map((s,i)=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 10px",background:"var(--bg)",border:`1px solid ${s.accepted?"var(--secondaryb)":"var(--b1)"}`,borderRadius:6,opacity:s.accepted?1:.5}}>
              <button onClick={()=>setProposal(p=>({...p,skills:p.skills.map((sk,j)=>j===i?{...sk,accepted:!sk.accepted}:sk)}))}
                style={{width:18,height:18,borderRadius:3,border:`1px solid ${s.accepted?"var(--secondary)":"var(--b2)"}`,background:s.accepted?"var(--secondaryf)":"none",color:"var(--secondary)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {s.accepted?"✓":""}
              </button>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,color:"var(--tx)",fontWeight:500}}>{s.name}</div>
                <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>{s.reason}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                <input type="number" min={1} max={500} value={s.editXp}
                  onChange={e=>setProposal(p=>({...p,skills:p.skills.map((sk,j)=>j===i?{...sk,editXp:Number(e.target.value)||0}:sk)}))}
                  style={{width:44,background:"var(--bg)",border:"1px solid var(--b1)",borderRadius:3,color:"var(--secondary)",fontSize:11,fontFamily:"'DM Mono',monospace",padding:"2px 5px",textAlign:"center",outline:"none"}}/>
                <span style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>{L.xpName}</span>
              </div>
            </div>
          ))}
        </>}

        {proposal.quests.length>0&&<>
          <div className="label9" style={{marginBottom:8,marginTop:proposal.skills.length?12:0}}>Quests mentioned</div>
          {proposal.quests.map((q,i)=>(
            <div key={q.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"6px 10px",background:"var(--bg)",border:`1px solid ${q.accepted?"var(--primaryb)":"var(--b1)"}`,borderRadius:6,opacity:q.accepted?1:.5}}>
              <button onClick={()=>setProposal(p=>({...p,quests:p.quests.map((qq,j)=>j===i?{...qq,accepted:!qq.accepted}:qq)}))}
                style={{width:18,height:18,borderRadius:3,border:`1px solid ${q.accepted?"var(--primary)":"var(--b2)"}`,background:q.accepted?"var(--primaryf)":"none",color:"var(--primary)",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {q.accepted?"✓":""}
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"var(--tx)"}}>◆ {q.name}</div>
                <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>Activity will be noted in journal</div>
              </div>
            </div>
          ))}
        </>}

        {proposal.skills.length===0&&proposal.quests.length===0&&(
          <div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic",marginBottom:12}}>No skills or quests detected — entry will be saved as a plain journal note.</div>
        )}

        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="fsbtn" style={{flex:1,background:"var(--secondaryf)",color:"var(--secondary)",border:"1px solid var(--secondaryb)"}}
            onClick={confirmProposal} disabled={confirming}>
            {confirming?"Saving...":"✓ Confirm & Award XP"}
          </button>
          <button className="fsbtn" style={{width:"auto",padding:"8px 14px",background:"var(--s2)",color:"var(--tx3)",border:"1px solid var(--b1)"}}
            onClick={()=>{setProposal(null);}}>
            Edit
          </button>
          <button className="fsbtn" style={{width:"auto",padding:"8px 14px",background:"none",color:"var(--tx3)",border:"1px solid var(--b1)"}}
            onClick={()=>{setProposal(null);setText("");setShowForm(false);setAiMode(false);}}>✕</button>
        </div>
      </div>
    )}

    {filtered.length===0&&(
      <div className="empty">
        {filter==="practice"?"No practice notes yet. Add a note when logging a session.":"No entries yet."}
      </div>
    )}

    {filtered.map(e=>(
      <div key={e.id} className={`journal-entry${e.source==="practice"?" practice-entry":e.source==="ai_journal"?" ai-journal-entry":""}`}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div className="journal-date">{fmt(e.created)}</div>
            {e.source==="practice"&&<span style={{fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:1,color:"var(--secondary)",border:"1px solid var(--secondaryb)",borderRadius:10,padding:"1px 6px"}}>PRACTICE</span>}
            {e.source==="ai_journal"&&<span style={{fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:1,color:"var(--secondary)",border:"1px solid var(--secondaryb)",borderRadius:10,padding:"1px 6px"}}>✦ AI</span>}
          </div>
          <button className="delbtn" style={{fontSize:9}} onClick={()=>onDelete(e.id)}>✕</button>
        </div>
        {e.summary&&<div style={{fontSize:11,color:"var(--secondary)",fontStyle:"italic",marginBottom:6,lineHeight:1.5}}>"{e.summary}"</div>}
        {e.img&&<img src={e.img} className="journal-img" alt="journal page"/>}
        {e.text&&<div className="journal-text">{e.text}</div>}
        {(e.linkedSkills?.length>0||e.linkedQuests?.length>0)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
            {(e.linkedSkills||[]).map(s=>(
              <span key={s.id} style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:.5,color:"var(--secondary)",border:"1px solid var(--secondaryb)",borderRadius:10,padding:"2px 8px"}}>+{s.xp} {s.name}</span>
            ))}
            {(e.linkedQuests||[]).map(qId=>{
              const q=(quests||[]).find(qq=>qq.id===qId);
              return q?<span key={qId} style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:.5,color:"var(--primary)",border:"1px solid var(--primaryb)",borderRadius:10,padding:"2px 8px"}}>◆ {q.title}</span>:null;
            })}
          </div>
        )}
      </div>
    ))}
  </>);
}

