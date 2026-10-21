export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const SUMMON_RANK_ORDER = ["D-Rank", "C-Rank", "B-Rank", "A-Rank", "S-Rank"];
export const PUPPET_UPGRADE_TIERS = ["Wood", "Bronze", "Silver", "Gold", "Platinum"];
export const STANDARD_ARRAY = [15, 14, 13, 12, 11, 10];
export const ABILITY_POINT_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const ABILITY_POINT_BUDGET = 30;

import { featValidationProblems } from "./feat-system.mjs";

const PUPPET_SLOT_TABLE = [
  {},
  {}, { Wood: 2 }, { Wood: 2 }, { Wood: 3 }, { Wood: 3 },
  { Wood: 4, Bronze: 2 }, { Wood: 4, Bronze: 2 }, { Wood: 4, Bronze: 3 }, { Wood: 4, Bronze: 3 },
  { Wood: 4, Bronze: 3, Silver: 2 }, { Wood: 4, Bronze: 3, Silver: 2 },
  { Wood: 4, Bronze: 3, Silver: 3 }, { Wood: 4, Bronze: 3, Silver: 3 },
  { Wood: 4, Bronze: 3, Silver: 3, Gold: 1 }, { Wood: 4, Bronze: 3, Silver: 3, Gold: 1 },
  { Wood: 4, Bronze: 3, Silver: 3, Gold: 2 }, { Wood: 4, Bronze: 3, Silver: 3, Gold: 2 },
  { Wood: 4, Bronze: 3, Silver: 3, Gold: 3, Platinum: 1 }, { Wood: 4, Bronze: 3, Silver: 3, Gold: 3, Platinum: 1 },
  { Wood: 4, Bronze: 3, Silver: 3, Gold: 3, Platinum: 2 },
];

export function abilityModifier(score) {
  const number = Number(score) || 0;
  return Math.floor((number - 10) / 2);
}

export function proficiencyBonus(level) {
  const safeLevel = Math.min(20, Math.max(1, Number(level) || 1));
  return 3 + Math.floor((safeLevel - 1) / 3);
}

export function masteryRankCap(level) {
  const safeLevel = Math.min(20, Math.max(1, Number(level) || 1));
  if (safeLevel >= 12) return 3;
  if (safeLevel >= 7) return 2;
  return 1;
}

export function proficiencyDegreeBonus(level, degree) {
  const safeDegree = Math.min(4, Math.max(0, Number(degree) || 0));
  return safeDegree ? proficiencyBonus(level) + ((safeDegree - 1) * 2) : 0;
}

export function emptyCharacter() {
  const baseAbilities = Object.fromEntries(ABILITIES.map((ability) => [ability, 10]));
  return {
    schema: "naruto5e-character",
    schemaVersion: 9,
    appVersion: "0.9.0",
    name: "",
    player: "",
    level: 1,
    classId: "",
    subclassId: "",
    clanId: "",
    backgroundId: "",
    ambition: "",
    alignment: "",
    notes: "",
    abilityMethod: "manual",
    baseAbilities,
    abilities: { ...baseAbilities },
    abilityIncreases: {
      clanPrimary: "",
      clanSecondary: "",
      backgroundMode: "ability",
      backgroundAbility: "",
      classLevels: {},
      manual: Object.fromEntries(ABILITIES.map((ability) => [ability, 0])),
    },
    jutsu: [],
    feats: [],
    featSettings: { allowRare: false },
    equipment: { ryo: 100, startingChoices: {}, startingDetails: {}, items: [] },
    summons: [],
    puppets: [],
    proficiencies: { skills: {}, toolkits: [], grantChoices: {} },
    capabilities: {
      entries: {},
      custom: [],
      trainingExtras: { armor: "", weapons: "", ninjaTools: "", savingThrows: "" },
      trainingSelections: { armor: [], weapons: [], ninjaTools: [], savingThrows: [] },
    },
    featureChoices: {},
    levelChoices: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeCharacter(input) {
  if (!input || input.schema !== "naruto5e-character") {
    throw new Error("This is not a Naruto 5e character JSON file.");
  }
  const base = emptyCharacter();
  const level = Math.min(20, Math.max(1, Number(input.level) || 1));
  const sourceScores = input.baseAbilities || input.abilities || {};
  const increases = {
    ...base.abilityIncreases,
    ...(input.abilityIncreases || {}),
    classLevels: input.abilityIncreases?.classLevels && typeof input.abilityIncreases.classLevels === "object" ? input.abilityIncreases.classLevels : {},
    manual: Object.fromEntries(ABILITIES.map((ability) => [ability, Number(input.abilityIncreases?.manual?.[ability]) || 0])),
  };
  const character = {
    ...base,
    ...input,
    level,
    abilityMethod: ["manual", "pointBuy", "standardArray"].includes(input.abilityMethod) ? input.abilityMethod : "manual",
    baseAbilities: Object.fromEntries(ABILITIES.map((ability) => [ability, Math.min(30, Math.max(1, Number(sourceScores[ability]) || 10))])),
    abilityIncreases: increases,
    jutsu: Array.isArray(input.jutsu) ? input.jutsu.filter((entry) => entry && entry.id) : [],
    feats: Array.isArray(input.feats) ? input.feats.filter((entry) => entry && typeof entry === "object").map((entry) => ({
      slotId: String(entry.slotId || ""),
      featId: String(entry.featId || ""),
      level: Math.min(20, Math.max(1, Number(entry.level) || level)),
      source: String(entry.source || ""),
      choices: entry.choices && typeof entry.choices === "object" ? Object.fromEntries(Object.entries(entry.choices).map(([id, values]) => [id, Array.isArray(values) ? values.filter(Boolean).map(String) : []])) : {},
    })) : [],
    featSettings: { allowRare: Boolean(input.featSettings?.allowRare) },
    equipment: {
      ryo: Math.max(0, Number(input.equipment?.ryo ?? 100) || 0),
      startingChoices: input.equipment?.startingChoices && typeof input.equipment.startingChoices === "object" ? input.equipment.startingChoices : {},
      startingDetails: input.equipment?.startingDetails && typeof input.equipment.startingDetails === "object" ? input.equipment.startingDetails : {},
      items: Array.isArray(input.equipment?.items) ? input.equipment.items.filter((entry) => entry && entry.name) : [],
    },
    summons: Array.isArray(input.summons) ? input.summons.filter((entry) => entry && typeof entry === "object").map((summon) => ({
      ...summon,
      roleMode: summon.roleMode === "dual" ? "dual" : "single",
      primaryRole: summon.primaryRole || summon.role || "Striker",
      secondaryRole: summon.secondaryRole || "",
      statIncreases: Object.fromEntries(ABILITIES.map((ability) => [ability, Math.max(0, Number(summon.statIncreases?.[ability]) || 0)])),
      featuresByRank: summon.featuresByRank && typeof summon.featuresByRank === "object" ? summon.featuresByRank : {},
      jutsu: Array.isArray(summon.jutsu) ? summon.jutsu.filter((entry) => entry && entry.id) : [],
      hpAdjustment: Number(summon.hpAdjustment) || 0,
      acAdjustment: Number(summon.acAdjustment) || 0,
    })) : [],
    puppets: Array.isArray(input.puppets) ? input.puppets.filter((entry) => entry && typeof entry === "object").map((puppet) => ({
      ...puppet,
      name: String(puppet.name || ""),
      technique: String(puppet.technique || ""),
      chassis: String(puppet.chassis || "Standard"),
      size: String(puppet.size || "Medium"),
      chassisAbility: String(puppet.chassisAbility || ""),
      statIncreases: Object.fromEntries(ABILITIES.map((ability) => [ability, Math.max(0, Number(puppet.statIncreases?.[ability]) || 0)])),
      upgrades: Array.isArray(puppet.upgrades) ? puppet.upgrades.filter((entry) => entry && typeof entry === "object").map((upgrade) => ({ name: String(upgrade.name || ""), tier: PUPPET_UPGRADE_TIERS.includes(upgrade.tier) ? upgrade.tier : "Wood", free: Boolean(upgrade.free), notes: String(upgrade.notes || "") })) : [],
      seals: Array.isArray(puppet.seals) ? puppet.seals.filter(Boolean).map(String) : [],
      weapons: Array.isArray(puppet.weapons) ? puppet.weapons.filter(Boolean).map(String) : [],
      jutsu: Array.isArray(puppet.jutsu) ? puppet.jutsu.filter((entry) => entry && entry.id) : [],
      hijutsuAccess: Boolean(puppet.hijutsuAccess),
      hpAdjustment: Number(puppet.hpAdjustment) || 0,
      acAdjustment: Number(puppet.acAdjustment) || 0,
      speedAdjustment: Number(puppet.speedAdjustment) || 0,
      notes: String(puppet.notes || ""),
    })) : [],
    proficiencies: {
      skills: Object.fromEntries(Object.entries(input.proficiencies?.skills || {}).map(([skillId, entry]) => {
        const value = typeof entry === "number" ? { degree: entry, source: "" } : entry || {};
        return [skillId, { degree: Math.min(4, Math.max(0, Number(value.degree) || 0)), source: String(value.source || "") }];
      })),
      toolkits: Array.isArray(input.proficiencies?.toolkits) ? input.proficiencies.toolkits.filter((entry) => entry && typeof entry === "object").map((entry) => ({
        id: String(entry.id || crypto.randomUUID()),
        name: String(entry.name || ""),
        degree: Math.min(4, Math.max(0, Number(entry.degree) || 0)),
        source: String(entry.source || ""),
      })) : [],
      grantChoices: input.proficiencies?.grantChoices && typeof input.proficiencies.grantChoices === "object" ? Object.fromEntries(Object.entries(input.proficiencies.grantChoices).map(([id, values]) => [id, Array.isArray(values) ? values.filter(Boolean).map(String) : []])) : {},
    },
    capabilities: {
      entries: input.capabilities?.entries && typeof input.capabilities.entries === "object" ? Object.fromEntries(Object.entries(input.capabilities.entries).map(([id, entry]) => [id, { enabled: Boolean(entry?.enabled), source: String(entry?.source || "") }])) : {},
      custom: Array.isArray(input.capabilities?.custom) ? input.capabilities.custom.filter((entry) => entry && typeof entry === "object").map((entry) => ({ id: String(entry.id || crypto.randomUUID()), name: String(entry.name || ""), source: String(entry.source || "") })) : [],
      trainingExtras: {
        armor: String(input.capabilities?.trainingExtras?.armor || ""),
        weapons: String(input.capabilities?.trainingExtras?.weapons || ""),
        ninjaTools: String(input.capabilities?.trainingExtras?.ninjaTools || ""),
        savingThrows: String(input.capabilities?.trainingExtras?.savingThrows || ""),
      },
      trainingSelections: Object.fromEntries(["armor", "weapons", "ninjaTools", "savingThrows"].map((key) => [key,
        [...new Set((Array.isArray(input.capabilities?.trainingSelections?.[key]) ? input.capabilities.trainingSelections[key] : []).filter(Boolean).map(String))],
      ])),
    },
    featureChoices: input.featureChoices && typeof input.featureChoices === "object" ? input.featureChoices : {},
    levelChoices: input.levelChoices && typeof input.levelChoices === "object" ? input.levelChoices : {},
    updatedAt: new Date().toISOString(),
  };
  return syncAbilityScores(character);
}

export function startingWeaponRequirements(choice = "") {
  const requirements = [];
  for (const match of choice.matchAll(/(\d+)\s+(Simple|Martial|Exotic)\s+Weapons?/gi)) {
    for (let index = 0; index < Number(match[1]); index += 1) requirements.push(match[2][0].toUpperCase() + match[2].slice(1).toLowerCase());
  }
  return requirements;
}

export function startingToolkitRequirements(choice = "") {
  const match = String(choice).match(/(\d+)\s+(?:Tool\s+)?Kits?\s+of\s+your\s+choice/i);
  return match ? Math.min(10, Math.max(0, Number(match[1]) || 0)) : 0;
}

export function summonRankDetails(tribe, rank, rules) {
  return tribe?.ranks?.[rank] || rules?.summons?.ranks?.[rank] || { level: 4, asiPoints: 0, statMax: 20 };
}

export function summonFinalAbilities(summon, tribe) {
  const base = tribe?.abilities || summon.abilities || {};
  return Object.fromEntries(ABILITIES.map((ability) => [ability, (Number(base[ability]) || 10) + (Number(summon.statIncreases?.[ability]) || 0)]));
}

export function summonDerivedStats(summon, tribe, rules) {
  const rank = summonRankDetails(tribe, summon.rank, rules);
  const abilities = summonFinalAbilities(summon, tribe);
  const roles = [summon.primaryRole || "Striker", ...(summon.roleMode === "dual" && summon.secondaryRole ? [summon.secondaryRole] : [])];
  const rankIndex = Math.max(0, SUMMON_RANK_ORDER.indexOf(summon.rank));
  const defenderBonus = roles.includes("Defender") ? [1, 1, 2, 2, 3][rankIndex] : 0;
  const toughness = Number(summon.toughnessOverride ?? tribe?.toughness ?? tribe?.hitDie ?? 0) || 0;
  const defensiveAbility = ABILITIES.includes(tribe?.defensiveAbility) ? tribe.defensiveAbility : "";
  const defensiveModifier = defensiveAbility
    ? abilityModifier(abilities[defensiveAbility])
    : Number(summon.defensiveModifierOverride ?? tribe?.defensiveModifier ?? 0) || 0;
  const hp = Math.max(1, (toughness + abilityModifier(abilities.constitution)) * Number(rank.level || 4) + (Number(summon.hpAdjustment) || 0));
  const ac = 10 + Math.round(Number(rank.level || 4) / 2 + defensiveModifier) + defenderBonus + (Number(summon.acAdjustment) || 0);
  return { rank, abilities, roles, hp, ac, toughness, defensiveAbility, defensiveModifier };
}

export function puppetUpgradeCapacity(level) {
  const safeLevel = Math.min(20, Math.max(1, Number(level) || 1));
  return { ...PUPPET_SLOT_TABLE[safeLevel] };
}

export function puppetAllowedCount(level) {
  const safeLevel = Math.min(20, Math.max(1, Number(level) || 1));
  if (safeLevel >= 15) return 4;
  if (safeLevel >= 9) return 3;
  if (safeLevel >= 6) return 2;
  return 1;
}

export function puppetAbilityPointPool(level) {
  return CLASS_ASI_LEVELS.filter((entry) => entry <= Number(level)).length * 2;
}

export function puppetBaseAbilities(puppet = {}) {
  const scores = { strength: 15, dexterity: 13, constitution: 13, intelligence: 5, wisdom: 5, charisma: 5 };
  if (puppet.chassis === "Quadrupedal") { scores.strength = 16; scores.constitution = 16; }
  if (puppet.chassis === "Warforged") { scores.strength = 16; scores.dexterity = 16; }
  if (puppet.chassis === "Winged") { scores.dexterity = 18; scores.constitution = 14; }
  if (puppet.chassis === "Specialized" && ABILITIES.includes(puppet.chassisAbility)) scores[puppet.chassisAbility] += 2;
  return scores;
}

export function puppetDerivedStats(puppet, level) {
  const safeLevel = Math.min(20, Math.max(1, Number(level) || 1));
  const base = puppetBaseAbilities(puppet);
  const abilities = Object.fromEntries(ABILITIES.map((ability) => [ability, base[ability] + (Number(puppet.statIncreases?.[ability]) || 0)]));
  const speedBase = puppet.chassis === "Quadrupedal" ? 35 : 30;
  return {
    abilities,
    hp: Math.max(1, 4 + ((5 + abilityModifier(abilities.constitution)) * safeLevel) + (Number(puppet.hpAdjustment) || 0)),
    ac: 13 + proficiencyBonus(safeLevel) + (Number(puppet.acAdjustment) || 0),
    speed: Math.max(0, speedBase + (Number(puppet.speedAdjustment) || 0)),
    flySpeed: puppet.chassis === "Winged" ? Math.max(0, speedBase + (Number(puppet.speedAdjustment) || 0)) : 0,
    sealSlots: safeLevel >= 3 ? 2 + proficiencyBonus(safeLevel) : 0,
    repairDie: safeLevel >= 15 ? "2d10" : safeLevel >= 9 ? "2d8" : "2d6",
  };
}

export function puppetUpgradeProblems(puppets, level) {
  const capacity = puppetUpgradeCapacity(level);
  const used = PUPPET_UPGRADE_TIERS.map((tier) => (puppets || []).flatMap((puppet) => puppet.upgrades || []).filter((upgrade) => !upgrade.free && upgrade.name.trim() && PUPPET_UPGRADE_TIERS.indexOf(upgrade.tier) >= PUPPET_UPGRADE_TIERS.indexOf(tier)).length);
  const available = PUPPET_UPGRADE_TIERS.map((tier) => PUPPET_UPGRADE_TIERS.slice(PUPPET_UPGRADE_TIERS.indexOf(tier)).reduce((sum, slotTier) => sum + (Number(capacity[slotTier]) || 0), 0));
  return PUPPET_UPGRADE_TIERS.filter((_, index) => used[index] > available[index]).map((tier, index) => `Too many ${tier} tier or higher puppet upgrades are installed for level ${level}.`);
}

export const CLASS_ASI_LEVELS = [4, 8, 12, 16, 19];

export function abilityBreakdown(character, ability) {
  const increases = character.abilityIncreases || {};
  const classIncrease = Object.entries(increases.classLevels || {}).filter(([level, chosen]) => Number(level) <= Number(character.level) && chosen === ability).length;
  return {
    base: Number(character.baseAbilities?.[ability] ?? character.abilities?.[ability]) || 10,
    clan: (increases.clanPrimary === ability ? 2 : 0) + (increases.clanSecondary === ability ? 1 : 0),
    background: increases.backgroundMode === "ability" && increases.backgroundAbility === ability ? 1 : 0,
    class: classIncrease,
    manual: Number(increases.manual?.[ability]) || 0,
  };
}

export function finalAbilityScore(character, ability) {
  return Object.values(abilityBreakdown(character, ability)).reduce((total, value) => total + value, 0);
}

export function syncAbilityScores(character) {
  character.abilities = Object.fromEntries(ABILITIES.map((ability) => [ability, finalAbilityScore(character, ability)]));
  return character;
}

export function activeProficiencyGrants(character, rules) {
  const selectedClass = rules.classes?.find((entry) => entry.id === character.classId);
  const selectedBackground = rules.backgrounds?.find((entry) => entry.id === character.backgroundId);
  const sources = [
    { key: "class", label: selectedClass ? `Class: ${selectedClass.name}` : "Class", groups: selectedClass?.skillGrants || [] },
    { key: "background", label: selectedBackground ? `Background: ${selectedBackground.name}` : "Background", groups: selectedBackground?.proficiencyGrants?.skills || [] },
  ];
  const bySkill = {};
  for (const source of sources) for (const group of source.groups) {
    const chosen = group.fixed ? group.options : (character.proficiencies?.grantChoices?.[group.id] || []).slice(0, group.count);
    for (const originalSkillId of chosen) {
      const replacementKey = `overlap-${source.key}-${group.id}-${originalSkillId}`;
      const skillId = bySkill[originalSkillId]?.length ? character.proficiencies?.grantChoices?.[replacementKey]?.[0] : originalSkillId;
      if (skillId) (bySkill[skillId] ||= []).push(source.label);
    }
  }
  return bySkill;
}

export function proficiencyGrantOverlaps(character, rules) {
  const selectedClass = rules.classes?.find((entry) => entry.id === character.classId);
  const selectedBackground = rules.backgrounds?.find((entry) => entry.id === character.backgroundId);
  const sources = [
    { key: "class", label: selectedClass?.name || "Class", groups: selectedClass?.skillGrants || [] },
    { key: "background", label: selectedBackground?.name || "Background", groups: selectedBackground?.proficiencyGrants?.skills || [] },
  ];
  const seen = new Set();
  const overlaps = [];
  for (const source of sources) for (const group of source.groups) {
    const chosen = group.fixed ? group.options : (character.proficiencies?.grantChoices?.[group.id] || []).slice(0, group.count);
    for (const skillId of chosen) {
      if (seen.has(skillId)) overlaps.push({ key: `overlap-${source.key}-${group.id}-${skillId}`, skillId, source: source.label });
      else seen.add(skillId);
    }
  }
  return overlaps;
}

export function effectiveSkillDegree(character, rules, skillId) {
  const manual = Number(character.proficiencies?.skills?.[skillId]?.degree) || 0;
  return Math.max(manual, activeProficiencyGrants(character, rules)[skillId]?.length ? 1 : 0);
}

export function grantedToolkits(character, rules) {
  const background = rules.backgrounds?.find((entry) => entry.id === character.backgroundId);
  const grants = background?.proficiencyGrants;
  if (!grants) return [];
  const result = (grants.toolkits || []).map((name) => ({ name, source: `Background: ${background.name}` }));
  const selected = character.proficiencies?.grantChoices?.[`background-toolkit-${background.id}`] || [];
  for (const name of selected) if (name) result.push({ name, source: `Background: ${background.name}` });
  return result;
}

function progressionOptions(source, character, rules) {
  if (!source?.optionsSource) return source?.options || [];
  if (source.optionsSource.type.startsWith("proficient-")) {
    const skills = (rules.proficiencies?.skills || []).filter((entry) => effectiveSkillDegree(character, rules, entry.id) > 0).map((entry) => ({ id: `skill:${entry.id}`, name: entry.name, ...(source.dynamicFollowUp ? { followUps: [source.dynamicFollowUp] } : {}) }));
    const toolkitNames = [...new Set([...grantedToolkits(character, rules).map((entry) => entry.name), ...(character.proficiencies?.toolkits || []).filter((entry) => Number(entry.degree) > 0).map((entry) => entry.name)].filter(Boolean))];
    const tools = toolkitNames.map((name) => ({ id: `tool:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name }));
    if (source.optionsSource.type === "proficient-skills") return skills;
    if (source.optionsSource.type === "proficient-tools") return tools;
    return [...skills, ...tools];
  }
  if (source.optionsSource.type !== "known-jutsu") return [];
  const rankOrder = ["E-Rank", "D-Rank", "C-Rank", "B-Rank", "A-Rank", "S-Rank"];
  return (character.jutsu || []).map((known) => rules.jutsu?.find((entry) => entry.id === known.id) || known).filter((entry) => {
    if (source.optionsSource.rank && entry.rank !== source.optionsSource.rank) return false;
    if (source.optionsSource.maxRank && rankOrder.indexOf(entry.rank) > rankOrder.indexOf(source.optionsSource.maxRank)) return false;
    const keywords = String(entry.keywords || "").split(/[,;/]/).map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (source.optionsSource.keyword && entry.keywords && !keywords.includes(source.optionsSource.keyword.toLowerCase())) return false;
    if (source.optionsSource.excludeKeyword && keywords.includes(source.optionsSource.excludeKeyword.toLowerCase())) return false;
    return true;
  }).map((entry) => ({ id: entry.id, name: entry.name }));
}

function progressionSelectionCount(selection, character) {
  if (!selection.dynamicCountAbility) return Number(selection.count) || 0;
  return Math.max(Number(selection.minimum) || 0, abilityModifier(character.abilities?.[selection.dynamicCountAbility]));
}

export function validateCharacter(character, rules) {
  const problems = [];
  if (!character.name.trim()) problems.push("Give the character a name.");
  if (!rules.classes.some((entry) => entry.id === character.classId)) problems.push("Choose a class.");
  if (!rules.clans.some((entry) => entry.id === character.clanId)) problems.push("Choose a clan.");
  if (!rules.backgrounds.some((entry) => entry.id === character.backgroundId)) problems.push("Choose a background.");
  const selectedClass = rules.classes.find((entry) => entry.id === character.classId);
  const masteryCap = masteryRankCap(character.level);
  for (const skill of rules.proficiencies?.skills || []) {
    const degree = effectiveSkillDegree(character, rules, skill.id);
    if (Math.max(0, degree - 1) > masteryCap) problems.push(`${skill.name} exceeds the Mastery ${masteryCap} limit for level ${character.level}.`);
  }
  for (const toolkit of character.proficiencies?.toolkits || []) {
    if (Math.max(0, Number(toolkit.degree) - 1) > masteryCap) problems.push(`${toolkit.name || "A toolkit"} exceeds the Mastery ${masteryCap} limit for level ${character.level}.`);
  }
  const grantGroups = [...(selectedClass?.skillGrants || []), ...(rules.backgrounds.find((entry) => entry.id === character.backgroundId)?.proficiencyGrants?.skills || [])];
  for (const group of grantGroups.filter((entry) => !entry.fixed)) {
    const chosen = character.proficiencies?.grantChoices?.[group.id] || [];
    if (chosen.length < group.count || new Set(chosen).size < group.count) problems.push(`Complete ${group.label.toLowerCase()} for class/background proficiencies.`);
  }
  const background = rules.backgrounds.find((entry) => entry.id === character.backgroundId);
  const toolkitGrant = background?.proficiencyGrants;
  if ((toolkitGrant?.toolkitOptions || toolkitGrant?.toolkitChoice) && !(character.proficiencies?.grantChoices?.[`background-toolkit-${background.id}`]?.[0] || "").trim()) problems.push(`Choose the toolkit granted by ${background.name}.`);
  for (const overlap of proficiencyGrantOverlaps(character, rules)) {
    const replacement = character.proficiencies?.grantChoices?.[overlap.key]?.[0];
    if (!replacement) problems.push(`Choose a replacement for the duplicate ${overlap.skillId} proficiency from ${overlap.source}.`);
    else if (replacement === overlap.skillId || (activeProficiencyGrants(character, rules)[replacement]?.length || 0) > 1) problems.push(`The replacement proficiency for ${overlap.source} must be a different, ungranted skill.`);
  }
  if (character.subclassId) {
    const subclass = rules.subclasses.find((entry) => entry.id === character.subclassId);
    if (!subclass || subclass.className !== selectedClass?.name) problems.push("The chosen subclass does not belong to the chosen class.");
  }
  if (selectedClass?.subclassLevel && Number(character.level) >= Number(selectedClass.subclassLevel) && !character.subclassId) {
    problems.push(`Choose a ${selectedClass.name} subclass gained at level ${selectedClass.subclassLevel}.`);
  }
  for (const group of selectedClass?.progressionChoices || []) {
    const allowed = new Map(progressionOptions(group, character, rules).map((entry) => [entry.id, entry]));
    const used = new Set();
    const usedFollowUps = new Map();
    for (const selection of group.selections || []) {
      if (Number(selection.level) > Number(character.level)) continue;
      const key = `progression:${group.id}:${selection.level}`;
      const raw = character.featureChoices?.[key];
      const chosen = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
      const slotBudget = Number(selection.slotBudget) || 0;
      const spentSlots = chosen.reduce((total, id) => total + Number(allowed.get(id)?.slotCost || 1), 0);
      const requiredCount = progressionSelectionCount(selection, character);
      if (slotBudget ? (new Set(chosen).size !== chosen.length || spentSlots > slotBudget) : (chosen.length !== requiredCount || new Set(chosen).size !== requiredCount)) {
        if (slotBudget) problems.push(`${group.label} selections must fit within ${slotBudget} slots; Major choices cost two slots.`);
        else problems.push(`Choose ${requiredCount} ${group.label}${requiredCount === 1 ? "" : "s"} for level ${selection.level}.`);
        continue;
      }
      if (chosen.some((id) => !allowed.has(id))) problems.push(`${group.label} contains an option that is not available to ${selectedClass.name}.`);
      chosen.forEach((id, choiceIndex) => {
        const selectedOption = allowed.get(id);
        if (!selectedOption) return;
        if (used.has(id) && !selectedOption.allowRepeat) problems.push(`${selectedOption.name} cannot be selected more than once.`);
        used.add(id);
        if (selectedOption.minLevel && Number(selection.level) < Number(selectedOption.minLevel)) problems.push(`${selectedOption.name} requires level ${selectedOption.minLevel}.`);
        const subclass = rules.subclasses.find((entry) => entry.id === character.subclassId);
        if (selectedOption.requiresSubclass && subclass?.name !== selectedOption.requiresSubclass) problems.push(`${selectedOption.name} requires the ${selectedOption.requiresSubclass} subclass.`);
        if (selectedOption.forbidsCurrentSubclass && subclass?.name === selectedOption.name) problems.push(`${selectedOption.name} cannot be selected again for this feature.`);
        for (const followUp of selectedOption.followUps || []) {
          const detailKey = `progression-detail:${group.id}:${selection.level}:${choiceIndex}:${selectedOption.id}:${followUp.id}`;
          const detailRaw = character.featureChoices?.[detailKey];
          const values = (Array.isArray(detailRaw) ? detailRaw : detailRaw ? [detailRaw] : []).filter(Boolean);
          if (values.length !== Number(followUp.count) || new Set(values).size !== Number(followUp.count)) {
            problems.push(`Choose ${followUp.count} ${followUp.label}${Number(followUp.count) === 1 ? "" : "s"} for ${selectedOption.name}.`);
            continue;
          }
          const followAllowed = new Set(progressionOptions(followUp, character, rules).map((entry) => entry.id));
          if (values.some((value) => !followAllowed.has(value))) problems.push(`${selectedOption.name} contains an invalid ${followUp.label.toLowerCase()} choice.`);
          const followKey = `${selectedOption.id}:${followUp.id}`;
          const prior = usedFollowUps.get(followKey) || new Set();
          if (values.some((value) => prior.has(value))) problems.push(`${selectedOption.name} must use different ${followUp.label.toLowerCase()} choices each time it is selected.`);
          values.forEach((value) => prior.add(value));
          usedFollowUps.set(followKey, prior);
        }
      });
    }
  }
  for (const group of selectedClass?.startingEquipment || []) {
    if (!character.equipment?.startingChoices?.[group.id]) problems.push(`Choose starting equipment: ${group.choices.join(" or ")}.`);
    const requirements = startingWeaponRequirements(character.equipment?.startingChoices?.[group.id] || "");
    const details = character.equipment?.startingDetails?.[group.id] || [];
    if (requirements.some((category, index) => !details[index])) problems.push(`Choose the specific ${requirements.find((category, index) => !details[index])?.toLowerCase()} weapon in starting package ${group.id.split("-").pop()}.`);
    const toolkitCount = startingToolkitRequirements(character.equipment?.startingChoices?.[group.id] || "");
    if (Array.from({ length: toolkitCount }, (_, index) => details[requirements.length + index]).some((name) => !String(name || "").trim())) problems.push(`Choose all ${toolkitCount} kits in starting package ${group.id.split("-").pop()}.`);
  }
  if (!Number.isFinite(Number(character.equipment?.ryo)) || Number(character.equipment.ryo) < 0) problems.push("Ryo cannot be negative.");
  for (const item of character.equipment?.items || []) {
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) problems.push(`Equipment quantity for ${item.name} must be at least 1.`);
  }
  for (const summon of character.summons || []) {
    if (!String(summon.name || "").trim()) problems.push("Give each summon a name.");
    if (!summon.tribeId) problems.push(`Choose a tribe for ${summon.name || "a summon"}.`);
    const tribe = rules.summons.tribes.find((entry) => entry.id === summon.tribeId);
    const derived = summonDerivedStats(summon, tribe, rules);
    const spent = ABILITIES.reduce((total, ability) => total + (Number(summon.statIncreases?.[ability]) || 0), 0);
    if (!summon.primaryRole) problems.push(`Choose a role for ${summon.name || "a summon"}.`);
    if (summon.roleMode === "dual" && (!summon.secondaryRole || summon.secondaryRole === summon.primaryRole)) problems.push(`${summon.name || "A summon"} needs two different roles when using both roles.`);
    if (spent > Number(derived.rank.asiPoints || 0)) problems.push(`${summon.name || "A summon"} has spent too many summon ability points.`);
    for (const ability of ABILITIES) if (derived.abilities[ability] > Number(derived.rank.statMax || 20)) problems.push(`${summon.name || "A summon"}'s ${ability} exceeds its ${summon.rank} maximum.`);
    const attained = SUMMON_RANK_ORDER.slice(0, SUMMON_RANK_ORDER.indexOf(summon.rank) + 1);
    for (const rank of attained) if (tribe?.ranks?.[rank]?.features?.length && !summon.featuresByRank?.[rank]) problems.push(`Choose ${summon.name || "summon"}'s ${rank} feature.`);
  }
  const puppets = character.puppets || [];
  const expandedPuppetry = Math.min(2, puppets.flatMap((puppet) => puppet.upgrades || []).filter((upgrade) => /expanded puppetry/i.test(upgrade.name)).length);
  const puppetLimit = puppetAllowedCount(character.level) + expandedPuppetry;
  if (puppets.length > puppetLimit) problems.push(`This character has ${puppets.length} puppets but their level and Expanded Puppetry upgrades currently allow ${puppetLimit}.`);
  const puppetAbilityPoints = puppets.reduce((total, puppet) => total + ABILITIES.reduce((sum, ability) => sum + (Number(puppet.statIncreases?.[ability]) || 0), 0), 0);
  if (puppetAbilityPoints > puppetAbilityPointPool(character.level)) problems.push(`Puppets have spent ${puppetAbilityPoints} ability points, but only ${puppetAbilityPointPool(character.level)} are available at level ${character.level}.`);
  for (const problem of puppetUpgradeProblems(puppets, character.level)) problems.push(problem);
  for (const puppet of puppets) {
    if (!puppet.name.trim()) problems.push("Give each puppet a name.");
    const derived = puppetDerivedStats(puppet, character.level);
    for (const ability of ABILITIES) if (derived.abilities[ability] > 20) problems.push(`${puppet.name || "A puppet"}'s ${ability} exceeds the normal puppet maximum of 20.`);
    if ((puppet.seals || []).length > derived.sealSlots) problems.push(`${puppet.name || "A puppet"} has more seals than its ${derived.sealSlots} available seal slots.`);
    if ((puppet.jutsu || []).length && !(puppet.upgrades || []).some((upgrade) => /jutsu specialization/i.test(upgrade.name))) problems.push(`${puppet.name || "A puppet"} needs the Jutsu Specialization upgrade to know jutsu.`);
    if (!puppet.hijutsuAccess && (puppet.jutsu || []).some((entry) => String(rules.jutsu?.find((rule) => rule.id === entry.id)?.keywords || "").split(/[,;/]/).some((keyword) => keyword.trim().toLowerCase() === "hijutsu"))) problems.push(`${puppet.name || "A puppet"} needs Bloodline Hijutsu access for its selected Hijutsu.`);
  }
  if (character.clanId && !character.abilityIncreases?.clanPrimary) problems.push("Choose the clan +2 ability.");
  if (character.clanId && !character.abilityIncreases?.clanSecondary) problems.push("Choose the clan +1 ability.");
  if (character.abilityIncreases?.clanPrimary && character.abilityIncreases.clanPrimary === character.abilityIncreases.clanSecondary) problems.push("The clan +2 and +1 must affect different abilities.");
  if (character.backgroundId && character.abilityIncreases?.backgroundMode === "ability" && !character.abilityIncreases?.backgroundAbility) problems.push("Choose the background +1 ability, or choose a feat instead.");
  for (const level of CLASS_ASI_LEVELS.filter((value) => value <= character.level)) {
    if (!character.abilityIncreases?.classLevels?.[level]) problems.push(`Choose the class ability increase gained at level ${level}.`);
  }
  for (const ability of ABILITIES) {
    const score = Number(character.abilities[ability]);
    if (!Number.isFinite(score) || score < 1 || score > 30) problems.push(`${ability} must be between 1 and 30.`);
    if (score > 20 && !(Number(character.abilityIncreases?.manual?.[ability]) > 0)) problems.push(`${ability} is above the normal maximum of 20; record the exceptional source as an adjustment.`);
  }
  if (character.abilityMethod === "pointBuy") {
    const scores = ABILITIES.map((ability) => Number(character.baseAbilities[ability]));
    if (scores.some((score) => !Object.hasOwn(ABILITY_POINT_COSTS, score))) problems.push("Point Buy scores must be whole numbers between 8 and 15.");
    const spent = scores.reduce((total, score) => total + (ABILITY_POINT_COSTS[score] ?? ABILITY_POINT_BUDGET + 1), 0);
    if (spent > ABILITY_POINT_BUDGET) problems.push(`Point Buy exceeds the ${ABILITY_POINT_BUDGET}-point Naruto 5e budget by ${spent - ABILITY_POINT_BUDGET}.`);
  }
  if (character.abilityMethod === "standardArray") {
    const scores = ABILITIES.map((ability) => Number(character.baseAbilities[ability])).sort((a, b) => b - a);
    if (scores.some((score, index) => score !== STANDARD_ARRAY[index])) problems.push(`Standard Array must use exactly ${STANDARD_ARRAY.join("/")}, one score per ability.`);
  }
  for (const entry of character.jutsu) {
    if (Number(entry.level) > character.level) problems.push(`${entry.name} is assigned to a level above the character's current level.`);
  }
  problems.push(...featValidationProblems(character, rules));
  return problems;
}

export function levelTimeline(character, rules, maximumLevel = 20) {
  const selectedClass = rules.classes.find((entry) => entry.id === character.classId);
  const selectedSubclass = rules.subclasses.find((entry) => entry.id === character.subclassId);
  const selectedClan = rules.clans.find((entry) => entry.id === character.clanId);
  const safeMaximum = Math.min(20, Math.max(Number(character.level) || 1, Number(maximumLevel) || 20));
  return Array.from({ length: safeMaximum }, (_, index) => {
    const level = index + 1;
    return {
      level,
      proficiency: proficiencyBonus(level),
      classFeatures: selectedClass?.featuresByLevel?.[level] || [],
      subclassFeatures: selectedSubclass?.featuresByLevel?.[level] || [],
      clanFeatures: selectedClan?.featuresByLevel?.[level] || [],
      jutsu: character.jutsu.filter((entry) => Number(entry.level) === level),
      choices: character.levelChoices?.[level] || "",
      attained: level <= Number(character.level),
      progressionChoices: (selectedClass?.progressionChoices || []).flatMap((group) => (group.selections || [])
        .filter((selection) => Number(selection.level) === level)
        .map((selection) => ({ ...group, selection }))),
    };
  });
}
