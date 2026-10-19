import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEngine } from "../server/engine.mjs";
import { emptyCharacter } from "../server/character-model.mjs";

const rules = JSON.parse(await readFile(new URL("../private-data/rules.json", import.meta.url), "utf8"));
const engine = createEngine(rules);

const hunterClass = rules.classes.find((entry) => entry.name === "Hunter-Nin");
assert.equal(hunterClass.skillGrants.find((entry) => entry.id === "class-hunter-choice").count, 4);
assert.equal(hunterClass.skillGrants.find((entry) => entry.id === "class-hunter-choice").options.includes("stealth"), false);
assert.deepEqual(hunterClass.combatProficiencies.ninjaTools, ["Disguise Kit", "Forensics Kit", "Forgery Kit"]);
assert.deepEqual(hunterClass.combatProficiencies.savingThrows, ["Dexterity", "Intelligence", "Wisdom"]);

const bootstrap = engine.bootstrap();
assert.equal(bootstrap.counts.classes, 13);
assert.equal(bootstrap.counts.jutsu, 1804);
assert.equal(Object.hasOwn(bootstrap, "jutsu"), false);
assert.equal(bootstrap.options.classes[0].featuresByLevel, undefined);

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
assert.equal(exported.character.schemaVersion, 8);
assert.ok(Array.isArray(exported.problems));
assert.equal(Object.hasOwn(exported.character, "rules"), false);

console.log("secure engine tests passed");
