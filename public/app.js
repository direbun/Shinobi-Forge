const STORAGE_KEY = "shinobi-forge-character-v1";
let ABILITIES = [];
let CLASS_ASI_LEVELS = [];
let PUPPET_UPGRADE_TIERS = [];
let SUMMON_RANK_ORDER = [];
let STANDARD_ARRAY = [];
let ABILITY_POINT_COSTS = {};
let ABILITY_POINT_BUDGET = 30;
const state = { bootstrap: null, rules: null, character: null, view: null, activeStep: "identity", weaponCategories: new Set() };
const summonFilters = new Map();
const puppetFilters = new Map();
const jutsuFilters = { disciplines: [], elements: [], keywords: [], hijutsu: false, clan: "", clanTouched: false };
let showLockedProficiencyActions = false;
const JUTSU_DISCIPLINES = ["Ninjutsu", "Bukijutsu", "Genjutsu", "Taijutsu"];
const JUTSU_ELEMENTS = ["Fire", "Wind", "Lightning", "Earth", "Water", "None"];
const CAPABILITY_GROUPS = [
  { title: "Basic nature releases", description: "The five foundational chakra natures.", entries: [
    { id: "fire", name: "Fire", glyph: "火", tone: "fire" },
    { id: "wind", name: "Wind", glyph: "風", tone: "wind" },
    { id: "lightning", name: "Lightning", glyph: "雷", tone: "lightning" },
    { id: "earth", name: "Earth", glyph: "土", tone: "earth" },
    { id: "water", name: "Water", glyph: "水", tone: "water" },
  ]},
  { title: "Advanced and spiritual releases", description: "Combined natures, bloodline releases, and spiritual affinities.", entries: [
    { id: "ice", name: "Ice", glyph: "氷", tone: "ice" },
    { id: "lava", name: "Lava", glyph: "溶", tone: "lava" },
    { id: "boil", name: "Boil", glyph: "沸", tone: "boil" },
    { id: "storm", name: "Storm", glyph: "嵐", tone: "storm" },
    { id: "magnet", name: "Magnet", glyph: "磁", tone: "magnet" },
    { id: "scorch", name: "Scorch", glyph: "灼", tone: "scorch" },
    { id: "explosion", name: "Explosion", glyph: "爆", tone: "explosion" },
    { id: "wood", name: "Wood", glyph: "木", tone: "wood" },
    { id: "crystal", name: "Crystal", glyph: "晶", tone: "crystal" },
    { id: "dust", name: "Dust", glyph: "塵", tone: "dust" },
    { id: "yin", name: "Yin", glyph: "陰", tone: "yin" },
    { id: "yang", name: "Yang", glyph: "陽", tone: "yang" },
  ]},
  { title: "Special jutsu access", description: "Track permissions that unlock otherwise restricted techniques.", entries: [
    { id: "medical", name: "Medical", glyph: "医", tone: "medical" },
    { id: "sensory", name: "Sensory", glyph: "感", tone: "sensory" },
    { id: "fuinjutsu", name: "Fuinjutsu", glyph: "封", tone: "fuinjutsu" },
    { id: "hijutsu", name: "Hijutsu", glyph: "秘", tone: "hijutsu" },
  ]},
];
const CAPABILITY_ENTRIES = CAPABILITY_GROUPS.flatMap((group) => group.entries);
const PUPPET_UPGRADE_SUGGESTIONS = ["Armory: Explosive Launcher", "Armory: Hook Shot", "Bulky Build", "Chakra Resonance", "Charismatic Presence", "Countermeasures", "Decoy Mode", "Destructive Habits", "Entrapment Mechanism", "Eye Lights", "Ghillie Coating", "Go-Pro", "Honed Edge", "Jutsu Channeler", "Observant Gaze", "Quickfooted", "Transforming Apparatus", "Warfare Augmentation", "Armory: Fire and Water Blaster", "Armory: Needle Wave", "Chakra Draining Mechanism", "Chakra Regulators", "Chakra Sealing Trap", "Elemental Integration", "Enhanced Durability", "Integrated Sight Mechanism", "Jutsu Specialization", "Long Distance Relationship", "Tag-Team", "Armory: Deafening Speaker", "Armory: Overdrive", "Chakra Cannon", "Deployable Shield", "Expanded Puppetry", "Exploding Puppet Mechanism", "Force of Will", "Hovering Mechanism", "Accumulated Strength", "Armory: Beheader's Blade", "Armory: Mirage Disc"];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let apiMode = "unknown";
let localEnginePromise;

async function getLocalEngine() {
  if (!localEnginePromise) {
    localEnginePromise = Promise.all([
      import("./server/engine.mjs"),
      fetch("./private-data/rules.json", { cache: "no-store" }),
    ]).then(async ([{ createEngine }, response]) => {
      if (!response.ok) throw new Error(`Static rules failed to load (${response.status}).`);
      return createEngine(await response.json());
    });
  }
  return localEnginePromise;
}

async function localApi(path, body = {}) {
  const engine = await getLocalEngine();
  if (path === "/api/v1/bootstrap") return engine.bootstrap();
  if (path === "/api/v1/selection") return engine.selection(body);
  if (path === "/api/v1/jutsu/search") return engine.searchJutsu(body);
  if (path === "/api/v1/equipment/search") return engine.searchEquipment(body);
  if (path === "/api/v1/summon/tribe") {
    const tribe = engine.summonTribe(body.id);
    if (!tribe) throw new Error("The requested summon tribe does not exist.");
    return tribe;
  }
  if (path === "/api/v1/evaluate") return engine.evaluate(body.character || body);
  if (path === "/api/v1/import") return engine.importCharacter(body.character || body);
  if (path === "/api/v1/equipment/purchase") return engine.purchaseEquipment(body.character, String(body.itemId || ""));
  if (path === "/api/v1/jutsu/select") return engine.selectJutsu(body.character, String(body.jutsuId || ""), body.target || {});
  if (path === "/api/v1/export") return engine.exportCharacter(body.character || body);
  throw new Error("Unknown local application route.");
}

async function api(path, body) {
  if (apiMode === "static") return localApi(path, body);
  try {
    const response = await fetch(path, body === undefined ? { cache: "no-store" } : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : {};
    if (!response.ok) {
      if (apiMode === "unknown" && path === "/api/v1/bootstrap" && (response.status === 404 || !contentType.includes("application/json"))) {
        apiMode = "static";
        return localApi(path, body);
      }
      throw new Error(payload.error?.message || `Server request failed (${response.status}).`);
    }
    apiMode = "server";
    return payload;
  } catch (error) {
    if (apiMode === "unknown" && path === "/api/v1/bootstrap") {
      apiMode = "static";
      return localApi(path, body);
    }
    throw error;
  }
}

function clone(value) { return structuredClone(value); }
function emptyCharacter() { return clone(state.bootstrap.emptyCharacter); }
function upsert(collection, record) {
  if (!record) return;
  const index = collection.findIndex((entry) => entry.id === record.id);
  if (index >= 0) collection[index] = record; else collection.push(record);
}

async function ensureWeaponCategory(category) {
  if (!category || state.weaponCategories.has(category)) return;
  const result = await api("/api/v1/equipment/search", { type: "weapon", category, limit: 100 });
  result.items.forEach((entry) => upsert(state.rules.equipment.weapons, entry));
  state.weaponCategories.add(category);
}

async function hydrateSupportData() {
  const cls = find(state.rules.classes, state.character.classId);
  const categories = new Set((cls?.startingEquipment || []).flatMap((group) => group.choices.flatMap(startingWeaponRequirements)));
  await Promise.all([...categories].map(ensureWeaponCategory));
  const tribeIds = [...new Set(state.character.summons.map((summon) => summon.tribeId).filter(Boolean))];
  await Promise.all(tribeIds.map(async (id) => upsert(state.rules.summons.tribes, await api("/api/v1/summon/tribe", { id }))));
}

async function applyEvaluation(result) {
  state.view = result;
  state.character = result.character;
  upsert(state.rules.classes, result.selection.class);
  upsert(state.rules.subclasses, result.selection.subclass);
  upsert(state.rules.clans, result.selection.clan);
  upsert(state.rules.backgrounds, result.selection.background);
  await hydrateSupportData();
}

async function refreshEvaluation() {
  await applyEvaluation(await api("/api/v1/evaluate", { character: state.character }));
}

function abilityBreakdown(_character, ability) { return state.view.derived.abilities[ability].breakdown; }
function abilityModifier(score) {
  const known = Object.values(state.view?.derived?.abilities || {}).find((entry) => entry.score === Number(score));
  return known?.modifier ?? Math.floor((Number(score) - 10) / 2);
}
function activeProficiencyGrants() { return state.view.derived.proficiencyGrants; }
function effectiveSkillDegree(_character, _rules, skillId) { return state.view.derived.skills[skillId]?.degree || 0; }
function grantedToolkits() { return state.view.derived.grantedToolkits; }
function levelTimeline() { return state.view.derived.timeline; }
function masteryRankCap() { return state.view.derived.masteryRankCap; }
function proficiencyBonus() { return state.view.derived.proficiencyBonus; }
function proficiencyDegreeBonus(_level, degree) { return state.view.derived.proficiencyDegreeBonuses[degree] || 0; }
function proficiencyGrantOverlaps() { return state.view.derived.proficiencyOverlaps; }
function puppetAbilityPointPool() { return state.view.derived.puppet.abilityPointPool; }
function puppetAllowedCount() { return state.view.derived.puppet.allowedCount; }
function puppetBaseAbilities(puppet) { return state.view.derived.puppets.find((entry) => entry.id === puppet.id)?.baseAbilities || {}; }
function puppetDerivedStats(puppet) { return state.view.derived.puppets.find((entry) => entry.id === puppet.id) || {}; }
function puppetUpgradeCapacity() { return state.view.derived.puppet.upgradeCapacity; }
function summonDerivedStats(summon) { return state.view.derived.summons.find((entry) => entry.id === summon.id) || {}; }
function validateCharacter() { return state.view.problems; }
function startingWeaponRequirements(choice = "") {
  const requirements = [];
  for (const match of choice.matchAll(/(\d+)\s+(Simple|Martial|Exotic)\s+Weapons?/gi)) for (let index = 0; index < Number(match[1]); index += 1) requirements.push(match[2][0].toUpperCase() + match[2].slice(1).toLowerCase());
  return requirements;
}

function startingToolkitRequirementCount(choice = "") {
  const match = String(choice).match(/(\d+)\s+(?:Tool\s+)?Kits?\s+of\s+your\s+choice/i);
  return match ? Math.min(10, Math.max(0, Number(match[1]) || 0)) : 0;
}

function natureFilterLabel(element) { return element === "None" ? "No Nature" : element; }

function optionMarkup(items, placeholder) {
  return `<option value="">${placeholder}</option>${items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function find(collection, id) { return collection.find((entry) => entry.id === id); }
function signed(value) { return value >= 0 ? `+${value}` : String(value); }
function abilityLabel(ability) { return ability[0].toUpperCase() + ability.slice(1); }
function abilityOptions(placeholder = "Choose ability") { return `<option value="">${placeholder}</option>${ABILITIES.map((ability) => `<option value="${ability}">${abilityLabel(ability)}</option>`).join("")}`; }
function keywordList(value = "") { return value.split(/[,;/]/).map((item) => item.trim().replace(/[.]+$/, "").replace(/\s+/g, " ")).filter(Boolean); }
function featureNeedsChoice(feature) { return /\b(?:choose|select|pick)\s+(?:one|two|three|four|five|a|an|any\s+one|from)\b/i.test(feature?.description || ""); }
function toggleFilter(collection, value) { const index = collection.indexOf(value); if (index >= 0) collection.splice(index, 1); else collection.push(value); }
function progressionChoiceKey(group, level) { return `progression:${group.id}:${level}`; }
function progressionDetailKey(group, level, choiceIndex, optionId, followUpId) { return `progression-detail:${group.id}:${level}:${choiceIndex}:${optionId}:${followUpId}`; }

function progressionSelectionCount(selection) {
  if (!selection.dynamicCountAbility) return Number(selection.count) || 0;
  return Math.max(Number(selection.minimum) || 0, abilityModifier(state.character.abilities?.[selection.dynamicCountAbility]));
}

function progressionOptions(source = {}) {
  if (!source.optionsSource) return source.options || [];
  if (source.optionsSource.type.startsWith("proficient-")) {
    const skills = state.rules.proficiencies.skills.filter((entry) => Number(state.view.derived.skills?.[entry.id]?.degree) > 0).map((entry) => ({ id: `skill:${entry.id}`, name: entry.name, description: "A skill in which this character is proficient.", ...(source.dynamicFollowUp ? { followUps: [source.dynamicFollowUp] } : {}) }));
    const toolkitNames = [...new Set([...(state.view.derived.grantedToolkits || []).map((entry) => entry.name), ...(state.character.proficiencies.toolkits || []).filter((entry) => Number(entry.degree) > 0).map((entry) => entry.name)].filter(Boolean))];
    const tools = toolkitNames.map((name) => ({ id: `tool:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, description: "A toolkit in which this character is proficient." }));
    if (source.optionsSource.type === "proficient-skills") return skills;
    if (source.optionsSource.type === "proficient-tools") return tools;
    return [...skills, ...tools];
  }
  if (source.optionsSource.type !== "known-jutsu") return [];
  const rankOrder = ["E-Rank", "D-Rank", "C-Rank", "B-Rank", "A-Rank", "S-Rank"];
  return (state.character.jutsu || []).map((known) => find(state.rules.jutsu, known.id) || known).filter((entry) => {
    if (source.optionsSource.rank && entry.rank !== source.optionsSource.rank) return false;
    if (source.optionsSource.maxRank && rankOrder.indexOf(entry.rank) > rankOrder.indexOf(source.optionsSource.maxRank)) return false;
    const keywords = keywordList(entry.keywords).map((value) => value.toLowerCase());
    if (source.optionsSource.keyword && entry.keywords && !keywords.includes(source.optionsSource.keyword.toLowerCase())) return false;
    if (source.optionsSource.excludeKeyword && keywords.includes(source.optionsSource.excludeKeyword.toLowerCase())) return false;
    return true;
  }).map((entry) => ({ id: entry.id, name: entry.name, description: `${entry.rank || "Unknown rank"}${entry.keywords ? ` · ${entry.keywords}` : ""}` }));
}

function selectedProgressionValues(group, selection) {
  const raw = state.character.featureChoices[progressionChoiceKey(group, selection.level)];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function progressionOptionUnavailable(option, level = state.character.level) {
  return (option.requiresSubclass && state.view.selection.subclass?.name !== option.requiresSubclass) || (option.forbidsCurrentSubclass && state.view.selection.subclass?.name === option.name) || (option.minLevel && Number(level) < Number(option.minLevel));
}

function progressionFollowUpMarkup(group, selection, choiceIndex, selectedOption, disabled) {
  return (selectedOption.followUps || []).map((followUp) => {
    const detailKey = progressionDetailKey(group, selection.level, choiceIndex, selectedOption.id, followUp.id);
    const raw = state.character.featureChoices[detailKey];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const usedByOtherSelections = new Set();
    for (const otherSelection of group.selections || []) {
      selectedProgressionValues(group, otherSelection).forEach((optionId, otherIndex) => {
        if (optionId !== selectedOption.id || (otherSelection.level === selection.level && otherIndex === choiceIndex)) return;
        const otherKey = progressionDetailKey(group, otherSelection.level, otherIndex, selectedOption.id, followUp.id);
        const otherRaw = state.character.featureChoices[otherKey];
        (Array.isArray(otherRaw) ? otherRaw : otherRaw ? [otherRaw] : []).filter(Boolean).forEach((value) => usedByOtherSelections.add(value));
      });
    }
    const controls = Array.from({ length: followUp.count }, (_, followIndex) => {
      const value = values[followIndex] || "";
      const usedInCurrent = new Set(values.filter((entry, index) => entry && index !== followIndex));
      const options = progressionOptions(followUp).map((entry) => {
        const unavailable = (usedInCurrent.has(entry.id) || usedByOtherSelections.has(entry.id)) && entry.id !== value;
        const suffix = entry.category ? ` — ${entry.category}` : "";
        return `<option value="${escapeHtml(entry.id)}"${entry.id === value ? " selected" : ""}${unavailable ? " disabled" : ""}>${escapeHtml(entry.name + suffix)}</option>`;
      }).join("");
      return `<label><span>${escapeHtml(followUp.label)}${followUp.count > 1 ? ` ${followIndex + 1}` : ""}</span><select data-progression-detail="${encodeURIComponent(detailKey)}" data-progression-detail-index="${followIndex}"${disabled ? " disabled" : ""}><option value="">Choose an option</option>${options}</select></label>`;
    }).join("");
    const selectedDetails = values.map((value) => progressionOptions(followUp).find((entry) => entry.id === value)).filter(Boolean).map((entry) => `<div class="nested-choice-description"><strong>${escapeHtml(entry.name)}</strong>${entry.requirement ? `<span>Requires ${escapeHtml(entry.requirement)}</span>` : ""}<p>${escapeHtml(entry.description || "")}</p></div>`).join("");
    return `<div class="choice-followup"><div class="choice-followup-heading"><span>Next choice</span><strong>${escapeHtml(followUp.label)}</strong></div><div class="guided-choice-fields">${controls}</div>${selectedDetails}</div>`;
  }).join("");
}

function progressionChoiceMarkup(group, selection, disabled = false) {
  const key = progressionChoiceKey(group, selection.level);
  const chosen = selectedProgressionValues(group, selection);
  const selectionCount = progressionSelectionCount(selection);
  const groupOptions = progressionOptions(group);
  const selectors = Array.from({ length: selectionCount }, (_, index) => {
    const value = chosen[index] || "";
    const selectedOption = groupOptions.find((entry) => entry.id === value);
    const alreadyChosen = new Set();
    for (const otherSelection of group.selections || []) selectedProgressionValues(group, otherSelection).forEach((id, otherIndex) => {
      if (otherSelection.level !== selection.level || otherIndex !== index) alreadyChosen.add(id);
    });
    const options = groupOptions.map((entry) => {
      const duplicate = alreadyChosen.has(entry.id) && !entry.allowRepeat && entry.id !== value;
      const unavailable = progressionOptionUnavailable(entry, selection.level);
      const suffix = entry.requiresSubclass ? ` — ${entry.requiresSubclass} only` : entry.minLevel ? ` — level ${entry.minLevel}+` : entry.slotCost > 1 ? ` — ${entry.slotCost} slots` : entry.allowRepeat ? " — repeatable" : "";
      return `<option value="${escapeHtml(entry.id)}"${entry.id === value ? " selected" : ""}${duplicate || unavailable ? " disabled" : ""}>${escapeHtml(entry.name + suffix)}</option>`;
    }).join("");
    const detail = selectedOption ? `<div class="choice-description"><div class="choice-description-heading"><strong>${escapeHtml(selectedOption.name)}</strong><div>${selectedOption.minLevel ? `<span class="choice-tag">Level ${selectedOption.minLevel}+</span>` : ""}${selectedOption.slotCost > 1 ? `<span class="choice-tag">${selectedOption.slotCost} slots</span>` : ""}${selectedOption.allowRepeat ? '<span class="choice-tag">Repeatable</span>' : ""}${selectedOption.requiresSubclass ? `<span class="choice-tag">${escapeHtml(selectedOption.requiresSubclass)}</span>` : ""}</div></div><p>${escapeHtml(selectedOption.description || "Description pending verification.")}</p>${progressionFollowUpMarkup(group, selection, index, selectedOption, disabled)}</div>` : "";
    const placeholder = group.optionsSource && !groupOptions.length ? (group.optionsSource.type === "known-jutsu" ? "Add qualifying jutsu in the Jutsu tab" : "Complete qualifying proficiencies first") : "Choose an option";
    return `<div class="guided-choice-slot"><label><span>${selectionCount > 1 ? `${group.label} ${index + 1}` : group.label}</span><select data-progression-choice="${encodeURIComponent(key)}" data-progression-index="${index}"${disabled ? " disabled" : ""}><option value="">${placeholder}</option>${options}</select></label>${detail}</div>`;
  }).join("");
  const progress = selection.slotBudget ? `${chosen.filter(Boolean).reduce((total, id) => total + Number(groupOptions.find((entry) => entry.id === id)?.slotCost || 1), 0)}/${selection.slotBudget} slots` : `${chosen.filter(Boolean).length}/${selectionCount}`;
  return `<section class="guided-choice${disabled ? " future-choice" : ""}"><header><div><span>${selection.slotBudget ? "Optional slot choices" : "Required choice"} · Level ${selection.level}</span><strong>${escapeHtml(group.featureName)}</strong></div><b>${progress}</b></header><p>${escapeHtml(group.help || "Choose from the options allowed by this feature.")}</p><div class="guided-choice-fields">${selectors}</div></section>`;
}

function bindProgressionChoiceControls(root = document) {
  $$('[data-progression-choice]', root).forEach((control) => control.addEventListener("change", () => {
    const key = decodeURIComponent(control.dataset.progressionChoice);
    const values = Array.isArray(state.character.featureChoices[key]) ? [...state.character.featureChoices[key]] : [];
    const choiceIndex = Number(control.dataset.progressionIndex);
    const oldValue = values[choiceIndex];
    values[choiceIndex] = control.value;
    state.character.featureChoices[key] = values;
    if (oldValue !== control.value) {
      const [, groupId, level] = key.split(":");
      const prefix = `progression-detail:${groupId}:${level}:${choiceIndex}:`;
      for (const detailKey of Object.keys(state.character.featureChoices)) if (detailKey.startsWith(prefix)) delete state.character.featureChoices[detailKey];
    }
    if (key === "progression:hunter-lethal-precision:1") {
      const group = find(state.view.selection.class?.progressionChoices || [], "hunter-lethal-precision");
      state.character.featureChoices["1:Lethal Precision"] = group?.options.find((entry) => entry.id === values[0])?.name || "";
    }
    saveAndRender();
  }));
  $$('[data-progression-detail]', root).forEach((control) => control.addEventListener("change", () => {
    const key = decodeURIComponent(control.dataset.progressionDetail);
    const values = Array.isArray(state.character.featureChoices[key]) ? [...state.character.featureChoices[key]] : [];
    values[Number(control.dataset.progressionDetailIndex)] = control.value;
    state.character.featureChoices[key] = values;
    saveAndRender();
  }));
}

async function loadRules() {
  state.bootstrap = await api("/api/v1/bootstrap");
  ABILITIES = state.bootstrap.constants.abilities;
  CLASS_ASI_LEVELS = state.bootstrap.constants.classAsiLevels;
  PUPPET_UPGRADE_TIERS = state.bootstrap.constants.puppetUpgradeTiers;
  SUMMON_RANK_ORDER = state.bootstrap.constants.summonRanks;
  STANDARD_ARRAY = state.bootstrap.constants.standardArray;
  ABILITY_POINT_COSTS = state.bootstrap.constants.abilityPointCosts;
  ABILITY_POINT_BUDGET = state.bootstrap.constants.abilityPointBudget;
  state.rules = {
    source: state.bootstrap.source,
    classes: state.bootstrap.options.classes,
    subclasses: state.bootstrap.options.subclasses,
    clans: state.bootstrap.options.clans,
    backgrounds: state.bootstrap.options.backgrounds,
    jutsu: [],
    equipment: { weapons: [], armor: [] },
    summons: { tribes: state.bootstrap.options.summonTribes, ...state.bootstrap.summons },
    proficiencies: state.bootstrap.proficiencies,
    trainingOptions: state.bootstrap.trainingOptions,
  };
  const saved = localStorage.getItem(STORAGE_KEY);
  state.character = emptyCharacter();
  if (saved) {
    try { state.character = JSON.parse(saved); } catch { localStorage.removeItem(STORAGE_KEY); }
  }
  await refreshEvaluation();
  initializeControls();
  renderAll();
  $("#save-status").textContent = saved ? "Restored browser draft" : "Draft autosaves locally";
}

function initializeControls() {
  $("#class-select").innerHTML = optionMarkup(state.rules.classes, "Choose class");
  $("#clan-select").innerHTML = optionMarkup(state.rules.clans, "Choose clan");
  $("#background-select").innerHTML = optionMarkup(state.rules.backgrounds, "Choose background");
  const ranks = state.bootstrap.filters.jutsuRanks;
  $("#jutsu-rank").innerHTML += ranks.map((rank) => `<option>${escapeHtml(rank)}</option>`).join("");
  const hijutsuClans = state.bootstrap.filters.hijutsuTraditions;
  $("#jutsu-hijutsu-clan").innerHTML = `<option value="">All Hijutsu traditions</option>${hijutsuClans.map((clan) => `<option>${escapeHtml(clan)}</option>`).join("")}`;
  $("#clan-primary").innerHTML = abilityOptions();
  $("#clan-secondary").innerHTML = abilityOptions();
  $("#background-ability").innerHTML = abilityOptions();
  $("#toolkit-to-add").innerHTML = `<option value="">Choose toolkit</option>${state.rules.trainingOptions.ninjaTools.map((name) => `<option>${escapeHtml(name)}</option>`).join("")}`;
  $("#jutsu-keyword-options").innerHTML = state.bootstrap.filters.jutsuKeywords.map((keyword) => `<label><input type="checkbox" data-jutsu-keyword="${escapeHtml(keyword)}"><span>${escapeHtml(keyword)}</span></label>`).join("");
  $("#summon-tribe").innerHTML = optionMarkup(state.rules.summons.tribes, "Choose summon tribe");
  const puppetTechniques = state.rules.subclasses.filter((entry) => entry.className === "Puppet-Master");
  $("#puppet-technique").innerHTML = `<option value="">Choose puppet technique</option>${puppetTechniques.map((entry) => `<option>${escapeHtml(entry.name.replaceAll("-", " ").replace(" ~ ", " - "))}</option>`).join("")}<option>Custom / archetype</option>`;
  $("#puppet-upgrade-options").innerHTML = PUPPET_UPGRADE_SUGGESTIONS.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  bindEvents();
}

let saveTimer;
function scheduleSave() {
  persistCharacter();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveAndRender, 250);
}

function bindEvents() {
  $$('[data-field]').forEach((control) => control.addEventListener("input", () => {
    const field = control.dataset.field;
    state.character[field] = field === "level" ? Math.min(20, Math.max(1, Number(control.value) || 1)) : control.value;
    if (field === "classId") state.character.subclassId = "";
    scheduleSave();
  }));
  $$('[data-bonus-field]').forEach((control) => control.addEventListener("change", () => {
    state.character.abilityIncreases[control.dataset.bonusField] = control.value;
    scheduleSave();
  }));
  $("#ability-method").addEventListener("change", (event) => {
    const method = event.currentTarget.value;
    state.character.abilityMethod = method;
    if (method === "pointBuy") {
      const scores = ABILITIES.map((ability) => Number(state.character.baseAbilities[ability]));
      const valid = scores.every((score) => Object.hasOwn(ABILITY_POINT_COSTS, score)) && scores.reduce((total, score) => total + ABILITY_POINT_COSTS[score], 0) <= ABILITY_POINT_BUDGET;
      if (!valid) for (const ability of ABILITIES) state.character.baseAbilities[ability] = 8;
    }
    if (method === "standardArray") {
      const scores = ABILITIES.map((ability) => Number(state.character.baseAbilities[ability])).sort((a, b) => b - a);
      if (scores.some((score, index) => score !== STANDARD_ARRAY[index])) ABILITIES.forEach((ability, index) => { state.character.baseAbilities[ability] = STANDARD_ARRAY[index]; });
    }
    saveAndRender();
  });
  $$('[data-level-adjust]').forEach((button) => button.addEventListener("click", () => {
    state.character.level = Math.min(20, Math.max(1, Number(state.character.level) + Number(button.dataset.levelAdjust)));
    saveAndRender();
  }));
  $$('.nav-step').forEach((button) => button.addEventListener("click", () => showStep(button.dataset.step)));
  $$('[data-proficiency-jump]').forEach((button) => button.addEventListener("click", () => {
    document.getElementById(button.dataset.proficiencyJump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  $("#proficiency-search").addEventListener("input", renderProficiencies);
  $("#proficiency-show-locked").addEventListener("click", () => {
    showLockedProficiencyActions = !showLockedProficiencyActions;
    renderProficiencies();
  });
  $("#add-toolkit").addEventListener("click", () => {
    const name = $("#toolkit-to-add").value;
    if (!name || state.character.proficiencies.toolkits.some((entry) => entry.name === name)) return;
    state.character.proficiencies.toolkits.push({ id: crypto.randomUUID(), name, degree: 1, source: "" });
    $("#toolkit-to-add").value = "";
    saveAndRender();
  });
  $("#jutsu-search").addEventListener("input", renderJutsuLibrary);
  $("#jutsu-rank").addEventListener("change", renderJutsuLibrary);
  $$('[data-jutsu-keyword]').forEach((control) => control.addEventListener("change", () => {
    toggleFilter(jutsuFilters.keywords, control.dataset.jutsuKeyword);
    renderJutsuLibrary();
  }));
  $$('[data-jutsu-discipline]').forEach((button) => button.addEventListener("click", () => { toggleFilter(jutsuFilters.disciplines, button.dataset.jutsuDiscipline); renderJutsuLibrary(); }));
  $$('[data-jutsu-element]').forEach((button) => button.addEventListener("click", () => { toggleFilter(jutsuFilters.elements, button.dataset.jutsuElement); renderJutsuLibrary(); }));
  $("#jutsu-hijutsu").addEventListener("click", () => { jutsuFilters.hijutsu = !jutsuFilters.hijutsu; renderJutsuLibrary(); });
  $("#jutsu-hijutsu-clan").addEventListener("change", (event) => { jutsuFilters.clan = event.currentTarget.value; jutsuFilters.clanTouched = true; renderJutsuLibrary(); });
  $("#equipment-search").addEventListener("input", renderEquipmentCatalogue);
  $("#equipment-type").addEventListener("change", (event) => { if (event.currentTarget.value === "armor") $("#weapon-category").value = ""; $("#weapon-category").disabled = event.currentTarget.value === "armor"; renderEquipmentCatalogue(); });
  $("#weapon-category").addEventListener("change", renderEquipmentCatalogue);
  $("#ryo-balance").addEventListener("change", (event) => { state.character.equipment.ryo = Math.max(0, Number(event.currentTarget.value) || 0); saveAndRender(); });
  $("#add-custom-equipment").addEventListener("click", () => {
    state.character.equipment.items.push({ id: crypto.randomUUID(), name: "Custom item", type: "custom", quantity: 1, notes: "", source: "custom" });
    saveAndRender();
  });
  $("#add-summon").addEventListener("click", () => addSummon().catch((error) => showNotice(error.message || "Could not load that summon tribe.", true)));
  $("#add-puppet").addEventListener("click", addPuppet);
  $("#export-json").addEventListener("click", exportCharacter);
  $("#review-export").addEventListener("click", exportCharacter);
  $("#import-json").addEventListener("change", importCharacter);
  $("#new-character").addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (button.dataset.confirmNew !== "true") {
      button.dataset.confirmNew = "true";
      button.textContent = "Click again to reset";
      showNotice("Click the reset button again to replace the current browser draft.");
      setTimeout(() => { button.dataset.confirmNew = ""; button.textContent = "New"; }, 5000);
      return;
    }
    button.dataset.confirmNew = "";
    button.textContent = "New";
    state.character = emptyCharacter();
    saveAndRender();
    showStep("identity");
    showNotice("Started a new character.");
  });
}

function persistCharacter() {
  state.character.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
}

let saveQueue = Promise.resolve();
function saveAndRender() {
  persistCharacter();
  $("#save-status").textContent = "Checking with server…";
  saveQueue = saveQueue.then(async () => {
    await refreshEvaluation();
    persistCharacter();
    renderAll();
    $("#save-status").textContent = `Saved locally ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }).catch((error) => {
    $("#save-status").textContent = "Server validation failed";
    showNotice(error.message || "Could not validate this change.", true);
  });
  return saveQueue;
}

function showStep(step) {
  state.activeStep = step;
  $$('.nav-step').forEach((button) => button.classList.toggle("active", button.dataset.step === step));
  $$('.step-panel').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === step));
  const titles = { identity:["Shape your shinobi","Start with the person behind the techniques."], build:["Choose the path","Build the class one level at a time and resolve each unlocked choice."], abilities:["Set the foundations","Record the six scores and see their modifiers."], proficiencies:["Know your capabilities","Training determines both your bonus and the skill actions available to you."], jutsu:["Build the arsenal","Search the complete sheet catalogue and track when each jutsu was learned."], equipment:["Pack for the mission","Resolve starting choices and maintain a usable inventory."], summons:["Call trusted allies","Build a roster of creatures bound to your shinobi."], puppets:["Engineer the arsenal","Craft Puppet Tools with their own chassis, upgrades, seals, weapons, and techniques."], timeline:["See every level","Inspect your current build and every future feature through level 20."], review:["Ready to share","Validate the build and export a portable character file."] };
  $("#page-title").textContent = titles[step][0];
  $("#page-subtitle").textContent = titles[step][1];
  const steps = $$('.nav-step');
  const position = Math.max(0, steps.findIndex((button) => button.dataset.step === step));
  $("#builder-progress-label").textContent = `Step ${position + 1} of ${steps.length}`;
  $("#builder-progress-fill").style.width = `${((position + 1) / steps.length) * 100}%`;
  renderStep(step);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStep(step) {
  if (!state.view) return;
  if (step === "jutsu") { renderJutsuCastingStats(); renderJutsuLibrary(); renderSelectedJutsu(); }
  if (step === "equipment") { renderEquipment(); renderEquipmentCatalogue(); }
  if (step === "summons") renderSummons();
  if (step === "puppets") renderPuppets();
  if (step === "timeline") renderTimeline();
  if (step === "review") renderReview();
}

function renderAbilityBuilder() {
  const method = state.character.abilityMethod || "manual";
  $("#ability-method").value = method;
  const methodCopy = {
    manual: ["Manual entry", "Enter any GM-approved starting scores from 1 to 30."],
    pointBuy: ["Naruto 5e Point Buy", `Spend up to ${ABILITY_POINT_BUDGET} points. Scores range from 8 to 15 before bonuses.`],
    standardArray: ["Naruto 5e Standard Array", `Assign ${STANDARD_ARRAY.join(", ")} exactly once each. Choosing an assigned score swaps the two abilities.`],
  }[method];
  $("#ability-method-title").textContent = methodCopy[0];
  $("#ability-method-help").textContent = methodCopy[1];
  const spent = ABILITIES.reduce((total, ability) => total + (ABILITY_POINT_COSTS[state.character.baseAbilities[ability]] ?? 0), 0);
  const remaining = ABILITY_POINT_BUDGET - spent;
  $("#ability-method-status").classList.toggle("invalid", method === "pointBuy" && remaining < 0);
  $("#ability-method-status").innerHTML = method === "pointBuy"
    ? `<span>Points remaining</span><strong>${remaining}</strong><small>${spent} of ${ABILITY_POINT_BUDGET} spent</small>`
    : method === "standardArray" ? `<span>Array</span><strong>${STANDARD_ARRAY.join(" · ")}</strong><small>Each value can be assigned once.</small>`
      : `<span>Method</span><strong>GM approved</strong><small>No automatic budget restriction.</small>`;
  $("#ability-grid").innerHTML = ABILITIES.map((ability) => {
    const current = Number(state.character.baseAbilities[ability]);
    let scoreControl;
    if (method === "pointBuy") {
      const availableForAbility = ABILITY_POINT_BUDGET - (spent - (ABILITY_POINT_COSTS[current] ?? 0));
      scoreControl = `<select id="ability-${ability}" data-ability="${ability}">${Object.entries(ABILITY_POINT_COSTS).map(([score, cost]) => `<option value="${score}"${current === Number(score) ? " selected" : ""}${Number(cost) > availableForAbility && current !== Number(score) ? " disabled" : ""}>${score} — ${cost} point${Number(cost) === 1 ? "" : "s"}</option>`).join("")}</select>`;
    } else if (method === "standardArray") {
      scoreControl = `<select id="ability-${ability}" data-ability="${ability}">${STANDARD_ARRAY.map((score) => `<option value="${score}"${current === score ? " selected" : ""}>${score}</option>`).join("")}</select>`;
    } else scoreControl = `<input id="ability-${ability}" type="number" min="1" max="30" value="${current}" data-ability="${ability}">`;
    return `<div class="ability-card"><label for="ability-${ability}">${abilityLabel(ability)} starting score</label><div class="ability-row">${scoreControl}<div><span class="final-score" data-final-score="${ability}">10</span><span class="modifier" data-modifier="${ability}">+0</span></div></div><div class="score-ledger" data-score-ledger="${ability}"></div><label class="manual-bonus">Other / feat adjustment<input type="number" min="-10" max="10" value="${state.character.abilityIncreases.manual[ability] || 0}" data-manual-ability="${ability}"></label></div>`;
  }).join("");
  $$('[data-ability]').forEach((control) => control.addEventListener(method === "manual" ? "input" : "change", () => {
    const fallback = method === "pointBuy" ? 8 : 10;
    const ability = control.dataset.ability;
    const previous = Number(state.character.baseAbilities[ability]);
    const next = Math.min(30, Math.max(1, Number(control.value) || fallback));
    if (method === "standardArray") {
      const swapAbility = ABILITIES.find((other) => other !== ability && Number(state.character.baseAbilities[other]) === next);
      if (swapAbility) state.character.baseAbilities[swapAbility] = previous;
    }
    state.character.baseAbilities[ability] = next;
    scheduleSave();
  }));
  $$('[data-manual-ability]').forEach((control) => control.addEventListener("input", () => {
    state.character.abilityIncreases.manual[control.dataset.manualAbility] = Math.min(10, Math.max(-10, Number(control.value) || 0));
    scheduleSave();
  }));
}

function renderAll() {
  if (!state.rules) return;
  $$('[data-field]').forEach((control) => { control.value = state.character[control.dataset.field] ?? ""; });
  $$('[data-bonus-field]').forEach((control) => { control.value = state.character.abilityIncreases[control.dataset.bonusField] ?? ""; });
  renderAbilityBuilder();
  const cls = find(state.rules.classes, state.character.classId);
  const clan = find(state.rules.clans, state.character.clanId);
  if (!jutsuFilters.clanTouched && clan?.name && [...$("#jutsu-hijutsu-clan").options].some((option) => option.value === clan.name)) jutsuFilters.clan = clan.name;
  $("#sidebar-name").textContent = state.character.name || "Unnamed shinobi";
  $("#badge-initial").textContent = (state.character.name.trim()[0] || "?").toUpperCase();
  $("#sidebar-build").textContent = [clan?.name, cls?.name].filter(Boolean).join(" · ") || "Choose a clan and class";
  $("#sidebar-level").textContent = state.character.level;
  $("#build-level-display").textContent = state.character.level;
  $("#level-value").textContent = state.character.level;
  $("#proficiency-value").textContent = signed(proficiencyBonus(state.character.level));
  $("#jutsu-count").textContent = state.character.jutsu.length;
  $("#source-pill").textContent = `Sheet ${state.rules.source.sheetVersion || "export"} · ${state.bootstrap.counts.jutsu.toLocaleString()} jutsu`;
  renderAbilitySources();
  ABILITIES.forEach((ability) => {
    const breakdown = abilityBreakdown(state.character, ability);
    const score = state.character.abilities[ability];
    $(`[data-final-score="${ability}"]`).textContent = score;
    $(`[data-modifier="${ability}"]`).textContent = signed(abilityModifier(score));
    const sources = [["Base", breakdown.base], ["Clan", breakdown.clan], ["Background", breakdown.background], ["Class", breakdown.class], ["Other", breakdown.manual]].filter(([, value], index) => index === 0 || value !== 0);
    $(`[data-score-ledger="${ability}"]`).innerHTML = sources.map(([name, value]) => `<span>${name} <strong>${name === "Base" ? value : signed(value)}</strong></span>`).join("");
  });
  renderSubclassOptions();
  renderBuildSummary();
  renderProficiencies();
  renderStep(state.activeStep);
}

function proficiencyDegreeOptions(selectedDegree, minimumDegree = 0) {
  return state.rules.proficiencies.degrees.map((degree) => `<option value="${degree.value}"${Number(selectedDegree) === degree.value ? " selected" : ""}${degree.value < minimumDegree ? " disabled" : ""}>${escapeHtml(degree.name)} · ${escapeHtml(degree.rank)}${degree.masteryBonus ? ` (+${degree.masteryBonus} mastery)` : ""}</option>`).join("");
}

function renderProficiencies() {
  const rules = state.rules.proficiencies;
  if (!rules) return;
  const skills = state.character.proficiencies.skills;
  const automaticSources = activeProficiencyGrants(state.character, state.rules);
  const cap = masteryRankCap(state.character.level);
  const trainedCount = rules.skills.filter((skill) => effectiveSkillDegree(state.character, state.rules, skill.id) >= 1).length;
  const masteredCount = rules.skills.filter((skill) => effectiveSkillDegree(state.character, state.rules, skill.id) >= 2).length;
  $("#proficiency-summary").innerHTML = `<div><span>Proficiency bonus</span><strong>${signed(proficiencyBonus(state.character.level))}</strong></div><div><span>Current mastery limit</span><strong>Mastery ${cap}</strong><small>${cap === 1 ? "Chunin" : cap === 2 ? "Jonin" : "Sannin / Kage"}</small></div><div><span>Skill training</span><strong>${trainedCount} proficient · ${masteredCount} mastered</strong></div>`;
  renderProficiencyGrantGuide();
  renderCapabilityTraining();
  const lockedButton = $("#proficiency-show-locked");
  lockedButton.textContent = showLockedProficiencyActions ? "Hide locked actions" : "Show locked actions";
  lockedButton.setAttribute("aria-pressed", String(showLockedProficiencyActions));
  const query = $("#proficiency-search").value.trim().toLowerCase();
  const filtered = rules.skills.filter((skill) => !query || `${skill.name} ${skill.ability} ${skill.actions.map((action) => `${action.name} ${action.summary}`).join(" ")}`.toLowerCase().includes(query));
  $("#proficiency-grid").innerHTML = filtered.map((skill) => {
    const entry = skills[skill.id] || { degree: 0, source: "" };
    const degree = effectiveSkillDegree(state.character, state.rules, skill.id);
    const totalBonus = abilityModifier(state.character.abilities[skill.ability]) + proficiencyDegreeBonus(state.character.level, degree);
    const actions = skill.actions.filter((action) => showLockedProficiencyActions || action.degree <= degree);
    const actionMarkup = actions.length ? actions.map((action) => {
      const actionDegree = rules.degrees.find((item) => item.value === action.degree);
      const locked = action.degree > degree;
      return `<li class="proficiency-action${locked ? " locked" : ""}"><div><strong>${escapeHtml(action.name)}</strong><span class="proficiency-tier">${escapeHtml(actionDegree?.name || "Not Proficient")}</span>${locked ? '<span class="locked-label">Locked</span>' : ""}</div><p>${escapeHtml(action.summary)}</p></li>`;
    }).join("") : `<li class="proficiency-empty">${skill.actions.length ? "No currently available special actions." : "The core rules list no dedicated Skill-Based Actions for this skill."}</li>`;
    const overCap = Math.max(0, degree - 1) > cap;
    const sourceTags = (automaticSources[skill.id] || []).map((source) => `<span class="grant-source-tag">${escapeHtml(source)}</span>`).join("");
    return `<article class="proficiency-card${overCap ? " over-cap" : ""}"><header><div><h4>${escapeHtml(skill.name)}</h4><span>${escapeHtml(abilityLabel(skill.ability))}</span></div><div class="skill-numbers"><strong>${signed(totalBonus)}</strong><small>Passive ${10 + totalBonus}</small></div></header>${sourceTags ? `<div class="grant-source-list">${sourceTags}</div>` : ""}<div class="proficiency-controls"><label>Training degree<select data-skill-degree="${skill.id}">${proficiencyDegreeOptions(degree, sourceTags ? 1 : 0)}</select></label><label>Additional source<input data-skill-source="${skill.id}" value="${escapeHtml(entry.source)}" placeholder="Feat, training, item…"></label></div>${overCap ? `<p class="cap-warning">Above the Mastery ${cap} limit for level ${state.character.level}.</p>` : ""}<ul class="proficiency-actions">${actionMarkup}</ul></article>`;
  }).join("") || '<p class="muted-copy">No skills or actions match that search.</p>';
  $$('[data-skill-degree]').forEach((control) => control.addEventListener("change", () => {
    const current = skills[control.dataset.skillDegree] || { source: "" };
    skills[control.dataset.skillDegree] = { ...current, degree: Number(control.value) || 0 };
    saveAndRender();
  }));
  $$('[data-skill-source]').forEach((control) => control.addEventListener("change", () => {
    const current = skills[control.dataset.skillSource] || { degree: 0 };
    skills[control.dataset.skillSource] = { ...current, source: control.value };
    saveAndRender();
  }));
  renderToolkits();
}

function capabilityStatus(capability) {
  return state.view.derived.capabilities.find((entry) => entry.id === capability.id) || { enabled: false, source: "", automatic: [] };
}

function renderCapabilityTraining() {
  const cls = find(state.rules.classes, state.character.classId);
  const training = cls?.combatProficiencies;
  const extras = state.character.capabilities.trainingExtras;
  const selections = state.character.capabilities.trainingSelections;
  const trainingTypes = [
    ["armor", "Armor", "Protection the class is trained to wear"],
    ["weapons", "Weapons", "Weapon groups and specific weapons"],
    ["ninjaTools", "Ninja tools", "Kits and specialized shinobi tools"],
    ["savingThrows", "Saving throws", "Class saving throw proficiencies"],
  ];
  const trainingCards = trainingTypes.map(([key, label, description]) => {
    const values = training?.[key] || [];
    const manual = selections[key] || [];
    const available = (state.rules.trainingOptions[key] || []).filter((value) => !values.includes(value) && !manual.includes(value));
    const chips = [
      ...values.map((value) => `<strong>${escapeHtml(value)}<em>Class</em></strong>`),
      ...manual.map((value, index) => `<strong>${escapeHtml(value)}<em>Added</em><button type="button" data-remove-training="${key}:${index}" aria-label="Remove ${escapeHtml(value)}">×</button></strong>`),
    ].join("");
    return `<article class="training-card"><header><span>${escapeHtml(label)}</span><small>${escapeHtml(description)}</small></header><div class="training-chip-list">${chips || `<span class="training-none">${training ? "None granted" : "Class source unavailable"}</span>`}</div><div class="training-adder"><select data-training-select="${key}" aria-label="Add ${escapeHtml(label.toLowerCase())}"><option value="">Choose ${escapeHtml(label.toLowerCase())}</option>${available.map((value) => `<option>${escapeHtml(value)}</option>`).join("")}</select><button type="button" class="button ghost" data-add-training="${key}">Add</button></div><label>Why does the character have the added training?<input data-training-extra="${key}" value="${escapeHtml(extras[key] || "")}" placeholder="Feat, clan feature, downtime training…"></label></article>`;
  }).join("");
  const releaseGroups = CAPABILITY_GROUPS.map((group) => `<section class="release-group"><div class="release-group-heading"><div><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(group.description)}</small></div></div><div class="release-grid">${group.entries.map((capability) => {
    const status = capabilityStatus(capability);
    return `<article class="release-tile ${capability.tone}${status.enabled ? " selected" : ""}"><button type="button" data-capability-toggle="${capability.id}" aria-pressed="${status.enabled}"><span class="release-glyph">${capability.glyph}</span><span class="release-name">${escapeHtml(capability.name)}</span><span class="release-check">${status.enabled ? "✓ Known" : "+ Add"}</span></button>${status.enabled ? `<div class="release-source">${status.automatic.map((source) => `<span>${escapeHtml(source)}</span>`).join("")}<label>Other source<input data-capability-source="${capability.id}" value="${escapeHtml(status.source)}" placeholder="Feat, training, story…"></label></div>` : ""}</article>`;
  }).join("")}</div></section>`).join("");
  const custom = state.character.capabilities.custom.map((entry, index) => `<div class="custom-release-row"><input data-custom-capability-name="${index}" value="${escapeHtml(entry.name)}" placeholder="Custom release or access"><input data-custom-capability-source="${index}" value="${escapeHtml(entry.source)}" placeholder="Source"><button type="button" class="icon-button" data-remove-custom-capability="${index}" aria-label="Remove ${escapeHtml(entry.name || "custom capability")}">×</button></div>`).join("");
  $("#capability-training-panel").innerHTML = `<section id="class-training" class="training-panel"><div class="section-lead"><div><span>Class training</span><h4>${escapeHtml(cls?.name || "Choose a class")}</h4></div><p>Class proficiencies are shown automatically. Use the additional fields for feats, clans, equipment, or campaign rewards.</p></div><div class="training-grid">${trainingCards}</div></section><section id="releases-access" class="release-panel"><div class="section-lead"><div><span>Chakra capabilities</span><h4>Releases and special access</h4></div><p>Click a tile to add or remove access. Automatic source suggestions remain visible, and manual sources travel with the JSON.</p></div>${releaseGroups}<div class="custom-release-section"><div class="source-heading"><div><strong>Custom releases and permissions</strong><small>For campaign-specific kekkei genkai, learned traditions, or unusual permissions.</small></div><button type="button" id="add-custom-capability" class="button ghost">Add custom</button></div><div class="custom-release-list">${custom || '<p class="muted-copy">No custom capabilities recorded.</p>'}</div></div></section>`;
  $$('[data-training-extra]').forEach((control) => {
    control.addEventListener("input", () => { extras[control.dataset.trainingExtra] = control.value; persistCharacter(); });
    control.addEventListener("change", saveAndRender);
  });
  $$('[data-add-training]').forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.addTraining;
    const select = $(`[data-training-select="${key}"]`);
    if (!select.value || selections[key].includes(select.value)) return;
    selections[key].push(select.value);
    saveAndRender();
  }));
  $$('[data-remove-training]').forEach((button) => button.addEventListener("click", () => {
    const [key, index] = button.dataset.removeTraining.split(":");
    selections[key].splice(Number(index), 1);
    saveAndRender();
  }));
  $$('[data-capability-toggle]').forEach((button) => button.addEventListener("click", () => {
    const capability = CAPABILITY_ENTRIES.find((entry) => entry.id === button.dataset.capabilityToggle);
    const status = capabilityStatus(capability);
    const current = state.character.capabilities.entries[capability.id] || { source: "" };
    state.character.capabilities.entries[capability.id] = { ...current, enabled: !status.enabled };
    saveAndRender();
  }));
  $$('[data-capability-source]').forEach((control) => {
    const updateSource = () => {
      const id = control.dataset.capabilitySource;
      const current = state.character.capabilities.entries[id] || { enabled: true };
      state.character.capabilities.entries[id] = { ...current, source: control.value };
    };
    control.addEventListener("input", () => { updateSource(); persistCharacter(); });
    control.addEventListener("change", () => { updateSource(); saveAndRender(); });
  });
  $("#add-custom-capability").addEventListener("click", () => { state.character.capabilities.custom.push({ id: crypto.randomUUID(), name: "", source: "" }); saveAndRender(); });
  $$('[data-custom-capability-name]').forEach((control) => {
    control.addEventListener("input", () => { state.character.capabilities.custom[Number(control.dataset.customCapabilityName)].name = control.value; persistCharacter(); });
    control.addEventListener("change", saveAndRender);
  });
  $$('[data-custom-capability-source]').forEach((control) => {
    control.addEventListener("input", () => { state.character.capabilities.custom[Number(control.dataset.customCapabilitySource)].source = control.value; persistCharacter(); });
    control.addEventListener("change", saveAndRender);
  });
  $$('[data-remove-custom-capability]').forEach((button) => button.addEventListener("click", () => { state.character.capabilities.custom.splice(Number(button.dataset.removeCustomCapability), 1); saveAndRender(); }));
}

function renderProficiencyGrantGuide() {
  const cls = find(state.rules.classes, state.character.classId);
  const background = find(state.rules.backgrounds, state.character.backgroundId);
  const skillMap = new Map(state.rules.proficiencies.skills.map((skill) => [skill.id, skill.name]));
  const choices = state.character.proficiencies.grantChoices;
  const renderGroups = (groups = []) => groups.map((group) => {
    if (group.fixed) return `<div class="grant-row"><span>${escapeHtml(group.label)}</span><div class="grant-pills">${group.options.map((id) => `<strong>${escapeHtml(skillMap.get(id) || id)}</strong>`).join("")}</div></div>`;
    const selected = choices[group.id] || [];
    const selectors = Array.from({ length: group.count }, (_, index) => `<label>Choice ${index + 1}<select data-grant-choice="${group.id}:${index}"><option value="">Choose skill</option>${group.options.map((id) => `<option value="${id}"${selected[index] === id ? " selected" : ""}${selected.includes(id) && selected[index] !== id ? " disabled" : ""}>${escapeHtml(skillMap.get(id) || id)}</option>`).join("")}</select></label>`).join("");
    return `<div class="grant-row"><span>${escapeHtml(group.label)}</span><div class="grant-selectors">${selectors}</div></div>`;
  }).join("");
  const sourceCard = (kind, source, groups, supported) => `<section class="grant-card"><header><span>${kind}</span><strong>${escapeHtml(source?.name || `Choose a ${kind.toLowerCase()}`)}</strong></header>${source ? (supported ? renderGroups(groups) : `<p class="grant-unavailable">This source is listed in the sheet, but its proficiency text is not structured yet. Record its grants manually below.</p>`) : `<p class="grant-unavailable">Select a ${kind.toLowerCase()} to see its skill grants.</p>`}</section>`;
  const bgGrants = background?.proficiencyGrants;
  let toolkitMarkup = "";
  if (bgGrants?.toolkits?.length) toolkitMarkup = `<div class="grant-row"><span>Granted toolkit</span><div class="grant-pills">${bgGrants.toolkits.map((name) => `<strong>${escapeHtml(name)}</strong>`).join("")}</div></div>`;
  if (bgGrants?.toolkitOptions) {
    const key = `background-toolkit-${background.id}`;
    toolkitMarkup = `<div class="grant-row"><span>Choose toolkit</span><div class="grant-selectors"><label>Background toolkit<select data-grant-toolkit="${key}"><option value="">Choose toolkit</option>${bgGrants.toolkitOptions.map((name) => `<option${choices[key]?.[0] === name ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label></div></div>`;
  } else if (bgGrants?.toolkitChoice) {
    const key = `background-toolkit-${background.id}`;
    toolkitMarkup = `<div class="grant-row"><span>Toolkit of your choice</span><div class="grant-selectors"><label>Background toolkit<select data-grant-toolkit="${key}"><option value="">Choose toolkit</option>${state.rules.trainingOptions.ninjaTools.map((name) => `<option${choices[key]?.[0] === name ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label></div></div>`;
  }
  const overlaps = proficiencyGrantOverlaps(state.character, state.rules);
  const grantedIds = new Set(Object.keys(activeProficiencyGrants(state.character, state.rules)));
  const overlapMarkup = overlaps.map((overlap) => `<div class="overlap-choice"><p><strong>${escapeHtml(skillMap.get(overlap.skillId) || overlap.skillId)}</strong> is granted twice. Choose a different skill for ${escapeHtml(overlap.source)}.</p><select data-overlap-choice="${overlap.key}"><option value="">Choose replacement skill</option>${state.rules.proficiencies.skills.map((skill) => `<option value="${skill.id}"${choices[overlap.key]?.[0] === skill.id ? " selected" : ""}${(skill.id === overlap.skillId || (grantedIds.has(skill.id) && choices[overlap.key]?.[0] !== skill.id)) ? " disabled" : ""}>${escapeHtml(skill.name)}</option>`).join("")}</select></div>`).join("");
  $("#proficiency-grant-guide").innerHTML = `<div class="grant-guide-heading"><div><span>Starting proficiency guide</span><strong>Class and background training</strong></div><p>Fixed skills apply automatically. Complete each open choice before exporting.</p></div><div class="grant-card-grid">${sourceCard("Class", cls, cls?.skillGrants || [], Boolean(cls?.skillGrants?.length))}${sourceCard("Background", background, bgGrants?.skills || [], Boolean(bgGrants))}</div>${bgGrants ? `<section class="grant-card compact"><header><span>Background</span><strong>Toolkit training</strong></header>${toolkitMarkup || '<p class="grant-unavailable">This background does not list a toolkit grant.</p>'}</section>` : ""}${overlapMarkup ? `<div class="overlap-panel"><strong>Duplicate proficiency replacement</strong>${overlapMarkup}</div>` : ""}`;
  $$('[data-grant-choice]').forEach((control) => control.addEventListener("change", () => {
    const [groupId, indexText] = control.dataset.grantChoice.split(":");
    const values = choices[groupId] || [];
    values[Number(indexText)] = control.value;
    choices[groupId] = values;
    saveAndRender();
  }));
  $$('[data-grant-toolkit]').forEach((control) => control.addEventListener("change", () => { choices[control.dataset.grantToolkit] = [control.value]; saveAndRender(); }));
  $$('[data-overlap-choice]').forEach((control) => control.addEventListener("change", () => { choices[control.dataset.overlapChoice] = [control.value]; saveAndRender(); }));
}

function renderToolkits() {
  const toolkits = state.character.proficiencies.toolkits;
  const automatic = grantedToolkits(state.character, state.rules).map((toolkit) => `<div class="toolkit-row automatic"><div><span>Toolkit</span><strong>${escapeHtml(toolkit.name)}</strong></div><div><span>Training degree</span><strong>Proficient</strong></div><div><span>Source</span><strong>${escapeHtml(toolkit.source)}</strong></div><div class="toolkit-bonus"><span>Training bonus</span><strong>${signed(proficiencyDegreeBonus(state.character.level, 1))}</strong></div></div>`).join("");
  const manual = toolkits.length ? toolkits.map((toolkit, index) => {
    const degreeBonus = proficiencyDegreeBonus(state.character.level, toolkit.degree);
    const overCap = Math.max(0, Number(toolkit.degree) - 1) > masteryRankCap(state.character.level);
    return `<div class="toolkit-row${overCap ? " over-cap" : ""}"><div><span>Toolkit</span><strong>${escapeHtml(toolkit.name)}</strong></div><label>Training degree<select data-toolkit-degree="${index}">${proficiencyDegreeOptions(toolkit.degree)}</select></label><label>Why do you have it?<input data-toolkit-source="${index}" value="${escapeHtml(toolkit.source)}" placeholder="Class, background, feat…"></label><div class="toolkit-bonus"><span>Training bonus</span><strong>${signed(degreeBonus)}</strong></div><button type="button" class="icon-button" data-remove-toolkit="${index}" aria-label="Remove toolkit">×</button></div>`;
  }).join("") : "";
  $("#toolkit-list").innerHTML = automatic + manual || '<p class="muted-copy">No toolkit proficiencies recorded.</p>';
  $$('[data-toolkit-degree]').forEach((control) => control.addEventListener("change", () => { toolkits[Number(control.dataset.toolkitDegree)].degree = Number(control.value) || 0; saveAndRender(); }));
  $$('[data-toolkit-source]').forEach((control) => control.addEventListener("change", () => { toolkits[Number(control.dataset.toolkitSource)].source = control.value; saveAndRender(); }));
  $$('[data-remove-toolkit]').forEach((button) => button.addEventListener("click", () => { toolkits.splice(Number(button.dataset.removeToolkit), 1); saveAndRender(); }));
}

function renderEquipment() {
  const cls = find(state.rules.classes, state.character.classId);
  const groups = cls?.startingEquipment || [];
  $("#ryo-balance").value = state.character.equipment.ryo;
  $("#starting-equipment").innerHTML = groups.length ? groups.map((group, index) => {
    const choice = state.character.equipment.startingChoices[group.id] || "";
    const requirements = startingWeaponRequirements(choice);
    const toolkitCount = startingToolkitRequirementCount(choice);
    const details = state.character.equipment.startingDetails[group.id] || [];
    const weaponChoices = requirements.map((category, detailIndex) => {
      const weapons = state.rules.equipment.weapons.filter((weapon) => weapon.category === category && !/\(Two Hands\)$/i.test(weapon.name));
      return `<label class="nested-choice"><span>${category} weapon ${requirements.filter((item) => item === category).length > 1 ? detailIndex + 1 : ""}</span><select data-starting-detail="${group.id}:${detailIndex}"><option value="">Choose ${category.toLowerCase()} weapon</option>${weapons.map((weapon) => `<option value="${weapon.id}">${escapeHtml(weapon.name)}</option>`).join("")}</select></label>`;
    }).join("");
    const toolkitChoices = Array.from({ length: toolkitCount }, (_, toolkitIndex) => {
      const detailIndex = requirements.length + toolkitIndex;
      return `<label class="nested-choice"><span>Toolkit ${toolkitIndex + 1}</span><select data-starting-toolkit="${group.id}:${detailIndex}"><option value="">Choose toolkit</option>${state.rules.trainingOptions.ninjaTools.map((name) => `<option${details[detailIndex] === name ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label>`;
    }).join("");
    const nested = weaponChoices + toolkitChoices;
    return `<div class="starting-choice"><label><span>Package ${index + 1}</span><select data-starting-group="${group.id}"><option value="">Choose one</option>${group.choices.map((entry) => `<option${entry === choice ? " selected" : ""}>${escapeHtml(entry)}</option>`).join("")}</select></label>${nested}</div>`;
  }).join("") : "<p class=\"muted-copy\">Choose a supported class to see its starting package.</p>";
  $$('[data-starting-group]').forEach((control) => {
    control.value = state.character.equipment.startingChoices[control.dataset.startingGroup] || "";
    control.addEventListener("change", () => { state.character.equipment.startingChoices[control.dataset.startingGroup] = control.value; state.character.equipment.startingDetails[control.dataset.startingGroup] = []; saveAndRender(); });
  });
  $$('[data-starting-detail]').forEach((control) => {
    const [groupId, detailIndex] = control.dataset.startingDetail.split(":");
    control.value = state.character.equipment.startingDetails[groupId]?.[Number(detailIndex)] || "";
    control.addEventListener("change", () => { const details = state.character.equipment.startingDetails[groupId] || []; details[Number(detailIndex)] = control.value; state.character.equipment.startingDetails[groupId] = details; saveAndRender(); });
  });
  $$('[data-starting-toolkit]').forEach((control) => {
    const [groupId, detailIndex] = control.dataset.startingToolkit.split(":");
    control.addEventListener("change", () => { const details = state.character.equipment.startingDetails[groupId] || []; details[Number(detailIndex)] = control.value.trim(); state.character.equipment.startingDetails[groupId] = details; saveAndRender(); });
  });
  const selectedStarting = groups.map((group) => {
    const choice = state.character.equipment.startingChoices[group.id];
    if (!choice) return null;
    const requirements = startingWeaponRequirements(choice);
    const toolkitCount = startingToolkitRequirementCount(choice);
    const details = state.character.equipment.startingDetails[group.id] || [];
    const resolvedWeapons = details.slice(0, requirements.length).map((id) => find(state.rules.equipment.weapons, id)?.name).filter(Boolean);
    const resolvedToolkits = details.slice(requirements.length, requirements.length + toolkitCount).map((name) => String(name || "").trim()).filter(Boolean);
    const resolved = [...resolvedWeapons, ...resolvedToolkits];
    return { name: (requirements.length || toolkitCount) && resolved.length ? resolved.join(" + ") : choice, quantity: requirements.length + toolkitCount || (Number(choice.match(/^\d+/)?.[0]) || 1) };
  }).filter(Boolean);
  const startingMarkup = selectedStarting.map((item) => `<div class="inventory-row starting"><div><strong>${escapeHtml(item.name)}</strong><small>Starting equipment</small></div><span>${item.quantity}</span><span class="source-tag">Class</span></div>`).join("");
  const itemMarkup = state.character.equipment.items.map((item, index) => `<div class="inventory-row"><input value="${escapeHtml(item.name)}" aria-label="Equipment name" data-equipment-name="${index}"><input type="number" min="1" value="${item.quantity || 1}" aria-label="Quantity" data-equipment-quantity="${index}"><input value="${escapeHtml(item.notes || "")}" placeholder="Notes" aria-label="Equipment notes" data-equipment-notes="${index}"><button class="icon-button" data-remove-equipment="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join("");
  $("#inventory").innerHTML = startingMarkup + itemMarkup || "<p class=\"muted-copy\">No equipment selected yet.</p>";
  $$('[data-equipment-name]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentName)].name = field.value; saveAndRender(); }));
  $$('[data-equipment-quantity]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentQuantity)].quantity = Math.max(1, Number(field.value) || 1); saveAndRender(); }));
  $$('[data-equipment-notes]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentNotes)].notes = field.value; saveAndRender(); }));
  $$('[data-remove-equipment]').forEach((button) => button.addEventListener("click", () => { state.character.equipment.items.splice(Number(button.dataset.removeEquipment), 1); saveAndRender(); }));
}

let equipmentSearchSequence = 0;
async function renderEquipmentCatalogue() {
  const sequence = ++equipmentSearchSequence;
  const query = $("#equipment-search").value.trim();
  const type = $("#equipment-type").value;
  const category = $("#weapon-category").value;
  $("#equipment-catalogue").innerHTML = '<p class="muted-copy">Searching the private catalogue…</p>';
  let response;
  try { response = await api("/api/v1/equipment/search", { query, type, category, limit: 80 }); }
  catch (error) { if (sequence === equipmentSearchSequence) $("#equipment-catalogue").innerHTML = `<p class="muted-copy">${escapeHtml(error.message)}</p>`; return; }
  if (sequence !== equipmentSearchSequence) return;
  const entries = response.items.map((item) => ({ ...item, catalogueType: item.kind }));
  entries.forEach((entry) => upsert(state.rules.equipment[entry.catalogueType === "weapon" ? "weapons" : "armor"], entry));
  $("#equipment-catalogue").innerHTML = entries.map((item) => `<article class="equipment-card"><div><strong>${escapeHtml(item.name)}</strong><small>${item.catalogueType === "weapon" ? `${escapeHtml(item.category || "Unclassified")} · ${escapeHtml(item.damage)} ${escapeHtml(item.damageType)}` : `${escapeHtml(item.type)} · armor +${item.armorBonus}`}</small><p>${escapeHtml(item.properties || (item.bulk !== undefined ? `Bulk ${item.bulk}` : ""))}</p>${item.price != null ? `<b class="price">${item.price} Ryo</b>` : '<b class="price unavailable">Price not listed</b>'}</div><button class="button ghost" data-add-equipment="${item.catalogueType}:${item.id}">${item.price != null ? "Buy" : "Add"}</button></article>`).join("") || "<p class=\"muted-copy\">No equipment matches that search.</p>";
  $$('[data-add-equipment]').forEach((button) => button.addEventListener("click", async () => {
    const [, id] = button.dataset.addEquipment.split(":");
    button.disabled = true;
    try {
      await applyEvaluation(await api("/api/v1/equipment/purchase", { character: state.character, itemId: id }));
      persistCharacter(); renderAll(); showNotice("Equipment added by the server.");
    } catch (error) { button.disabled = false; showNotice(error.message || "Could not add that equipment.", true); }
  }));
}

async function addSummon() {
  const name = $("#summon-name").value.trim();
  const tribeId = $("#summon-tribe").value;
  if (!name || !tribeId) { showNotice("Give the summon a name and choose its tribe.", true); return; }
  let tribe = find(state.rules.summons.tribes, tribeId);
  if (!tribe?.ranks) { tribe = await api("/api/v1/summon/tribe", { id: tribeId }); upsert(state.rules.summons.tribes, tribe); }
  const rank = $("#summon-rank").value;
  const sizes = summonSizeOptions(tribe, rank);
  state.character.summons.push({ id: crypto.randomUUID(), name, tribeId, tribeName: tribe.name, rank, size: sizes[0] || "Medium", roleMode: "single", primaryRole: "Striker", secondaryRole: "", statIncreases: Object.fromEntries(ABILITIES.map((ability) => [ability, 0])), featuresByRank: {}, jutsu: [], hpAdjustment: 0, acAdjustment: 0, notes: "" });
  $("#summon-name").value = "";
  saveAndRender();
}

function summonSizeOptions(tribe, rank) {
  const labels = ["Tiny", "Small", "Medium", "Large", "Huge", "Giant"];
  const letters = { T: 0, S: 1, M: 2, L: 3, H: 4, G: 5 };
  let range = tribe?.ranks?.[rank]?.sizeRange || state.rules.summons.templates.find((entry) => entry.tribe === tribe?.name && entry.rank === rank)?.size || state.rules.summons.templates.find((entry) => entry.tribe === tribe?.name)?.size || "";
  if (/^(Tiny|Small|Medium|Large|Huge|Giant)$/i.test(range)) return [labels.find((label) => label.toLowerCase() === range.toLowerCase())];
  const [minimum, maximum = minimum] = String(range).split("-").map((entry) => letters[entry.trim().slice(0, 1).toUpperCase()]);
  if (Number.isInteger(minimum) && Number.isInteger(maximum)) return labels.slice(Math.min(minimum, maximum), Math.max(minimum, maximum) + 1);
  return labels;
}

function summonRoleOptions(selected = "") {
  return state.rules.summons.roles.map((role) => `<option${role.name === selected ? " selected" : ""}>${escapeHtml(role.name)}</option>`).join("");
}

function renderSummons() {
  $("#summon-roster").innerHTML = state.character.summons.map((summon, index) => {
    const tribe = find(state.rules.summons.tribes, summon.tribeId);
    const derived = summonDerivedStats(summon, tribe, state.rules);
    const sizes = summonSizeOptions(tribe, summon.rank);
    const spent = ABILITIES.reduce((total, ability) => total + (Number(summon.statIncreases?.[ability]) || 0), 0);
    const attainedRanks = SUMMON_RANK_ORDER.slice(0, SUMMON_RANK_ORDER.indexOf(summon.rank) + 1);
    const roleDescriptions = derived.roles.map((name) => state.rules.summons.roles.find((role) => role.name === name)).filter(Boolean);
    const featureChoices = attainedRanks.map((rank) => {
      const options = tribe?.ranks?.[rank]?.features || [];
      if (!options.length) return `<label><span>${rank} feature</span><input data-summon-feature="${index}:${rank}" value="${escapeHtml(summon.featuresByRank?.[rank] || "")}" placeholder="Record feature (source has no list)"></label>`;
      return `<label><span>${rank} feature</span><select data-summon-feature="${index}:${rank}"><option value="">Choose ${rank} feature</option>${options.map((feature) => `<option value="${escapeHtml(feature.name)}" title="${escapeHtml(feature.description)}"${summon.featuresByRank?.[rank] === feature.name ? " selected" : ""}>${escapeHtml(feature.name)}</option>`).join("")}</select></label>`;
    }).join("");
    const selectedJutsu = (summon.jutsu || []).map((entry, jutsuIndex) => { const rule = find(state.rules.jutsu, entry.id) || entry; return `<div class="summon-jutsu-item"><div><strong>${escapeHtml(entry.name)}</strong><div class="keyword-tags compact-tags">${keywordList(rule.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div></div><button class="icon-button" data-remove-summon-jutsu="${index}:${jutsuIndex}" aria-label="Remove ${escapeHtml(entry.name)}">×</button></div>`; }).join("") || '<p class="muted-copy">No jutsu added to this summon.</p>';
    return `<article class="summon-card" data-summon-card="${index}"><header><div><input value="${escapeHtml(summon.name)}" aria-label="Summon name" data-summon-name="${index}"><span>${escapeHtml(tribe?.name || summon.tribeName || "Unknown tribe")}</span></div><button class="icon-button" data-remove-summon="${index}" aria-label="Remove ${escapeHtml(summon.name)}">×</button></header>
      <div class="summon-core-grid"><label>Rank<select data-summon-rank="${index}">${SUMMON_RANK_ORDER.map((rank) => `<option${rank === summon.rank ? " selected" : ""}>${rank}</option>`).join("")}</select></label><label>Size<select data-summon-size="${index}">${sizes.map((size) => `<option${size === summon.size ? " selected" : ""}>${size}</option>`).join("")}</select></label><label>Role access<select data-summon-role-mode="${index}"><option value="single"${summon.roleMode !== "dual" ? " selected" : ""}>One role</option><option value="dual"${summon.roleMode === "dual" ? " selected" : ""}>Both roles</option></select></label><label>Primary role<select data-summon-primary-role="${index}">${summonRoleOptions(summon.primaryRole)}</select></label>${summon.roleMode === "dual" ? `<label>Second role<select data-summon-secondary-role="${index}"><option value="">Choose second role</option>${summonRoleOptions(summon.secondaryRole)}</select></label>` : ""}</div>
      <div class="summon-derived"><div><span>HP</span><strong>${derived.hp}</strong><small>(${derived.toughness} + CON ${signed(abilityModifier(derived.abilities.constitution))}) × ${derived.rank.level}${summon.hpAdjustment ? ` ${signed(summon.hpAdjustment)}` : ""}</small></div><div><span>Armor</span><strong>${derived.ac}</strong><small>10 + level/2 + ${(derived.defensiveAbility || "defense").slice(0, 3).toUpperCase()} ${signed(derived.defensiveModifier)}${derived.roles.includes("Defender") ? " + Defender" : ""}</small></div><div><span>Speed</span><strong>${derived.rank.speed ? `${derived.rank.speed} ft` : "—"}</strong></div><div><span>Jutsu slots</span><strong>${Number(derived.rank.jutsuSlots || 0) + (derived.roles.includes("Caster") ? SUMMON_RANK_ORDER.indexOf(summon.rank) + 1 : 0)}</strong></div></div>
      <div class="summon-adjustments"><label>HP adjustment<input type="number" value="${summon.hpAdjustment || 0}" data-summon-hp-adjustment="${index}"></label><label>AC adjustment<input type="number" value="${summon.acAdjustment || 0}" data-summon-ac-adjustment="${index}"></label></div>
      <div class="summon-section-heading"><div><h4>Ability increases</h4><small>${spent} / ${derived.rank.asiPoints || 0} points spent · maximum ${derived.rank.statMax || 20}</small></div></div><div class="summon-stats">${ABILITIES.map((ability) => `<label><span>${ability.slice(0, 3).toUpperCase()} <strong>${derived.abilities[ability]}</strong><small>Base ${tribe?.abilities?.[ability] ?? 10}</small></span><input type="number" min="0" max="${Math.max(0, Number(derived.rank.statMax || 20) - Number(tribe?.abilities?.[ability] || 10))}" value="${summon.statIncreases?.[ability] || 0}" aria-label="${abilityLabel(ability)} increase" data-summon-stat="${index}:${ability}"></label>`).join("")}</div>
      <div class="summon-section-heading"><h4>Rank features</h4></div><div class="summon-feature-grid">${featureChoices}</div>
      <div class="summon-details">${roleDescriptions.map((role) => `<p><strong>${escapeHtml(role.name)}:</strong> ${escapeHtml(role.description)}</p>`).join("")}<p><strong>Senses:</strong> ${escapeHtml(tribe?.senses || "—")}</p><p><strong>Skills:</strong> ${escapeHtml(tribe?.skills || "—")}</p><p><strong>Jutsu access:</strong> ${escapeHtml(tribe?.jutsuAccess || "—")}</p><p><strong>Natural weapons:</strong> ${escapeHtml(tribe?.naturalWeapons || "—")}</p></div>
      <details class="summon-jutsu"><summary>Jutsu (${summon.jutsu?.length || 0})</summary><div class="summon-jutsu-selected">${selectedJutsu}</div><div class="summon-jutsu-toolbar"><input type="search" data-summon-jutsu-search="${index}" placeholder="Search this summon’s jutsu…"><select data-summon-jutsu-rank="${index}"><option value="">All ranks</option>${SUMMON_RANK_ORDER.map((rank) => `<option>${rank}</option>`).join("")}</select></div><div class="summon-filter-board"><div class="filter-group"><span>Discipline</span><div class="filter-chips">${JUTSU_DISCIPLINES.map((discipline) => `<button type="button" data-summon-discipline="${index}:${discipline}">${discipline}</button>`).join("")}</div></div><div class="filter-group"><span>Nature release</span><div class="filter-chips elemental">${JUTSU_ELEMENTS.map((element) => `<button type="button" data-summon-element="${index}:${element}">${natureFilterLabel(element)}</button>`).join("")}</div></div><div class="summon-hijutsu-lock"><button type="button" class="filter-toggle" disabled>Hijutsu unavailable</button><small>Summons cannot learn Hijutsu; those techniques are always excluded.</small></div></div><div class="summon-jutsu-results" data-summon-jutsu-results="${index}"></div></details>
      <label>Notes<textarea data-summon-notes="${index}" rows="2">${escapeHtml(summon.notes || "")}</textarea></label></article>`;
  }).join("") || "<div class=\"empty-state\">No summons recorded yet. Add one when the character forms a contract or gains a companion.</div>";
  $$('[data-summon-name]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonName)].name = field.value; saveAndRender(); }));
  $$('[data-summon-rank]').forEach((field) => field.addEventListener("change", () => { const summon = state.character.summons[Number(field.dataset.summonRank)]; summon.rank = field.value; const tribe = find(state.rules.summons.tribes, summon.tribeId); const sizes = summonSizeOptions(tribe, summon.rank); if (!sizes.includes(summon.size)) summon.size = sizes[0]; saveAndRender(); }));
  $$('[data-summon-size]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonSize)].size = field.value; saveAndRender(); }));
  $$('[data-summon-role-mode]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonRoleMode)].roleMode = field.value; saveAndRender(); }));
  $$('[data-summon-primary-role]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonPrimaryRole)].primaryRole = field.value; saveAndRender(); }));
  $$('[data-summon-secondary-role]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonSecondaryRole)].secondaryRole = field.value; saveAndRender(); }));
  $$('[data-summon-stat]').forEach((field) => field.addEventListener("input", () => { const [summonIndex, ability] = field.dataset.summonStat.split(":"); state.character.summons[Number(summonIndex)].statIncreases[ability] = Math.max(0, Number(field.value) || 0); saveAndRender(); }));
  $$('[data-summon-feature]').forEach((field) => field.addEventListener("change", () => { const [summonIndex, rank] = field.dataset.summonFeature.split(":"); state.character.summons[Number(summonIndex)].featuresByRank[rank] = field.value; saveAndRender(); }));
  $$('[data-summon-hp-adjustment]').forEach((field) => field.addEventListener("input", () => { state.character.summons[Number(field.dataset.summonHpAdjustment)].hpAdjustment = Number(field.value) || 0; saveAndRender(); }));
  $$('[data-summon-ac-adjustment]').forEach((field) => field.addEventListener("input", () => { state.character.summons[Number(field.dataset.summonAcAdjustment)].acAdjustment = Number(field.value) || 0; saveAndRender(); }));
  $$('[data-summon-notes]').forEach((field) => field.addEventListener("change", () => { state.character.summons[Number(field.dataset.summonNotes)].notes = field.value; saveAndRender(); }));
  $$('[data-remove-summon-jutsu]').forEach((button) => button.addEventListener("click", () => { const [summonIndex, jutsuIndex] = button.dataset.removeSummonJutsu.split(":"); state.character.summons[Number(summonIndex)].jutsu.splice(Number(jutsuIndex), 1); saveAndRender(); }));
  $$('[data-summon-jutsu-search]').forEach((field) => field.addEventListener("input", () => { const index = Number(field.dataset.summonJutsuSearch); const filter = summonFilters.get(state.character.summons[index].id) || {}; filter.query = field.value; summonFilters.set(state.character.summons[index].id, filter); renderSummonJutsuResults(index); }));
  $$('[data-summon-jutsu-rank]').forEach((field) => field.addEventListener("change", () => { const index = Number(field.dataset.summonJutsuRank); const filter = summonFilters.get(state.character.summons[index].id) || {}; filter.rank = field.value; summonFilters.set(state.character.summons[index].id, filter); renderSummonJutsuResults(index); }));
  $$('[data-summon-discipline]').forEach((button) => button.addEventListener("click", () => { const [summonIndex, discipline] = button.dataset.summonDiscipline.split(":"); const summon = state.character.summons[Number(summonIndex)]; const filter = summonFilters.get(summon.id) || { disciplines: [], elements: [] }; filter.disciplines ||= []; toggleFilter(filter.disciplines, discipline); summonFilters.set(summon.id, filter); renderSummonJutsuResults(Number(summonIndex)); }));
  $$('[data-summon-element]').forEach((button) => button.addEventListener("click", () => { const [summonIndex, element] = button.dataset.summonElement.split(":"); const summon = state.character.summons[Number(summonIndex)]; const filter = summonFilters.get(summon.id) || { disciplines: [], elements: [] }; filter.elements ||= []; toggleFilter(filter.elements, element); summonFilters.set(summon.id, filter); renderSummonJutsuResults(Number(summonIndex)); }));
  $$('[data-remove-summon]').forEach((button) => button.addEventListener("click", () => { state.character.summons.splice(Number(button.dataset.removeSummon), 1); saveAndRender(); }));
  state.character.summons.forEach((summon, index) => {
    const filter = summonFilters.get(summon.id) || {};
    const search = $(`[data-summon-jutsu-search="${index}"]`); if (search) search.value = filter.query || "";
    const rank = $(`[data-summon-jutsu-rank="${index}"]`); if (rank) rank.value = filter.rank || "";
    renderSummonJutsuResults(index);
  });
}

async function renderSummonJutsuResults(index) {
  const summon = state.character.summons[index];
  const container = $(`[data-summon-jutsu-results="${index}"]`);
  if (!summon || !container) return;
  const filter = summonFilters.get(summon.id) || {};
  const selected = new Set((summon.jutsu || []).map((entry) => entry.id));
  $$(`[data-summon-discipline^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.disciplines || []).includes(button.dataset.summonDiscipline.split(":")[1])));
  $$(`[data-summon-element^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.elements || []).includes(button.dataset.summonElement.split(":")[1])));
  container.innerHTML = '<p class="muted-copy">Searching the private catalogue…</p>';
  let response;
  try { response = await api("/api/v1/jutsu/search", { query: filter.query || "", rank: filter.rank || "", disciplines: filter.disciplines || [], elements: filter.elements || [], hijutsu: false, limit: 12 }); }
  catch (error) { container.innerHTML = `<p class="muted-copy">${escapeHtml(error.message)}</p>`; return; }
  if (!document.body.contains(container)) return;
  const results = response.items;
  results.forEach((entry) => upsert(state.rules.jutsu, entry));
  container.innerHTML = results.map((entry) => `<div class="summon-jutsu-result"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.rank)} · ${escapeHtml(entry.classification)}</small><div class="keyword-tags compact-tags">${keywordList(entry.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div>${jutsuDescriptionMarkup(entry)}</div><button class="button ghost" data-add-summon-jutsu="${index}:${entry.id}"${selected.has(entry.id) ? " disabled" : ""}>${selected.has(entry.id) ? "Added" : "Add"}</button></div>`).join("") || '<p class="muted-copy">No jutsu match those filters.</p>';
  $$('[data-add-summon-jutsu]', container).forEach((button) => button.addEventListener("click", async () => { const [summonIndex, jutsuId] = button.dataset.addSummonJutsu.split(":"); button.disabled = true; try { await applyEvaluation(await api("/api/v1/jutsu/select", { character: state.character, jutsuId, target: { kind: "summon", index: Number(summonIndex) } })); persistCharacter(); renderAll(); } catch (error) { button.disabled = false; showNotice(error.message || "Could not add that summon jutsu.", true); } }));
}

function puppetTechniqueOptions(selected = "") {
  const techniques = state.rules.subclasses.filter((entry) => entry.className === "Puppet-Master").map((entry) => entry.name.replaceAll("-", " ").replace(" ~ ", " - "));
  return [...techniques, "Custom / archetype"].map((name) => `<option${name === selected ? " selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function addPuppet() {
  const name = $("#puppet-name").value.trim();
  if (!name) { showNotice("Give the puppet a name before crafting it.", true); return; }
  const subclass = find(state.rules.subclasses, state.character.subclassId);
  const technique = $("#puppet-technique").value || (subclass?.className === "Puppet-Master" ? subclass.name.replaceAll("-", " ").replace(" ~ ", " - ") : "Custom / archetype");
  const chassis = $("#puppet-chassis").value;
  const defaultSize = chassis === "Quadrupedal" ? "Large" : chassis === "Winged" ? "Small" : "Medium";
  state.character.puppets.push({ id: crypto.randomUUID(), name, technique, chassis, size: defaultSize, chassisAbility: "", statIncreases: Object.fromEntries(ABILITIES.map((ability) => [ability, 0])), upgrades: [], seals: [], weapons: [], jutsu: [], hijutsuAccess: false, hpAdjustment: 0, acAdjustment: 0, speedAdjustment: 0, notes: "" });
  $("#puppet-name").value = "";
  saveAndRender();
}

function renderPuppets() {
  const level = state.character.level;
  const capacity = puppetUpgradeCapacity(level);
  const allocatedUpgrades = state.character.puppets.flatMap((puppet) => puppet.upgrades || []).filter((upgrade) => !upgrade.free && upgrade.name.trim());
  const spentAbilityPoints = state.character.puppets.reduce((total, puppet) => total + ABILITIES.reduce((sum, ability) => sum + (Number(puppet.statIncreases?.[ability]) || 0), 0), 0);
  const expanded = Math.min(2, state.character.puppets.flatMap((puppet) => puppet.upgrades || []).filter((upgrade) => /expanded puppetry/i.test(upgrade.name)).length);
  const allowedPuppets = puppetAllowedCount(level) + expanded;
  const budget = PUPPET_UPGRADE_TIERS.filter((tier) => capacity[tier]).map((tier) => `<span><strong>${capacity[tier]}</strong> ${tier}</span>`).join("") || "<span>No upgrade slots until level 2</span>";
  $("#puppet-budget").innerHTML = `<div><strong>Puppet allowance</strong><span>${state.character.puppets.length} / ${allowedPuppets}</span></div><div><strong>Shared ability points</strong><span>${spentAbilityPoints} / ${puppetAbilityPointPool(level)}</span></div><div class="puppet-tier-budget"><strong>Shared upgrade slots</strong>${budget}<small>${allocatedUpgrades.length} installed; higher-tier slots may hold lower-tier upgrades.</small></div>`;
  $("#puppet-roster").innerHTML = state.character.puppets.map((puppet, index) => {
    const derived = puppetDerivedStats(puppet, level);
    const base = puppetBaseAbilities(puppet);
    const upgradeRows = (puppet.upgrades || []).map((upgrade, upgradeIndex) => `<div class="puppet-upgrade-row"><input list="puppet-upgrade-options" value="${escapeHtml(upgrade.name)}" aria-label="Upgrade name" data-puppet-upgrade-name="${index}:${upgradeIndex}" placeholder="Choose or type an upgrade"><select aria-label="Upgrade tier" data-puppet-upgrade-tier="${index}:${upgradeIndex}">${PUPPET_UPGRADE_TIERS.map((tier) => `<option${tier === upgrade.tier ? " selected" : ""}>${tier}</option>`).join("")}</select><label class="check-label"><input type="checkbox" data-puppet-upgrade-free="${index}:${upgradeIndex}"${upgrade.free ? " checked" : ""}> Granted / free</label><input value="${escapeHtml(upgrade.notes || "")}" aria-label="Upgrade notes" data-puppet-upgrade-notes="${index}:${upgradeIndex}" placeholder="Effect or source notes"><button class="icon-button" data-remove-puppet-upgrade="${index}:${upgradeIndex}" aria-label="Remove ${escapeHtml(upgrade.name || "upgrade")}">×</button></div>`).join("") || '<p class="muted-copy">No upgrades installed.</p>';
    const sealRows = (puppet.seals || []).map((seal, sealIndex) => `<div class="puppet-list-row"><input value="${escapeHtml(seal)}" data-puppet-seal="${index}:${sealIndex}" aria-label="Seal"><button class="icon-button" data-remove-puppet-seal="${index}:${sealIndex}" aria-label="Remove seal">×</button></div>`).join("") || '<p class="muted-copy">No seals installed.</p>';
    const weaponRows = (puppet.weapons || []).map((weapon, weaponIndex) => `<div class="puppet-list-row"><input value="${escapeHtml(weapon)}" data-puppet-weapon="${index}:${weaponIndex}" aria-label="Weapon"><button class="icon-button" data-remove-puppet-weapon="${index}:${weaponIndex}" aria-label="Remove weapon">×</button></div>`).join("") || '<p class="muted-copy">No weapons recorded.</p>';
    const selectedJutsu = (puppet.jutsu || []).map((entry, jutsuIndex) => { const rule = find(state.rules.jutsu, entry.id) || entry; return `<div class="summon-jutsu-item"><div><strong>${escapeHtml(entry.name)}</strong><div class="keyword-tags compact-tags">${keywordList(rule.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div></div><button class="icon-button" data-remove-puppet-jutsu="${index}:${jutsuIndex}" aria-label="Remove ${escapeHtml(entry.name)}">×</button></div>`; }).join("") || '<p class="muted-copy">No jutsu installed.</p>';
    const canCast = (puppet.upgrades || []).some((upgrade) => /jutsu specialization/i.test(upgrade.name));
    return `<article class="puppet-card" data-puppet-card="${index}"><header><div><input value="${escapeHtml(puppet.name)}" aria-label="Puppet name" data-puppet-name="${index}"><span>${escapeHtml(puppet.technique || "Unassigned technique")}</span></div><button class="icon-button" data-remove-puppet="${index}" aria-label="Remove ${escapeHtml(puppet.name)}">×</button></header>
      <div class="puppet-core-grid"><label>Technique<select data-puppet-technique="${index}">${puppetTechniqueOptions(puppet.technique)}</select></label><label>Chassis<select data-puppet-chassis="${index}">${["Standard","Specialized","Quadrupedal","Warforged","Winged","Custom"].map((chassis) => `<option${chassis === puppet.chassis ? " selected" : ""}>${chassis}</option>`).join("")}</select></label><label>Size<select data-puppet-size="${index}">${["Tiny","Small","Medium","Large","Huge"].map((size) => `<option${size === puppet.size ? " selected" : ""}>${size}</option>`).join("")}</select></label>${puppet.chassis === "Specialized" ? `<label>Chassis +2<select data-puppet-chassis-ability="${index}">${ABILITIES.map((ability) => `<option value="${ability}"${ability === puppet.chassisAbility ? " selected" : ""}>${abilityLabel(ability)}</option>`).join("")}</select></label>` : ""}</div>
      <div class="puppet-derived"><div><span>HP</span><strong>${derived.hp}</strong><small>4 + (5 + CON ${signed(abilityModifier(derived.abilities.constitution))}) × ${level}</small></div><div><span>Armor</span><strong>${derived.ac}</strong><small>13 + proficiency ${signed(proficiencyBonus(level))}</small></div><div><span>Speed</span><strong>${derived.speed} ft${derived.flySpeed ? ` / fly ${derived.flySpeed} ft` : ""}</strong></div><div><span>Seal slots</span><strong>${puppet.seals.length} / ${derived.sealSlots}</strong></div><div><span>Mending</span><strong>${derived.repairDie} + ${Math.floor(level / 2)}</strong></div></div>
      <div class="puppet-adjustments"><label>HP adjustment<input type="number" value="${puppet.hpAdjustment || 0}" data-puppet-hp-adjustment="${index}"></label><label>AC adjustment<input type="number" value="${puppet.acAdjustment || 0}" data-puppet-ac-adjustment="${index}"></label><label>Speed adjustment<input type="number" value="${puppet.speedAdjustment || 0}" data-puppet-speed-adjustment="${index}"></label></div>
      <div class="summon-section-heading"><div><h4>Ability allocation</h4><small>Shared pool across every Puppet Tool · normal maximum 20</small></div></div><div class="summon-stats">${ABILITIES.map((ability) => `<label><span>${ability.slice(0,3).toUpperCase()} <strong>${derived.abilities[ability]}</strong><small>Base ${base[ability]}</small></span><input type="number" min="0" max="${Math.max(0, 20 - base[ability])}" value="${puppet.statIncreases?.[ability] || 0}" aria-label="${abilityLabel(ability)} increase" data-puppet-stat="${index}:${ability}"></label>`).join("")}</div>
      <div class="puppet-section"><div class="summon-section-heading"><div><h4>Installed upgrades</h4><small>Mark chassis- or feature-granted upgrades as free.</small></div><button class="button ghost" data-add-puppet-upgrade="${index}">Add upgrade</button></div><div class="puppet-upgrades">${upgradeRows}</div></div>
      <div class="puppet-two-column"><div class="puppet-section"><div class="summon-section-heading"><h4>Chakra-enhanced seals</h4><button class="button ghost" data-add-puppet-seal="${index}">Add seal</button></div>${sealRows}</div><div class="puppet-section"><div class="summon-section-heading"><h4>Weapons & mechanisms</h4><button class="button ghost" data-add-puppet-weapon="${index}">Add weapon</button></div>${weaponRows}</div></div>
      <div class="puppet-traits"><span><strong>Bound</strong> 500 ft maximum thread distance</span><span><strong>Hollow Shell</strong> immune to Genjutsu</span><span><strong>Mechanical Limits</strong> no exhaustion-increasing or clone jutsu</span>${puppet.chassis === "Quadrupedal" ? "<span><strong>Quadrupedal</strong> non-fire damage reduction 2</span>" : ""}</div>
      <details class="summon-jutsu"><summary>Jutsu (${puppet.jutsu?.length || 0})</summary><div class="summon-jutsu-selected">${selectedJutsu}</div>${canCast ? `<label class="check-label puppet-hijutsu-access"><input type="checkbox" data-puppet-hijutsu-access="${index}"${puppet.hijutsuAccess ? " checked" : ""}> Bloodline feature permits Hijutsu</label><div class="summon-jutsu-toolbar"><input type="search" data-puppet-jutsu-search="${index}" placeholder="Search this puppet’s jutsu…"><select data-puppet-jutsu-rank="${index}"><option value="">All ranks</option>${SUMMON_RANK_ORDER.map((rank) => `<option>${rank}</option>`).join("")}</select></div><div class="summon-filter-board"><div class="filter-group"><span>Discipline</span><div class="filter-chips">${JUTSU_DISCIPLINES.map((discipline) => `<button type="button" data-puppet-discipline="${index}:${discipline}">${discipline}</button>`).join("")}</div></div><div class="filter-group"><span>Nature release</span><div class="filter-chips elemental">${JUTSU_ELEMENTS.map((element) => `<button type="button" data-puppet-element="${index}:${element}">${natureFilterLabel(element)}</button>`).join("")}</div></div></div><div class="summon-jutsu-results" data-puppet-jutsu-results="${index}"></div>` : '<p class="muted-copy puppet-jutsu-lock">Install an upgrade named “Jutsu Specialization” to unlock this catalogue.</p>'}</details>
      <label>Construction notes<textarea data-puppet-notes="${index}" rows="3">${escapeHtml(puppet.notes || "")}</textarea></label></article>`;
  }).join("") || '<div class="empty-state">No Puppet Tools recorded yet. Craft one for a Puppet Master or a character with puppeteer training.</div>';

  $$('[data-puppet-name]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetName)].name = field.value; saveAndRender(); }));
  $$('[data-puppet-technique]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetTechnique)].technique = field.value; saveAndRender(); }));
  $$('[data-puppet-chassis]').forEach((field) => field.addEventListener("change", () => { const puppet = state.character.puppets[Number(field.dataset.puppetChassis)]; puppet.chassis = field.value; if (field.value === "Quadrupedal") puppet.size = "Large"; if (field.value === "Winged") puppet.size = "Small"; saveAndRender(); }));
  $$('[data-puppet-size]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetSize)].size = field.value; saveAndRender(); }));
  $$('[data-puppet-chassis-ability]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetChassisAbility)].chassisAbility = field.value; saveAndRender(); }));
  $$('[data-puppet-stat]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, ability] = field.dataset.puppetStat.split(":"); state.character.puppets[Number(puppetIndex)].statIncreases[ability] = Math.max(0, Number(field.value) || 0); saveAndRender(); }));
  $$('[data-puppet-hp-adjustment]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetHpAdjustment)].hpAdjustment = Number(field.value) || 0; saveAndRender(); }));
  $$('[data-puppet-ac-adjustment]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetAcAdjustment)].acAdjustment = Number(field.value) || 0; saveAndRender(); }));
  $$('[data-puppet-speed-adjustment]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetSpeedAdjustment)].speedAdjustment = Number(field.value) || 0; saveAndRender(); }));
  $$('[data-add-puppet-upgrade]').forEach((button) => button.addEventListener("click", () => { state.character.puppets[Number(button.dataset.addPuppetUpgrade)].upgrades.push({ name: "", tier: "Wood", free: false, notes: "" }); saveAndRender(); }));
  $$('[data-puppet-upgrade-name]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, upgradeIndex] = field.dataset.puppetUpgradeName.split(":"); state.character.puppets[Number(puppetIndex)].upgrades[Number(upgradeIndex)].name = field.value; saveAndRender(); }));
  $$('[data-puppet-upgrade-tier]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, upgradeIndex] = field.dataset.puppetUpgradeTier.split(":"); state.character.puppets[Number(puppetIndex)].upgrades[Number(upgradeIndex)].tier = field.value; saveAndRender(); }));
  $$('[data-puppet-upgrade-free]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, upgradeIndex] = field.dataset.puppetUpgradeFree.split(":"); state.character.puppets[Number(puppetIndex)].upgrades[Number(upgradeIndex)].free = field.checked; saveAndRender(); }));
  $$('[data-puppet-upgrade-notes]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, upgradeIndex] = field.dataset.puppetUpgradeNotes.split(":"); state.character.puppets[Number(puppetIndex)].upgrades[Number(upgradeIndex)].notes = field.value; saveAndRender(); }));
  $$('[data-remove-puppet-upgrade]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, upgradeIndex] = button.dataset.removePuppetUpgrade.split(":"); state.character.puppets[Number(puppetIndex)].upgrades.splice(Number(upgradeIndex), 1); saveAndRender(); }));
  $$('[data-add-puppet-seal]').forEach((button) => button.addEventListener("click", () => { state.character.puppets[Number(button.dataset.addPuppetSeal)].seals.push(""); saveAndRender(); }));
  $$('[data-puppet-seal]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, sealIndex] = field.dataset.puppetSeal.split(":"); state.character.puppets[Number(puppetIndex)].seals[Number(sealIndex)] = field.value; saveAndRender(); }));
  $$('[data-remove-puppet-seal]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, sealIndex] = button.dataset.removePuppetSeal.split(":"); state.character.puppets[Number(puppetIndex)].seals.splice(Number(sealIndex), 1); saveAndRender(); }));
  $$('[data-add-puppet-weapon]').forEach((button) => button.addEventListener("click", () => { state.character.puppets[Number(button.dataset.addPuppetWeapon)].weapons.push(""); saveAndRender(); }));
  $$('[data-puppet-weapon]').forEach((field) => field.addEventListener("change", () => { const [puppetIndex, weaponIndex] = field.dataset.puppetWeapon.split(":"); state.character.puppets[Number(puppetIndex)].weapons[Number(weaponIndex)] = field.value; saveAndRender(); }));
  $$('[data-remove-puppet-weapon]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, weaponIndex] = button.dataset.removePuppetWeapon.split(":"); state.character.puppets[Number(puppetIndex)].weapons.splice(Number(weaponIndex), 1); saveAndRender(); }));
  $$('[data-puppet-hijutsu-access]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetHijutsuAccess)].hijutsuAccess = field.checked; saveAndRender(); }));
  $$('[data-puppet-notes]').forEach((field) => field.addEventListener("change", () => { state.character.puppets[Number(field.dataset.puppetNotes)].notes = field.value; saveAndRender(); }));
  $$('[data-remove-puppet-jutsu]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, jutsuIndex] = button.dataset.removePuppetJutsu.split(":"); state.character.puppets[Number(puppetIndex)].jutsu.splice(Number(jutsuIndex), 1); saveAndRender(); }));
  $$('[data-puppet-jutsu-search]').forEach((field) => field.addEventListener("input", () => { const index = Number(field.dataset.puppetJutsuSearch); const filter = puppetFilters.get(state.character.puppets[index].id) || {}; filter.query = field.value; puppetFilters.set(state.character.puppets[index].id, filter); renderPuppetJutsuResults(index); }));
  $$('[data-puppet-jutsu-rank]').forEach((field) => field.addEventListener("change", () => { const index = Number(field.dataset.puppetJutsuRank); const filter = puppetFilters.get(state.character.puppets[index].id) || {}; filter.rank = field.value; puppetFilters.set(state.character.puppets[index].id, filter); renderPuppetJutsuResults(index); }));
  $$('[data-puppet-discipline]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, discipline] = button.dataset.puppetDiscipline.split(":"); const puppet = state.character.puppets[Number(puppetIndex)]; const filter = puppetFilters.get(puppet.id) || { disciplines: [], elements: [] }; filter.disciplines ||= []; toggleFilter(filter.disciplines, discipline); puppetFilters.set(puppet.id, filter); renderPuppetJutsuResults(Number(puppetIndex)); }));
  $$('[data-puppet-element]').forEach((button) => button.addEventListener("click", () => { const [puppetIndex, element] = button.dataset.puppetElement.split(":"); const puppet = state.character.puppets[Number(puppetIndex)]; const filter = puppetFilters.get(puppet.id) || { disciplines: [], elements: [] }; filter.elements ||= []; toggleFilter(filter.elements, element); puppetFilters.set(puppet.id, filter); renderPuppetJutsuResults(Number(puppetIndex)); }));
  $$('[data-remove-puppet]').forEach((button) => button.addEventListener("click", () => { state.character.puppets.splice(Number(button.dataset.removePuppet), 1); saveAndRender(); }));
  state.character.puppets.forEach((puppet, index) => {
    const filter = puppetFilters.get(puppet.id) || {};
    const search = $(`[data-puppet-jutsu-search="${index}"]`); if (search) search.value = filter.query || "";
    const rank = $(`[data-puppet-jutsu-rank="${index}"]`); if (rank) rank.value = filter.rank || "";
    renderPuppetJutsuResults(index);
  });
}

async function renderPuppetJutsuResults(index) {
  const puppet = state.character.puppets[index];
  const container = $(`[data-puppet-jutsu-results="${index}"]`);
  if (!puppet || !container) return;
  const filter = puppetFilters.get(puppet.id) || {};
  const selected = new Set((puppet.jutsu || []).map((entry) => entry.id));
  $$(`[data-puppet-discipline^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.disciplines || []).includes(button.dataset.puppetDiscipline.split(":")[1])));
  $$(`[data-puppet-element^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.elements || []).includes(button.dataset.puppetElement.split(":")[1])));
  container.innerHTML = '<p class="muted-copy">Searching the private catalogue…</p>';
  let response;
  try { response = await api("/api/v1/jutsu/search", { query: filter.query || "", rank: filter.rank || "", disciplines: filter.disciplines || [], elements: filter.elements || [], hijutsu: false, includeHijutsu: puppet.hijutsuAccess, limit: 40 }); }
  catch (error) { container.innerHTML = `<p class="muted-copy">${escapeHtml(error.message)}</p>`; return; }
  if (!document.body.contains(container)) return;
  const results = response.items;
  results.forEach((entry) => upsert(state.rules.jutsu, entry));
  container.innerHTML = results.map((entry) => `<div class="summon-jutsu-result"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.rank)} · ${escapeHtml(entry.classification)}</small><div class="keyword-tags compact-tags">${keywordList(entry.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div>${jutsuDescriptionMarkup(entry)}</div><button class="button ghost" data-add-puppet-jutsu="${index}:${entry.id}"${selected.has(entry.id) ? " disabled" : ""}>${selected.has(entry.id) ? "Added" : "Add"}</button></div>`).join("") || '<p class="muted-copy">No jutsu match those filters.</p>';
  $$('[data-add-puppet-jutsu]', container).forEach((button) => button.addEventListener("click", async () => { const [puppetIndex, jutsuId] = button.dataset.addPuppetJutsu.split(":"); button.disabled = true; try { await applyEvaluation(await api("/api/v1/jutsu/select", { character: state.character, jutsuId, target: { kind: "puppet", index: Number(puppetIndex) } })); persistCharacter(); renderAll(); } catch (error) { button.disabled = false; showNotice(error.message || "Could not add that puppet jutsu.", true); } }));
}

function renderAbilitySources() {
  const increases = state.character.abilityIncreases;
  $("#background-ability").disabled = increases.backgroundMode === "feat";
  const reached = CLASS_ASI_LEVELS.filter((level) => level <= state.character.level);
  $("#class-asi-controls").innerHTML = reached.length ? reached.map((level) => `<label>Level ${level} +1<select data-asi-level="${level}">${abilityOptions()}</select></label>`).join("") : "<p class=\"muted-copy\">No class ability increases have been reached yet.</p>";
  $$('[data-asi-level]').forEach((control) => {
    control.value = increases.classLevels[control.dataset.asiLevel] || "";
    control.addEventListener("change", () => { state.character.abilityIncreases.classLevels[control.dataset.asiLevel] = control.value; saveAndRender(); });
  });
}

function renderSubclassOptions() {
  const cls = find(state.rules.classes, state.character.classId);
  const options = cls ? state.rules.subclasses.filter((entry) => entry.className === cls.name) : [];
  $("#subclass-select").innerHTML = optionMarkup(options, options.length ? "Choose subclass" : "No subclass selected");
  $("#subclass-select").value = state.character.subclassId;
  $("#subclass-select").disabled = !options.length;
}

function renderBuildSummary() {
  const cls = find(state.rules.classes, state.character.classId);
  const clan = find(state.rules.clans, state.character.clanId);
  const background = find(state.rules.backgrounds, state.character.backgroundId);
  if (!cls && !clan && !background) { $("#build-summary").innerHTML = "Your chosen build details will appear here."; $("#build-progression").innerHTML = ""; return; }
  const timeline = levelTimeline();
  const current = timeline.find((entry) => entry.level === Number(state.character.level));
  const next = timeline.find((entry) => entry.level === Number(state.character.level) + 1);
  const currentNames = [...(current?.classFeatures || []), ...(current?.subclassFeatures || []), ...(current?.clanFeatures || [])].map((feature) => feature.name);
  const nextNames = [...(next?.classFeatures || []), ...(next?.subclassFeatures || []), ...(next?.clanFeatures || [])].map((feature) => feature.name);
  $("#build-summary").innerHTML = `<div class="class-summary-heading"><div><span>Current build</span><strong>${escapeHtml([clan?.name, cls?.name].filter(Boolean).join(" ") || "Build in progress")}</strong>${state.view.selection.subclass ? `<small>${escapeHtml(state.view.selection.subclass.name)}</small>` : ""}</div>${cls ? `<div class="class-dice"><span>d${escapeHtml(cls.hitDie || "?")}<small>Hit die</small></span><span>d${escapeHtml(cls.chakraDie || "?")}<small>Chakra die</small></span></div>` : ""}</div><div class="class-level-snapshot"><div><span>Level ${state.character.level} grants</span><strong>${escapeHtml(currentNames.join(" · ") || "No recorded automatic feature")}</strong></div><div><span>${next ? `At level ${next.level}` : "Maximum level"}</span><strong>${escapeHtml(nextNames.join(" · ") || (next ? "No recorded automatic feature" : "Level 20 reached"))}</strong></div></div>${background?.feature ? `<p>Background feature: <strong>${escapeHtml(background.feature.name)}</strong></p>` : ""}`;
  const reachedChoices = (cls?.progressionChoices || []).flatMap((group) => group.selections.filter((selection) => selection.level <= state.character.level).map((selection) => ({ group, selection })));
  const futureChoiceCount = (cls?.progressionChoices || []).flatMap((group) => group.selections || []).filter((selection) => selection.level > state.character.level).length;
  const emptyChoiceMessage = futureChoiceCount ? `No guided choices are due at level ${state.character.level}. ${futureChoiceCount} future choice${futureChoiceCount === 1 ? " is" : "s are"} available in the full timeline.` : "This class has no additional structured choices at this level.";
  $("#build-progression").innerHTML = cls ? `<div class="progression-heading"><div><span>Guided advancement</span><h4>Class choices through level ${state.character.level}</h4></div><button type="button" class="button ghost" data-open-timeline>View all 20 levels</button></div>${reachedChoices.map(({ group, selection }) => progressionChoiceMarkup(group, selection)).join("") || `<p class="muted-copy">${escapeHtml(emptyChoiceMessage)}</p>`}` : "";
  bindProgressionChoiceControls($("#build-progression"));
  $("[data-open-timeline]", $("#build-progression"))?.addEventListener("click", () => showStep("timeline"));
}

function renderJutsuCastingStats() {
  const stats = state.view?.derived?.jutsuCasting || {};
  $("#jutsu-casting-stats").innerHTML = ["Ninjutsu", "Genjutsu", "Taijutsu", "Bukijutsu"].map((discipline) => {
    const entry = stats[discipline];
    if (!entry) return "";
    return `<article class="jutsu-casting-card"><div><strong>${discipline}</strong><small>${abilityLabel(entry.ability)} ${signed(entry.abilityBonus)}</small></div><div><span>Attack</span><b>${signed(entry.attackModifier)}</b></div><div><span>Save DC</span><b>${entry.saveDC}</b></div></article>`;
  }).join("");
}

function jutsuDescriptionMarkup(entry) {
  const description = String(entry.description || "");
  if (description.length <= 320) return `<p>${escapeHtml(description)}</p>`;
  return `<p class="jutsu-description-preview">${escapeHtml(description.slice(0, 320))}…</p><details class="jutsu-description"><summary>See full description</summary><p>${escapeHtml(description)}</p></details>`;
}

let jutsuSearchSequence = 0;
async function renderJutsuLibrary() {
  const sequence = ++jutsuSearchSequence;
  const query = $("#jutsu-search").value.trim();
  const rank = $("#jutsu-rank").value;
  $$('[data-jutsu-discipline]').forEach((button) => button.classList.toggle("active", jutsuFilters.disciplines.includes(button.dataset.jutsuDiscipline)));
  $$('[data-jutsu-element]').forEach((button) => button.classList.toggle("active", jutsuFilters.elements.includes(button.dataset.jutsuElement)));
  $$('[data-jutsu-keyword]').forEach((control) => { control.checked = jutsuFilters.keywords.includes(control.dataset.jutsuKeyword); });
  $("#jutsu-keyword-summary").textContent = jutsuFilters.keywords.length ? `${jutsuFilters.keywords.length} selected` : "Any keyword";
  $("#jutsu-hijutsu").classList.toggle("active", jutsuFilters.hijutsu);
  $("#jutsu-hijutsu-clan").disabled = !jutsuFilters.hijutsu;
  $("#jutsu-hijutsu-clan").value = jutsuFilters.clan;
  const selected = new Set(state.character.jutsu.map((entry) => entry.id));
  $("#jutsu-results").innerHTML = '<p class="muted-copy">Searching the private catalogue…</p>';
  let response;
  try {
    response = await api("/api/v1/jutsu/search", { query, rank, disciplines: jutsuFilters.disciplines, elements: jutsuFilters.elements, keywords: jutsuFilters.keywords, hijutsu: jutsuFilters.hijutsu, clan: jutsuFilters.clan, limit: 50 });
  } catch (error) {
    if (sequence === jutsuSearchSequence) $("#jutsu-results").innerHTML = `<p class="muted-copy">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (sequence !== jutsuSearchSequence) return;
  const results = response.items;
  results.forEach((entry) => upsert(state.rules.jutsu, entry));
  $("#jutsu-results").innerHTML = results.map((entry) => `<article class="jutsu-card"><header><h4>${escapeHtml(entry.name)}</h4><span class="jutsu-meta">${escapeHtml(entry.rank)} · ${escapeHtml(entry.cost)}</span></header><div class="keyword-tags"><span class="keyword classification">${escapeHtml(entry.classification)}</span>${keywordList(entry.keywords).map((item) => `<span class="keyword">${escapeHtml(item)}</span>`).join("")}</div><div class="jutsu-facts"><span>${escapeHtml(entry.castingTime)}</span><span>${escapeHtml(entry.range)}</span><span>${escapeHtml(entry.components)}</span></div>${jutsuDescriptionMarkup(entry)}<button class="button ${selected.has(entry.id) ? "ghost" : "primary"}" data-add-jutsu="${entry.id}" ${selected.has(entry.id) ? "disabled" : ""}>${selected.has(entry.id) ? "Selected" : "Add jutsu"}</button></article>`).join("") || "<p>No jutsu match those filters.</p>";
  $$('[data-add-jutsu]').forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try { await applyEvaluation(await api("/api/v1/jutsu/select", { character: state.character, jutsuId: button.dataset.addJutsu, target: { kind: "character", level: state.character.level } })); persistCharacter(); renderAll(); }
    catch (error) { button.disabled = false; showNotice(error.message || "Could not add that jutsu.", true); }
  }));
}

function renderSelectedJutsu() {
  $("#selected-jutsu").innerHTML = state.character.jutsu.map((entry, index) => { const rule = find(state.rules.jutsu, entry.id) || entry; return `<div class="selected-item"><div><span>${escapeHtml(entry.name)} <small>${escapeHtml(entry.rank)}</small></span><div class="keyword-tags compact-tags">${keywordList(rule.keywords).map((item) => `<span class="keyword">${escapeHtml(item)}</span>`).join("")}</div></div><input type="number" min="1" max="20" value="${entry.level}" aria-label="Level learned" data-jutsu-level="${index}"><button class="icon-button" data-remove-jutsu="${index}" aria-label="Remove ${escapeHtml(entry.name)}">×</button></div>`; }).join("") || "<p>No jutsu selected yet.</p>";
  $$('[data-jutsu-level]').forEach((input) => input.addEventListener("input", () => { state.character.jutsu[Number(input.dataset.jutsuLevel)].level = Math.min(20, Math.max(1, Number(input.value) || 1)); saveAndRender(); }));
  $$('[data-remove-jutsu]').forEach((button) => button.addEventListener("click", () => { state.character.jutsu.splice(Number(button.dataset.removeJutsu), 1); saveAndRender(); }));
}

function renderTimeline() {
  $("#timeline").innerHTML = levelTimeline().map((entry) => {
    const allFeatures = [...entry.classFeatures, ...entry.subclassFeatures, ...entry.clanFeatures];
    const tags = [
      ...entry.classFeatures.map((feature) => `<span class="tag" title="${escapeHtml(feature.description)}">${escapeHtml(feature.name)}</span>`),
      ...entry.subclassFeatures.map((feature) => `<span class="tag">${escapeHtml(feature.name)}</span>`),
      ...entry.clanFeatures.map((feature) => `<span class="tag clan">${escapeHtml(feature.name)}</span>`),
      ...entry.jutsu.map((jutsu) => `<span class="tag jutsu">${escapeHtml(jutsu.name)}</span>`),
    ].join("");
    const structuredNames = new Set(entry.progressionChoices.map((choice) => choice.featureName));
    const decisions = allFeatures.filter((feature) => featureNeedsChoice(feature) && ![...structuredNames].some((name) => feature.name.startsWith(name))).map((feature) => { const key = `${entry.level}:${feature.name}`; return `<label class="feature-choice"><span>${escapeHtml(feature.name)} decision</span><input data-feature-choice="${encodeURIComponent(key)}" value="${escapeHtml(state.character.featureChoices[key] || "")}" placeholder="Record the selected option…"${entry.attained ? "" : " disabled"}></label>`; }).join("");
    const structured = entry.progressionChoices.map((group) => progressionChoiceMarkup(group, group.selection, !entry.attained)).join("");
    const featureDetails = allFeatures.map((feature) => `<details class="feature-detail"><summary><span>${escapeHtml(feature.type || "Feature")}</span>${escapeHtml(feature.name)}</summary><p>${escapeHtml(feature.description || "Full rules text has not yet been verified in the Forge catalogue.")}</p>${feature.action && feature.action !== "None" ? `<small>Action: ${escapeHtml(feature.action)}</small>` : ""}</details>`).join("");
    const subclassChoice = state.view.selection.class?.subclassLevel === entry.level ? `<label class="timeline-subclass"><span>Subclass choice</span><select data-inline-subclass${entry.attained ? "" : " disabled"}>${optionMarkup(state.rules.subclasses.filter((item) => item.className === state.view.selection.class.name), "Choose subclass")}</select></label>` : "";
    return `<article class="level-row${entry.attained ? " attained" : " future"}${entry.level === state.character.level ? " current" : ""}"><div class="level-number">${entry.attained ? "Level" : "Preview"}<strong>${entry.level}</strong>PB ${signed(entry.proficiency)}</div><div class="level-content"><header class="level-heading"><div><span>${entry.level === state.character.level ? "Current level" : entry.attained ? "Completed level" : "Future level"}</span><strong>${allFeatures.length} feature${allFeatures.length === 1 ? "" : "s"}${entry.progressionChoices.length ? ` · ${entry.progressionChoices.length} guided choice${entry.progressionChoices.length === 1 ? "" : "s"}` : ""}</strong></div>${entry.attained ? "" : `<button type="button" class="button ghost compact-button" data-set-level="${entry.level}">Set level ${entry.level}</button>`}</header><div class="feature-tags">${tags || '<span class="tag">No automatic features recorded</span>'}</div>${featureDetails ? `<div class="feature-detail-list">${featureDetails}</div>` : ""}${subclassChoice}${structured}${decisions ? `<div class="feature-decisions">${decisions}</div>` : ""}<label class="level-notes"><span>Level notes</span><textarea data-level-note="${entry.level}" placeholder="Record feat choices, ASIs, optional features, training, or other decisions…"${entry.attained ? "" : " disabled"}>${escapeHtml(entry.choices)}</textarea></label></div></article>`;
  }).join("");
  $$('[data-inline-subclass]').forEach((control) => { control.value = state.character.subclassId; control.addEventListener("change", () => { state.character.subclassId = control.value; saveAndRender(); }); });
  $$('[data-set-level]').forEach((button) => button.addEventListener("click", () => { state.character.level = Number(button.dataset.setLevel); saveAndRender(); }));
  bindProgressionChoiceControls($("#timeline"));
  $$('[data-feature-choice]').forEach((field) => field.addEventListener("change", () => { state.character.featureChoices[decodeURIComponent(field.dataset.featureChoice)] = field.value; saveAndRender(); }));
  $$('[data-level-note]').forEach((field) => field.addEventListener("change", () => { state.character.levelChoices[field.dataset.levelNote] = field.value; saveAndRender(); }));
}

function renderReview() {
  const problems = validateCharacter(state.character, state.rules);
  $("#validation").className = `validation ${problems.length ? "problem" : "ok"}`;
  $("#validation").innerHTML = problems.length ? `<strong>${problems.length} item${problems.length === 1 ? "" : "s"} to review</strong><ul>${problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ul>` : "No structural problems found. The exported JSON is ready to share.";
  const cls = find(state.rules.classes, state.character.classId); const clan = find(state.rules.clans, state.character.clanId); const subclass = find(state.rules.subclasses, state.character.subclassId); const background = find(state.rules.backgrounds, state.character.backgroundId);
  const trainedSkills = state.rules.proficiencies.skills.filter((skill) => effectiveSkillDegree(state.character, state.rules, skill.id) >= 1).length;
  const masteredSkills = state.rules.proficiencies.skills.filter((skill) => effectiveSkillDegree(state.character, state.rules, skill.id) >= 2).length;
  const toolkitCount = state.character.proficiencies.toolkits.length + grantedToolkits(state.character, state.rules).length;
  const releaseIds = new Set(CAPABILITY_GROUPS.slice(0, 2).flatMap((group) => group.entries.map((entry) => entry.id)));
  const releases = CAPABILITY_ENTRIES.filter((entry) => releaseIds.has(entry.id) && capabilityStatus(entry).enabled).map((entry) => entry.name).concat(state.character.capabilities.custom.map((entry) => entry.name).filter(Boolean));
  const specialAccess = CAPABILITY_GROUPS[2].entries.filter((entry) => capabilityStatus(entry).enabled).map((entry) => entry.name);
  $("#review-sheet").innerHTML = `<div class="review-title"><div><h4>${escapeHtml(state.character.name || "Unnamed shinobi")}</h4><p>${escapeHtml([clan?.name, cls?.name, subclass?.name].filter(Boolean).join(" · ") || "Build incomplete")}</p></div><strong>Level ${state.character.level}</strong></div><div class="review-grid">${ABILITIES.map((ability) => `<div class="review-stat"><span>${ability.slice(0,3)}</span><strong>${state.character.abilities[ability]} (${signed(abilityModifier(state.character.abilities[ability]))})</strong></div>`).join("")}<div class="review-stat"><span>Background</span><strong>${escapeHtml(background?.name || "—")}</strong></div><div class="review-stat"><span>Skills</span><strong>${trainedSkills} proficient · ${masteredSkills} mastered</strong></div><div class="review-stat"><span>Toolkits</span><strong>${toolkitCount}</strong></div><div class="review-stat"><span>Releases</span><strong>${escapeHtml(releases.join(", ") || "None recorded")}</strong></div><div class="review-stat"><span>Special access</span><strong>${escapeHtml(specialAccess.join(", ") || "None recorded")}</strong></div><div class="review-stat"><span>Jutsu</span><strong>${state.character.jutsu.length}</strong></div><div class="review-stat"><span>Equipment</span><strong>${state.character.equipment.items.length + Object.values(state.character.equipment.startingChoices).filter(Boolean).length}</strong></div><div class="review-stat"><span>Summons</span><strong>${state.character.summons.length}</strong></div><div class="review-stat"><span>Puppets</span><strong>${state.character.puppets.length}</strong></div></div>`;
}

async function exportCharacter() {
  try {
    const result = await api("/api/v1/export", { character: state.character });
    const safeName = (result.character.name || "shinobi").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const blob = new Blob([JSON.stringify(result.character, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${safeName || "shinobi"}.naruto5e.json`; link.click(); URL.revokeObjectURL(link.href);
    showNotice(result.valid ? "Server-validated character JSON exported." : `Character JSON exported with ${result.problems.length} validation warning${result.problems.length === 1 ? "" : "s"}.`);
  } catch (error) { showNotice(error.message || "Could not export this character.", true); }
}

async function importCharacter(event) {
  const file = event.target.files[0]; if (!file) return;
  try {
    const result = await api("/api/v1/import", { character: JSON.parse(await file.text()) });
    state.view = result;
    state.character = result.character;
    upsert(state.rules.classes, result.selection.class); upsert(state.rules.subclasses, result.selection.subclass); upsert(state.rules.clans, result.selection.clan); upsert(state.rules.backgrounds, result.selection.background);
    await hydrateSupportData();
    persistCharacter(); renderAll(); showStep("review"); showNotice(`Loaded and server-validated ${file.name}.`);
  }
  catch (error) { showNotice(error.message || "Could not import that file.", true); }
  event.target.value = "";
}

function showNotice(message, error = false) { const notice = $("#notice"); notice.textContent = message; notice.className = `notice${error ? " error" : ""}`; setTimeout(() => notice.classList.add("hidden"), 4500); }

loadRules().catch((error) => { showNotice(error.message, true); $("#save-status").textContent = "Rules failed to load"; });
