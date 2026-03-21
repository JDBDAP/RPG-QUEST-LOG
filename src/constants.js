import { createContext, useContext } from "react";

// ── FONTS ─────────────────────────────────────────────────────────────────────
export const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;1,300&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;
export const GFONTS_RPG = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cinzel+Decorative:wght@400;700&family=DM+Mono:ital,wght@0,300;0,400;1,300&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;

// ── SETTINGS CONTEXT ──────────────────────────────────────────────────────────
export const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

// ── DEFAULT SETTINGS ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  appName: "",
  profile: { name: "", setup: false, public: false, friendCode: "", digestEnabled: false },
  labels: {
    plannerTab:"Planner", questsTab:"Quests", skillsTab:"Skills",
    practiceTab:"Practice", advisorTab:"Advisor", settingsTab:"Settings", journalTab:"Journal",
    mainQuest:"Main Quest", sideQuest:"Side Quest", radiantQuest:"Radiant Quest",
    mainXp:"2000", sideXp:"500", radiantXp:"80",
    daily:"Daily", weekly:"Weekly", monthly:"Monthly", yearly:"Yearly",
    xpName:"XP", levelName:"LVL", done:"Done", completed:"Completed",
    radiantDesc:"Recurring practices. Embodied, not completed.",
    skillsDesc:"Skills level up as you complete tagged tasks and quests.",
    comboName:"Combo",
  },
  colors: { primary:"#c8a96e", secondary:"#5b9e9e", success:"#6a9e6a", danger:"#a06060" },
  theme:  { bg:"#0c0c0c", s1:"#141414", s2:"#1a1a1a", b1:"#252525", b2:"#333333", tx:"#dedede", tx2:"#999999", tx3:"#555555" },
  xp: { globalPerLevel:6000, skillPerLevel:6000, practicePerMin:1, aiScoring:true },
  fontSize: 14,
  contentWidth: 700,
  uiMode: "rpg",
  compact: false,
  advisorRole: "",
};

// ── THEME & COLOR PRESETS ─────────────────────────────────────────────────────
export const THEME_PRESETS = [
  { name:"Dark",     bg:"#0c0c0c", s1:"#141414", s2:"#1a1a1a", b1:"#252525", b2:"#333333", tx:"#dedede", tx2:"#999999", tx3:"#555555" },
  { name:"Midnight", bg:"#070b14", s1:"#0d1220", s2:"#131929", b1:"#1e2640", b2:"#2d3a58", tx:"#d8e0f0", tx2:"#8896b8", tx3:"#4a5470" },
  { name:"Warm",     bg:"#0f0d0b", s1:"#181410", s2:"#201c16", b1:"#2a2420", b2:"#3d3530", tx:"#e8ddd0", tx2:"#a89888", tx3:"#605548" },
  { name:"Sepia",    bg:"#1a1510", s1:"#221c14", s2:"#2a2318", b1:"#352b20", b2:"#4a3f32", tx:"#f0e8d8", tx2:"#b0a090", tx3:"#706050" },
  { name:"Dim",      bg:"#1a1a1a", s1:"#222222", s2:"#2a2a2a", b1:"#333333", b2:"#444444", tx:"#cccccc", tx2:"#888888", tx3:"#555555" },
  { name:"Forest",   bg:"#0a0f0a", s1:"#111811", s2:"#162016", b1:"#1f2e1f", b2:"#2e402e", tx:"#d8e8d0", tx2:"#88a888", tx3:"#486048" },
  { name:"Light",    bg:"#f5f5f0", s1:"#eeeeea", s2:"#e5e5e0", b1:"#d8d8d3", b2:"#c5c5c0", tx:"#1a1a1a", tx2:"#555555", tx3:"#aaaaaa" },
  { name:"Paper",    bg:"#f8f5ee", s1:"#f0ece2", s2:"#e8e3d6", b1:"#d8d2c2", b2:"#c2bba8", tx:"#2a2520", tx2:"#6a6058", tx3:"#b0a898" },
];

export const PALETTES = [
  { name:"Amber",   primary:"#c8a96e", secondary:"#5b9e9e" },
  { name:"Crimson", primary:"#c86e7a", secondary:"#6e8bc8" },
  { name:"Violet",  primary:"#a06ec8", secondary:"#6ec8a0" },
  { name:"Sage",    primary:"#7aaa7a", secondary:"#aa9a5a" },
  { name:"Steel",   primary:"#7a9ec8", secondary:"#c8a06e" },
  { name:"Rose",    primary:"#c87aaa", secondary:"#7ac8b0" },
  { name:"Copper",  primary:"#c8824e", secondary:"#4ea0c8" },
  { name:"Slate",   primary:"#8898b8", secondary:"#b8a888" },
];

// ── SKILL DISPLAY ─────────────────────────────────────────────────────────────
export const SKILL_ICONS = ["◈","◉","◎","◆","◬","✦","◌","◊","△","○","□","◇","❋","⊕","◐","◑","⬡","✧","⟡","◿"];
export const SKILL_ICONS_EXTRA = ["◈","◉","◎","◆","◬","✦","◌","◊","△","○","□","◇","❋","⊕","◐","◑","⬡","✧","⟡","◿","⚔","🧠","💪","🎯","🎨","📚","🎵","🌱","⚡","🔥","💎","🏆","🎭","🔬","🌟","✍","🎸","🏋","🧘","💻","🗺","🎲","⚙","🛡","🌊","🦾","🧩","🎤","📖","🌙"];

export const SKILL_CATEGORIES = [
  {id:"fitness",     label:"Fitness",      icon:"💪"},
  {id:"creativity",  label:"Creativity",   icon:"✦"},
  {id:"spirituality",label:"Spirituality", icon:"◉"},
  {id:"learning",    label:"Learning",     icon:"◎"},
  {id:"finance",     label:"Finance",      icon:"◆"},
  {id:"social",      label:"Social",       icon:"◈"},
  {id:"productivity",label:"Productivity", icon:"□"},
  {id:"other",       label:"Other",        icon:"◇"},
];

export const SKILL_COLORS = [
  "#6a8fb5","#6a9e6a","#9e6ab5","#c8a96e","#5b9e9e","#b5906a",
  "#9e6a6a","#7a9e6a","#8b6a9e","#9e8b5b","#5b7a9e","#9e7a5b",
  "#7a9e9e","#9e9e5b","#8b5b8b","#b58b6a","#6ab58b","#8b8b5b",
  "#e05555","#e07a30","#e0c030","#55c255","#30b8e0","#7055e0",
  "#e055b8","#e05580","#55e0a0","#55a0e0","#c255e0","#e09030",
  "#ff6b6b","#ffa94d","#ffe066","#69db7c","#4dabf7","#cc5de8",
  "#f783ac","#74c0fc","#63e6be","#a9e34b","#ff8cc6","#f9ca24",
];

// ── SKILL PRESETS ─────────────────────────────────────────────────────────────
export const DEFAULT_PRACTICE_TYPES = [];
export const DEFAULT_SKILLS = [];

export const SKILL_PRESETS = [
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

// ── NAVIGATION & PLANNER ──────────────────────────────────────────────────────
export const PERIODS = ["daily","weekly","monthly","yearly"];
export const WDAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
export const TIME_BLOCKS = [
  {id:"morning",   label:"Morning"},
  {id:"afternoon", label:"Afternoon"},
  {id:"evening",   label:"Evening"},
];

export const COOLDOWN_OPTIONS = [
  {label:"Instant",  ms:0},
  {label:"15 min",   ms:15*60*1000},
  {label:"30 min",   ms:30*60*1000},
  {label:"1 hr",     ms:60*60*1000},
  {label:"2 hr",     ms:2*60*60*1000},
  {label:"4 hr",     ms:4*60*60*1000},
  {label:"6 hr",     ms:6*60*60*1000},
  {label:"8 hr",     ms:8*60*60*1000},
  {label:"12 hr",    ms:12*60*60*1000},
  {label:"24 hr",    ms:24*60*60*1000},
];

export const RADIANT_FREQ_OPTIONS = [
  {id:"daily",    label:"Every day",      cd:24*60*60*1000},
  {id:"weekdays", label:"Weekdays",       cd:24*60*60*1000},
  {id:"weekends", label:"Weekends",       cd:24*60*60*1000},
  {id:"custom",   label:"Custom days",    cd:24*60*60*1000},
  {id:"cooldown", label:"After cooldown", cd:null}, // legacy — uses cooldown field
];

// ── SKILL MILESTONES ──────────────────────────────────────────────────────────
// Fires a special overlay at these skill levels
export const SKILL_MILESTONES = {
  25:  {title:"Dedicated",   sub:"You show up. That's rarer than it sounds.",                                        glyph:"◈", big:false},
  50:  {title:"Invested",    sub:"This is becoming part of who you are.",                                            glyph:"◉", big:false},
  75:  {title:"Experienced", sub:"You know what this practice actually demands.",                                    glyph:"◆", big:false},
  100: {title:"Master",      sub:"10,000 hours is a metaphor. You understand it now. Most people never get here.",  glyph:"✦", big:true},
};

// ── ONBOARDING EXPLAINERS ─────────────────────────────────────────────────────
export const TAB_EXPLAINERS = {
  planner:  {icon:"◎",title:"Planner",  body:"Daily, weekly, and monthly tasks. Tag them to a skill and they feed XP when completed. Switch periods at the top to plan across different time horizons.",          tip:"Start small. One or two tasks per period builds a rhythm faster than a full list."},
  quests:   {icon:"◆",title:"Quests",   body:"Main Quests complete once — goals, milestones. Radiant Quests are recurring practices to embody. Completing a Radiant Quest prompts a practice session log.",        tip:"If it has an end, it's Main. If it's a way of being, it's Radiant."},
  skills:   {icon:"◈",title:"Skills",   body:"The dimensions you're developing — define them yourself. XP flows in from tagged tasks, quests, and sessions. Every 6000 XP is one level, roughly 100 hours at 1 XP/min.",tip:"Use the presets for inspiration, or build from scratch."},
  practice: {icon:"◉",title:"Practice", body:"Log actual sessions. Create your own practice types to match your real vocabulary. Tag skills for XP. Journal entries trigger AI scoring beyond raw time.",             tip:"Consecutive daily sessions build a streak multiplier up to 2×. Honest logging compounds."},
  advisor:  {icon:"✦",title:"Advisor",  body:"An AI that knows your full system — skills, quests, tasks, streaks, history. Ask anything or think out loud. It can create quests and tasks directly from conversation.",tip:"The more you've built in other tabs, the more useful it becomes."},
  settings: {icon:"⚙",title:"Settings", body:"Customize name, font size, theme, colors, XP rates, and tab labels. Changes save immediately. Export full data as JSON for backup.",                                   tip:"Font size S/M/L/XL is at the top of the Profile section."},
};

// ── SUPABASE KEY MAP ───────────────────────────────────────────────────────────
// Maps localStorage cx_ keys → Supabase column names
// KEY_MAP lives in supabase.js — import from there, not here
