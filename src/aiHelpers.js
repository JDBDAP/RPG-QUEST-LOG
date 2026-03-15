// ── GROQ FORMAT CONVERTER ─────────────────────────────────────────────────────
// Groq uses OpenAI format: {type:"function", function:{name, description, parameters}}
// Anthropic uses:          {name, description, input_schema}
// This converts so the same tool definitions work with our /api/chat endpoint
export function toGroqTools(tools){
  return tools.map(t=>({
    type:"function",
    function:{
      name: t.name,
      description: t.description,
      parameters: t.input_schema || {type:"object", properties:{}},
    }
  }));
}

// ── ADVISOR TOOL DEFINITIONS ─────────────────────────────────────────────────
// Returns Anthropic-format tool definitions (converted to Groq via toGroqTools before use)
export function buildAdvisorTools(skills, quests, tasks){
  const sn = skills.map(s=>`${s.id}=${s.name}`).join(",") || "none";
  const qn = (quests||[]).filter(q=>!q.done).map(q=>`${q.id}="${q.title}"[${q.type}]`).join(",") || "none";
  const qnAll = (quests||[]).map(q=>`${q.id}="${q.title}"[${q.type},done:${q.done}]`).join(",") || "none";
  const tn = (tasks||[]).filter(t=>!t.done).map(t=>`${t.id}="${t.title}"[${t.period}]`).join(",") || "none";

  return [
    // ── QUESTS ──
    {
      name: "add_quest",
      description: "Add a new quest. Use 'main' for multi-day goals, 'side' for contained tasks, 'radiant' for repeatable daily habits.",
      input_schema: {type:"object", properties:{
        title:    {type:"string"},
        type:     {type:"string", enum:["main","side","radiant"]},
        skillIds: {type:"array", items:{type:"string"}, description:`Array of skill IDs to link. Available: ${sn}`},
        note:     {type:"string", description:"Intention or description"},
        dueDate:  {type:"string", description:"YYYY-MM-DD"},
        priority: {type:"string", enum:["high","med","low"]},
        xpVal:    {type:"number", description:"XP reward. radiant 20-300, side 200-1500, main 800-60000 (1 level = 6000 XP ≈ 100 hrs)"},
      }, required:["title","type"]},
    },
    {
      name: "update_quest",
      description: `Update an existing quest's title, note, due date, type, skills, or priority. Active quests: ${qn}`,
      input_schema: {type:"object", properties:{
        questId:  {type:"string", description:"ID of quest to update"},
        title:    {type:"string"},
        note:     {type:"string"},
        dueDate:  {type:"string", description:"YYYY-MM-DD"},
        type:     {type:"string", enum:["main","side","radiant"]},
        skillIds: {type:"array", items:{type:"string"}},
        priority: {type:"string", enum:["high","med","low"]},
      }, required:["questId"]},
    },
    {
      name: "delete_quest",
      description: `Delete/remove a quest permanently. All quests: ${qnAll}`,
      input_schema: {type:"object", properties:{
        questId: {type:"string"},
      }, required:["questId"]},
    },
    // ── TASKS ──
    {
      name: "add_task",
      description: "Add a recurring or one-time task to the planner.",
      input_schema: {type:"object", properties:{
        title:   {type:"string"},
        period:  {type:"string", enum:["daily","weekly","monthly"]},
        skillId: {type:"string", description:`Optional skill ID: ${sn}`},
        xpVal:   {type:"number", description:"XP for completion, typically 10-80 for tasks"},
      }, required:["title","period"]},
    },
    {
      name: "delete_task",
      description: `Delete a task from the planner. Active tasks: ${tn}`,
      input_schema: {type:"object", properties:{
        taskId: {type:"string"},
      }, required:["taskId"]},
    },
    // ── SKILLS ──
    {
      name: "add_skill",
      description: "Create a new skill for the user.",
      input_schema: {type:"object", properties:{
        name:     {type:"string"},
        icon:     {type:"string", description:"Single emoji or symbol"},
        category: {type:"string", enum:["body","mind","spirit","craft","social","other"]},
      }, required:["name"]},
    },
    {
      name: "delete_skill",
      description: `Delete a skill and all its XP. Skills: ${sn}`,
      input_schema: {type:"object", properties:{
        skillId: {type:"string"},
      }, required:["skillId"]},
    },
    {
      name: "adjust_skill_xp",
      description: `Manually add or subtract XP from a skill. Use to correct calibration mismatches. 1 level = 6000 XP ≈ 100 genuine hours. Be conservative — only correct obvious gaps. Skills: ${sn}`,
      input_schema: {type:"object", properties:{
        skillId:   {type:"string"},
        xpAmount:  {type:"number", description:"Amount to ADD (negative to subtract)"},
        reason:    {type:"string", description:"Brief explanation for the adjustment"},
      }, required:["skillId","xpAmount"]},
    },
    // ── SESSIONS ──
    {
      name: "log_session",
      description: "Log a practice or work session.",
      input_schema: {type:"object", properties:{
        skillId:     {type:"string", description:`Skill to log against: ${sn}`},
        duration:    {type:"number", description:"Minutes"},
        note:        {type:"string", description:"What happened in this session"},
        backlogDate: {type:"string", description:"YYYY-MM-DD if logging for a past date"},
      }, required:["skillId","duration"]},
    },
  ];
}
