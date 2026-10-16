import { ABILITIES, CLASS_ASI_LEVELS, PUPPET_UPGRADE_TIERS, SUMMON_RANK_ORDER, abilityBreakdown, abilityModifier, emptyCharacter, levelTimeline, proficiencyBonus, puppetAbilityPointPool, puppetAllowedCount, puppetBaseAbilities, puppetDerivedStats, puppetUpgradeCapacity, sanitizeCharacter, startingWeaponRequirements, summonDerivedStats, syncAbilityScores, validateCharacter } from "./model.mjs";

const STORAGE_KEY = "shinobi-forge-character-v1";
const state = { rules: null, character: emptyCharacter(), activeStep: "identity" };
const summonFilters = new Map();
const puppetFilters = new Map();
const jutsuFilters = { disciplines: [], elements: [], hijutsu: false, clan: "", clanTouched: false };
const JUTSU_DISCIPLINES = ["Ninjutsu", "Bukijutsu", "Genjutsu", "Taijutsu"];
const JUTSU_ELEMENTS = ["Fire", "Wind", "Lightning", "Earth", "Water"];
const PUPPET_UPGRADE_SUGGESTIONS = ["Armory: Explosive Launcher", "Armory: Hook Shot", "Bulky Build", "Chakra Resonance", "Charismatic Presence", "Countermeasures", "Decoy Mode", "Destructive Habits", "Entrapment Mechanism", "Eye Lights", "Ghillie Coating", "Go-Pro", "Honed Edge", "Jutsu Channeler", "Observant Gaze", "Quickfooted", "Transforming Apparatus", "Warfare Augmentation", "Armory: Fire and Water Blaster", "Armory: Needle Wave", "Chakra Draining Mechanism", "Chakra Regulators", "Chakra Sealing Trap", "Elemental Integration", "Enhanced Durability", "Integrated Sight Mechanism", "Jutsu Specialization", "Long Distance Relationship", "Tag-Team", "Armory: Deafening Speaker", "Armory: Overdrive", "Chakra Cannon", "Deployable Shield", "Expanded Puppetry", "Exploding Puppet Mechanism", "Force of Will", "Hovering Mechanism", "Accumulated Strength", "Armory: Beheader's Blade", "Armory: Mirage Disc"];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
function keywordList(value = "") { return value.split(/[,;/]/).map((item) => item.trim()).filter(Boolean); }
function featureNeedsChoice(feature) { return /\b(choose|select|pick)\b/i.test(feature?.description || ""); }
function hasKeyword(entry, keyword) { return keywordList(entry.keywords).some((item) => item.toLowerCase() === keyword.toLowerCase()); }
function isHijutsu(entry) { return hasKeyword(entry, "Hijutsu"); }
function matchesDiscipline(entry, discipline) { return entry.classification === discipline || hasKeyword(entry, discipline) || (discipline === "Ninjutsu" && entry.classification === "Non-Elemental Ninjutsu"); }
function matchesElement(entry, element) { return keywordList(entry.keywords).some((item) => item.toLowerCase() === element.toLowerCase() || item.toLowerCase() === `${element.toLowerCase()} release`); }
function toggleFilter(collection, value) { const index = collection.indexOf(value); if (index >= 0) collection.splice(index, 1); else collection.push(value); }

async function loadRules() {
  const response = await fetch("data/rules.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the extracted rules catalogue.");
  state.rules = await response.json();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { state.character = sanitizeCharacter(JSON.parse(saved)); } catch { localStorage.removeItem(STORAGE_KEY); }
  }
  initializeControls();
  renderAll();
  $("#save-status").textContent = saved ? "Restored browser draft" : "Draft autosaves locally";
}

function initializeControls() {
  $("#class-select").innerHTML = optionMarkup(state.rules.classes, "Choose class");
  $("#clan-select").innerHTML = optionMarkup(state.rules.clans, "Choose clan");
  $("#background-select").innerHTML = optionMarkup(state.rules.backgrounds, "Choose background");
  const ranks = [...new Set(state.rules.jutsu.map((entry) => entry.rank).filter(Boolean))].sort();
  $("#jutsu-rank").innerHTML += ranks.map((rank) => `<option>${escapeHtml(rank)}</option>`).join("");
  const hijutsuClans = [...new Set(state.rules.jutsu.filter(isHijutsu).map((entry) => entry.classification).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $("#jutsu-hijutsu-clan").innerHTML = `<option value="">All Hijutsu traditions</option>${hijutsuClans.map((clan) => `<option>${escapeHtml(clan)}</option>`).join("")}`;
  $("#clan-primary").innerHTML = abilityOptions();
  $("#clan-secondary").innerHTML = abilityOptions();
  $("#background-ability").innerHTML = abilityOptions();
  $("#summon-tribe").innerHTML = optionMarkup(state.rules.summons.tribes, "Choose summon tribe");
  const puppetTechniques = state.rules.subclasses.filter((entry) => entry.className === "Puppet-Master");
  $("#puppet-technique").innerHTML = `<option value="">Choose puppet technique</option>${puppetTechniques.map((entry) => `<option>${escapeHtml(entry.name.replaceAll("-", " ").replace(" ~ ", " - "))}</option>`).join("")}<option>Custom / archetype</option>`;
  $("#puppet-upgrade-options").innerHTML = PUPPET_UPGRADE_SUGGESTIONS.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  $("#ability-grid").innerHTML = ABILITIES.map((ability) => `<div class="ability-card"><label for="ability-${ability}">${abilityLabel(ability)} starting score</label><div class="ability-row"><input id="ability-${ability}" type="number" min="1" max="30" data-ability="${ability}"><div><span class="final-score" data-final-score="${ability}">10</span><span class="modifier" data-modifier="${ability}">+0</span></div></div><div class="score-ledger" data-score-ledger="${ability}"></div><label class="manual-bonus">Other / feat adjustment<input type="number" min="-10" max="10" value="0" data-manual-ability="${ability}"></label></div>`).join("");
  bindEvents();
}

function bindEvents() {
  $$('[data-field]').forEach((control) => control.addEventListener("input", () => {
    const field = control.dataset.field;
    state.character[field] = field === "level" ? Math.min(20, Math.max(1, Number(control.value) || 1)) : control.value;
    if (field === "classId") state.character.subclassId = "";
    saveAndRender();
  }));
  $$('[data-ability]').forEach((control) => control.addEventListener("input", () => {
    state.character.baseAbilities[control.dataset.ability] = Math.min(30, Math.max(1, Number(control.value) || 10));
    saveAndRender();
  }));
  $$('[data-bonus-field]').forEach((control) => control.addEventListener("change", () => {
    state.character.abilityIncreases[control.dataset.bonusField] = control.value;
    saveAndRender();
  }));
  $$('[data-manual-ability]').forEach((control) => control.addEventListener("input", () => {
    state.character.abilityIncreases.manual[control.dataset.manualAbility] = Math.min(10, Math.max(-10, Number(control.value) || 0));
    saveAndRender();
  }));
  $$('.nav-step').forEach((button) => button.addEventListener("click", () => showStep(button.dataset.step)));
  $("#jutsu-search").addEventListener("input", renderJutsuLibrary);
  $("#jutsu-rank").addEventListener("change", renderJutsuLibrary);
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
  $("#add-summon").addEventListener("click", addSummon);
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

function saveAndRender() {
  syncAbilityScores(state.character);
  state.character.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.character));
  renderAll();
  $("#save-status").textContent = `Saved locally ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function showStep(step) {
  state.activeStep = step;
  $$('.nav-step').forEach((button) => button.classList.toggle("active", button.dataset.step === step));
  $$('.step-panel').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === step));
  const titles = { identity:["Shape your shinobi","Start with the person behind the techniques."], build:["Choose the path","Clan, class, subclass, and background establish the build."], abilities:["Set the foundations","Record the six scores and see their modifiers."], jutsu:["Build the arsenal","Search the complete sheet catalogue and track when each jutsu was learned."], equipment:["Pack for the mission","Resolve starting choices and maintain a usable inventory."], summons:["Call trusted allies","Build a roster of creatures bound to your shinobi."], puppets:["Engineer the arsenal","Craft Puppet Tools with their own chassis, upgrades, seals, weapons, and techniques."], timeline:["See every level","Class, clan, subclass, jutsu, and personal choices in one history."], review:["Ready to share","Validate the build and export a portable character file."] };
  $("#page-title").textContent = titles[step][0];
  $("#page-subtitle").textContent = titles[step][1];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  if (!state.rules) return;
  $$('[data-field]').forEach((control) => { control.value = state.character[control.dataset.field] ?? ""; });
  $$('[data-ability]').forEach((control) => { control.value = state.character.baseAbilities[control.dataset.ability]; });
  $$('[data-bonus-field]').forEach((control) => { control.value = state.character.abilityIncreases[control.dataset.bonusField] ?? ""; });
  $$('[data-manual-ability]').forEach((control) => { control.value = state.character.abilityIncreases.manual[control.dataset.manualAbility] || 0; });
  const cls = find(state.rules.classes, state.character.classId);
  const clan = find(state.rules.clans, state.character.clanId);
  if (!jutsuFilters.clanTouched && clan?.name && [...$("#jutsu-hijutsu-clan").options].some((option) => option.value === clan.name)) jutsuFilters.clan = clan.name;
  $("#sidebar-name").textContent = state.character.name || "Unnamed shinobi";
  $("#badge-initial").textContent = (state.character.name.trim()[0] || "?").toUpperCase();
  $("#sidebar-build").textContent = [clan?.name, cls?.name].filter(Boolean).join(" · ") || "Choose a clan and class";
  $("#sidebar-level").textContent = state.character.level;
  $("#level-value").textContent = state.character.level;
  $("#proficiency-value").textContent = signed(proficiencyBonus(state.character.level));
  $("#jutsu-count").textContent = state.character.jutsu.length;
  $("#source-pill").textContent = `Sheet ${state.rules.source.sheetVersion || "export"} · ${state.rules.jutsu.length.toLocaleString()} jutsu`;
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
  renderJutsuLibrary();
  renderSelectedJutsu();
  renderEquipment();
  renderEquipmentCatalogue();
  renderSummons();
  renderPuppets();
  renderTimeline();
  renderReview();
}

function renderEquipment() {
  const cls = find(state.rules.classes, state.character.classId);
  const groups = cls?.startingEquipment || [];
  $("#ryo-balance").value = state.character.equipment.ryo;
  $("#starting-equipment").innerHTML = groups.length ? groups.map((group, index) => {
    const choice = state.character.equipment.startingChoices[group.id] || "";
    const requirements = startingWeaponRequirements(choice);
    const details = state.character.equipment.startingDetails[group.id] || [];
    const nested = requirements.map((category, detailIndex) => {
      const weapons = state.rules.equipment.weapons.filter((weapon) => weapon.category === category && !/\(Two Hands\)$/i.test(weapon.name));
      return `<label class="nested-choice"><span>${category} weapon ${requirements.filter((item) => item === category).length > 1 ? detailIndex + 1 : ""}</span><select data-starting-detail="${group.id}:${detailIndex}"><option value="">Choose ${category.toLowerCase()} weapon</option>${weapons.map((weapon) => `<option value="${weapon.id}">${escapeHtml(weapon.name)}</option>`).join("")}</select></label>`;
    }).join("");
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
  const selectedStarting = groups.map((group) => {
    const choice = state.character.equipment.startingChoices[group.id];
    if (!choice) return null;
    const requirements = startingWeaponRequirements(choice);
    const resolved = (state.character.equipment.startingDetails[group.id] || []).map((id) => find(state.rules.equipment.weapons, id)?.name).filter(Boolean);
    return { name: requirements.length && resolved.length ? resolved.join(" + ") : choice, quantity: requirements.length || (Number(choice.match(/^\d+/)?.[0]) || 1) };
  }).filter(Boolean);
  const startingMarkup = selectedStarting.map((item) => `<div class="inventory-row starting"><div><strong>${escapeHtml(item.name)}</strong><small>Starting equipment</small></div><span>${item.quantity}</span><span class="source-tag">Class</span></div>`).join("");
  const itemMarkup = state.character.equipment.items.map((item, index) => `<div class="inventory-row"><input value="${escapeHtml(item.name)}" aria-label="Equipment name" data-equipment-name="${index}"><input type="number" min="1" value="${item.quantity || 1}" aria-label="Quantity" data-equipment-quantity="${index}"><input value="${escapeHtml(item.notes || "")}" placeholder="Notes" aria-label="Equipment notes" data-equipment-notes="${index}"><button class="icon-button" data-remove-equipment="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join("");
  $("#inventory").innerHTML = startingMarkup + itemMarkup || "<p class=\"muted-copy\">No equipment selected yet.</p>";
  $$('[data-equipment-name]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentName)].name = field.value; saveAndRender(); }));
  $$('[data-equipment-quantity]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentQuantity)].quantity = Math.max(1, Number(field.value) || 1); saveAndRender(); }));
  $$('[data-equipment-notes]').forEach((field) => field.addEventListener("change", () => { state.character.equipment.items[Number(field.dataset.equipmentNotes)].notes = field.value; saveAndRender(); }));
  $$('[data-remove-equipment]').forEach((button) => button.addEventListener("click", () => { state.character.equipment.items.splice(Number(button.dataset.removeEquipment), 1); saveAndRender(); }));
}

function renderEquipmentCatalogue() {
  const query = $("#equipment-search").value.trim().toLowerCase();
  const type = $("#equipment-type").value;
  const category = $("#weapon-category").value;
  const entries = [
    ...state.rules.equipment.weapons.map((item) => ({ ...item, catalogueType: "weapon" })),
    ...state.rules.equipment.armor.map((item) => ({ ...item, catalogueType: "armor" })),
  ].filter((item) => (!type || item.catalogueType === type) && (!category || item.category === category) && (!query || `${item.name} ${item.category || ""} ${item.type || ""} ${item.properties || ""} ${item.damageType || ""}`.toLowerCase().includes(query))).slice(0, 80);
  $("#equipment-catalogue").innerHTML = entries.map((item) => `<article class="equipment-card"><div><strong>${escapeHtml(item.name)}</strong><small>${item.catalogueType === "weapon" ? `${escapeHtml(item.category || "Unclassified")} · ${escapeHtml(item.damage)} ${escapeHtml(item.damageType)}` : `${escapeHtml(item.type)} · armor +${item.armorBonus}`}</small><p>${escapeHtml(item.properties || (item.bulk !== undefined ? `Bulk ${item.bulk}` : ""))}</p>${item.price != null ? `<b class="price">${item.price} Ryo</b>` : '<b class="price unavailable">Price not listed</b>'}</div><button class="button ghost" data-add-equipment="${item.catalogueType}:${item.id}">${item.price != null ? "Buy" : "Add"}</button></article>`).join("") || "<p class=\"muted-copy\">No equipment matches that search.</p>";
  $$('[data-add-equipment]').forEach((button) => button.addEventListener("click", () => {
    const [catalogueType, id] = button.dataset.addEquipment.split(":");
    const source = state.rules.equipment[catalogueType === "weapon" ? "weapons" : "armor"];
    const item = find(source, id);
    if (item.price != null && state.character.equipment.ryo < item.price) { showNotice(`You need ${item.price - state.character.equipment.ryo} more Ryo to buy ${item.name}.`, true); return; }
    if (item.price != null) state.character.equipment.ryo -= item.price;
    const existing = state.character.equipment.items.find((entry) => entry.catalogueId === id);
    if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
    else state.character.equipment.items.push({ id: crypto.randomUUID(), catalogueId: id, name: item.name, type: catalogueType, quantity: 1, notes: "", source: "catalogue", pricePaid: item.price });
    saveAndRender();
  }));
}

function addSummon() {
  const name = $("#summon-name").value.trim();
  const tribeId = $("#summon-tribe").value;
  if (!name || !tribeId) { showNotice("Give the summon a name and choose its tribe.", true); return; }
  const tribe = find(state.rules.summons.tribes, tribeId);
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
      <details class="summon-jutsu"><summary>Jutsu (${summon.jutsu?.length || 0})</summary><div class="summon-jutsu-selected">${selectedJutsu}</div><div class="summon-jutsu-toolbar"><input type="search" data-summon-jutsu-search="${index}" placeholder="Search this summon’s jutsu…"><select data-summon-jutsu-rank="${index}"><option value="">All ranks</option>${SUMMON_RANK_ORDER.map((rank) => `<option>${rank}</option>`).join("")}</select></div><div class="summon-filter-board"><div class="filter-group"><span>Discipline</span><div class="filter-chips">${JUTSU_DISCIPLINES.map((discipline) => `<button type="button" data-summon-discipline="${index}:${discipline}">${discipline}</button>`).join("")}</div></div><div class="filter-group"><span>Nature release</span><div class="filter-chips elemental">${JUTSU_ELEMENTS.map((element) => `<button type="button" data-summon-element="${index}:${element}">${element}</button>`).join("")}</div></div><div class="summon-hijutsu-lock"><button type="button" class="filter-toggle" disabled>Hijutsu unavailable</button><small>Summons cannot learn Hijutsu; those techniques are always excluded.</small></div></div><div class="summon-jutsu-results" data-summon-jutsu-results="${index}"></div></details>
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

function renderSummonJutsuResults(index) {
  const summon = state.character.summons[index];
  const container = $(`[data-summon-jutsu-results="${index}"]`);
  if (!summon || !container) return;
  const filter = summonFilters.get(summon.id) || {};
  const selected = new Set((summon.jutsu || []).map((entry) => entry.id));
  $$(`[data-summon-discipline^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.disciplines || []).includes(button.dataset.summonDiscipline.split(":")[1])));
  $$(`[data-summon-element^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.elements || []).includes(button.dataset.summonElement.split(":")[1])));
  const results = state.rules.jutsu.filter((entry) => !isHijutsu(entry) && (!filter.rank || entry.rank === filter.rank) && (!(filter.disciplines || []).length || filter.disciplines.some((discipline) => matchesDiscipline(entry, discipline))) && (!(filter.elements || []).length || filter.elements.some((element) => matchesElement(entry, element))) && (!filter.query || `${entry.name} ${entry.classification} ${entry.keywords}`.toLowerCase().includes(filter.query.toLowerCase()))).slice(0, 12);
  container.innerHTML = results.map((entry) => `<div class="summon-jutsu-result"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.rank)} · ${escapeHtml(entry.classification)}</small><div class="keyword-tags compact-tags">${keywordList(entry.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div></div><button class="button ghost" data-add-summon-jutsu="${index}:${entry.id}"${selected.has(entry.id) ? " disabled" : ""}>${selected.has(entry.id) ? "Added" : "Add"}</button></div>`).join("") || '<p class="muted-copy">No jutsu match those filters.</p>';
  $$('[data-add-summon-jutsu]', container).forEach((button) => button.addEventListener("click", () => { const [summonIndex, jutsuId] = button.dataset.addSummonJutsu.split(":"); const rule = find(state.rules.jutsu, jutsuId); state.character.summons[Number(summonIndex)].jutsu.push({ id: rule.id, name: rule.name, rank: rule.rank }); saveAndRender(); }));
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
      <details class="summon-jutsu"><summary>Jutsu (${puppet.jutsu?.length || 0})</summary><div class="summon-jutsu-selected">${selectedJutsu}</div>${canCast ? `<label class="check-label puppet-hijutsu-access"><input type="checkbox" data-puppet-hijutsu-access="${index}"${puppet.hijutsuAccess ? " checked" : ""}> Bloodline feature permits Hijutsu</label><div class="summon-jutsu-toolbar"><input type="search" data-puppet-jutsu-search="${index}" placeholder="Search this puppet’s jutsu…"><select data-puppet-jutsu-rank="${index}"><option value="">All ranks</option>${SUMMON_RANK_ORDER.map((rank) => `<option>${rank}</option>`).join("")}</select></div><div class="summon-filter-board"><div class="filter-group"><span>Discipline</span><div class="filter-chips">${JUTSU_DISCIPLINES.map((discipline) => `<button type="button" data-puppet-discipline="${index}:${discipline}">${discipline}</button>`).join("")}</div></div><div class="filter-group"><span>Nature release</span><div class="filter-chips elemental">${JUTSU_ELEMENTS.map((element) => `<button type="button" data-puppet-element="${index}:${element}">${element}</button>`).join("")}</div></div></div><div class="summon-jutsu-results" data-puppet-jutsu-results="${index}"></div>` : '<p class="muted-copy puppet-jutsu-lock">Install an upgrade named “Jutsu Specialization” to unlock this catalogue.</p>'}</details>
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

function renderPuppetJutsuResults(index) {
  const puppet = state.character.puppets[index];
  const container = $(`[data-puppet-jutsu-results="${index}"]`);
  if (!puppet || !container) return;
  const filter = puppetFilters.get(puppet.id) || {};
  const selected = new Set((puppet.jutsu || []).map((entry) => entry.id));
  $$(`[data-puppet-discipline^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.disciplines || []).includes(button.dataset.puppetDiscipline.split(":")[1])));
  $$(`[data-puppet-element^="${index}:"]`).forEach((button) => button.classList.toggle("active", (filter.elements || []).includes(button.dataset.puppetElement.split(":")[1])));
  const query = (filter.query || "").toLowerCase();
  const results = state.rules.jutsu.filter((entry) => (!query || `${entry.name} ${entry.description}`.toLowerCase().includes(query)) && (!filter.rank || entry.rank === filter.rank) && (!(filter.disciplines || []).length || filter.disciplines.some((discipline) => matchesDiscipline(entry, discipline))) && (!(filter.elements || []).length || filter.elements.some((element) => matchesElement(entry, element))) && (puppet.hijutsuAccess || !isHijutsu(entry))).slice(0, 40);
  container.innerHTML = results.map((entry) => `<div class="summon-jutsu-result"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.rank)} · ${escapeHtml(entry.classification)}</small><div class="keyword-tags compact-tags">${keywordList(entry.keywords).map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}</div></div><button class="button ghost" data-add-puppet-jutsu="${index}:${entry.id}"${selected.has(entry.id) ? " disabled" : ""}>${selected.has(entry.id) ? "Added" : "Add"}</button></div>`).join("") || '<p class="muted-copy">No jutsu match those filters.</p>';
  $$('[data-add-puppet-jutsu]', container).forEach((button) => button.addEventListener("click", () => { const [puppetIndex, jutsuId] = button.dataset.addPuppetJutsu.split(":"); const rule = find(state.rules.jutsu, jutsuId); state.character.puppets[Number(puppetIndex)].jutsu.push({ id: rule.id, name: rule.name, rank: rule.rank }); saveAndRender(); }));
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
  if (!cls && !clan && !background) { $("#build-summary").innerHTML = "Your chosen build details will appear here."; return; }
  $("#build-summary").innerHTML = `<strong>${escapeHtml([clan?.name, cls?.name].filter(Boolean).join(" ") || "Build in progress")}</strong><br>${cls ? `Hit die d${escapeHtml(cls.hitDie || "?")} · Chakra die d${escapeHtml(cls.chakraDie || "?")}` : ""}${background?.feature ? `<br>Background feature: ${escapeHtml(background.feature.name)}` : ""}`;
}

function renderJutsuLibrary() {
  const query = $("#jutsu-search").value.trim().toLowerCase();
  const rank = $("#jutsu-rank").value;
  $$('[data-jutsu-discipline]').forEach((button) => button.classList.toggle("active", jutsuFilters.disciplines.includes(button.dataset.jutsuDiscipline)));
  $$('[data-jutsu-element]').forEach((button) => button.classList.toggle("active", jutsuFilters.elements.includes(button.dataset.jutsuElement)));
  $("#jutsu-hijutsu").classList.toggle("active", jutsuFilters.hijutsu);
  $("#jutsu-hijutsu-clan").disabled = !jutsuFilters.hijutsu;
  $("#jutsu-hijutsu-clan").value = jutsuFilters.clan;
  const selected = new Set(state.character.jutsu.map((entry) => entry.id));
  const results = state.rules.jutsu.filter((entry) => {
    const hijutsuMatch = jutsuFilters.hijutsu ? isHijutsu(entry) && (!jutsuFilters.clan || entry.classification === jutsuFilters.clan) : !isHijutsu(entry);
    const disciplineMatch = !jutsuFilters.disciplines.length || jutsuFilters.disciplines.some((discipline) => matchesDiscipline(entry, discipline));
    const elementMatch = !jutsuFilters.elements.length || jutsuFilters.elements.some((element) => matchesElement(entry, element));
    return hijutsuMatch && disciplineMatch && elementMatch && (!rank || entry.rank === rank) && (!query || `${entry.name} ${entry.classification} ${entry.keywords} ${entry.description}`.toLowerCase().includes(query));
  }).slice(0, 80);
  $("#jutsu-results").innerHTML = results.map((entry) => `<article class="jutsu-card"><header><h4>${escapeHtml(entry.name)}</h4><span class="jutsu-meta">${escapeHtml(entry.rank)} · ${escapeHtml(entry.cost)}</span></header><div class="keyword-tags"><span class="keyword classification">${escapeHtml(entry.classification)}</span>${keywordList(entry.keywords).map((item) => `<span class="keyword">${escapeHtml(item)}</span>`).join("")}</div><div class="jutsu-facts"><span>${escapeHtml(entry.castingTime)}</span><span>${escapeHtml(entry.range)}</span><span>${escapeHtml(entry.components)}</span></div><p>${escapeHtml(entry.description.slice(0, 320))}${entry.description.length > 320 ? "…" : ""}</p><button class="button ${selected.has(entry.id) ? "ghost" : "primary"}" data-add-jutsu="${entry.id}" ${selected.has(entry.id) ? "disabled" : ""}>${selected.has(entry.id) ? "Selected" : "Add jutsu"}</button></article>`).join("") || "<p>No jutsu match those filters.</p>";
  $$('[data-add-jutsu]').forEach((button) => button.addEventListener("click", () => {
    const entry = find(state.rules.jutsu, button.dataset.addJutsu);
    state.character.jutsu.push({ id: entry.id, name: entry.name, rank: entry.rank, level: state.character.level });
    saveAndRender();
  }));
}

function renderSelectedJutsu() {
  $("#selected-jutsu").innerHTML = state.character.jutsu.map((entry, index) => { const rule = find(state.rules.jutsu, entry.id) || entry; return `<div class="selected-item"><div><span>${escapeHtml(entry.name)} <small>${escapeHtml(entry.rank)}</small></span><div class="keyword-tags compact-tags">${keywordList(rule.keywords).map((item) => `<span class="keyword">${escapeHtml(item)}</span>`).join("")}</div></div><input type="number" min="1" max="20" value="${entry.level}" aria-label="Level learned" data-jutsu-level="${index}"><button class="icon-button" data-remove-jutsu="${index}" aria-label="Remove ${escapeHtml(entry.name)}">×</button></div>`; }).join("") || "<p>No jutsu selected yet.</p>";
  $$('[data-jutsu-level]').forEach((input) => input.addEventListener("input", () => { state.character.jutsu[Number(input.dataset.jutsuLevel)].level = Math.min(20, Math.max(1, Number(input.value) || 1)); saveAndRender(); }));
  $$('[data-remove-jutsu]').forEach((button) => button.addEventListener("click", () => { state.character.jutsu.splice(Number(button.dataset.removeJutsu), 1); saveAndRender(); }));
}

function renderTimeline() {
  $("#timeline").innerHTML = levelTimeline(state.character, state.rules).map((entry) => {
    const allFeatures = [...entry.classFeatures, ...entry.subclassFeatures, ...entry.clanFeatures];
    const tags = [
      ...entry.classFeatures.map((feature) => `<span class="tag" title="${escapeHtml(feature.description)}">${escapeHtml(feature.name)}</span>`),
      ...entry.subclassFeatures.map((feature) => `<span class="tag">${escapeHtml(feature.name)}</span>`),
      ...entry.clanFeatures.map((feature) => `<span class="tag clan">${escapeHtml(feature.name)}</span>`),
      ...entry.jutsu.map((jutsu) => `<span class="tag jutsu">${escapeHtml(jutsu.name)}</span>`),
    ].join("");
    const decisions = allFeatures.filter(featureNeedsChoice).map((feature) => { const key = `${entry.level}:${feature.name}`; return `<label class="feature-choice"><span>${escapeHtml(feature.name)} decision</span><input data-feature-choice="${encodeURIComponent(key)}" value="${escapeHtml(state.character.featureChoices[key] || "")}" placeholder="Record the selected option…"></label>`; }).join("");
    return `<article class="level-row"><div class="level-number">Level<strong>${entry.level}</strong>PB ${signed(entry.proficiency)}</div><div class="level-content"><div class="feature-tags">${tags || '<span class="tag">No automatic features recorded</span>'}</div>${decisions ? `<div class="feature-decisions">${decisions}</div>` : ""}<textarea data-level-note="${entry.level}" placeholder="Record feat choices, ASIs, optional features, training, or other decisions…">${escapeHtml(entry.choices)}</textarea></div></article>`;
  }).join("");
  $$('[data-feature-choice]').forEach((field) => field.addEventListener("change", () => { state.character.featureChoices[decodeURIComponent(field.dataset.featureChoice)] = field.value; saveAndRender(); }));
  $$('[data-level-note]').forEach((field) => field.addEventListener("change", () => { state.character.levelChoices[field.dataset.levelNote] = field.value; saveAndRender(); }));
}

function renderReview() {
  const problems = validateCharacter(state.character, state.rules);
  $("#validation").className = `validation ${problems.length ? "problem" : "ok"}`;
  $("#validation").innerHTML = problems.length ? `<strong>${problems.length} item${problems.length === 1 ? "" : "s"} to review</strong><ul>${problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ul>` : "No structural problems found. The exported JSON is ready to share.";
  const cls = find(state.rules.classes, state.character.classId); const clan = find(state.rules.clans, state.character.clanId); const subclass = find(state.rules.subclasses, state.character.subclassId); const background = find(state.rules.backgrounds, state.character.backgroundId);
  $("#review-sheet").innerHTML = `<div class="review-title"><div><h4>${escapeHtml(state.character.name || "Unnamed shinobi")}</h4><p>${escapeHtml([clan?.name, cls?.name, subclass?.name].filter(Boolean).join(" · ") || "Build incomplete")}</p></div><strong>Level ${state.character.level}</strong></div><div class="review-grid">${ABILITIES.map((ability) => `<div class="review-stat"><span>${ability.slice(0,3)}</span><strong>${state.character.abilities[ability]} (${signed(abilityModifier(state.character.abilities[ability]))})</strong></div>`).join("")}<div class="review-stat"><span>Background</span><strong>${escapeHtml(background?.name || "—")}</strong></div><div class="review-stat"><span>Jutsu</span><strong>${state.character.jutsu.length}</strong></div><div class="review-stat"><span>Equipment</span><strong>${state.character.equipment.items.length + Object.values(state.character.equipment.startingChoices).filter(Boolean).length}</strong></div><div class="review-stat"><span>Summons</span><strong>${state.character.summons.length}</strong></div><div class="review-stat"><span>Puppets</span><strong>${state.character.puppets.length}</strong></div></div>`;
}

function exportCharacter() {
  const safeName = (state.character.name || "shinobi").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const blob = new Blob([JSON.stringify(state.character, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${safeName || "shinobi"}.naruto5e.json`; link.click(); URL.revokeObjectURL(link.href);
  showNotice("Character JSON exported.");
}

async function importCharacter(event) {
  const file = event.target.files[0]; if (!file) return;
  try { state.character = sanitizeCharacter(JSON.parse(await file.text())); saveAndRender(); showStep("review"); showNotice(`Loaded ${file.name}.`); }
  catch (error) { showNotice(error.message || "Could not import that file.", true); }
  event.target.value = "";
}

function showNotice(message, error = false) { const notice = $("#notice"); notice.textContent = message; notice.className = `notice${error ? " error" : ""}`; setTimeout(() => notice.classList.add("hidden"), 4500); }

loadRules().catch((error) => { showNotice(error.message, true); $("#save-status").textContent = "Rules failed to load"; });
