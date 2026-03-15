import React, { useState, useEffect, useRef } from "react";
import { useSettings, SKILL_CATEGORIES } from "./constants";
import { fmtDate, uid } from "./utils";

// ─── WEEKLY REVIEW MODAL ────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY TAB - Wave 2 Multiplayer
// ═══════════════════════════════════════════════════════════════════════════
export function CommunityTab({userId,settings,skills,quests,meds,journal,streaks,xp,friends,myFriendCode,profiles,onPublishProfile,onAddFriend,onRemoveFriend,onRefresh,onEditSkillPublish,onEditQuestPublish,onSaveSettings,showToast}){
  const L=settings.labels;
  const [view,setView]=useState("board"); // board | profile | friends
  const [loading,setLoading]=useState(false);
  const [friendInput,setFriendInput]=useState("");
  const [filterCat,setFilterCat]=useState("all");
  const [filterFriends,setFilterFriends]=useState(false);
  const [profilePublic,setProfilePublic]=useState(settings.profile.public||false);

  const level=Math.floor(skills.reduce((a,s)=>a+(s.xp||0),0)/(settings.xp.globalPerLevel||6000))+1;
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

export function CommunityCard({profile,isFriend,badges,filterCat}){
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

export function WeeklyReview({tasks,quests,skills,meds,xpLog,journal,settings,onClose,onNavigate,onAddTask}){
  const L=settings.labels;
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);
  const [planStep,setPlanStep]=useState(false); // show planning step after review
  const [planLoading,setPlanLoading]=useState(false);
  const [planSuggestions,setPlanSuggestions]=useState([]); // [{questId,title,reason}]
  const [planAccepted,setPlanAccepted]=useState(false);

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
      const skPerLv=settings?.xp?.skillPerLevel||6000;
      const practiceBySkill={};
      recentMeds.forEach(m=>{
        (m.skillIds||[m.skill]).filter(Boolean).forEach(sid=>{
          practiceBySkill[sid]=(practiceBySkill[sid]||0)+(m.dur||0);
        });
      });
      // Skill velocity: XP gained this week per skill
      const xpThisWeek={};
      (xpLog||[]).filter(e=>e.created>weekAgo&&e.skillId).forEach(e=>{
        xpThisWeek[e.skillId]=(xpThisWeek[e.skillId]||0)+e.amt;
      });
      const skillContext=skills.filter(s=>s.type!=="subskill").map(s=>({
        name:s.name, level:Math.floor((s.xp||0)/skPerLv)+1,
        intention:s.intention||null,
        minutesThisWeek:practiceBySkill[s.id]||0,
        xpThisWeek:xpThisWeek[s.id]||0,
        hasActiveQuest:quests.some(q=>!q.done&&(q.skills||[]).includes(s.id)),
      }));
      // Gaining vs stalling detection
      const gaining=skillContext.filter(s=>s.xpThisWeek>0).map(s=>s.name);
      const stalledWithQuests=skillContext.filter(s=>s.xpThisWeek===0&&s.hasActiveQuest).map(s=>s.name);
      const sessionNotes=recentMeds.filter(m=>m.note&&m.note.length>10).map(m=>({
        skill:skills.find(s=>(m.skillIds||[]).includes(s.id)||m.skill===s.id)?.name||"Unknown",
        dur:m.dur, note:m.note.slice(0,120),
      })).slice(0,6);
      const dayActivity={};
      recentMeds.forEach(m=>{
        const d=new Date(m.created).toLocaleDateString("en",{weekday:"short"});
        dayActivity[d]=(dayActivity[d]||0)+1;
      });
      // Tasks: scheduled vs completed
      const weekTasks=tasks.filter(t=>t.period==="weekly"||(t.period==="daily"&&t.created>weekAgo));
      const completedTasks=weekTasks.filter(t=>t.done);
      const summary={
        playerName:settings?.profile?.name||"Player",
        tasksScheduled:weekTasks.length, tasksCompleted:recentTasks.length,
        completionRate:weekTasks.length?Math.round(completedTasks.length/weekTasks.length*100):null,
        questsCompleted:recentQuests.length,
        questsCompleted_titles:recentQuests.map(q=>q.title).slice(0,5),
        activeQuestsCount:quests.filter(q=>!q.done).length,
        practiceSessionsLogged:recentMeds.length,
        totalMinutesPracticed:recentMeds.reduce((s,m)=>s+(m.dur||0),0),
        xpEarned:recentXp,
        skillsGaining:gaining,
        skillsStalledWithActiveQuests:stalledWithQuests,
        radiantQuestsActive:quests.filter(q=>q.type==="radiant"&&!q.done).map(q=>q.title),
        skillDetails:skillContext,
        sessionNotes,
        dayActivity,
        journalEntriesThisWeek:journal.filter(j=>j.created>weekAgo).length,
      };
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          max_tokens:750,
          messages:[
            {role:"system",content:"You are a grounded, direct life coach. Be specific, personal, and honest — not cheerleading. Reference real data. Acknowledge gaps without being harsh."},
            {role:"user",content:`Weekly rewind for ${summary.playerName}.

DATA:
${JSON.stringify(summary,null,2)}

Write in EXACTLY this structure (no extra sections, no deviation):

**⬡ WINS**
[2-3 specific things. Reference actual quest titles, session notes, or skill names from the data.]

**◈ ACTUAL VS PLANNED**
[Compare tasks scheduled vs completed. Call out the gap honestly if completion was low. If no task data, note that. Mention which skills got work and which active-quest skills got zero.]

**◉ SKILL VELOCITY**
[Which skills are gaining momentum this week? Which have active quests but zero XP movement? Be specific with names.]

**◆ ONE CHANGE**
[One concrete, specific process change for next week. Not a goal — a behavior or system. Based on the actual gap you see in the data.]

Under 350 words total. Direct, specific, useful.`}
          ]
        })
      });
      const data=await res.json();
      const msg=(data.choices?.[0]?.message?.content||"Couldn't generate review. Try again.");
      setAnalysis(msg);
    }catch(e){ setAnalysis("Couldn't connect to advisor. Try again."); }
    finally{ setLoading(false); }
  };

  const runPlan=async()=>{
    setPlanLoading(true);
    try{
      const activeQ=quests.filter(q=>!q.done).map(q=>({id:q.id,title:q.title,type:q.type,skills:(q.skills||[]).map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean)}));
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          max_tokens:400,
          messages:[
            {role:"system",content:"You are a planning assistant. Reply ONLY with valid JSON array, no markdown, no explanation."},
            {role:"user",content:`Based on this player's active quests, pick 3 to focus on next week. Prioritize momentum and skill variety.

Active quests: ${JSON.stringify(activeQ)}
Weekly review: ${analysis.slice(0,300)}

Reply with JSON only: [{"questId":"id","title":"title","reason":"one sentence, 10 words max"}]`}
          ]
        })
      });
      const data=await res.json();
      const txt=(data.choices?.[0]?.message?.content||"[]").replace(/```json|```/g,"").trim();
      let parsed; try{parsed=JSON.parse(txt);}catch{parsed=[];}
      setPlanSuggestions(parsed.slice(0,3));
    }catch(e){setPlanSuggestions([]);}
    setPlanLoading(false);
  };

  const acceptPlan=()=>{
    planSuggestions.forEach(s=>{
      if(onAddTask) onAddTask({title:s.title,period:"daily",skill:null,xpVal:20,questId:s.questId,timeBlock:null,priority:"med"});
    });
    setPlanAccepted(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div className="review-modal">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2,color:"var(--primary)"}}>
            {planStep?"◆ PLAN NEXT WEEK":"WEEKLY REVIEW"}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {planStep&&<button className="delbtn" style={{fontSize:9,color:"var(--tx3)"}} onClick={()=>setPlanStep(false)}>← Back</button>}
            <button className="delbtn" onClick={onClose}>✕</button>
          </div>
        </div>

        {!planStep?(<>
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
            {analysis&&<button className="fsbtn primary" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10}} onClick={()=>{setPlanStep(true);if(!planSuggestions.length)runPlan();}}>◆ Plan Next Week →</button>}
            {[["quests","Quests"],["skills","Skills"],["journal","Log"],["advisor","Advisor"]].map(([t,label])=>(
              <button key={t} className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0,fontSize:10,background:"var(--s2)",color:"var(--tx2)",border:"1px solid var(--b2)"}}
                onClick={()=>onNavigate(t)}>
                {label}
              </button>
            ))}
          </div>
        </>):(<>
          <div style={{fontSize:12,color:"var(--tx3)",marginBottom:16,lineHeight:1.6}}>Based on your week, here are 3 quests to focus on. Accept to pin them as today's tasks.</div>
          {planLoading&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)",letterSpacing:1,padding:"20px 0",textAlign:"center"}}>◌ Thinking...</div>}
          {!planLoading&&planSuggestions.map((s,i)=>(
            <div key={i} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",borderRadius:"var(--r)",padding:"10px 14px",marginBottom:6}}>
              <div style={{fontSize:13,color:"var(--tx)",marginBottom:3}}>◆ {s.title}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",letterSpacing:.5}}>{s.reason}</div>
            </div>
          ))}
          {!planLoading&&planSuggestions.length===0&&<div style={{fontSize:12,color:"var(--tx3)",fontStyle:"italic",padding:"12px 0"}}>No active quests to suggest. Add some quests first.</div>}
          {!planLoading&&planSuggestions.length>0&&(
            planAccepted
              ?<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--success)",letterSpacing:1,padding:"12px 0",textAlign:"center"}}>✓ Added to today's planner</div>
              :<div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="fsbtn primary" style={{margin:0}} onClick={acceptPlan}>◆ Add to Planner</button>
                <button className="fsbtn" style={{width:"auto",padding:"8px 14px",margin:0,color:"var(--tx3)",background:"none"}} onClick={()=>onNavigate("planner")}>Open Planner</button>
              </div>
          )}
        </>)}
      </div>
    </div>
  );
}

              </div>
          )}
        </>)}
      </div>
    </div>
  );
}

// ─── STREAK RESCUE BANNER ─────────────────────────────────────────────────────
export function StreakRescueBanner({rescue,onDismiss,onLog}){
  return (
    <div style={{position:"fixed",bottom:72,left:"50%",transform:"translateX(-50%)",
      width:"min(440px,92vw)",zIndex:500,
      background:"var(--s1)",border:"1px solid var(--secondaryb)",borderRadius:"var(--r)",
      padding:"12px 14px",boxShadow:"0 4px 24px #0008,0 0 16px var(--secondaryb)"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{fontSize:18,flexShrink:0,marginTop:1}}>◉</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,
            color:"var(--secondary)",textTransform:"uppercase",marginBottom:3}}>
            Streak at Risk · {rescue.skillName} · {rescue.count}d
          </div>
          <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.5,marginBottom:8}}>
            {rescue.suggestion}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={onLog}
              style={{background:"var(--secondaryf)",border:"1px solid var(--secondaryb)",
                borderRadius:4,padding:"6px 14px",cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,
                color:"var(--secondary)",textTransform:"uppercase"}}>
              ◉ Log it
            </button>
            <button onClick={onDismiss}
              style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,
                padding:"6px 10px",cursor:"pointer",fontFamily:"'DM Mono',monospace",
                fontSize:9,color:"var(--tx3)"}}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QUEST BREAKDOWN MODAL ────────────────────────────────────────────────────
export function QuestBreakdownModal({questId,quests,skills,settings,onClose,onAddSubquest,onAddQuest,showToast}){
  const quest=quests.find(q=>q.id===questId);
  const [steps,setSteps]=useState([]); // [{title,xpVal,skillIds,accepted,loading}]
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const skPerLv=settings.xp?.skillPerLevel||6000;

  useEffect(()=>{if(quest) generate();},[]);

  const generate=async()=>{
    if(!quest) return;
    setLoading(true); setSteps([]); setDone(false);
    const qSkills=(quest.skills||[]).map(id=>skills.find(s=>s.id===id)?.name).filter(Boolean);
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:600,
          messages:[{role:"user",content:`Break down this quest into 3-6 concrete, actionable steps.

Quest: "${quest.title}"
Type: ${quest.type}
Intention: ${quest.note||"none"}
Linked skills: ${qSkills.join(", ")||"none"}
XP scale: 1 level = ${skPerLv} XP. Each step should be 50–800 XP depending on effort.

Reply ONLY with a JSON array, no markdown, no explanation:
[{"title":"step title","xpVal":number,"note":"why this step matters, 1 sentence"},...]

Steps should be specific actions, not vague goals. Order them logically.`}]})});
      const data=await res.json();
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      const m=raw.match(/\[[\s\S]*\]/);
      if(m){
        const parsed=JSON.parse(m[0]);
        setSteps(parsed.map((s,i)=>({...s,id:i,skillIds:quest.skills||[],accepted:false})));
      } else { setSteps([]); }
    }catch{ setSteps([]); }
    setLoading(false);
  };

  const toggle=i=>setSteps(prev=>prev.map((s,idx)=>idx===i?{...s,accepted:!s.accepted}:s));
  const toggleAll=()=>{
    const anyOff=steps.some(s=>!s.accepted);
    setSteps(prev=>prev.map(s=>({...s,accepted:anyOff})));
  };

  const accept=async()=>{
    const chosen=steps.filter(s=>s.accepted);
    if(!chosen.length){showToast("Select at least one step");return;}
    for(const s of chosen){
      await onAddSubquest(questId,s.title,s.xpVal);
    }
    showToast(`Added ${chosen.length} step${chosen.length>1?"s":""} to quest`);
    setDone(true);
  };

  if(!quest) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(4px)",
      zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{width:"min(500px,96vw)",background:"var(--s1)",border:"1px solid var(--b2)",
        borderRadius:"var(--r)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"85vh"}}>
        {/* Header */}
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b1)",display:"flex",
          alignItems:"flex-start",gap:10,flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,
              color:"var(--primary)",textTransform:"uppercase",marginBottom:4}}>⟡ AI Quest Breakdown</div>
            <div style={{fontSize:13,color:"var(--tx)",fontWeight:500,lineHeight:1.3}}>{quest.title}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",
            cursor:"pointer",fontSize:16,flexShrink:0,padding:"2px 4px"}}>✕</button>
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
          {loading&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[1,2,3,4].map(i=>(
                <div key={i} style={{background:"var(--s2)",borderRadius:4,padding:"12px",
                  animation:"pulse 1.5s ease-in-out infinite",opacity:.6+i*.05}}>
                  <div style={{height:10,background:"var(--b2)",borderRadius:2,marginBottom:6,width:`${60+i*8}%`}}/>
                  <div style={{height:8,background:"var(--b2)",borderRadius:2,width:"40%"}}/>
                </div>
              ))}
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",
                letterSpacing:1,textAlign:"center",marginTop:4}}>Analyzing quest…</div>
            </div>
          )}
          {!loading&&steps.length===0&&(
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:22,marginBottom:8}}>◌</div>
              <div style={{fontSize:12,color:"var(--tx3)"}}>Couldn't generate steps. Try again.</div>
              <button className="fsbtn" style={{margin:"12px auto 0",width:"auto",padding:"7px 18px"}}
                onClick={generate}>↺ Retry</button>
            </div>
          )}
          {!loading&&steps.length>0&&!done&&(
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",letterSpacing:.8}}>
                  Select steps to add as subquests
                </div>
                <button onClick={toggleAll}
                  style={{background:"none",border:"none",color:"var(--primary)",
                    fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:.5}}>
                  {steps.every(s=>s.accepted)?"Deselect all":"Select all"}
                </button>
              </div>
              {steps.map((s,i)=>(
                <div key={i} onClick={()=>toggle(i)}
                  style={{display:"flex",gap:10,padding:"10px 12px",marginBottom:6,cursor:"pointer",
                    background:s.accepted?"var(--primaryf)":"var(--s2)",
                    border:`1px solid ${s.accepted?"var(--primaryb)":"var(--b1)"}`,
                    borderRadius:"var(--r)",transition:"all .15s"}}>
                  <div style={{width:16,height:16,borderRadius:3,border:`1px solid ${s.accepted?"var(--primary)":"var(--b2)"}`,
                    background:s.accepted?"var(--primary)":"none",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:9,color:"var(--bg)",flexShrink:0,marginTop:1}}>
                    {s.accepted?"✓":""}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:"var(--tx)",marginBottom:3,lineHeight:1.3}}>{s.title}</div>
                    {s.note&&<div style={{fontSize:10,color:"var(--tx3)",marginBottom:3,fontStyle:"italic"}}>{s.note}</div>}
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:s.accepted?"var(--primary)":"var(--tx3)"}}>
                      +{s.xpVal} XP
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {done&&(
            <div style={{textAlign:"center",padding:"28px 0"}}>
              <div style={{fontSize:28,marginBottom:10,color:"var(--success)"}}>✓</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--success)",letterSpacing:1}}>
                Steps added to quest
              </div>
              <div style={{fontSize:11,color:"var(--tx3)",marginTop:6}}>Find them under the quest's steps counter</div>
            </div>
          )}
        </div>
        {/* Footer */}
        {!loading&&steps.length>0&&!done&&(
          <div style={{padding:"12px 16px",borderTop:"1px solid var(--b1)",display:"flex",gap:8,flexShrink:0}}>
            <button className="fsbtn primary" style={{flex:1,margin:0}} onClick={accept}>
              ◆ Add {steps.filter(s=>s.accepted).length||0} selected steps
            </button>
            <button onClick={generate}
              style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,padding:"8px 12px",
                cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>
              ↺
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SKILL GAP MODAL ──────────────────────────────────────────────────────────
export function SkillGapModal({quests,skills,tasks,settings,onClose,onAddTask,onEditQuest,showToast}){
  const [analysis,setAnalysis]=useState(null);
  const [loading,setLoading]=useState(false);
  const skPerLv=settings.xp?.skillPerLevel||6000;

  useEffect(()=>{ run(); },[]);

  const run=async()=>{
    setLoading(true); setAnalysis(null);
    try{
      const activeQ=quests.filter(q=>!q.done);
      const skillXpMap=Object.fromEntries(skills.map(s=>[s.id,s.xp||0]));
      const skillUsage={}; // skillId -> {questCount, taskCount, totalXp}
      activeQ.forEach(q=>{
        (q.skills||[]).forEach(sid=>{
          if(!skillUsage[sid]) skillUsage[sid]={questCount:0,taskCount:0};
          skillUsage[sid].questCount++;
        });
      });
      tasks.filter(t=>!t.done&&t.skill).forEach(t=>{
        if(!skillUsage[t.skill]) skillUsage[t.skill]={questCount:0,taskCount:0};
        skillUsage[t.skill].taskCount++;
      });
      // Skills with active quests but no tasks
      const gaps=skills.filter(s=>s.type!=="subskill").map(s=>{
        const usage=skillUsage[s.id]||{questCount:0,taskCount:0};
        const lv=Math.floor((s.xp||0)/skPerLv)+1;
        return {id:s.id,name:s.name,icon:s.icon||"◈",level:lv,xp:s.xp||0,...usage};
      });
      const prompt=`Skill gap analysis for a gamified life tracker.

Active quests (${activeQ.length}):
${activeQ.slice(0,10).map(q=>`- "${q.title}" [${q.type}] linked to: ${(q.skills||[]).map(id=>skills.find(s=>s.id===id)?.name||id).join(", ")||"no skills"}`).join("\n")}

Skills and activity:
${gaps.map(s=>`- ${s.name} Lv${s.level}: ${s.questCount} active quests, ${s.taskCount} active tasks, ${s.xp} XP`).join("\n")}

Identify:
1. NEGLECTED: Skills with quests but zero active tasks (action gap)
2. ORPHANED: Skills with no quests and no tasks (possibly unused)
3. OVERLOADED: Skills carrying too many quests with no clear priority
4. MISSING: Skills that seem needed given the quests but don't exist

Reply ONLY with JSON, no markdown:
{"neglected":[{"skillName":"...","reason":"...","suggestion":"one specific task to add"}],
 "orphaned":[{"skillName":"...","reason":"..."}],
 "overloaded":[{"skillName":"...","reason":"...","suggestion":"..."}],
 "missing":[{"skillName":"...","reason":"why it's needed"}]}`;

      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({max_tokens:700,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const raw=(data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
      const m=raw.match(/\{[\s\S]*\}/);
      if(m) setAnalysis(JSON.parse(m[0]));
      else setAnalysis({neglected:[],orphaned:[],overloaded:[],missing:[],error:"Parse failed"});
    }catch{ setAnalysis({neglected:[],orphaned:[],overloaded:[],missing:[],error:"Connection failed"}); }
    setLoading(false);
  };

  const Section=({icon,label,color,items,renderItem})=>{
    if(!items?.length) return null;
    return (
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,
          color,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          {icon} {label} <span style={{opacity:.5}}>({items.length})</span>
        </div>
        {items.map((item,i)=>(
          <div key={i} style={{background:"var(--s2)",border:"1px solid var(--b1)",
            borderRadius:"var(--r)",padding:"10px 12px",marginBottom:6}}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(4px)",
      zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{width:"min(500px,96vw)",background:"var(--s1)",border:"1px solid var(--b2)",
        borderRadius:"var(--r)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"88vh"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b1)",display:"flex",
          alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,
              color:"var(--primary)",textTransform:"uppercase",marginBottom:2}}>◈ Skill Gap Analysis</div>
            <div style={{fontSize:11,color:"var(--tx3)"}}>Where your skills and quests don't line up</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tx3)",
            cursor:"pointer",fontSize:16}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
          {loading&&(
            <div style={{padding:"32px 0",textAlign:"center"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",
                letterSpacing:2,animation:"pulse 1.5s ease-in-out infinite"}}>ANALYZING…</div>
            </div>
          )}
          {analysis?.error&&<div style={{fontSize:11,color:"var(--danger)",padding:"8px 0"}}>{analysis.error}</div>}
          {analysis&&!analysis.error&&(
            <>
              <Section icon="⚠" label="Neglected" color="var(--danger)"
                items={analysis.neglected}
                renderItem={item=>(
                  <>
                    <div style={{fontSize:12,color:"var(--tx)",marginBottom:3}}>{item.skillName}</div>
                    <div style={{fontSize:10,color:"var(--tx3)",marginBottom:6,fontStyle:"italic"}}>{item.reason}</div>
                    {item.suggestion&&(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:10,color:"var(--tx2)",flex:1}}>→ {item.suggestion}</div>
                        <button onClick={async()=>{
                          const sk=skills.find(s=>s.name===item.skillName);
                          await onAddTask({title:item.suggestion,period:"daily",skill:sk?.id||null,xpVal:20});
                          showToast(`Added: ${item.suggestion}`);
                        }} style={{background:"var(--primaryf)",border:"1px solid var(--primaryb)",
                          borderRadius:3,padding:"3px 10px",cursor:"pointer",
                          fontFamily:"'DM Mono',monospace",fontSize:8,color:"var(--primary)",flexShrink:0}}>
                          + Add task
                        </button>
                      </div>
                    )}
                  </>
                )}/>
              <Section icon="◌" label="Orphaned skills" color="var(--tx3)"
                items={analysis.orphaned}
                renderItem={item=>(
                  <>
                    <div style={{fontSize:12,color:"var(--tx)",marginBottom:3}}>{item.skillName}</div>
                    <div style={{fontSize:10,color:"var(--tx3)",fontStyle:"italic"}}>{item.reason}</div>
                  </>
                )}/>
              <Section icon="◉" label="Overloaded" color="var(--secondary)"
                items={analysis.overloaded}
                renderItem={item=>(
                  <>
                    <div style={{fontSize:12,color:"var(--tx)",marginBottom:3}}>{item.skillName}</div>
                    <div style={{fontSize:10,color:"var(--tx3)",marginBottom:3,fontStyle:"italic"}}>{item.reason}</div>
                    {item.suggestion&&<div style={{fontSize:10,color:"var(--tx2)"}}>→ {item.suggestion}</div>}
                  </>
                )}/>
              <Section icon="◆" label="Missing skills" color="var(--primary)"
                items={analysis.missing}
                renderItem={item=>(
                  <>
                    <div style={{fontSize:12,color:"var(--tx)",marginBottom:3}}>{item.skillName}</div>
                    <div style={{fontSize:10,color:"var(--tx3)",fontStyle:"italic"}}>{item.reason}</div>
                  </>
                )}/>
              {!analysis.neglected?.length&&!analysis.orphaned?.length&&!analysis.overloaded?.length&&!analysis.missing?.length&&(
                <div style={{textAlign:"center",padding:"24px 0"}}>
                  <div style={{fontSize:24,marginBottom:8}}>✓</div>
                  <div style={{fontSize:12,color:"var(--tx3)"}}>Your skills and quests are well aligned.</div>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid var(--b1)",flexShrink:0}}>
          <button onClick={run}
            style={{background:"none",border:"1px solid var(--b2)",borderRadius:4,
              padding:"7px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",
              fontSize:9,color:"var(--tx3)",letterSpacing:.8}}>
            ↺ Re-run analysis
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FOCUS TIMER ─────────────────────────────────────────────────────────────
export function FocusTimer({elapsed,skillName,onStop,onCancel}){
  const mins=String(Math.floor(elapsed/60)).padStart(2,"0");
  const secs=String(elapsed%60).padStart(2,"0");
  return (
    <div className="timer-overlay">
      <div className="timer-skill">◉ {skillName||"Focus Session"}</div>
      <div className="timer-face">{mins}:{secs}</div>
      <div style={{color:"var(--tx3)",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,marginBottom:48}}>IN SESSION</div>
      <button className="timer-btn timer-stop" onClick={onStop}>■ Stop & Log</button>
      <button className="timer-btn timer-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ─── PROFILE MODAL ────────────────────────────────────────────────────────────
export function ProfileModal({settings,xp,level,prog,skills,streaks,meds,quests,journal,userId,myFriendCode,friends,profiles,onSignIn,onSignOut,onClose,onPublish,onAddFriend,onRemoveFriend,onRefresh,onSaveSettings,showToast}){
  const L=settings.labels;
  const [view,setView]=useState("profile"); // profile | community | friends | share
  const [friendInput,setFriendInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [profilePublic,setProfilePublic]=useState(settings.profile.public||false);
  const perLv=settings.xp.globalPerLevel||6000;

  const getBadges=()=>{
    const badges=[];
    if(Object.values(streaks).some(s=>s.count>=7)) badges.push({icon:"◆",label:"Immaculate",tip:"7-day streak"});
    if((journal||[]).length>=5) badges.push({icon:"✦",label:"Chronicler",tip:"5+ journal entries"});
    if((meds||[]).length>=10) badges.push({icon:"◉",label:"Practitioner",tip:"10+ sessions"});
    if(quests.filter(q=>q.done).length>=5) badges.push({icon:"◈",label:"Seeker",tip:"5+ quests completed"});
    return badges;
  };
  const badges=getBadges();
  const topSkills=skills.filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,3);
  const totalMins=meds.reduce((a,m)=>a+(m.dur||0),0);
  const doneQuests=quests.filter(q=>q.done).length;

  const togglePublic=async(val)=>{
    setProfilePublic(val);
    const next={...settings,profile:{...settings.profile,public:val}};
    await onSaveSettings(next);
    await onPublish(next);
    showToast(val?"Profile published":"Profile hidden");
  };

  const addFriend=async()=>{
    if(!friendInput.trim()) return;
    setLoading(true);
    await onAddFriend(friendInput.trim().toUpperCase());
    setFriendInput(""); setLoading(false);
    showToast("Friend added");
  };

  return (
    <div className="profile-modal" onClick={onClose}>
      <div className="profile-modal-bg"/>
      <div className="profile-sheet" onClick={e=>e.stopPropagation()}>
        <div className="profile-pill"/>
        {/* Sub-nav */}
        <div className="stabs" style={{marginBottom:18}}>
          {[["profile","◎ Profile"],["community","⬡ Community"],["share","◈ Share"]].map(([id,lbl])=>(
            <button key={id} className={`stab ${view===id?"on":""}`} onClick={()=>setView(id)}>{lbl}</button>
          ))}
        </div>

        {view==="profile"&&<>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <div className="profile-avatar">{settings.profile.name?settings.profile.name[0].toUpperCase():"?"}</div>
            <div style={{flex:1}}>
              <div className="profile-name">{settings.profile.name||"Adventurer"}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)",letterSpacing:1}}>{L.levelName} {level}</div>
              <div className="profile-xp-bar"><div className="profile-xp-fill" style={{width:`${prog}%`}}/></div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>{xp % perLv} / {perLv} {L.xpName}</div>
            </div>
          </div>
          {badges.length>0&&<div className="badge-row" style={{marginBottom:14}}>{badges.map(b=><div key={b.label} className="badge" title={b.tip}>{b.icon} {b.label}</div>)}</div>}
          <div className="stats" style={{marginBottom:16}}>
            <div className="sbox"><div className="snum">{doneQuests}</div><div className="slb2">Quests</div></div>
            <div className="sbox"><div className="snum">{totalMins>=60?Math.round(totalMins/60)+"h":totalMins+"m"}</div><div className="slb2">Practiced</div></div>
            <div className="sbox"><div className="snum">{(journal||[]).length}</div><div className="slb2">Entries</div></div>
          </div>
          {topSkills.length>0&&<>
            <div className="slbl" style={{marginBottom:8}}>Top Skills</div>
            {topSkills.map(s=>{const lv=Math.floor((s.xp||0)/(settings.xp.skillPerLevel||6000))+1;return(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:14}}>{s.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"var(--tx)",marginBottom:2}}>{s.name}</div>
                  <div style={{height:2,background:"var(--b1)",borderRadius:1,overflow:"hidden"}}><div style={{height:"100%",width:`${skillProg(s.xp||0,settings.xp.skillPerLevel||6000)}%`,background:s.color,borderRadius:1}}/></div>
                </div>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>Lv {lv}</span>
              </div>
            );})}
          </>}
          <div style={{height:12}}/>
          {/* Account */}
          <div className="slbl" style={{marginBottom:8}}>Account</div>
          {userId
            ?<div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1,fontSize:11,color:"var(--tx2)",fontFamily:"'DM Mono',monospace",padding:"8px 0"}}>Signed in · syncing</div>
              <button className="fsbtn" style={{width:"auto",padding:"6px 14px",margin:0}} onClick={onSignOut}>Sign Out</button>
            </div>
            :<button className="fsbtn" style={{marginBottom:8}} onClick={onSignIn}>Sign In / Create Account</button>
          }
          {myFriendCode&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",marginBottom:8}}>Friend code: <span style={{color:"var(--tx2)",letterSpacing:2}}>{myFriendCode}</span></div>}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid var(--b1)",marginTop:4}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)"}}>Public profile</div>
            <button className={`tog ${profilePublic?"on":""}`} onClick={()=>togglePublic(!profilePublic)}><div className="tog-knob"/></button>
          </div>
          {/* Add friend */}
          {userId&&<div style={{marginTop:12}}>
            <div className="slbl" style={{marginBottom:6}}>Add Friend</div>
            <div style={{display:"flex",gap:6}}>
              <input className="fi" placeholder="Friend code..." value={friendInput} onChange={e=>setFriendInput(e.target.value.toUpperCase())} style={{letterSpacing:2,fontFamily:"'DM Mono',monospace"}}/>
              <button className="fsbtn" style={{width:"auto",padding:"7px 12px",margin:0}} onClick={addFriend} disabled={loading}>Add</button>
            </div>
          </div>}
        </>}

        {view==="community"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="slbl" style={{margin:0}}>Community Board</div>
            <button className="fsbtn" style={{width:"auto",padding:"5px 12px",margin:0,fontSize:8}} onClick={async()=>{setLoading(true);await onRefresh();setLoading(false);}}>
              {loading?"…":"↺ Refresh"}
            </button>
          </div>
          {(profiles||[]).filter(p=>p.public!==false).slice(0,10).map(p=>(
            <div key={p.userId} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontSize:13}}>{p.name||"Adventurer"}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--primary)"}}>Lv {Math.floor((p.xp||0)/(settings.xp.globalPerLevel||6000))+1}</div>
              </div>
              {p.skills?.slice(0,3).map(s=><span key={s.id} className="ctag" style={{marginRight:4}}>{s.icon} {s.name}</span>)}
            </div>
          ))}
          {(profiles||[]).length===0&&<div className="empty">No profiles yet</div>}
        </>}

        {view==="share"&&<ShareCard settings={settings} level={level} xp={xp} skills={skills} streaks={streaks} meds={meds} quests={quests} journal={journal} showToast={showToast}/>}
      </div>
    </div>
  );
}

// ─── SHARE CARD ───────────────────────────────────────────────────────────────
export function ShareCard({settings,level,xp,skills,streaks,meds,quests,journal,showToast}){
  const L=settings.labels;
  const topSkills=skills.filter(s=>s.type!=="subskill").sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,3);
  const topStreak=Math.max(0,...Object.values(streaks).map(s=>s.count||0));
  const totalMins=meds.reduce((a,m)=>a+(m.dur||0),0);
  const doneQuests=quests.filter(q=>q.done).length;
  const cardRef=useRef();

  const copyText=()=>{
    const lines=[
      `${settings.profile.name||"Adventurer"} — ${L.levelName} ${level}`,
      `◆ ${doneQuests} quests completed`,
      `◉ ${totalMins>=60?Math.round(totalMins/60)+"h practiced":totalMins+"min practiced"}`,
      `✦ ${topStreak} day streak`,
      topSkills.length?`Top skills: ${topSkills.map(s=>s.name).join(", ")}`:"",
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(lines).then(()=>showToast("Copied to clipboard!"));
  };

  return (<>
    <div className="share-card" ref={cardRef}>
      <div className="share-level">{level}</div>
      <div className="share-name">{settings.profile.name||"Adventurer"}</div>
      <div className="share-stats">
        <div className="share-stat"><div className="share-stat-num">{doneQuests}</div><div className="share-stat-lbl">Quests</div></div>
        <div className="share-stat"><div className="share-stat-num">{totalMins>=60?Math.round(totalMins/60)+"h":totalMins+"m"}</div><div className="share-stat-lbl">Practice</div></div>
        <div className="share-stat"><div className="share-stat-num">{topStreak}</div><div className="share-stat-lbl">Streak</div></div>
      </div>
      {topSkills.length>0&&<div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
        {topSkills.map(s=><span key={s.id} style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"var(--tx3)",border:"1px solid var(--b2)",borderRadius:20,padding:"2px 8px"}}>{s.icon} {s.name}</span>)}
      </div>}
    </div>
    <button className="fsbtn" onClick={copyText}>◈ Copy Progress to Clipboard</button>
  </>);
}

// ─── CUSTOM IMAGES SUPPORT ──────────────────────────────────────────────────
// CustomImageUploader: reusable component for uploading images as base64
export function CustomImageUploader({label,value,onChange,aspectHint}){
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
