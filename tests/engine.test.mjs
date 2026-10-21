import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEngine } from "../server/engine.mjs";
import { emptyCharacter } from "../server/character-model.mjs";

const rules = JSON.parse(await readFile(new URL("../private-data/rules.json", import.meta.url), "utf8"));
rules.feats = JSON.parse(await readFile(new URL("../private-data/feats.json", import.meta.url), "utf8")).feats;
const engine = createEngine(rules);
const keywordTokens = (value) => String(value || "").split(/[,;/]/).map((entry) => entry.trim().replace(/[.]+$/, "").toLowerCase()).filter(Boolean);

const hunterClass = rules.classes.find((entry) => entry.name === "Hunter-Nin");
assert.equal(hunterClass.skillGrants.find((entry) => entry.id === "class-hunter-choice").count, 4);
assert.equal(hunterClass.skillGrants.find((entry) => entry.id === "class-hunter-choice").options.includes("stealth"), false);
assert.deepEqual(hunterClass.combatProficiencies.ninjaTools, ["Disguise Kit", "Forensics Kit", "Forgery Kit"]);
assert.deepEqual(hunterClass.combatProficiencies.savingThrows, ["Dexterity", "Intelligence", "Wisdom"]);
assert.deepEqual(hunterClass.combatProficiencies.weapons, ["Simple Weapons", "Battle Wire", "Broadsword", "Chakram", "Fuma-Shuriken", "Iron Claw", "Jitte", "Katana", "Knuckle Blades", "Longbow", "Odachi", "Scythe"]);
assert.equal(hunterClass.subclassLevel, 3);
assert.equal(hunterClass.progressionChoices.find((entry) => entry.id === "hunter-patterns").options.length, 15);
assert.equal(hunterClass.progressionChoices.find((entry) => entry.id === "hunter-exploits").options.length, 28);
assert.deepEqual(hunterClass.progressionChoices.find((entry) => entry.id === "hunter-exploits").selections, [{ level: 3, count: 2 }, { level: 10, count: 1 }, { level: 17, count: 1 }]);
const practicedCombatant = hunterClass.progressionChoices.find((entry) => entry.id === "hunter-patterns").options.find((entry) => entry.id === "practiced-combatant");
assert.match(practicedCombatant.description, /stance/i);
assert.equal(practicedCombatant.followUps[0].options.length, 21);
assert.equal(practicedCombatant.followUps[0].options.filter((entry) => entry.category === "Taijutsu").length, 9);
assert.equal(practicedCombatant.followUps[0].options.filter((entry) => entry.category === "Bukijutsu").length, 12);
assert.equal(hunterClass.progressionChoices.find((entry) => entry.id === "hunter-patterns").options.find((entry) => entry.id === "habitual-researcher").allowRepeat, true);
assert.equal(hunterClass.progressionChoices.find((entry) => entry.id === "hunter-exploits").options.find((entry) => entry.id === "deflection").requiresSubclass, "Wolves-Legacy");
assert.equal(hunterClass.featuresByLevel[13].some((entry) => entry.name === "Elusive"), true);
assert.equal(hunterClass.featuresByLevel[20].some((entry) => entry.name === "Assassinate"), true);

const expectedProgressionGroups = new Map([
  ["Genjutsu-Specialist", 4], ["Hunter-Nin", 5], ["Intelligence-Operative", 2], ["Medical-Nin", 1],
  ["Ninjutsu-Specialist", 2], ["Scout-Nin", 6], ["Taijutsu-Specialist", 4], ["Weapon-Specialist", 3],
  ["Puppet-Master", 1], ["Cooking-Nin", 2], ["Science-Nin", 3], ["Jujutsu-Sorcerer", 5], ["Lunar-Slayer", 5],
]);
for (const [className, groupCount] of expectedProgressionGroups) {
  const cls = rules.classes.find((entry) => entry.name === className);
  assert.ok(cls.subclassLevel >= 2 && cls.subclassLevel <= 3, `${className} should expose its subclass level`);
  assert.equal(cls.progressionChoices.length, groupCount, `${className} should expose all verified guided-choice groups`);
  assert.ok(cls.progressionChoices.every((group) => group.options.length > 0 || group.optionsSource), `${className} guided choices need real options`);
}
assert.equal(rules.classes.find((entry) => entry.name === "Genjutsu-Specialist").progressionChoices.find((entry) => entry.id === "genjutsu-mirages").options.length, 78);
assert.equal(rules.classes.find((entry) => entry.name === "Ninjutsu-Specialist").progressionChoices.find((entry) => entry.id === "ninjutsu-moldings").options.length, 17);
assert.equal(rules.classes.find((entry) => entry.name === "Lunar-Slayer").progressionChoices.find((entry) => entry.id === "lunar-runes").options.length, 21);
assert.equal(rules.classes.find((entry) => entry.name === "Ninjutsu-Specialist").featuresByLevel[20].some((entry) => entry.name === "Ninjutsu Master"), true);
assert.equal(rules.classes.find((entry) => entry.name === "Cooking-Nin").featuresByLevel[20].some((entry) => entry.name === "Peerless Taste"), true);

const bootstrap = engine.bootstrap();
assert.equal(bootstrap.counts.classes, 13);
assert.equal(bootstrap.counts.jutsu, 1804);
assert.equal(bootstrap.counts.feats, 373);
assert.equal(Object.hasOwn(bootstrap, "jutsu"), false);
assert.equal(bootstrap.options.classes[0].featuresByLevel, undefined);
assert.equal(bootstrap.constants.abilityPointBudget, 30);
assert.deepEqual(bootstrap.constants.standardArray, [15, 14, 13, 12, 11, 10]);
assert.ok(bootstrap.trainingOptions.weapons.includes("Tachi"));
assert.ok(bootstrap.trainingOptions.armor.includes("Light Armor"));
assert.ok(bootstrap.trainingOptions.ninjaTools.includes("Poison Kit"));
assert.deepEqual(bootstrap.trainingOptions.savingThrows, ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);
assert.ok(bootstrap.filters.jutsuKeywords.includes("Chain"));
assert.ok(!bootstrap.filters.jutsuKeywords.some((entry) => /^cha(?:i)?n(?:\s|$)/i.test(entry) && entry !== "Chain"));
assert.ok(bootstrap.filters.jutsuKeywords.includes("Fire Release"));
assert.ok(!bootstrap.filters.jutsuKeywords.includes("Fire"));
assert.ok(bootstrap.filters.jutsuKeywords.includes("Combo"));
assert.ok(bootstrap.filters.jutsuKeywords.includes("Combination"));
assert.ok(bootstrap.filters.featCategories.includes("Clan"));
assert.ok(bootstrap.filters.featCategories.includes("Class"));

const lowLevelFeatSearch = engine.searchFeats({ character: emptyCharacter(), query: "Action Surge", showLocked: true, limit: 20, slot: { id: "class-4", level: 4, source: "Class advancement" } });
assert.equal(lowLevelFeatSearch.items.find((entry) => entry.name === "Action Surge").eligibility.eligible, false);
const highLevelFeatSearch = engine.searchFeats({ character: { ...emptyCharacter(), level: 8 }, query: "Action Surge", showLocked: true, limit: 20, slot: { id: "class-8", level: 8, source: "Class advancement" } });
assert.equal(highLevelFeatSearch.items.find((entry) => entry.name === "Action Surge").eligibility.eligible, true);
const clashingAdept = engine.searchFeats({ character: emptyCharacter(), query: "Clashing Adept", showLocked: true, limit: 20, slot: { id: "extra-test", level: 12, source: "GM bonus" } }).items.find((entry) => entry.name === "Clashing Adept");
assert.ok(clashingAdept.choices.some((choice) => choice.options.some((option) => option.name === "Ninshou")));
const featCharacter = emptyCharacter();
featCharacter.backgroundId = rules.backgrounds[0].id;
featCharacter.abilityIncreases.backgroundMode = "feat";
const advancedStudy = rules.feats.find((entry) => entry.name === "Advanced Study");
featCharacter.feats.push({ slotId: "background", featId: advancedStudy.id, level: 1, source: "Background", choices: { "choice-1": ["intelligence"] } });
const featEvaluated = engine.evaluate(featCharacter);
assert.equal(featEvaluated.derived.abilities.intelligence.breakdown.feat, 1);
assert.equal(featEvaluated.character.abilities.intelligence, 11);
assert.ok(!featEvaluated.problems.some((problem) => problem.includes("Advanced Study")));
assert.equal(engine.exportCharacter(featCharacter).character.feats[0].featName, "Advanced Study");

const character = emptyCharacter();
character.name = "Secure Test";
character.level = 10;
character.classId = rules.classes.find((entry) => entry.name === "Medical-Nin").id;
character.clanId = rules.clans.find((entry) => entry.name === "Uzumaki").id;
character.backgroundId = rules.backgrounds[0].id;
character.baseAbilities.constitution = 16;
character.abilityIncreases.clanPrimary = "constitution";
character.abilityIncreases.clanSecondary = "wisdom";
character.abilityIncreases.backgroundAbility = "intelligence";
for (const level of [4, 8]) character.abilityIncreases.classLevels[level] = "constitution";

const evaluated = engine.evaluate(character);
assert.equal(evaluated.character.schema, "naruto5e-character");
assert.equal(evaluated.derived.proficiencyBonus, 6);
assert.equal(evaluated.derived.abilities.constitution.score, 20);
assert.equal(evaluated.selection.class.name, "Medical-Nin");
assert.equal(evaluated.derived.capabilities.find((entry) => entry.id === "medical").enabled, true);
assert.equal(evaluated.derived.capabilities.find((entry) => entry.id === "fuinjutsu").enabled, true);

const hunter = emptyCharacter();
hunter.name = "Hunter Test";
hunter.classId = hunterClass.id;
hunter.baseAbilities.dexterity = 18;
hunter.baseAbilities.strength = 10;
hunter.featureChoices["1:Lethal Precision"] = "Taijutsu";
const evaluatedHunter = engine.evaluate(hunter);
assert.equal(evaluatedHunter.derived.jutsuCasting.Ninjutsu.ability, "intelligence");
assert.equal(evaluatedHunter.derived.jutsuCasting.Taijutsu.ability, "dexterity");
assert.equal(evaluatedHunter.derived.jutsuCasting.Taijutsu.attackModifier, 7);
assert.equal(evaluatedHunter.derived.jutsuCasting.Taijutsu.saveDC, 15);
assert.equal(evaluatedHunter.derived.jutsuCasting.Bukijutsu.ability, "strength");
assert.equal(evaluatedHunter.derived.timeline.length, 20);
assert.equal(evaluatedHunter.derived.timeline[0].attained, true);
assert.equal(evaluatedHunter.derived.timeline[1].attained, false);
assert.equal(evaluatedHunter.derived.timeline[0].progressionChoices[0].id, "hunter-lethal-precision");
assert.ok(evaluatedHunter.problems.some((problem) => problem.includes("Lethal Precision discipline")));
hunter.featureChoices["progression:hunter-lethal-precision:1"] = ["taijutsu"];
assert.ok(!engine.evaluate(hunter).problems.some((problem) => problem.includes("Lethal Precision discipline")));
hunter.level = 2;
hunter.featureChoices["progression:hunter-patterns:2"] = ["practiced-combatant"];
assert.ok(engine.evaluate(hunter).problems.some((problem) => problem.includes("Fighting stance") && problem.includes("Practiced Combatant")));
hunter.featureChoices["progression-detail:hunter-patterns:2:0:practiced-combatant:stance"] = ["dragon-fist-stance"];
assert.ok(!engine.evaluate(hunter).problems.some((problem) => problem.includes("Fighting stance") && problem.includes("Practiced Combatant")));

const toolkitGroup = hunterClass.startingEquipment.find((entry) => entry.choices.some((choice) => /Kits? of your choice/i.test(choice)));
hunter.equipment.startingChoices[toolkitGroup.id] = toolkitGroup.choices[0];
assert.ok(engine.evaluate(hunter).problems.some((problem) => problem.includes("Choose all 2 kits")));
hunter.equipment.startingDetails[toolkitGroup.id] = ["Poison Kit", "Disguise Kit"];
assert.ok(!engine.evaluate(hunter).problems.some((problem) => problem.includes("Choose all 2 kits")));

const search = engine.searchJutsu({ query: "chakra", limit: 5, page: 1, hijutsu: false });
assert.ok(search.items.length > 0 && search.items.length <= 5);
assert.ok(search.total >= search.items.length);
assert.equal(search.hasMore, search.total > search.items.length);

const noNature = engine.searchJutsu({ elements: ["None"], includeHijutsu: true, limit: 50 });
assert.ok(noNature.items.length > 0);
const naturePattern = /\b(?:fire|wind|lightning|earth|water|ice|lava|boil|storm|magnet|scorch|explosion|wood|crystal|dust|yin|yang)(?: release)?\b|any nature release/i;
assert.ok(noNature.items.every((entry) => !naturePattern.test(entry.keywords)));
const keyword = "Chain";
const keywordSearch = engine.searchJutsu({ keywords: [keyword], includeHijutsu: true, limit: 50 });
assert.ok(keywordSearch.items.length > 0);
assert.ok(keywordSearch.items.every((entry) => /\bcha(?:i)?n\b/i.test(entry.keywords)));
assert.ok(keywordSearch.items.some((entry) => /Chain [13X]|Chain \(Special\)|Chan X/i.test(entry.keywords)));

const fireKeywordSearch = engine.searchJutsu({ keywords: ["Fire Release"], includeHijutsu: true, limit: 50 });
assert.ok(fireKeywordSearch.items.length > 0);
assert.ok(fireKeywordSearch.items.every((entry) => /\bfire(?: release)?\b/i.test(entry.keywords)));

const comboSearch = engine.searchJutsu({ keywords: ["Combo"], includeHijutsu: true, limit: 50 });
assert.ok(comboSearch.items.length > 0);
assert.ok(comboSearch.items.every((entry) => keywordTokens(entry.keywords).includes("combo")));
assert.ok(comboSearch.items.every((entry) => !keywordTokens(entry.keywords).includes("combination")));
const combinationSearch = engine.searchJutsu({ keywords: ["Combination"], includeHijutsu: true, limit: 50 });
assert.ok(combinationSearch.items.length > 0);
assert.ok(combinationSearch.items.every((entry) => keywordTokens(entry.keywords).includes("combination")));
assert.ok(combinationSearch.items.every((entry) => !keywordTokens(entry.keywords).includes("combo")));

const equipment = engine.searchEquipment({ type: "weapon", category: "simple", limit: 7 });
assert.ok(equipment.items.length <= 7);
assert.ok(equipment.items.every((entry) => entry.kind === "weapon"));
const pricedItem = [...rules.equipment.weapons, ...rules.equipment.armor].find((entry) => Number(entry.price) > 0 && Number(entry.price) <= character.equipment.ryo);
const purchased = engine.purchaseEquipment(character, pricedItem.id);
assert.equal(purchased.character.equipment.ryo, character.equipment.ryo - pricedItem.price);
assert.equal(purchased.character.equipment.items.at(-1).catalogueId, pricedItem.id);

const normalJutsu = rules.jutsu.find((entry) => !String(entry.keywords).toLowerCase().includes("hijutsu"));
const learned = engine.selectJutsu(character, normalJutsu.id, { kind: "character", level: 3 });
assert.equal(learned.character.jutsu[0].id, normalJutsu.id);
assert.equal(learned.character.jutsu[0].level, 3);

const exported = engine.exportCharacter(character);
assert.equal(exported.character.schemaVersion, 9);
assert.ok(Array.isArray(exported.problems));
assert.equal(Object.hasOwn(exported.character, "rules"), false);
assert.equal(exported.character.className, "Medical-Nin");
assert.equal(exported.character.clanName, "Uzumaki");

const tachi = rules.equipment.weapons.find((entry) => entry.name === "Tachi");
assert.ok(tachi, "The equipment catalogue should expose Tachi by name.");
character.equipment.startingDetails["round-trip-weapon"] = [tachi.id];
const readableExport = engine.exportCharacter(character).character;
assert.deepEqual(readableExport.equipment.startingDetails["round-trip-weapon"], ["Tachi"]);
const readableOnly = structuredClone(readableExport);
readableOnly.classId = hunterClass.id;
readableOnly.clanId = rules.clans.find((entry) => entry.name !== "Uzumaki").id;
const roundTrip = engine.importCharacter(readableOnly).character;
assert.equal(roundTrip.classId, character.classId);
assert.equal(roundTrip.clanId, character.clanId);
assert.deepEqual(roundTrip.equipment.startingDetails["round-trip-weapon"], [tachi.id]);

console.log("secure engine tests passed");
