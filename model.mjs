export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const SUMMON_RANK_ORDER = ["D-Rank", "C-Rank", "B-Rank", "A-Rank", "S-Rank"];
export const PUPPET_UPGRADE_TIERS = ["Wood", "Bronze", "Silver", "Gold", "Platinum"];

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
    schemaVersion: 8,
    appVersion: "0.8.0",
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
    equipment: { ryo: 100, startingChoices: {}, startingDetails: {}, items: [] },
    summons: [],
    puppets: [],
    proficiencies: { skills: {}, toolkits: [], grantChoices: {} },
    capabilities: {
      entries: {},
      custom: [],
      trainingExtras: { armor: "", weapons: "", ninjaTools: "", savingThrows: "" },
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
    baseAbilities: Object.fromEntries(ABILITIES.map((ability) => [ability, Math.min(30, Math.max(1, Number(sourceScores[ability]) || 10))])),
    abilityIncreases: increases,
    jutsu: Array.isArray(input.jutsu) ? input.jutsu.filter((entry) => entry && entry.id) : [],
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
  for (const group of selectedClass?.startingEquipment || []) {
    if (!character.equipment?.startingChoices?.[group.id]) problems.push(`Choose starting equipment: ${group.choices.join(" or ")}.`);
    const requirements = startingWeaponRequirements(character.equipment?.startingChoices?.[group.id] || "");
    const details = character.equipment?.startingDetails?.[group.id] || [];
    if (requirements.some((category, index) => !details[index])) problems.push(`Choose the specific ${requirements.find((category, index) => !details[index])?.toLowerCase()} weapon in starting package ${group.id.split("-").pop()}.`);
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
  for (const entry of character.jutsu) {
    if (Number(entry.level) > character.level) problems.push(`${entry.name} is assigned to a level above the character's current level.`);
  }
  return problems;
}

export function levelTimeline(character, rules) {
  const selectedClass = rules.classes.find((entry) => entry.id === character.classId);
  const selectedSubclass = rules.subclasses.find((entry) => entry.id === character.subclassId);
  const selectedClan = rules.clans.find((entry) => entry.id === character.clanId);
  return Array.from({ length: character.level }, (_, index) => {
    const level = index + 1;
    return {
      level,
      proficiency: proficiencyBonus(level),
      classFeatures: selectedClass?.featuresByLevel?.[level] || [],
      subclassFeatures: selectedSubclass?.featuresByLevel?.[level] || [],
      clanFeatures: selectedClan?.featuresByLevel?.[level] || [],
      jutsu: character.jutsu.filter((entry) => Number(entry.level) === level),
      choices: character.levelChoices?.[level] || "",
    };
  });
}
