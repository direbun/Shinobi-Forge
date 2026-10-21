import {
  ABILITIES,
  ABILITY_POINT_BUDGET,
  ABILITY_POINT_COSTS,
  CLASS_ASI_LEVELS,
  PUPPET_UPGRADE_TIERS,
  SUMMON_RANK_ORDER,
  STANDARD_ARRAY,
  abilityBreakdown,
  abilityModifier,
  activeProficiencyGrants,
  effectiveSkillDegree,
  emptyCharacter,
  grantedToolkits,
  levelTimeline,
  masteryRankCap,
  proficiencyBonus,
  proficiencyDegreeBonus,
  proficiencyGrantOverlaps,
  puppetAbilityPointPool,
  puppetAllowedCount,
  puppetBaseAbilities,
  puppetDerivedStats,
  puppetUpgradeCapacity,
  sanitizeCharacter,
  summonDerivedStats,
  validateCharacter,
} from "./character-model.mjs";
import { applyProgressionCatalog } from "./progression-catalog.mjs";
import { featAbilityBonuses, featChoiceDefinitions, featEligibility } from "../feat-system.mjs";

const CAPABILITIES = [
  { id: "fire", name: "Fire", patterns: [/fire release/i] },
  { id: "wind", name: "Wind", patterns: [/wind release/i] },
  { id: "lightning", name: "Lightning", patterns: [/lightning release/i] },
  { id: "earth", name: "Earth", patterns: [/earth release/i] },
  { id: "water", name: "Water", patterns: [/water release/i] },
  { id: "ice", name: "Ice", patterns: [/ice release/i, /hyoton/i] },
  { id: "lava", name: "Lava", patterns: [/lava release/i, /yoton/i] },
  { id: "boil", name: "Boil", patterns: [/boil release/i] },
  { id: "storm", name: "Storm", patterns: [/storm release/i] },
  { id: "magnet", name: "Magnet", patterns: [/magnet release/i] },
  { id: "scorch", name: "Scorch", patterns: [/scorch release/i] },
  { id: "explosion", name: "Explosion", patterns: [/explosion release/i] },
  { id: "wood", name: "Wood", patterns: [/wood release/i, /mokuton/i] },
  { id: "crystal", name: "Crystal", patterns: [/crystal release/i] },
  { id: "dust", name: "Dust", patterns: [/dust release/i] },
  { id: "yin", name: "Yin", patterns: [/yin release/i] },
  { id: "yang", name: "Yang", patterns: [/yang release/i] },
  { id: "medical", name: "Medical", patterns: [/medical/i] },
  { id: "sensory", name: "Sensory", patterns: [/sensory/i, /chakra sense/i] },
  { id: "fuinjutsu", name: "Fuinjutsu", patterns: [/fuinjutsu/i, /sealing/i] },
  { id: "hijutsu", name: "Hijutsu", patterns: [/hijutsu/i] },
];

function boundedText(value, maximum = 120) {
  return String(value || "").trim().slice(0, maximum);
}

function keywordList(value = "") {
  return String(value).split(/[,;/]/).map((item) => item.trim().replace(/[.]+$/, "").replace(/\s+/g, " ")).filter(Boolean);
}

const NATURE_KEYWORDS = ["fire", "wind", "lightning", "earth", "water", "ice", "lava", "boil", "storm", "magnet", "scorch", "explosion", "wood", "crystal", "dust", "yin", "yang"];

function canonicalKeyword(value = "") {
  const cleaned = boundedText(value, 60).replace(/[.]+$/, "").replace(/\s+/g, " ").trim();
  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9()]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized === "any nature release") return "Any Nature Release";
  const nature = NATURE_KEYWORDS.find((name) => normalized === name || new RegExp(`\\b${name}\\s+release\\b`).test(normalized));
  if (nature) return `${nature[0].toUpperCase()}${nature.slice(1)} Release`;
  if (/\bcha(?:i)?n\b/.test(normalized)) return "Chain";
  return cleaned.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+(?:\d+|x)$/i, "").trim();
}

function hasKeyword(entry, keyword) {
  const expected = canonicalKeyword(keyword).toLowerCase();
  return keywordList(entry?.keywords).some((item) => canonicalKeyword(item).toLowerCase() === expected);
}

function matchesElement(entry, element) {
  const normalized = String(element).toLowerCase();
  if (normalized === "none") {
    return !keywordList(entry?.keywords).some((item) => canonicalKeyword(item) === "Any Nature Release" || NATURE_KEYWORDS.some((nature) => canonicalKeyword(item).toLowerCase() === `${nature} release`));
  }
  return keywordList(entry?.keywords).some((item) => canonicalKeyword(item).toLowerCase() === `${normalized} release`);
}

function matchesDiscipline(entry, discipline) {
  return entry.classification === discipline || hasKeyword(entry, discipline) || (discipline === "Ninjutsu" && entry.classification === "Non-Elemental Ninjutsu");
}

function paginate(items, request = {}, maximum = 50) {
  const limit = Math.min(maximum, Math.max(1, Number(request.limit) || 30));
  const page = Math.max(1, Number(request.page) || 1);
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), page, limit, total: items.length, hasMore: start + limit < items.length };
}

function selectedRecord(collection, id) {
  return collection.find((entry) => entry.id === id) || null;
}

function normalizedReference(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function referencedRecord(collection = [], ...references) {
  for (const reference of references.filter(Boolean)) {
    const normalized = normalizedReference(reference);
    const match = collection.find((entry) => entry.id === reference || normalizedReference(entry.name) === normalized);
    if (match) return match;
  }
  return null;
}

function attainedFeatureNames(record, level) {
  if (!record?.featuresByLevel) return [];
  return Object.entries(record.featuresByLevel)
    .filter(([featureLevel]) => Number(featureLevel) <= Number(level))
    .flatMap(([, features]) => features.map((feature) => feature.name));
}

function capabilityStatuses(character, selection) {
  const sources = [selection.clan, selection.class, selection.subclass].filter(Boolean);
  return CAPABILITIES.map((capability) => {
    const automatic = [];
    if (capability.id === "medical" && selection.class?.name === "Medical-Nin") automatic.push("Class: Medical-Nin");
    for (const source of sources) {
      const labels = [source.name, ...attainedFeatureNames(source, character.level)];
      if (labels.some((label) => capability.patterns.some((pattern) => pattern.test(label)))) automatic.push(`${source === selection.clan ? "Clan" : source === selection.class ? "Class" : "Subclass"}: ${source.name}`);
    }
    const explicit = character.capabilities?.entries?.[capability.id];
    return { id: capability.id, name: capability.name, enabled: explicit ? Boolean(explicit.enabled) : automatic.length > 0, automatic: [...new Set(automatic)], source: String(explicit?.source || "") };
  });
}

function publicClassSummary(entry) {
  return { id: entry.id, name: entry.name };
}

function jutsuCastingStats(character, selection) {
  const abilities = { Ninjutsu: "intelligence", Genjutsu: "wisdom", Taijutsu: "strength", Bukijutsu: "strength" };
  if (selection.class?.name === "Hunter-Nin") {
    const structuredChoice = character.featureChoices?.["progression:hunter-lethal-precision:1"];
    const precisionChoice = String((Array.isArray(structuredChoice) ? structuredChoice[0] : structuredChoice) || Object.entries(character.featureChoices || {}).find(([key]) => key.endsWith(":Lethal Precision"))?.[1] || "").toLowerCase();
    if (precisionChoice.includes("taijutsu")) abilities.Taijutsu = "dexterity";
    if (precisionChoice.includes("bukijutsu")) abilities.Bukijutsu = "dexterity";
  }
  const proficiency = proficiencyBonus(character.level);
  return Object.fromEntries(Object.entries(abilities).map(([discipline, ability]) => {
    const abilityBonus = abilityModifier(character.abilities[ability]);
    return [discipline, { ability, abilityBonus, attackModifier: proficiency + abilityBonus, saveDC: 8 + proficiency + abilityBonus }];
  }));
}

export function createEngine(rules) {
  if (!rules?.classes || !rules?.jutsu) throw new Error("Private rules catalogue is invalid.");
  applyProgressionCatalog(rules);

  const equipmentRules = [...(rules.equipment?.weapons || []), ...(rules.equipment?.armor || [])];
  const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const trainingOptions = {
    armor: uniqueSorted(rules.classes.flatMap((entry) => entry.combatProficiencies?.armor || [])),
    weapons: uniqueSorted([
      ...rules.classes.flatMap((entry) => entry.combatProficiencies?.weapons || []),
      ...(rules.equipment?.weapons || []).map((entry) => entry.name),
    ]),
    ninjaTools: uniqueSorted([
      ...rules.classes.flatMap((entry) => entry.combatProficiencies?.ninjaTools || []).filter((entry) => !/^choose\b/i.test(entry)),
      ...rules.backgrounds.flatMap((entry) => [...(entry.proficiencyGrants?.toolkits || []), ...(entry.proficiencyGrants?.toolkitOptions || [])]),
    ]),
    savingThrows: ABILITIES.map((ability) => ability[0].toUpperCase() + ability.slice(1)),
  };

  function normalizeImportedReferences(input) {
    const character = structuredClone(input);
    for (const [idField, nameField, collection] of [
      ["classId", "className", rules.classes],
      ["subclassId", "subclassName", rules.subclasses],
      ["clanId", "clanName", rules.clans],
      ["backgroundId", "backgroundName", rules.backgrounds],
    ]) {
      const record = referencedRecord(collection, character[nameField], character[nameField.replace("Name", "")], character[idField]);
      if (record) character[idField] = record.id;
    }
    if (character.equipment?.startingDetails && typeof character.equipment.startingDetails === "object") {
      character.equipment.startingDetails = Object.fromEntries(Object.entries(character.equipment.startingDetails).map(([groupId, values]) => [groupId,
        Array.isArray(values) ? values.map((reference) => referencedRecord(equipmentRules, reference)?.id || reference) : values,
      ]));
    }
    if (Array.isArray(character.equipment?.items)) {
      character.equipment.items = character.equipment.items.map((item) => {
        const record = referencedRecord(equipmentRules, item.catalogueName, item.name, item.catalogueId);
        return record ? { ...item, catalogueId: record.id, catalogueName: record.name, name: record.name } : item;
      });
    }
    if (Array.isArray(character.jutsu)) {
      character.jutsu = character.jutsu.map((entry) => {
        const record = referencedRecord(rules.jutsu, entry.name, entry.id);
        return record ? {
          ...entry,
          id: record.id,
          name: record.name,
          rank: entry.rank || record.rank,
          keywords: entry.keywords || record.keywords || "",
          classification: entry.classification || record.classification || "",
        } : entry;
      });
    }
    if (Array.isArray(character.feats)) {
      character.feats = character.feats.map((entry) => {
        const record = referencedRecord(rules.feats || [], entry.featName, entry.featId);
        return record ? { ...entry, featId: record.id, featName: record.name } : entry;
      });
    }
    return character;
  }

  function portableCharacter(result) {
    const character = structuredClone(result.character);
    character.className = result.selection.class?.name || "";
    character.subclassName = result.selection.subclass?.name || "";
    character.clanName = result.selection.clan?.name || "";
    character.backgroundName = result.selection.background?.name || "";
    character.equipment.startingDetails = Object.fromEntries(Object.entries(character.equipment.startingDetails || {}).map(([groupId, values]) => [groupId,
      Array.isArray(values) ? values.map((reference) => referencedRecord(equipmentRules, reference)?.name || reference) : values,
    ]));
    character.equipment.items = character.equipment.items.map((item) => {
      const record = referencedRecord(equipmentRules, item.catalogueId, item.catalogueName, item.name);
      return record ? { ...item, catalogueId: record.id, catalogueName: record.name, name: record.name } : item;
    });
    character.feats = character.feats.map((entry) => {
      const record = referencedRecord(rules.feats || [], entry.featId, entry.featName);
      return record ? { ...entry, featId: record.id, featName: record.name } : entry;
    });
    return character;
  }

  function selectionFor(character) {
    return {
      class: selectedRecord(rules.classes, character.classId),
      subclass: selectedRecord(rules.subclasses, character.subclassId),
      clan: selectedRecord(rules.clans, character.clanId),
      background: selectedRecord(rules.backgrounds, character.backgroundId),
    };
  }

  function evaluate(input) {
    const character = sanitizeCharacter(input);
    const selection = selectionFor(character);
    const featBonuses = featAbilityBonuses(character, rules);
    const abilities = Object.fromEntries(ABILITIES.map((ability) => {
      const breakdown = { ...abilityBreakdown(character, ability), feat: featBonuses[ability] || 0 };
      const score = Object.values(breakdown).reduce((total, value) => total + Number(value || 0), 0);
      character.abilities[ability] = score;
      return [ability, { breakdown, score, modifier: abilityModifier(score) }];
    }));
    const grants = activeProficiencyGrants(character, rules);
    const skills = Object.fromEntries((rules.proficiencies?.skills || []).map((skill) => {
      const degree = effectiveSkillDegree(character, rules, skill.id);
      return [skill.id, { degree, bonus: abilityModifier(character.abilities[skill.ability]) + proficiencyDegreeBonus(character.level, degree), sources: grants[skill.id] || [] }];
    }));
    const summons = character.summons.map((summon) => {
      const tribe = selectedRecord(rules.summons.tribes, summon.tribeId);
      return { id: summon.id, tribeName: tribe?.name || "", ...summonDerivedStats(summon, tribe, rules) };
    });
    const puppets = character.puppets.map((puppet) => ({ id: puppet.id, baseAbilities: puppetBaseAbilities(puppet), ...puppetDerivedStats(puppet, character.level) }));
    return {
      character,
      selection,
      derived: {
        abilities,
        proficiencyBonus: proficiencyBonus(character.level),
        proficiencyDegreeBonuses: Object.fromEntries([0, 1, 2, 3, 4].map((degree) => [degree, proficiencyDegreeBonus(character.level, degree)])),
        masteryRankCap: masteryRankCap(character.level),
        proficiencyGrants: grants,
        proficiencyOverlaps: proficiencyGrantOverlaps(character, rules),
        grantedToolkits: grantedToolkits(character, rules),
        skills,
        summons,
        puppets,
        puppet: {
          allowedCount: puppetAllowedCount(character.level),
          abilityPointPool: puppetAbilityPointPool(character.level),
          upgradeCapacity: puppetUpgradeCapacity(character.level),
        },
        capabilities: capabilityStatuses(character, selection),
        jutsuCasting: jutsuCastingStats(character, selection),
        timeline: levelTimeline(character, rules),
      },
      problems: validateCharacter(character, rules),
    };
  }

  return {
    bootstrap() {
      return {
        schemaVersion: rules.schemaVersion,
        source: { sheetVersion: rules.source?.sheetVersion || "", sheetTitle: rules.source?.sheetTitle || "" },
        counts: { classes: rules.classes.length, subclasses: rules.subclasses.length, clans: rules.clans.length, backgrounds: rules.backgrounds.length, jutsu: rules.jutsu.length, feats: rules.feats?.length || 0 },
        options: {
          classes: rules.classes.map(publicClassSummary),
          subclasses: rules.subclasses.map((entry) => ({ id: entry.id, className: entry.className, name: entry.name })),
          clans: rules.clans.map((entry) => ({ id: entry.id, name: entry.name })),
          backgrounds: rules.backgrounds.map((entry) => ({ id: entry.id, name: entry.name })),
          summonTribes: rules.summons.tribes.map((entry) => ({ id: entry.id, name: entry.name })),
        },
        proficiencies: rules.proficiencies,
        summons: { templates: rules.summons.templates, roles: rules.summons.roles, ranks: rules.summons.ranks },
        filters: {
          jutsuRanks: [...new Set(rules.jutsu.map((entry) => entry.rank).filter(Boolean))].sort(),
          jutsuKeywords: uniqueSorted(rules.jutsu.flatMap((entry) => keywordList(entry.keywords).map(canonicalKeyword))),
          hijutsuTraditions: [...new Set(rules.jutsu.filter((entry) => hasKeyword(entry, "Hijutsu")).map((entry) => entry.classification).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
          featCategories: uniqueSorted((rules.feats || []).map((entry) => entry.category)),
        },
        trainingOptions,
        constants: { abilities: ABILITIES, classAsiLevels: CLASS_ASI_LEVELS, summonRanks: SUMMON_RANK_ORDER, puppetUpgradeTiers: PUPPET_UPGRADE_TIERS, standardArray: STANDARD_ARRAY, abilityPointCosts: ABILITY_POINT_COSTS, abilityPointBudget: ABILITY_POINT_BUDGET },
        emptyCharacter: emptyCharacter(),
      };
    },
    selection(input = {}) {
      const character = sanitizeCharacter({ ...emptyCharacter(), ...input, schema: "naruto5e-character" });
      return selectionFor(character);
    },
    searchJutsu(request = {}) {
      const query = boundedText(request.query).toLowerCase();
      const rank = boundedText(request.rank, 30);
      const disciplines = Array.isArray(request.disciplines) ? request.disciplines.slice(0, 4).map((item) => boundedText(item, 30)) : [];
      const elements = Array.isArray(request.elements) ? request.elements.slice(0, 8).map((item) => boundedText(item, 30)) : [];
      const keywords = Array.isArray(request.keywords) ? request.keywords.slice(0, 20).map((item) => boundedText(item, 60)).filter(Boolean) : [];
      const clan = boundedText(request.clan, 100);
      const hijutsu = Boolean(request.hijutsu);
      const includeHijutsu = Boolean(request.includeHijutsu);
      const matches = rules.jutsu.filter((entry) => {
        if (query && !`${entry.name} ${entry.description} ${entry.keywords}`.toLowerCase().includes(query)) return false;
        if (rank && entry.rank !== rank) return false;
        if (disciplines.length && !disciplines.some((value) => matchesDiscipline(entry, value))) return false;
        if (elements.length && !elements.some((value) => matchesElement(entry, value))) return false;
        if (keywords.length && !keywords.every((value) => hasKeyword(entry, value))) return false;
        if (hijutsu !== hasKeyword(entry, "Hijutsu") && (hijutsu || !includeHijutsu)) return false;
        if (hijutsu && clan && !String(entry.classification || "").toLowerCase().includes(clan.toLowerCase())) return false;
        return true;
      });
      return paginate(matches, request, 50);
    },
    searchFeats(request = {}) {
      const character = sanitizeCharacter(request.character || emptyCharacter());
      const query = boundedText(request.query).toLowerCase();
      const category = boundedText(request.category, 30);
      const owner = boundedText(request.owner, 100);
      const showLocked = Boolean(request.showLocked);
      const slot = request.slot && typeof request.slot === "object" ? {
        id: boundedText(request.slot.id, 80),
        level: Math.min(20, Math.max(1, Number(request.slot.level) || character.level)),
        source: boundedText(request.slot.source, 50),
      } : { id: "", level: character.level, source: "Campaign / downtime" };
      const matches = (rules.feats || []).map((feat) => {
        const eligibility = featEligibility(feat, character, rules, slot);
        return { ...feat, eligibility, choices: featChoiceDefinitions(feat, character, rules) };
      }).filter((feat) => {
        if (query && !`${feat.name} ${feat.prerequisite} ${feat.description} ${feat.owner}`.toLowerCase().includes(query)) return false;
        if (category && feat.category !== category) return false;
        if (owner && !String(feat.owner || "").toLowerCase().includes(owner.toLowerCase())) return false;
        if (!showLocked && !feat.eligibility.eligible) return false;
        return true;
      }).sort((a, b) => Number(b.eligibility.eligible) - Number(a.eligibility.eligible) || a.name.localeCompare(b.name));
      return paginate(matches, request, 500);
    },
    searchEquipment(request = {}) {
      const query = boundedText(request.query).toLowerCase();
      const type = boundedText(request.type, 30).toLowerCase();
      const category = boundedText(request.category, 30).toLowerCase();
      const combined = [
        ...(rules.equipment?.armor || []).map((entry) => ({ ...entry, kind: "armor" })),
        ...(rules.equipment?.weapons || []).map((entry) => ({ ...entry, kind: "weapon" })),
      ];
      const matches = combined.filter((entry) => {
        if (query && !`${entry.name} ${entry.type} ${entry.category} ${entry.properties || ""}`.toLowerCase().includes(query)) return false;
        if (type && entry.kind !== type) return false;
        if (category && !`${entry.type} ${entry.category}`.toLowerCase().includes(category)) return false;
        return true;
      });
      return paginate(matches, request, 100);
    },
    summonTribe(id) {
      return selectedRecord(rules.summons.tribes, boundedText(id, 100));
    },
    evaluate,
    importCharacter(input) {
      return evaluate(normalizeImportedReferences(input));
    },
    purchaseEquipment(input, itemId) {
      const character = sanitizeCharacter(input);
      const item = [...(rules.equipment?.weapons || []), ...(rules.equipment?.armor || [])].find((entry) => entry.id === itemId);
      if (!item) throw Object.assign(new Error("The requested equipment item does not exist."), { status: 404, code: "ITEM_NOT_FOUND" });
      const price = item.price == null ? null : Math.max(0, Number(item.price) || 0);
      if (price !== null && character.equipment.ryo < price) throw Object.assign(new Error(`You need ${price - character.equipment.ryo} more Ryo to buy ${item.name}.`), { status: 409, code: "INSUFFICIENT_RYO" });
      if (price !== null) character.equipment.ryo -= price;
      const existing = character.equipment.items.find((entry) => entry.catalogueId === item.id);
      if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
      else character.equipment.items.push({ id: crypto.randomUUID(), catalogueId: item.id, name: item.name, type: (rules.equipment.weapons || []).includes(item) ? "weapon" : "armor", quantity: 1, notes: "", source: "catalogue", pricePaid: price });
      return evaluate(character);
    },
    selectJutsu(input, jutsuId, target = {}) {
      const character = sanitizeCharacter(input);
      const rule = selectedRecord(rules.jutsu, jutsuId);
      if (!rule) throw Object.assign(new Error("The requested jutsu does not exist."), { status: 404, code: "JUTSU_NOT_FOUND" });
      const entry = {
        id: rule.id,
        name: rule.name,
        rank: rule.rank,
        keywords: rule.keywords || "",
        classification: rule.classification || "",
        level: Math.min(character.level, Math.max(1, Number(target.level) || character.level)),
      };
      if (target.kind === "summon") {
        const summon = character.summons[Number(target.index)];
        if (!summon) throw Object.assign(new Error("The requested summon does not exist."), { status: 404, code: "SUMMON_NOT_FOUND" });
        if (hasKeyword(rule, "Hijutsu")) throw Object.assign(new Error("Summons cannot learn Hijutsu."), { status: 409, code: "SUMMON_HIJUTSU_FORBIDDEN" });
        if (!summon.jutsu.some((known) => known.id === rule.id)) summon.jutsu.push(entry);
      } else if (target.kind === "puppet") {
        const puppet = character.puppets[Number(target.index)];
        if (!puppet) throw Object.assign(new Error("The requested puppet does not exist."), { status: 404, code: "PUPPET_NOT_FOUND" });
        if (!puppet.upgrades.some((upgrade) => /jutsu specialization/i.test(upgrade.name))) throw Object.assign(new Error("This puppet needs Jutsu Specialization."), { status: 409, code: "PUPPET_JUTSU_LOCKED" });
        if (hasKeyword(rule, "Hijutsu") && !puppet.hijutsuAccess) throw Object.assign(new Error("This puppet has no Bloodline Hijutsu access."), { status: 409, code: "PUPPET_HIJUTSU_FORBIDDEN" });
        if (!puppet.jutsu.some((known) => known.id === rule.id)) puppet.jutsu.push(entry);
      } else if (!character.jutsu.some((known) => known.id === rule.id)) character.jutsu.push(entry);
      return evaluate(character);
    },
    exportCharacter(input) {
      const result = evaluate(input);
      return { character: portableCharacter(result), valid: result.problems.length === 0, problems: result.problems };
    },
  };
}
