import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abilityBreakdown, abilityModifier, emptyCharacter, masteryRankCap, proficiencyBonus, proficiencyDegreeBonus, puppetAbilityPointPool, puppetAllowedCount, puppetDerivedStats, puppetUpgradeCapacity, puppetUpgradeProblems, sanitizeCharacter, startingWeaponRequirements, summonDerivedStats, syncAbilityScores, validateCharacter } from "../model.mjs";

assert.equal(abilityModifier(10), 0);
assert.equal(abilityModifier(9), -1);
assert.equal(abilityModifier(18), 4);
assert.equal(proficiencyBonus(1), 3);
assert.equal(proficiencyBonus(4), 4);
assert.equal(proficiencyBonus(20), 9);
assert.equal(masteryRankCap(1), 1);
assert.equal(masteryRankCap(6), 1);
assert.equal(masteryRankCap(7), 2);
assert.equal(masteryRankCap(12), 3);
assert.equal(proficiencyDegreeBonus(1, 0), 0);
assert.equal(proficiencyDegreeBonus(1, 1), 3);
assert.equal(proficiencyDegreeBonus(1, 2), 5);
assert.equal(proficiencyDegreeBonus(1, 4), 9);

const character = emptyCharacter();
const restored = sanitizeCharacter({ ...character, level: 999, abilities: { strength: 99 } });
assert.equal(restored.level, 20);
assert.equal(restored.baseAbilities.strength, 10);
assert.equal(restored.abilities.dexterity, 10);
assert.deepEqual(restored.equipment, { ryo: 100, startingChoices: {}, startingDetails: {}, items: [] });
assert.deepEqual(restored.summons, []);
assert.deepEqual(restored.puppets, []);
assert.deepEqual(restored.proficiencies, { skills: {}, toolkits: [] });
assert.deepEqual(startingWeaponRequirements("1 Simple Weapon, 2 Martial Weapons"), ["Simple", "Martial", "Martial"]);

const summon = { rank: "B-Rank", roleMode: "dual", primaryRole: "Defender", secondaryRole: "Caster", statIncreases: { constitution: 2 }, hpAdjustment: 0, acAdjustment: 0 };
const tribe = { abilities: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 }, toughness: 8, defensiveAbility: "constitution", ranks: { "B-Rank": { level: 12, asiPoints: 12, statMax: 22, jutsuSlots: 9 } } };
const derived = summonDerivedStats(summon, tribe, { summons: { ranks: {} } });
assert.equal(derived.hp, 132);
assert.equal(derived.ac, 21);
assert.equal(derived.defensiveAbility, "constitution");
assert.equal(derived.defensiveModifier, 3);
assert.deepEqual(derived.roles, ["Defender", "Caster"]);

const puppet = { chassis: "Warforged", statIncreases: { constitution: 1 }, upgrades: [], seals: [], hpAdjustment: 0, acAdjustment: 0, speedAdjustment: 0 };
const puppetDerived = puppetDerivedStats(puppet, 6);
assert.equal(puppetDerived.abilities.strength, 16);
assert.equal(puppetDerived.abilities.dexterity, 16);
assert.equal(puppetDerived.abilities.constitution, 14);
assert.equal(puppetDerived.hp, 46);
assert.equal(puppetDerived.ac, 17);
assert.equal(puppetDerived.sealSlots, 6);
assert.equal(puppetAllowedCount(9), 3);
assert.equal(puppetAbilityPointPool(12), 6);
assert.deepEqual(puppetUpgradeCapacity(6), { Wood: 4, Bronze: 2 });
assert.equal(puppetUpgradeProblems([{ upgrades: Array.from({ length: 3 }, () => ({ name: "Bronze test", tier: "Bronze", free: false })) }], 6).length, 1);

character.level = 4;
character.abilityIncreases.clanPrimary = "strength";
character.abilityIncreases.clanSecondary = "dexterity";
character.abilityIncreases.backgroundAbility = "strength";
character.abilityIncreases.classLevels[4] = "strength";
syncAbilityScores(character);
assert.deepEqual(abilityBreakdown(character, "strength"), { base: 10, clan: 2, background: 1, class: 1, manual: 0 });
assert.equal(character.abilities.strength, 14);

const rules = { classes: [], clans: [], backgrounds: [], subclasses: [], summons: { tribes: [], ranks: {} }, proficiencies: { skills: [] } };
assert.equal(validateCharacter(character, rules).length, 4);

const trained = sanitizeCharacter({ ...emptyCharacter(), proficiencies: { skills: { athletics: { degree: 3, source: "Class" } }, toolkits: [{ id: "kit", name: "Poison Kit", degree: 2, source: "Background" }] } });
assert.deepEqual(trained.proficiencies.skills.athletics, { degree: 3, source: "Class" });
assert.equal(trained.proficiencies.toolkits[0].degree, 2);
assert.equal(validateCharacter(trained, { ...rules, proficiencies: { skills: [{ id: "athletics", name: "Athletics" }] } }).filter((entry) => entry.includes("Athletics exceeds")).length, 1);

const extractedRules = JSON.parse(readFileSync(new URL("../data/rules.json", import.meta.url), "utf8"));
const expectedSummonAbilities = {
  Bear: [16, 10, 14, 10, 12, 10],
  Boar: [16, 10, 14, 10, 10, 12],
  Deer: [14, 12, 10, 10, 16, 10],
  "Dog/Wolf": [14, 14, 14, 10, 12, 10],
  Fox: [8, 14, 12, 10, 13, 14],
  "Hare/Rabbits": [8, 14, 10, 16, 13, 11],
  "Hawk/Predator Birds": [10, 14, 12, 10, 16, 10],
  "Insect Swarm": [8, 13, 11, 16, 14, 10],
  Lizard: [16, 12, 12, 10, 14, 8],
  "Monkey Primate": [16, 14, 12, 10, 10, 10],
  "Ox/Ram": [16, 10, 14, 10, 12, 10],
  Rat: [8, 16, 10, 14, 13, 11],
  Shark: [16, 10, 12, 10, 10, 14],
  Slug: [10, 10, 12, 14, 16, 10],
  Snake: [10, 16, 12, 10, 10, 14],
  Spider: [14, 10, 12, 16, 10, 10],
  "Tiger/Lion": [16, 10, 12, 10, 14, 10],
  Toad: [14, 12, 12, 14, 12, 11],
  Turtle: [13, 8, 16, 14, 11, 10],
  Weasel: [8, 16, 12, 14, 12, 10],
};
const expectedDefensiveAbilities = {
  Bear: "constitution", Boar: "strength", Deer: "dexterity", "Dog/Wolf": "dexterity",
  Fox: "dexterity", "Hare/Rabbits": "dexterity", "Hawk/Predator Birds": "dexterity",
  "Insect Swarm": "wisdom", Lizard: "strength", "Monkey Primate": "dexterity",
  "Ox/Ram": "constitution", Rat: "dexterity", Shark: "constitution", Slug: "constitution",
  Snake: "dexterity", Spider: "strength", "Tiger/Lion": "wisdom", Toad: "constitution",
  Turtle: "constitution", Weasel: "dexterity",
};
const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
for (const [tribeName, expected] of Object.entries(expectedSummonAbilities)) {
  const extractedTribe = extractedRules.summons.tribes.find(({ name }) => name === tribeName);
  assert.ok(extractedTribe, `missing summon tribe ${tribeName}`);
  assert.deepEqual(abilityKeys.map((ability) => extractedTribe.abilities[ability]), expected, `${tribeName} base ability scores`);
  assert.equal(extractedTribe.defensiveAbility, expectedDefensiveAbilities[tribeName], `${tribeName} defensive ability`);
}
console.log("model tests passed");
