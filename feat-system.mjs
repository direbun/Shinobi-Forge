const ABILITY_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

const normalized = (value = "") => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
const unique = (values) => [...new Set(values.filter(Boolean))];

export function featSlots(character, includeFuture = false) {
  const level = Number(character.level) || 1;
  const slots = [];
  if (character.backgroundId && character.abilityIncreases?.backgroundMode === "feat") slots.push({ id: "background", level: 1, source: "Background", attained: true });
  for (const slotLevel of [4, 8, 12, 16, 19]) {
    if (includeFuture || slotLevel <= level) slots.push({ id: `class-${slotLevel}`, level: slotLevel, source: "Class advancement", attained: slotLevel <= level });
  }
  for (const entry of character.feats || []) {
    if (!String(entry.slotId || "").startsWith("extra-")) continue;
    slots.push({ id: entry.slotId, level: Math.min(20, Math.max(1, Number(entry.level) || level)), source: entry.source || "Campaign / downtime", attained: Number(entry.level) <= level, extra: true });
  }
  return slots;
}

function selectedFeatIds(character) {
  return new Set((character.feats || []).map((entry) => entry.featId).filter(Boolean));
}

function selectedClass(rules, character) { return rules.classes?.find((entry) => entry.id === character.classId); }
function selectedClan(rules, character) { return rules.clans?.find((entry) => entry.id === character.clanId); }

function skillDegree(character, rules, name) {
  const skill = rules.proficiencies?.skills?.find((entry) => normalized(entry.name) === normalized(name));
  if (!skill) return 0;
  const manual = Number(character.proficiencies?.skills?.[skill.id]?.degree) || 0;
  const cls = selectedClass(rules, character);
  const background = rules.backgrounds?.find((entry) => entry.id === character.backgroundId);
  const fixed = [...(cls?.skillGrants || []), ...(background?.proficiencyGrants?.skills || [])]
    .some((group) => group.fixed ? group.options.includes(skill.id) : (character.proficiencies?.grantChoices?.[group.id] || []).includes(skill.id));
  return Math.max(manual, fixed ? 1 : 0);
}

export function featEligibility(feat, character, rules, slot = {}) {
  const reasons = [];
  const reviews = [];
  const prerequisite = String(feat.prerequisite || "");
  const level = Number(slot.level || character.level) || 1;
  const cls = selectedClass(rules, character);
  const clan = selectedClan(rules, character);
  const existing = (character.feats || []).find((entry) => entry.featId === feat.id && entry.slotId !== slot.id);
  const repeatable = /take this feat (?:more than once|multiple times)/i.test(feat.description || "");

  if (existing && !repeatable) reasons.push("Already selected; this feat is not repeatable.");
  if (feat.rare && !character.featSettings?.allowRare) reasons.push("Rare feat: enable GM approval to select it.");
  if (feat.category === "Archetype" && slot.source !== "Downtime") reasons.push("Archetype feats can only be taken through Downtime.");
  const levelMatches = [
    ...[...prerequisite.matchAll(/\bLevel\s*(\d+)\s*\+/gi)].map((match) => Number(match[1])),
    ...[...prerequisite.matchAll(/\b(\d+)\s*\+\s*levels?\b/gi)].map((match) => Number(match[1])),
  ];
  const requiredLevel = Math.max(0, ...levelMatches);
  if (requiredLevel && level < requiredLevel) reasons.push(`Requires level ${requiredLevel}+.`);

  if (feat.category === "Clan" && feat.owner && normalized(clan?.name) !== normalized(feat.owner)) reasons.push(`Requires the ${feat.owner} clan.`);
  if (feat.category === "Class" && feat.owner && normalized(cls?.name) !== normalized(feat.owner)) reasons.push(`Requires ${feat.owner} class levels.`);
  const forbiddenClass = prerequisite.match(/cannot have class levels in\s+([^,]+)/i)?.[1];
  if (forbiddenClass && normalized(cls?.name) === normalized(forbiddenClass)) reasons.push(`Cannot be taken by a ${forbiddenClass.trim()}.`);

  for (const match of prerequisite.matchAll(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))?\s+(\d+)\s*\+/gi)) {
    const abilities = [match[1], match[2]].filter(Boolean).map((entry) => entry.toLowerCase());
    const target = Number(match[3]);
    if (!abilities.some((ability) => Number(character.abilities?.[ability]) >= target)) reasons.push(`Requires ${abilities.map((ability) => ability[0].toUpperCase() + ability.slice(1)).join(" or ")} ${target}+.`);
  }
  for (const match of prerequisite.matchAll(/Proficiency in (?:either )?([A-Za-z ]+?)(?:\s+or\s+([A-Za-z ]+?))?(?:,|$)/gi)) {
    const names = [match[1], match[2]].filter(Boolean).map((entry) => entry.trim());
    if (!names.some((name) => skillDegree(character, rules, name) > 0)) reasons.push(`Requires proficiency in ${names.join(" or ")}.`);
  }

  const knownByName = new Map((rules.feats || []).map((entry) => [normalized(entry.name), entry]));
  for (const clause of prerequisite.split(/,|\band\b/i).map((entry) => entry.trim()).filter(Boolean)) {
    const candidate = clause.replace(/\bFeat\b/gi, "").replace(/\bLevel\s*\d+\s*\+?/gi, "").trim();
    const requiredFeat = knownByName.get(normalized(candidate));
    if (requiredFeat && !selectedFeatIds(character).has(requiredFeat.id)) reasons.push(`Requires the ${requiredFeat.name} feat.`);
  }

  const recognized = [/level\s*\d+\s*\+/i, /\d+\s*\+\s*levels?\s+in/i, /\bClan\b/i, /cannot have class levels/i, /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(?:or\s+\w+\s+)?\d+\s*\+/i, /Proficiency in/i, /\bFeat\b/i];
  if (prerequisite && !recognized.some((pattern) => pattern.test(prerequisite))) reviews.push(`Check prerequisite: ${prerequisite}`);
  if (/modifier is \d+\+/i.test(prerequisite)) reviews.push(`Confirm the listed jutsu modifier requirement: ${prerequisite}`);
  return { eligible: reasons.length === 0, reasons: unique(reasons), reviews: unique(reviews), repeatable };
}

function choiceOptionsFor(prompt, feat, character, rules) {
  const lower = prompt.toLowerCase();
  if (/following/i.test(prompt)) {
    const listed = unique([...String(feat.description || "").matchAll(/(?:^|\n)\s*(?:◦|o)\s*([^\n]+)/g)].map((match) => match[1].trim().replace(/[.;]+$/, "")));
    if (listed.length > 1) return listed.map((name) => ({ id: normalized(name), name }));
    const attackTypes = ["Ninjutsu attacks", "Taijutsu attacks", "Genjutsu attacks"].filter((name) => String(feat.description || "").toLowerCase().includes(name.toLowerCase()));
    if (attackTypes.length > 1) return attackTypes.map((name) => ({ id: normalized(name), name }));
  }
  const progressionGroups = (rules.classes || []).flatMap((entry) => entry.progressionChoices || []);
  const matchingGroup = progressionGroups.find((group) => [group.label, group.featureName].filter(Boolean).some((label) => {
    const words = normalized(label).split(" ").map((word) => word.replace(/s$/, "")).filter((word) => word.length > 3);
    const promptWords = new Set(normalized(prompt).split(" ").map((word) => word.replace(/s$/, "")));
    return words.length && words.every((word) => promptWords.has(word));
  }));
  if (matchingGroup?.options?.length) return matchingGroup.options.map((entry) => ({ id: entry.id, name: entry.name }));
  if (/stance/i.test(lower)) {
    const stances = progressionGroups.flatMap((group) => (group.options || []).flatMap((option) => (option.followUps || []).filter((followUp) => /stance/i.test(followUp.label || "")).flatMap((followUp) => followUp.options || [])));
    if (stances.length) return unique(stances.map((entry) => entry.id)).map((id) => { const entry = stances.find((item) => item.id === id); return { id, name: entry.name }; });
  }
  const abilityHits = ABILITY_NAMES.filter((ability) => new RegExp(`\\b${ability}\\b`, "i").test(prompt));
  if (/\bability(?: score)?\b|strength|dexterity|constitution|intelligence|wisdom|charisma/i.test(prompt) && abilityHits.length) return abilityHits.map((name) => ({ id: name.toLowerCase(), name }));
  if (/\bability(?: score)?\b/i.test(prompt)) return ABILITY_NAMES.map((name) => ({ id: name.toLowerCase(), name }));
  if (/attack type/i.test(lower)) return ["Ninjutsu attacks", "Taijutsu attacks", "Genjutsu attacks"].map((name) => ({ id: normalized(name), name }));
  if (/nature|release/i.test(lower)) return ["Fire Release", "Wind Release", "Lightning Release", "Earth Release", "Water Release"].map((name) => ({ id: normalized(name), name }));
  if (/\bclan\b/i.test(lower)) return (rules.clans || []).map((entry) => ({ id: entry.id, name: entry.name }));
  if (/subclass|pledge|creed|strategy|tradition|technique/i.test(lower)) {
    const owner = feat.owner || selectedClass(rules, character)?.name;
    return (rules.subclasses || []).filter((entry) => !owner || normalized(entry.className) === normalized(owner)).map((entry) => ({ id: entry.id, name: entry.name }));
  }
  if (/\bclass\b/i.test(lower)) return (rules.classes || []).map((entry) => ({ id: entry.id, name: entry.name }));
  if (/skill/i.test(lower) || /ninshou|martial arts/i.test(lower)) {
    const mentioned = (rules.proficiencies?.skills || []).filter((entry) => new RegExp(`\\b${entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(prompt));
    return (mentioned.length ? mentioned : rules.proficiencies?.skills || []).map((entry) => ({ id: entry.id, name: entry.name }));
  }
  if (/jutsu/i.test(lower)) return (character.jutsu || []).map((entry) => ({ id: entry.id, name: entry.name }));
  if (/weapon/i.test(lower)) return (rules.equipment?.weapons || []).map((entry) => ({ id: entry.id, name: entry.name }));
  if (/tool|kit/i.test(lower)) {
    const names = unique([...(rules.backgrounds || []).flatMap((entry) => [...(entry.proficiencyGrants?.toolkits || []), ...(entry.proficiencyGrants?.toolkitOptions || [])]), ...(character.proficiencies?.toolkits || []).map((entry) => entry.name)]).sort();
    return names.map((name) => ({ id: normalized(name), name }));
  }
  if (/feat/i.test(lower)) return (rules.feats || []).filter((entry) => entry.id !== feat.id).map((entry) => ({ id: entry.id, name: entry.name }));
  const explicit = unique([...prompt.matchAll(/(?:^|\b(?:or|between)\s+)([A-Z][A-Za-z -]{2,40})(?=[,.;]|$)/g)].map((match) => match[1].trim()));
  return explicit.map((name) => ({ id: normalized(name), name }));
}

export function featChoiceDefinitions(feat, character, rules) {
  const text = String(feat.description || "").replace(/\n+/g, " ");
  const abilityPrompts = [...text.matchAll(/Increase (?:your )?((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\s+or\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))+|one Ability)(?: score)? by 1/gi)]
    .map((match) => `Increase ${match[1]} by 1.`);
  const prompts = unique([...abilityPrompts, ...[...text.matchAll(/(?:^|[•.;]\s+)((?:Choose|Select)\s+.+?|You learn (?:one|two|three|four|five|\d+)\s+.+?)(?=(?:\.\s|;\s|$))/gi)].map((match) => `${match[1].trim().replace(/[.;]+$/, "")}.`)]).slice(0, 8);
  return prompts.map((prompt, index) => {
    const countWord = prompt.match(/(?:choose|select|you learn)\s+(one|two|three|four|five|\d+)/i)?.[1]?.toLowerCase();
    const count = ({ one: 1, two: 2, three: 3, four: 4, five: 5 }[countWord] || Number(countWord) || 1);
    const options = choiceOptionsFor(prompt, feat, character, rules);
    return { id: `choice-${index + 1}`, prompt, count, options, resolved: options.length > 0 };
  });
}

export function featAbilityBonuses(character, rules) {
  const bonuses = Object.fromEntries(ABILITY_NAMES.map((name) => [name.toLowerCase(), 0]));
  const records = new Map((rules.feats || []).map((entry) => [entry.id, entry]));
  const activeSlots = new Set(featSlots(character).map((entry) => entry.id));
  for (const selection of character.feats || []) {
    if (!selection.featId || !activeSlots.has(selection.slotId) || Number(selection.level) > Number(character.level)) continue;
    const feat = records.get(selection.featId);
    if (!feat) continue;
    const description = String(feat.description || "").replace(/\n+/g, " ");
    for (const match of description.matchAll(/Increase (?:your )?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score by 1/gi)) bonuses[match[1].toLowerCase()] += 1;
    for (const choice of featChoiceDefinitions(feat, character, rules).filter((entry) => /^Increase .+ by 1\.$/i.test(entry.prompt))) {
      const ability = selection.choices?.[choice.id]?.[0];
      if (Object.hasOwn(bonuses, ability)) bonuses[ability] += 1;
    }
  }
  return bonuses;
}

export function featValidationProblems(character, rules) {
  const problems = [];
  const records = new Map((rules.feats || []).map((entry) => [entry.id, entry]));
  const selections = character.feats || [];
  for (const slot of featSlots(character)) {
    const selection = selections.find((entry) => entry.slotId === slot.id);
    if (!selection?.featId) { problems.push(`Choose the feat gained from ${slot.source}${slot.source === "Class advancement" ? ` at level ${slot.level}` : ""}.`); continue; }
    const feat = records.get(selection.featId);
    if (!feat) { problems.push(`The feat in ${slot.source} is not in the current catalogue.`); continue; }
    const eligibility = featEligibility(feat, character, rules, { ...slot, source: selection.source || slot.source });
    for (const reason of eligibility.reasons) problems.push(`${feat.name}: ${reason}`);
    for (const choice of featChoiceDefinitions(feat, character, rules)) {
      if (!choice.resolved) continue;
      const values = Array.isArray(selection.choices?.[choice.id]) ? selection.choices[choice.id].filter(Boolean) : [];
      if (values.length !== choice.count || new Set(values).size !== choice.count) problems.push(`${feat.name}: complete “${choice.prompt}”`);
      const allowed = new Set(choice.options.map((entry) => entry.id));
      if (values.some((value) => !allowed.has(value))) problems.push(`${feat.name}: one conditional choice is no longer available.`);
    }
  }
  return problems;
}
