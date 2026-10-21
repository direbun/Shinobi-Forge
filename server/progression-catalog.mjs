import { GENERATED_CLASS_FEATURES, GENERATED_OPTION_POOLS } from "./generated-progression-data.mjs";

const slug = (name) => name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const option = (name, details = {}) => ({ id: slug(name), name, ...details });
const choices = (names) => names.map(option);
const generatedChoices = (key) => (GENERATED_OPTION_POOLS[key] || []).map((entry) => {
  const levelMatch = entry.description.match(/Prerequisite:\s*(\d+)(?:st|nd|rd|th)?\s+(?:Genjutsu Specialist )?Level/i);
  return option(entry.name, { description: entry.description, sourceRow: entry.sourceRow, ...(levelMatch ? { minLevel: Number(levelMatch[1]) } : {}) });
});

const SKILLS = choices(["Acrobatics", "Animal Handling", "Athletics", "Chakra Control", "Crafting", "Deception", "History", "Illusions", "Insight", "Intimidation", "Investigation", "Martial Arts", "Medicine", "Nature", "Ninshou", "Perception", "Persuasion", "Sleight of Hand", "Stealth", "Survival", "Technology"]);
const LANDS = choices(["Land of Fire", "Land of Earth", "Land of Lightning", "Land of Water", "Land of Wind", "Land of Snow", "Minor Lands (any three)"]);
const ADVERSARIES = choices(["Caster", "Controller", "Defender", "Lurker", "Generalist", "Striker", "Supporter"]);
const ABILITIES = choices(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);
const TOOLKITS = choices(["Chemistry Kit", "Disguise Kit", "Forensics Kit", "Forgery Kit", "Medicine Kit", "Poison Kit", "Security Kit", "Smith's Tools", "Tracking Kit", "Trapper's Kit"]);
const NATURE_RELEASES = choices(["Earth Release", "Wind Release", "Fire Release", "Water Release", "Lightning Release"]);

const STANCES = [
  option("Dragon Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage and gain Reinforced. Focus on one creature as a bonus action for +2 AC against it until your next turn." }),
  option("Drunken Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage and gain Fortified. React to impose disadvantage on attacks against you until the end of the turn." }),
  option("Frog Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage and gain Reach 1. Taijutsu that deal unarmed damage gain 10 feet of range." }),
  option("Iron Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage, or d8 with Combat Bracers when using Strength, and gain Heavy. Double your unarmed damage dice against structures and constructs." }),
  option("Lion Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage, or d8 against frightened creatures, and gain Threatening. Replace one Attack-action attack with Demoralize." }),
  option("Rabbit Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage and gain Multiattack. Total Attack and multiattack unarmed damage before damage reduction." }),
  option("Serpent Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 piercing damage and gain Tactical. Once per turn, a hit penalizes the target's next Taijutsu attack by d4." }),
  option("Silent Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 slashing damage, or d8 with Iron Claws, and gain Lethal 2. Your movement and strikes are exceptionally quiet." }),
  option("Wolf Fist Stance", { category: "Taijutsu", description: "Unarmed attacks deal d6 damage and gain Blocking 1. Wolf Fang Fist makes two unarmed attacks with a larger damage die." }),
  option("Blade Stance", { category: "Bukijutsu", requirement: "Melee · Blade group", description: "Gain advantage on opportunity attacks. Critical hits inflict one rank of Bleeding." }),
  option("Power Stance", { category: "Bukijutsu", requirement: "Melee · Power group", description: "A readied hit knocks the target prone and makes standing more costly. Critical hits inflict one rank of Bruised." }),
  option("Dueling Mastery", { category: "Bukijutsu", requirement: "One melee weapon and an empty other hand", description: "Your first melee hit each turn gains a damage die. React to counterattack after a melee hit against you." }),
  option("Great Weapon Stance", { category: "Bukijutsu", requirement: "Melee · Two-Handed or Heavy", description: "Reroll weapon damage dice showing 1 or 2, keeping the second result. A hit also deals half damage to adjacent hostiles." }),
  option("Polearm Stance", { category: "Bukijutsu", requirement: "Melee · Polearm group", description: "After attacking, make an opposite-end attack as a bonus action. Creatures provoke when entering or leaving your reach." }),
  option("Silent Killing", { category: "Bukijutsu", requirement: "Deadly, Hidden, or Lethal weapon", description: "While hidden or heavily obscured, ignore half damage reduction and gain Mastery on your first attack from hiding." }),
  option("Sharpshooter Stance", { category: "Bukijutsu", requirement: "Ranged weapon", description: "Focus as a bonus action for advantage and cover penetration on your next attack. React to shoot and divert an incoming ranged attack." }),
  option("Shield Guardian Stance", { category: "Bukijutsu", requirement: "Melee · Blocking weapon", description: "Dodging improves Strength saves. React to intercept an attack or damage aimed at an adjacent ally." }),
  option("Spider Web Stance", { category: "Bukijutsu", requirement: "Flail group", description: "Your weapon gains Grapple and can move a hit target. Damage increases against targets grappled or restrained by it." }),
  option("Throwing Stance", { category: "Bukijutsu", requirement: "Thrown weapon", description: "Thrown weapons gain Returning and use long range as normal range. A ranged hit grants advantage on your next melee attack with it." }),
  option("Trickster Stance", { category: "Bukijutsu", requirement: "Finesse, Trip, Thrown, or Hidden weapon", description: "Conceal and detonate explosives without revealing yourself. A critical hit lets you Dash as part of the action." }),
  option("Two-Weapon Stance", { category: "Bukijutsu", requirement: "Two Light weapons or a Double weapon", description: "Retry a missed attack as a bonus action, strike with both weapons on opportunity attacks, and total Attack-action damage before reduction." }),
];

const HUNTER_PATTERNS = [
  option("Back-up Plans", { description: "Once per rest, produce a single-use greater-quality tool, kit, or weapon from a prepared backup scroll." }),
  option("Botany", { allowRepeat: true, description: "Choose two lands. Add 1d6 to Nature and Survival checks there. Repeatable for different lands.", followUps: [{ id: "locations", label: "Favored land", count: 2, options: LANDS }] }),
  option("Drinker", { description: "For every two Hit Dice you spend, gain one additional use of a Hunter-Nin class feature that has a use limit." }),
  option("Habitual Researcher", { allowRepeat: true, description: "Gain proficiency in two skills. Repeatable for different skills.", followUps: [{ id: "skills", label: "Skill proficiency", count: 2, options: SKILLS }] }),
  option("Horror Films", { description: "Gain immunity to the Fear condition and fear-based effects." }),
  option("Hyper Critical Eye", { description: "Inspect a weapon, armor, or tool within 60 feet as an object interaction to learn its quality, special effects, features, and seals." }),
  option("Illicit Literature", { description: "Gain immunity to the Charmed condition and charm-based effects." }),
  option("Kleptomaniac", { description: "Gain proficiency in Sleight of Hand or Security Kits. When picking a pocket or lock, you can mark it as your Primary Target to reduce the DC by 2.", followUps: [{ id: "proficiency", label: "Granted proficiency", count: 1, options: choices(["Sleight of Hand", "Security Kits"]) }] }),
  option("Martial Student", { description: "Use Dexterity for the martial discipline not selected by Lethal Precision; that discipline is determined by your level 1 choice." }),
  option("Ninja Info Card Addict", { allowRepeat: true, description: "Choose an adversary role. When you learn a creature has that role, you also learn all of its role traits. Repeatable for a different role.", followUps: [{ id: "adversary-type", label: "Adversary role", count: 1, options: ADVERSARIES }] }),
  option("Overprepared", { description: "After each rest, roll and record a d20. Replace one creature's Dexterity-, Wisdom-, or Charisma-based skill check with that recorded result, consuming it." }),
  option("Practiced Combatant", { description: "Learn one Taijutsu or Bukijutsu fighting stance from Chapter 13.", followUps: [{ id: "stance", label: "Fighting stance", count: 1, options: STANCES }] }),
  option("Pre-Planned Route", { description: "When you Dash, increase your movement by twice your base speed. You regain this benefit after reducing your speed to 0 at the start of a turn or finishing a rest." }),
  option("Reviewing Tactics", { description: "When you and an ally stand on opposite sides of a hostile creature, it suffers −2 AC against your attacks." }),
  option("Smoker", { description: "Once per turn, spend one Chakra Die and add its result to a skill check." }),
];

const exploit = (name, description, requiresSubclass) => option(name, { description, ...(requiresSubclass ? { requiresSubclass } : {}) });
const HUNTER_EXPLOITS = [
  exploit("Aim", "Use Perception against AC to improve your next attack; an exceptional result also improves its critical threat range."),
  exploit("Analyze", "Use Investigation against Charisma to identify a creature's adversary role or clan."),
  exploit("Angle", "Use Perception against Dexterity to hinder the target's next attack and saving throw."),
  exploit("Battle Cry", "Use Intimidation against Charisma to demoralize a creature, penalizing attacks, checks, saves, and AC."),
  exploit("Brute", "After a melee hit, use Athletics against Strength to inflict a rank of Weakened."),
  exploit("Chakra Recoil", "After casting a jutsu, make a Chakra Control check based on its rank to recover part of its chakra cost."),
  exploit("Charming", "Use Persuasion against Wisdom to charm a creature until combat begins or it is harmed."),
  exploit("Confuse Beast", "Use Animal Handling against Wisdom to prevent a beast from taking actions or reactions."),
  exploit("Deflection", "Spend Lethal Attack dice to reduce incoming damage and potentially reduce a melee attacker's AC.", "Wolves-Legacy"),
  exploit("Diplomacy", "Use Persuasion against Charisma to improve a creature's disposition toward you."),
  exploit("Distraction", "Use Deception as a bonus action or reaction to make a target surprised against a chosen ally."),
  exploit("Emulate Predator", "While unseen, use Nature against Wisdom to force a target to flee."),
  exploit("Feint", "Use Deception as a bonus action against Wisdom to briefly incapacitate a target."),
  exploit("Festering Siphonage", "When applying Necrosis, shift one of the target's physical or mental ability scores.", "Necrotic-Hand"),
  exploit("Fox's Sin", "When using Shadow Bite, steal one of the target's boons for yourself.", "Vice-Agent"),
  exploit("Hinder", "Use Sleight of Hand as a reaction to blind a creature under the exploit's trigger."),
  exploit("Incurable Affliction", "Make your Undertaker poisons and their afflictions harder to remove.", "Undertaker"),
  exploit("Instruct", "Use Investigation to give allies advantage on their next attack against the studied target."),
  exploit("Intuit", "Use Insight to prevent a target from adding bonuses to its next skill checks."),
  exploit("Shadow Step", "Use Stealth to move between obscured spaces and remain difficult to sense.", "Grave-Stalker"),
  exploit("Sharp Rain", "Use Crafting with Arsenalist weapons to restrict speed, hand seals, or actions.", "Arsenalist"),
  exploit("Study", "Use History as a reaction to gain advantage on your first relevant check, attack, or save against a target."),
  exploit("Sunder", "Use Crafting to bypass the AC bonus granted by a target's armor."),
  exploit("Terrifying", "Use Intimidation to inflict Fear and increase the difficulty of resisting it."),
  exploit("Tumble", "Use Acrobatics to replace your AC against the first attack made against you."),
  exploit("Vanish", "Use Stealth to move into concealment and Hide."),
  exploit("Void Assault", "Empower Lethal Attacks against marked creatures and reposition through the void.", "Void-Walker"),
  exploit("Wardens Assault", "Use Athletics to enable two Lethal Attacks under the Blade Warden exploit's conditions.", "Blade-Warden"),
];

const HUNTER_DEFENSIVE_TACTICS = [
  option("Escaping Danger", { description: "Opportunity attacks and attacks made as reactions against you have disadvantage." }),
  option("Evasion", { description: "On Dexterity saves that normally deal half damage, take none on a success and half on a failure." }),
  option("Hunter's Revenge", { description: "After a creature hits you, your next qualifying damage against it can use Lethal Attack without its normal trigger." }),
  option("Unbroken Will", { description: "Gain advantage on saving throws against Mental and Sensory conditions." }),
];

const HUNTER_PROGRESSION = [
  { id: "hunter-lethal-precision", featureName: "Lethal Precision", label: "Lethal Precision discipline", help: "Choose the discipline that can use Dexterity instead of Strength.", selections: [{ level: 1, count: 1 }], options: [option("Taijutsu", { description: "Use Dexterity for Taijutsu attack modifiers and save DCs." }), option("Bukijutsu", { description: "Use Dexterity for Bukijutsu attack modifiers and save DCs." })] },
  { id: "hunter-patterns", featureName: "Hunters Patterns", label: "Hunter Pattern", help: "Choose one Pattern at each listed level. Only options marked repeatable may be selected again.", selections: [{ level: 2, count: 1 }, { level: 9, count: 1 }, { level: 15, count: 1 }], options: HUNTER_PATTERNS },
  { id: "hunter-exploits", featureName: "Hunter Exploits", label: "Hunter Exploit", help: "Choose two at level 3, then one additional Exploit at levels 10 and 17. Subclass-only options unlock for the matching subclass.", selections: [{ level: 3, count: 2 }, { level: 10, count: 1 }, { level: 17, count: 1 }], options: HUNTER_EXPLOITS },
  { id: "hunter-defensive-tactics", featureName: "Defensive Tactics", label: "Defensive Tactic", help: "Choose one at levels 6, 11, and 17.", selections: [{ level: 6, count: 1 }, { level: 11, count: 1 }, { level: 17, count: 1 }], options: HUNTER_DEFENSIVE_TACTICS },
  { id: "hunter-expertise", featureName: "Expertise", label: "Skill or toolkit mastery", help: "Choose a proficient skill or toolkit at levels 5 and 15.", selections: [{ level: 5, count: 1 }, { level: 15, count: 1 }], options: [], optionsSource: { type: "proficient-skills-tools" } },
];

const HUNTER_FEATURE_PATCHES = {
  13: [{ name: "Elusive", description: "Beginning at 13th level, no attack roll has advantage against you while you are not incapacitated.", type: "Class", action: "None", cost: "None" }],
  20: [{ name: "Assassinate", description: "At 20th level, you have mastered hunting, tracking, and assassinating targets. You can trigger Lethal Attack twice per turn.", type: "Class", action: "None", cost: "None" }],
};

const group = (id, featureName, label, selections, options, help) => ({ id, featureName, label, selections, options, help });

function classCatalog(rules) {
  const weapons = (rules.equipment?.weapons || []).filter((entry) => !/\(Two Hands\)$/i.test(entry.name)).map((entry) => option(entry.name, { description: `${entry.category || "Weapon"} · ${entry.damage || "—"} ${entry.damageType || "damage"}. ${entry.properties || ""}`.trim() }));
  const weaponStances = STANCES.filter((entry) => entry.category === "Bukijutsu");
  const taijutsuStances = STANCES.filter((entry) => entry.category === "Taijutsu");
  const subclassesFor = (className) => (rules.subclasses || []).filter((entry) => entry.className === className).map((entry) => option(entry.name, { description: `Gain the 3rd-level features of ${entry.name}. This must be different from your primary subclass.`, forbidsCurrentSubclass: true }));
  const weaponTraits = choices(["Accurate", "Blocking", "Critical", "Deadly", "Defensive", "Disarming", "Finesse", "Heavy", "Hidden", "Lethal", "Multiattack", "Reach", "Returning", "Threatening", "Thrown", "Trip"]);
  const masterIllusion = [
    option("Greater Mastery", { description: "A save result 2 or more below your save DC is treated as a critical failure." }),
    option("Higher Understanding", { description: "A creature must beat your save DC by 10 or more to critically succeed against your Genjutsu." }),
    option("Subdued Illusion", { description: "Increase the check DC to identify your Genjutsu by 5." }),
    option("Genjutsu Flow", { description: "Double Genjutsu range; Touch range becomes 30 feet." }),
  ];
  const superiorFlurry = choices(["Enhanced Deflection lasts until your next turn", "Enhanced Deflection may add one-third maximum Flurry Dice to AC", "Perceptive Augmentation lasts until the end of your next turn", "Perceptive Augmentation also grants Dash", "Striking Flurry can trigger one additional time", "Chained Reaction can add two Flurry Dice"]);
  const vows = generatedChoices("jujutsuBindingVows").map((entry) => ({ ...entry, slotCost: /major binding vow|heavenly restriction/i.test(entry.name) || /major binding vow/i.test(entry.description) ? 2 : 1 }));
  const minorVows = vows.filter((entry) => entry.slotCost === 1);
  const genjutsuInceptions = generatedChoices("genjutsuInceptions").map((entry) => entry.name === "Elemental Manifestation" ? { ...entry, followUps: [{ id: "nature-release", label: "Nature release", count: 1, options: NATURE_RELEASES }] } : entry.name === "Illusionary Weapon" ? { ...entry, followUps: [{ id: "weapon-form", label: "Illusionary weapon form", count: 1, options: weapons }] } : entry);
  const genjutsuMirages = generatedChoices("genjutsuMirages").map((entry) => entry.name === "Fighting Mirage" ? { ...entry, followUps: [{ id: "stance", label: "Mirage fighting stance", count: 1, options: STANCES }] } : entry);
  const scoutAdept = generatedChoices("scoutAdept").map((entry) => entry.name === "Shinobi’s Precision" ? { ...entry, followUps: [{ id: "jutsu-type", label: "Chosen jutsu type", count: 1, options: choices(["Ninjutsu", "Taijutsu", "Bukijutsu", "Genjutsu"]) }] } : entry);
  const signatureEffects = generatedChoices("scoutSignatureEffects").map((entry) => ({ ...entry, followUps: [{ id: "signature-jutsu", label: "Known B-rank or lower jutsu", count: 1, optionsSource: { type: "known-jutsu", maxRank: "B-Rank" } }] }));

  return {
    "Genjutsu-Specialist": [
      group("genjutsu-inception", "Genjutsu Inception", "Genjutsu Inception", [{ level: 3, count: 1 }], genjutsuInceptions, "Choose the conceptual basis for your Genjutsu. Selected descriptions expose any secondary decisions."),
      group("genjutsu-mirages", "Malleable Mirages", "Malleable Mirage", [{ level: 2, count: 2 }, ...[4, 6, 8, 10, 12, 14, 16, 18, 20].map((level) => ({ level, count: 1 }))], genjutsuMirages, "Choose two at level 2 and one more at each listed level. Prerequisites remain visible in each description."),
      group("genjutsu-conversions", "Real World Conversion", "Conversion", [5, 9, 15].map((level) => ({ level, count: 1 })), generatedChoices("genjutsuConversions"), "Choose one Conversion at levels 5, 9, and 15."),
      group("genjutsu-mastery", "Master of Illusion", "Master of Illusion benefit", [13, 20].map((level) => ({ level, count: 1 })), masterIllusion, "Choose one benefit at level 13 and a second at level 20."),
    ],
    "Intelligence-Operative": [
      group("operative-plans", "Master Planner", "Plan", [{ level: 2, count: 2 }, ...[5, 8, 11, 14, 17, 20].map((level) => ({ level, count: 1 }))], generatedChoices("intelligencePlans"), "Choose two Plans at level 2 and another at levels 5, 8, 11, 14, 17, and 20. Plans can be exchanged on a long rest."),
      { ...group("operative-mastery", "Mastery", "Skill or toolkit mastery", [2, 9, 16].map((level) => ({ level, count: 1 })), [], "Choose one proficient skill or toolkit at each listed level."), optionsSource: { type: "proficient-skills-tools" } },
    ],
    "Medical-Nin": [
      group("medical-doctrines", "Medical Doctrine", "Medical Doctrine", [3, 13].map((level) => ({ level, count: 1 })), generatedChoices("medicalDoctrines"), "Choose one doctrine at level 3 and another at level 13."),
    ],
    "Ninjutsu-Specialist": [
      { ...group("ninjutsu-refined", "Refined Ninjutsu", "Refined Ninjutsu", [{ level: 1, count: 2 }, ...[4, 7, 10, 13, 16, 19].map((level) => ({ level, count: 1 }))], [], "Choose from the Ninjutsu already added to this character. Combination jutsu are excluded."), optionsSource: { type: "known-jutsu", keyword: "Ninjutsu", excludeKeyword: "Combination" } },
      group("ninjutsu-moldings", "Efficient Molding", "Efficient Molding", [{ level: 3, count: 2 }, ...[5, 9, 13, 18].map((level) => ({ level, count: 1 }))], generatedChoices("ninjutsuMoldings"), "Choose two moldings at level 3, then one at levels 5, 9, 13, and 18."),
    ],
    "Scout-Nin": [
      group("scout-stance", "Fighting Stance", "Fighting stance", [{ level: 1, count: 1 }], STANCES, "Choose a Taijutsu or Bukijutsu stance."),
      group("scout-canny", "Canny", "Canny proficiency", [{ level: 1, count: 1 }], SKILLS, "Choose the skill granted proficiency and Mastery by Canny."),
      group("scout-adept", "Shinobi Adept", "Shinobi Adept feature", [{ level: 2, count: 2 }, { level: 13, count: 2 }], scoutAdept, "Choose two at level 2 and two more at level 13."),
      group("scout-jack", "Jack of all Master of None", "Generalization", [{ level: 5, count: 1 }], generatedChoices("scoutJack"), "Choose the generalization currently prepared after your latest rest."),
      group("scout-signature-effect", "Signature Jutsu", "Signature effect", [7, 15].map((level) => ({ level, count: 1 })), signatureEffects, "Choose the effect, then pair it with a known B-rank or lower jutsu."),
      group("scout-signature-technique", "Signature Technique", "Signature Technique", [10, 18].map((level) => ({ level, count: 1 })), generatedChoices("scoutSignatureTechniques"), "Choose one at level 10 and a second at level 18."),
    ],
    "Taijutsu-Specialist": [
      group("taijutsu-stance", "Unarmed Technique", "Taijutsu stance", [{ level: 1, count: 1 }], taijutsuStances, "Choose the Taijutsu stance granted by Unarmed Technique."),
      group("taijutsu-martial-techniques", "Martial Adept", "Martial Technique", [{ level: 2, count: 4 }, ...[7, 13, 19].map((level) => ({ level, count: 1 }))], generatedChoices("taijutsuMartialTechniques"), "Choose four Martial Techniques at level 2, then one more at levels 7, 13, and 19."),
      group("taijutsu-flow", "Flow of Battle", "Initiative ability", [{ level: 11, count: 1 }], choices(["Intelligence", "Wisdom", "Charisma"]), "Choose the mental ability permanently added to initiative."),
      group("taijutsu-perfect-mind", "Perfect Mind", "Saving throw proficiency", [{ level: 18, count: 1 }], choices(["Intelligence", "Wisdom"]), "Choose the saving throw proficiency granted by Perfect Mind."),
    ],
    "Weapon-Specialist": [
      group("weapon-focus", "Weapon Focus", "Weapon Focus", [1, 9, 15].map((level) => ({ level, count: 1 })), weapons.map((entry) => ({ ...entry, followUps: [{ id: "trait", label: "Bonus weapon trait", count: 1, options: weaponTraits }] })), "Choose the weapon type and the bonus trait attached to each Weapon Focus."),
      group("weapon-stance", "Weapon Stance", "Weapon stance", [{ level: 2, count: 1 }], weaponStances, "Choose one Bukijutsu weapon stance."),
      group("weapon-superior-flurry", "Superior Weapon Flurry", "Superior Flurry benefit", [{ level: 14, count: 2 }, { level: 18, count: 1 }], superiorFlurry, "Choose two benefits at level 14 and another at level 18."),
    ],
    "Puppet-Master": [
      group("puppet-tactics", "Puppet Master Tactics", "Puppet Master Tactic", [{ level: 2, count: 1 }, { level: 11, count: 1 }], generatedChoices("puppetTactics"), "Choose a tactic at level 2 and another at level 11. Puppet upgrades remain managed in the dedicated Puppets area."),
    ],
    "Cooking-Nin": [
      group("cooking-soul", "Food for the Soul", "Ability score", [{ level: 2, count: 1 }], ABILITIES, "Choose the ability currently nourished after your latest rest."),
      { ...group("cooking-expertise", "Tool Expertise", "Mastered skill", [{ level: 3, count: 1 }], [], "Choose one proficient skill, then the proficient ninja tool that also gains Mastery."), optionsSource: { type: "proficient-skills" }, dynamicFollowUp: { id: "toolkit", label: "Mastered ninja tool", count: 1, optionsSource: { type: "proficient-tools" } } },
    ],
    "Science-Nin": [
      { ...group("science-cell-jutsu", "Chakra Cell Enhancement", "Enhanced E-rank jutsu", [{ level: 1, dynamicCountAbility: "intelligence", minimum: 0 }], [], "Choose from E-rank jutsu already added to this character; the number equals the current Intelligence modifier."), optionsSource: { type: "known-jutsu", rank: "E-Rank" } },
      group("science-infused-genius", "Infused Genius", "Infused Scientific Ninja Tool", [{ level: 11, count: 1 }], generatedChoices("scienceTools"), "Choose the Scientific Ninja Tool currently installed by Infused Genius."),
      group("science-mixed-studies", "Mixed Studies", "Second Scientific Inquiry", [{ level: 18, count: 1 }], subclassesFor("Science-Nin"), "Choose a second Inquiry; it must differ from your primary subclass."),
    ],
    "Jujutsu-Sorcerer": [
      group("jujutsu-cursed-techniques", "Cursed Technique", "Cursed Technique", [{ level: 1, count: 2 }, { level: 3, count: 1 }, { level: 6, count: 1 }, { level: 14, count: 1 }, { level: 18, count: 1 }], generatedChoices("jujutsuTechniques"), "Choose techniques as the class table increases your total known."),
      group("jujutsu-binding-vows", "Binding Vow", "Binding Vow", [{ level: 1, count: 4, slotBudget: 4 }], vows, "You have four vow slots at level 1. Minor vows cost one slot and Major vows cost two; unused selectors may be left blank."),
      group("jujutsu-additional-vows", "Binding Vow", "Additional minor Binding Vow", [7, 11, 15].map((level) => ({ level, count: 1 })), minorVows, "Gain one additional vow slot at levels 7, 11, and 15. Major vows require two slots and therefore are handled in the initial slot pool."),
      group("jujutsu-zone-stance", "The Zone", "Zone stance", [{ level: 2, count: 1 }], STANCES, "Choose the Taijutsu or weapon stance granted by The Zone."),
      group("jujutsu-physique", "Cursed Physique", "Cursed Energy trait", [{ level: 9, count: 1 }], choices(["Standard", "Sturdy", "Nonstandard", "Rough"]), "Choose the permanent trait of your Cursed Energy."),
    ],
    "Lunar-Slayer": [
      group("lunar-trick-weapon", "Trick Weaponry", "Trick Weapon form", [{ level: 1, count: 2 }], weapons, "Choose the base and transformed weapon forms."),
      group("lunar-stance", "Slayer's Stance", "Weapon stance", [{ level: 2, count: 1 }], weaponStances, "Choose the weapon stance used in the hunt."),
      group("lunar-runes", "Caryll Runes", "Caryll Rune", [2, 4, 8, 12, 16].map((level) => ({ level, count: 1 })), generatedChoices("lunarRunes"), "Choose runes as the class table increases your known total. Runes may be exchanged on a long rest."),
      group("lunar-weapon-tricks", "Trick Weaponry", "Trick Weapon Trick", [1, 7, 12, 17].map((level) => ({ level, count: 1 })), generatedChoices("lunarWeaponTricks"), "Choose weapon tricks as the class table increases your total."),
      group("lunar-rifle-tricks", "Slayer's Rifle", "Slayer's Rifle Trick", [7, 14].map((level) => ({ level, count: 1 })), generatedChoices("lunarRifleTricks"), "Choose one rifle trick at level 7 and another at level 14."),
    ],
  };
}

const SUBCLASS_LEVELS = {
  "Genjutsu-Specialist": 2, "Hunter-Nin": 3, "Intelligence-Operative": 3, "Medical-Nin": 2,
  "Ninjutsu-Specialist": 2, "Scout-Nin": 3, "Taijutsu-Specialist": 3, "Weapon-Specialist": 3,
  "Puppet-Master": 2, "Cooking-Nin": 2, "Science-Nin": 3, "Jujutsu-Sorcerer": 3, "Lunar-Slayer": 3,
};

export function applyProgressionCatalog(rules) {
  const catalogs = classCatalog(rules);
  for (const cls of rules.classes || []) {
    cls.subclassLevel = SUBCLASS_LEVELS[cls.name] || cls.subclassLevel;
    cls.progressionChoices = structuredClone(catalogs[cls.name] || []);
    cls.featuresByLevel ||= {};
    for (const [level, feature] of Object.entries(GENERATED_CLASS_FEATURES[cls.name] || {})) {
      cls.featuresByLevel[level] ||= [];
      if (!cls.featuresByLevel[level].some((entry) => entry.name === feature.name)) cls.featuresByLevel[level].push(structuredClone(feature));
    }
  }
  const hunter = rules.classes?.find((entry) => entry.name === "Hunter-Nin");
  if (!hunter) return rules;
  const skillChoice = hunter.skillGrants?.find((entry) => entry.id === "class-hunter-choice");
  if (skillChoice) { skillChoice.count = 4; skillChoice.label = "Choose four other skills"; skillChoice.options = skillChoice.options.filter((skill) => skill !== "stealth"); }
  hunter.combatProficiencies = { armor: ["Light Armor"], weapons: ["Simple Weapons", "Battle Wire", "Broadsword", "Chakram", "Fuma-Shuriken", "Iron Claw", "Jitte", "Katana", "Knuckle Blades", "Longbow", "Odachi", "Scythe"], ninjaTools: ["Disguise Kit", "Forensics Kit", "Forgery Kit"], savingThrows: ["Dexterity", "Intelligence", "Wisdom"] };
  hunter.progressionChoices = structuredClone(HUNTER_PROGRESSION);
  hunter.featuresByLevel ||= {};
  for (const [level, features] of Object.entries(HUNTER_FEATURE_PATCHES)) {
    hunter.featuresByLevel[level] ||= [];
    for (const feature of features) if (!hunter.featuresByLevel[level].some((entry) => entry.name === feature.name)) hunter.featuresByLevel[level].push(feature);
  }
  return rules;
}
