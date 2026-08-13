import { detectRepairFaults, normalized, type DetectedFault } from "./repair-ai";
import type { IfixitGuideCandidate } from "./ifixit";

export type GuidePart = {
  name: string;
  reason: string;
  origin: "Recorded" | "Recommended" | "Consumable";
};

export type GuideStep = {
  title: string;
  instruction: string;
  checkpoint: string;
};

export type RepairGuideDraft = {
  recognizedModel: string;
  title: string;
  difficulty: "Basic" | "Intermediate" | "Advanced" | "Restricted";
  estimatedMinutes: number;
  riskLevel: "Standard" | "Elevated" | "High";
  overview: string;
  tools: string[];
  parts: GuidePart[];
  precautions: string[];
  steps: GuideStep[];
  sourceUrl: string;
  sourceLabel: string;
  sourceGuideId: number | null;
  sourceMatchLevel: "Exact" | "Strong" | "Possible" | "Unverified";
  sourceCheckedAt: string;
  generatedAt: string;
};

type GuideProfile = {
  tools: string[];
  consumables: string[];
  precautions: string[];
  steps: GuideStep[];
  minutes: number;
  difficulty: RepairGuideDraft["difficulty"];
  risk: RepairGuideDraft["riskLevel"];
};

type GuideInput = {
  device: string;
  category?: string;
  issue: string;
  diagnosis?: string;
  recognizedModel?: string;
  guideUrl?: string;
  laborHours?: number;
  faults?: DetectedFault[];
  recordedParts?: Array<{ name: string; sku?: string; quantity?: number }>;
  sourceGuide?: IfixitGuideCandidate | null;
};

const profiles: Record<string, GuideProfile> = {
  battery: {
    tools: ["Battery-safe opening tools", "Plastic cards or battery-isolation pick", "Non-metallic tweezers"],
    consumables: ["Model-specific battery adhesive strips", "Replacement perimeter seal, if the device uses one"],
    precautions: [
      "If possible, discharge the battery below 25% before opening the device.",
      "Do not bend, puncture, crush, heat or reuse a swollen or mechanically damaged cell.",
      "Keep a non-flammable work surface and an approved damaged-battery isolation container available.",
    ],
    steps: [
      { title:"Inspect the battery condition", instruction:"Check for swelling, heat, odour, leakage or enclosure distortion before applying force. Move a damaged cell to the shop's battery incident procedure.", checkpoint:"No uncontrolled battery hazard is present." },
      { title:"Release and remove the battery", instruction:"Follow the exact model reference for adhesive direction and access. Use only plastic tools around the cell and stop if it deforms or heats.", checkpoint:"The old battery is isolated with no puncture or connector damage." },
      { title:"Fit the replacement battery", instruction:"Compare the connector, dimensions, ratings and part number, install fresh adhesive, then connect only when the pack sits flat and clear of cables.", checkpoint:"Battery is secure, flat and correctly matched to the device." },
    ],
    minutes:55,
    difficulty:"Intermediate",
    risk:"Elevated",
  },
  screen: {
    tools: ["Suction handle", "Thin plastic opening picks", "Eye protection for shattered glass"],
    consumables: ["Model-specific display adhesive or seal", "Low-lint cleaning wipes"],
    precautions: ["Cover shattered glass with clear tape and wear eye protection before opening.", "Keep picks shallow and follow the model reference so display, biometric and sensor cables are not cut."],
    steps: [
      { title:"Remove the damaged display assembly", instruction:"Stabilize broken glass, soften only the specified adhesive, and follow the model reference for opening direction, cable locations and screw map.", checkpoint:"Display is free and all nearby flex cables and sensors remain intact." },
      { title:"Prepare and test the replacement display", instruction:"Compare part revision and connector layout. Transfer only the components required by the model reference, connect temporarily and test image, touch, brightness and sensors.", checkpoint:"Replacement passes a full pre-seal display and touch test." },
    ],
    minutes:70,
    difficulty:"Intermediate",
    risk:"Elevated",
  },
  "charge-port": {
    tools: ["Magnification and inspection light", "ESD-safe port-cleaning tools", "USB power meter or approved charging analyser"],
    consumables: ["Model-specific charging-port seal or flex adhesive"],
    precautions: ["Never probe or solder a powered board.", "Confirm whether the port is modular or board-soldered before ordering parts or applying heat."],
    steps: [
      { title:"Confirm the charging-path fault", instruction:"Inspect for compacted debris, bent contacts, corrosion and connector movement. Test with a known-good cable, supply and charging analyser before replacing parts.", checkpoint:"The fault is isolated to the port, port flex or board-level charging path." },
      { title:"Service the charging port", instruction:"For a modular part, follow the model reference to replace the port or flex. For a soldered port, use the shop's qualified microsoldering workflow and official board documentation.", checkpoint:"Port is mechanically stable, aligned and free of bridges or damaged pads." },
    ],
    minutes:90,
    difficulty:"Advanced",
    risk:"Elevated",
  },
  "back-glass": {
    tools: ["Eye protection", "Glass-safe scraper and plastic picks", "Dust extraction suitable for glass debris"],
    consumables: ["Model-specific rear adhesive or housing seal"],
    precautions: ["Contain sharp glass fragments and protect cameras, battery and wireless-charging components from heat and debris."],
    steps: [
      { title:"Remove damaged rear glass or housing", instruction:"Protect exposed modules, contain fragments, and follow the model reference for safe heat limits and component clearances. Replace the full housing when that is the safer approved method.", checkpoint:"Frame is undamaged, flat and free of loose glass or adhesive." },
      { title:"Fit the rear part", instruction:"Dry-fit first, confirm camera and button alignment, clean the bonding surface and apply the specified seal without blocking microphones or vents.", checkpoint:"Housing sits flush and all openings remain clear." },
    ],
    minutes:85,
    difficulty:"Advanced",
    risk:"Elevated",
  },
  camera: {
    tools: ["Clean-room swabs", "Dust blower rated for electronics", "Magnification and inspection light"],
    consumables: ["Camera lens seal or bracket adhesive, if specified"],
    precautions: ["Do not touch optical surfaces or use liquid cleaner inside a camera module.", "Keep dust away from exposed sensors and lenses."],
    steps: [
      { title:"Confirm the camera fault", instruction:"Test every lens and mode, inspect cover glass, and rule out software, contamination, loose connectors or impact damage before replacing the module.", checkpoint:"The affected camera or cover component is identified." },
      { title:"Replace and validate the camera assembly", instruction:"Transfer brackets or seals exactly as shown in the model reference, keep optics clean, reconnect and test focus, stabilization, flash and image quality before closure.", checkpoint:"All cameras focus consistently with no dust spots or warnings." },
    ],
    minutes:55,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  keyboard: {
    tools: ["Key and keyboard test utility", "ESD-safe brush", "Model-appropriate case-opening tools"],
    consumables: ["Keyboard or top-case fasteners/adhesive specified for the model"],
    precautions: ["A top-case repair may place the battery directly beneath the work area; isolate it before touching keyboard fasteners or cables."],
    steps: [
      { title:"Map the keyboard failure", instruction:"Test every key and modifier, inspect for liquid traces, and determine whether the service part is a keyboard, top case or individual approved key mechanism.", checkpoint:"Failed keys and the correct replacement assembly are documented." },
      { title:"Replace the keyboard or top case", instruction:"Follow the model reference for cable routing, fastener map and any battery or trackpad transfer. Do not reuse single-use fasteners or adhesive where prohibited.", checkpoint:"All keys, backlight, trackpad and power controls pass before closure." },
    ],
    minutes:125,
    difficulty:"Advanced",
    risk:"Elevated",
  },
  hinge: {
    tools: ["Plastic-safe clamps", "Torque-limited precision driver", "Magnification and inspection light"],
    consumables: ["Thread-locking product only when the manufacturer specifies it"],
    precautions: ["Do not force a seized hinge; hidden cable, housing or mounting-post damage can worsen quickly."],
    steps: [
      { title:"Assess the complete hinge path", instruction:"Inspect the hinge, mounts, headband or display housing and all cables that cross the moving joint. Replace cracked structural parts rather than fastening into broken plastic.", checkpoint:"Every damaged structural and cable component is identified." },
      { title:"Install and align the hinge assembly", instruction:"Route cables without pinch points, tighten in the model-specified sequence and cycle the joint slowly through its full travel before closure.", checkpoint:"Movement is smooth, aligned and does not pull on any cable." },
    ],
    minutes:65,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  speaker: {
    tools: ["Audio test source", "ESD-safe brush", "Non-metallic tweezers"],
    consumables: ["Speaker gasket or acoustic seal specified for the model"],
    precautions: ["Keep metal debris away from speaker magnets and preserve acoustic seals and vent meshes."],
    steps: [
      { title:"Isolate the audio fault", instruction:"Test channels, volume ranges and wired/wireless paths. Inspect meshes, contacts and seals before replacing the speaker assembly.", checkpoint:"The failed channel and component are confirmed." },
      { title:"Replace and test the speaker", instruction:"Install the correct acoustic seal, keep vents clear, reconnect and test speech, music and alert tones for distortion or vibration.", checkpoint:"Audio is clear across the expected volume range." },
    ],
    minutes:45,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  microphone: {
    tools: ["Known-good audio recorder or call test", "Magnification and inspection light", "ESD-safe cleaning tools"],
    consumables: ["Microphone mesh or acoustic seal specified for the model"],
    precautions: ["Do not insert tools into microphone capsules or block pressure vents with adhesive."],
    steps: [
      { title:"Identify the affected microphone path", instruction:"Test each recording/call mode, rule out blocked meshes and software routing, then inspect the relevant flex and connector.", checkpoint:"The failed microphone or flex path is identified." },
      { title:"Replace and verify the microphone part", instruction:"Align the acoustic port and seal exactly, reconnect the flex and compare recordings before final closure.", checkpoint:"Recordings are clear and consistent in all supported modes." },
    ],
    minutes:50,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  cooling: {
    tools: ["ESD-safe brush", "Electronics-safe dust extraction", "Temperature and fan-speed monitoring utility"],
    consumables: ["Manufacturer-compatible thermal interface material", "Replacement thermal pads in the specified thickness"],
    precautions: ["Do not spin a fan with compressed air while it is connected.", "Use the specified thermal-material type and pad thickness; excess material can reduce cooling performance."],
    steps: [
      { title:"Establish a thermal baseline", instruction:"Record idle/load temperatures, fan behaviour and airflow, then inspect vents, heat sink contact and fan bearings.", checkpoint:"The overheating source is isolated to airflow, fan, interface material or another subsystem." },
      { title:"Service the cooling system", instruction:"Clean while preventing fan rotation, replace the failed fan if required, and renew thermal materials only where the model reference specifies.", checkpoint:"Heat sink sits evenly and every fan spins freely." },
    ],
    minutes:70,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  joystick: {
    tools: ["Controller input test utility", "Precision driver set", "Soldering equipment only for board-mounted modules"],
    consumables: ["Stick cap or module consumables specified for the controller"],
    precautions: ["Disconnect batteries before soldering and protect nearby plastic parts from heat."],
    steps: [
      { title:"Measure the controller drift", instruction:"Record centre position and full-axis movement in a test utility, then inspect for mechanical damage or contamination.", checkpoint:"The affected axis and replaceable module are confirmed." },
      { title:"Replace and calibrate the joystick", instruction:"Use the modular or qualified soldering workflow appropriate to the controller, inspect every joint, then calibrate where supported.", checkpoint:"The stick centres reliably and reaches full range without jitter." },
    ],
    minutes:65,
    difficulty:"Advanced",
    risk:"Elevated",
  },
  storage: {
    tools: ["Drive-health and diagnostic utility", "Known-good boot or recovery media", "ESD-safe drive-handling tools"],
    consumables: ["Thermal pad or drive retainer specified for the model"],
    precautions: ["Obtain explicit approval before erasing, cloning or reinstalling customer data.", "Treat a failing drive as fragile; repeated power cycles may reduce recoverability."],
    steps: [
      { title:"Protect data and confirm the storage fault", instruction:"Record drive health and detection status. If readable, follow the approved backup or clone workflow before stress tests or replacement.", checkpoint:"Data-handling approval and recovery status are documented." },
      { title:"Install and configure the replacement drive", instruction:"Verify interface, keying, capacity and thermal requirements, install the drive, restore only approved data and apply firmware if required.", checkpoint:"Drive is detected, healthy, bootable and stable under a controlled test." },
    ],
    minutes:75,
    difficulty:"Intermediate",
    risk:"Elevated",
  },
  liquid: {
    tools: ["Magnification or microscope", "Electronics-safe cleaning tools", "ESD-safe board tray"],
    consumables: ["High-purity electronics cleaning solution", "Lint-free swabs and absorbent bench protection"],
    precautions: ["Do not power or charge a liquid-exposed device until it has been isolated, inspected and cleaned.", "Use ventilation, eye protection and chemical-resistant gloves required by the cleaning product.", "Liquid damage can continue underneath shields and connectors even when the device appears dry."],
    steps: [
      { title:"Map the liquid path", instruction:"With power isolated, document residue, corrosion indicators and affected connectors or modules before cleaning. Do not promise data or board recovery at intake.", checkpoint:"The exposure area and immediate risks are recorded." },
      { title:"Clean, dry and reassess", instruction:"Use the shop's approved electronics-cleaning process, inspect under magnification and replace only parts proven damaged. Power testing begins only after the assembly is fully dry and safe.", checkpoint:"No active residue, moisture or unsafe battery condition remains." },
    ],
    minutes:135,
    difficulty:"Advanced",
    risk:"High",
  },
  power: {
    tools: ["Current-limited bench supply or approved power analyser", "Digital multimeter", "Magnification or microscope"],
    consumables: ["Board-repair consumables approved by the workshop"],
    precautions: ["Do not inject voltage, bridge protection devices or replace board components without a schematic-led diagnosis.", "Board-level work requires ESD controls, fume extraction and a technician trained for the assembly."],
    steps: [
      { title:"Isolate the no-power path", instruction:"Rule out the external supply, cable, port and battery first. Use approved measurements and board documentation to identify the failed subsystem without bypassing protection circuits.", checkpoint:"The fault is localized and the proposed repair has measured evidence." },
      { title:"Complete the approved board or module repair", instruction:"Replace the confirmed modular part or use the shop's qualified board-repair workflow. Inspect connections and current draw before reconnecting all loads.", checkpoint:"Power behaviour is normal with no abnormal heat or current draw." },
    ],
    minutes:120,
    difficulty:"Advanced",
    risk:"High",
  },
  buttons: {
    tools: ["Input test utility", "Non-metallic tweezers", "Magnification and inspection light"],
    consumables: ["Button bracket adhesive or gasket specified for the model"],
    precautions: ["Avoid tearing nearby flex cables and preserve water/dust seals around external buttons."],
    steps: [
      { title:"Confirm the button mechanism fault", instruction:"Test the input electrically and mechanically, inspect the external cap, bracket and flex, and rule out software or contamination.", checkpoint:"The failed cap, switch or flex assembly is identified." },
      { title:"Replace and align the button assembly", instruction:"Follow the model reference for bracket orientation and cable routing, then test click feel and input response before closure.", checkpoint:"Button travel and electronic response are consistent." },
    ],
    minutes:50,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  connectivity: {
    tools: ["Known-good wireless access point or paired device", "Network diagnostic utility", "Magnification and inspection light"],
    consumables: ["Antenna contact or coaxial retainer specified for the model"],
    precautions: ["Coaxial connectors are fragile; align vertically and never force them sideways."],
    steps: [
      { title:"Reproduce and localize the wireless fault", instruction:"Test against known-good networks or accessories, reset only with approval, and compare signal strength before opening the device.", checkpoint:"Software, antenna and radio-module causes have been separated." },
      { title:"Service the antenna path", instruction:"Inspect contacts and coaxial cables under magnification, replace the confirmed part, route it through original channels and reconnect without side load.", checkpoint:"Stable range and throughput are restored across the affected radio." },
    ],
    minutes:60,
    difficulty:"Intermediate",
    risk:"Standard",
  },
  diagnostic: {
    tools: ["Known-good cables and power source", "Digital multimeter", "Manufacturer diagnostic software when available"],
    consumables: [],
    precautions: ["Do not order or replace parts until the symptom is reproduced and the failed subsystem is confirmed."],
    steps: [
      { title:"Reproduce and document the symptom", instruction:"Record the exact trigger, frequency, indicators and environmental conditions. Compare against a known-good accessory or configuration.", checkpoint:"The symptom is repeatable or its intermittent conditions are documented." },
      { title:"Narrow the fault to one subsystem", instruction:"Use non-invasive checks first, then measured substitution or manufacturer diagnostics. Update the diagnosis and regenerate this guide once the failed part is known.", checkpoint:"A measured diagnosis supports the next repair action." },
    ],
    minutes:60,
    difficulty:"Intermediate",
    risk:"Standard",
  },
};

const difficultyRank: Record<RepairGuideDraft["difficulty"], number> = { Basic:0, Intermediate:1, Advanced:2, Restricted:3 };
const riskRank: Record<RepairGuideDraft["riskLevel"], number> = { Standard:0, Elevated:1, High:2 };

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function exactModelSource(model: string, guideUrl?: string, sourceGuide?: IfixitGuideCandidate | null) {
  if (sourceGuide) return {
    sourceUrl:sourceGuide.url,
    sourceLabel:sourceGuide.title,
    sourceGuideId:sourceGuide.guideId,
    sourceMatchLevel:sourceGuide.matchLevel,
    sourceCheckedAt:sourceGuide.retrievedAt,
  } as const;
  const raw = guideUrl?.trim() ?? "";
  const fallback = { sourceGuideId:null, sourceMatchLevel:"Unverified" as const, sourceCheckedAt:"" };
  if (/^https?:\/\//i.test(raw)) return { sourceUrl:raw, sourceLabel:"Unconfirmed iFixit reference", ...fallback };
  if (raw.startsWith("/")) return { sourceUrl:`https://www.ifixit.com${raw}`, sourceLabel:"Unconfirmed iFixit reference", ...fallback };
  return {
    sourceUrl:`https://www.ifixit.com/Search?query=${encodeURIComponent(`${model} repair guide`)}`,
    sourceLabel:"Find the exact model disassembly reference",
    ...fallback,
  };
}

function commonTools(category: string) {
  const normalizedCategory = normalized(category);
  const base = ["ESD mat and wrist strap", "Magnetic screw and parts organizer", "Inspection light", "Model-appropriate precision driver set", "Plastic spudger and opening picks"];
  if (/phone|tablet/.test(normalizedCategory)) base.push("Suction handle");
  if (/laptop|console/.test(normalizedCategory)) base.push("Known-good charger and external test display, where applicable");
  if (/audio/.test(normalizedCategory)) base.push("Known-good audio source and cable");
  return base;
}

function mergeFaults(input: GuideInput) {
  const detected = detectRepairFaults(`${input.issue} ${input.diagnosis ?? ""}`);
  const merged = new Map<string, DetectedFault>();
  for (const fault of [...(input.faults ?? []), ...detected]) {
    if (fault.key === "diagnostic" && merged.size) continue;
    if (fault.key !== "diagnostic") merged.delete("diagnostic");
    if (!merged.has(fault.key)) merged.set(fault.key, fault);
  }
  return [...merged.values()].slice(0, 5);
}

function partsForGuide(input: GuideInput, faults: DetectedFault[], consumables: string[]) {
  const result: GuidePart[] = [];
  const seen = new Set<string>();
  for (const part of input.recordedParts ?? []) {
    const key = normalized(part.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const quantity = Math.max(1, Number(part.quantity) || 1);
    result.push({ name:`${quantity > 1 ? `${quantity}× ` : ""}${part.name}`, reason:part.sku ? `Already recorded · SKU ${part.sku}` : "Already recorded on this repair", origin:"Recorded" });
  }
  for (const fault of faults) {
    const key = normalized(fault.recommendedPart);
    if (!key || [...seen].some((item) => item.includes(key) || key.includes(item))) continue;
    seen.add(key);
    result.push({ name:fault.recommendedPart, reason:`Required for ${fault.label.toLowerCase()} — verify the exact model and revision`, origin:"Recommended" });
  }
  for (const name of consumables) {
    const key = normalized(name);
    if (!key || [...seen].some((item) => item.includes(key) || key.includes(item))) continue;
    seen.add(key);
    result.push({ name, reason:"Single-use material for reassembly or protection", origin:"Consumable" });
  }
  return result;
}

function restrictedGuide(input: GuideInput, model: string, faults: DetectedFault[]): RepairGuideDraft {
  const source = exactModelSource(model, input.guideUrl, input.sourceGuide);
  const parts = partsForGuide(input, faults, []);
  return {
    recognizedModel:model,
    title:"Qualified high-voltage repair plan",
    difficulty:"Restricted",
    estimatedMinutes:Math.max(90, Math.round((input.laborHours ?? 1.5) * 60)),
    riskLevel:"High",
    overview:`The reported work on ${model} may expose mains voltage or stored high energy. This guide intentionally stops at safe intake, isolation and documented hand-off; internal procedures must come from the manufacturer's service information and a qualified technician.`,
    tools:["Manufacturer service documentation", "Approved lockout/isolation equipment", "CAT-rated test equipment appropriate to the circuit", "PPE specified by the manufacturer", "Discharge and zero-energy verification equipment specified by the manufacturer"],
    parts,
    precautions:[
      "Only a technician trained and authorized for this exact equipment class should continue past external inspection.",
      "Unplugging alone does not make high-voltage equipment safe; capacitors and other assemblies can retain lethal energy.",
      "Use the manufacturer's isolation, lockout, discharge and verification procedure. Never improvise a discharge method.",
      "Stop if the exact model, service manual, ratings or required safety equipment cannot be verified.",
    ],
    steps:[
      { title:"Identify the exact unit", instruction:"Record the full rating-plate model, revision, supply rating and reported symptom. Obtain the matching manufacturer service documentation.", checkpoint:"Model, revision and approved service source match the physical unit." },
      { title:"Isolate and secure", instruction:"A qualified technician applies the manufacturer's lockout, isolation and stored-energy procedure with the specified PPE and test equipment.", checkpoint:"Zero-energy state is verified using the approved method." },
      { title:"Perform documented diagnosis only", instruction:"Follow the manufacturer fault tree and safety boundaries. Do not rely on this generated draft for component access, discharge points or live measurements.", checkpoint:"Measured evidence identifies the failed assembly and approved replacement." },
      { title:"Repair and safety-test", instruction:"Install approved parts, restore all barriers and interlocks, then complete every electrical safety and functional test required by the manufacturer.", checkpoint:"Test records are attached and the unit meets the release criteria." },
    ],
    ...source,
    generatedAt:new Date().toISOString(),
  };
}

export function generateRepairGuide(input: GuideInput): RepairGuideDraft {
  const model = input.recognizedModel?.trim() || input.device.trim() || "Unconfirmed device";
  const faults = mergeFaults(input);
  const highVoltage = /microwave|crt|tube television|high voltage|mains|power supply|\bpsu\b|inverter|washing machine|dishwasher|refrigerator|\bfridge\b|\boven\b/i.test(`${input.device} ${input.category ?? ""} ${input.issue} ${input.diagnosis ?? ""}`);
  if (highVoltage) return restrictedGuide(input, model, faults);

  const selectedProfiles = faults.map((fault) => profiles[fault.key] ?? profiles.diagnostic);
  const difficulty = selectedProfiles.reduce<RepairGuideDraft["difficulty"]>((current, profile) => difficultyRank[profile.difficulty] > difficultyRank[current] ? profile.difficulty : current, "Basic");
  const riskLevel = selectedProfiles.reduce<RepairGuideDraft["riskLevel"]>((current, profile) => riskRank[profile.risk] > riskRank[current] ? profile.risk : current, "Standard");
  const profileMinutes = selectedProfiles.reduce((sum, profile, index) => sum + profile.minutes * (index ? .72 : 1), 0) + 35;
  const researchMinutes = Number(input.laborHours) > 0 ? Number(input.laborHours) * 60 : 0;
  const estimatedMinutes = Math.round(Math.max(profileMinutes, researchMinutes) / 5) * 5;
  const source = exactModelSource(model, input.guideUrl, input.sourceGuide);
  const tools = unique([...commonTools(input.category ?? "Other"), ...selectedProfiles.flatMap((profile) => profile.tools)]);
  const consumables = unique(selectedProfiles.flatMap((profile) => profile.consumables));
  const precautions = unique([
    "Confirm the exact model, regional variant and replacement-part revision before opening or ordering.",
    "Back up customer data where possible, record consent and photograph the device condition before work.",
    "Power down, disconnect chargers and accessories, and use ESD controls throughout the repair.",
    "Keep screws and brackets mapped by location; a wrong-length screw can cause hidden damage.",
    ...selectedProfiles.flatMap((profile) => profile.precautions),
  ]);
  const problemSummary = faults.map((fault) => fault.label.toLowerCase()).join(", ");
  const diagnosis = input.diagnosis?.trim() && normalized(input.diagnosis) !== "awaiting diagnosis" ? ` The current diagnosis says: ${input.diagnosis.trim()}` : "";
  const boardLevelFault = faults.some((fault) => ["charge-port", "power", "connectivity"].includes(fault.key));
  const pinGate: GuideStep[] = boardLevelFault ? [{
    title:"Verify the board pin map before electrical work",
    instruction:"Do not bridge pins, inject voltage, or infer a connection from a similar model. Obtain the exact schematic or boardview and record the connector name, pin number, expected rail and ground reference first.",
    checkpoint:"Every planned board measurement or connection has an exact-model schematic reference; otherwise board-level work stops here.",
  }] : [];
  const steps: GuideStep[] = [
    { title:"Verify the repair target", instruction:`Confirm that the physical device is ${model}, reproduce the reported issue, and review the selected work: ${problemSummary}.${diagnosis}`, checkpoint:"Model, variant, symptoms and repair scope are confirmed." },
    { title:"Prepare the job and replacement parts", instruction:"Back up data where approved, photograph the starting condition, compare every replacement part and gather the listed tools. Open the linked model reference before disassembly.", checkpoint:"Correct parts, tools, data approval and reference are ready." },
    { title:"Make the device safe", instruction:"Shut down fully, unplug all accessories and external power, observe any waiting period in the model reference, then apply ESD controls.", checkpoint:"The device is powered down and the bench is safe to proceed." },
    { title:"Open the complete model reference", instruction:source.sourceMatchLevel === "Unverified" ? "No exact guide has been confirmed yet. Open the iFixit Guides tab and verify the physical model before disassembly." : `Open ${source.sourceLabel} and follow its complete order, photographs and warnings on iFixit.`, checkpoint:"The physical layout matches the selected reference before any hidden fastener or cable is touched." },
    { title:"Isolate internal power", instruction:"Disconnect the battery or other internal power source as soon as the model procedure safely allows, then verify the board is not being powered before touching other connectors.", checkpoint:"Internal power is isolated." },
    ...pinGate,
    ...selectedProfiles.flatMap((profile) => profile.steps),
    { title:"Run an open-device functional check", instruction:"Reconnect only what the model procedure permits and test every repaired function plus nearby controls, cameras, audio, charging, wireless and thermal behaviour. Power down and isolate again before further adjustment.", checkpoint:"The repair passes and no adjacent function has regressed." },
    { title:"Reassemble and restore seals", instruction:"Remove debris, confirm cable and bracket placement, install new single-use adhesive or seals, and tighten fasteners in the model-specified positions and sequence.", checkpoint:"The enclosure is flush, clean and mechanically secure." },
    { title:"Complete final quality control", instruction:"Repeat the full intake test set, verify charging and temperature stability, document parts and results, and handle the removed battery or electronic waste through an approved recycling stream.", checkpoint:"All release checks are recorded and the device is ready for hand-off." },
  ];
  return {
    recognizedModel:model,
    title:faults.length > 1 ? `${faults.length}-problem custom repair plan` : `${faults[0]?.label ?? "Diagnostic"} repair plan`,
    difficulty,
    estimatedMinutes,
    riskLevel,
    overview:`A workshop draft customized for ${model} from the reported issue, current diagnosis, detected problem${faults.length === 1 ? "" : "s"} and recorded parts. Use the linked complete model reference for physical placement and the manufacturer's safety procedure where available.`,
    tools,
    parts:partsForGuide(input, faults, consumables),
    precautions,
    steps,
    ...source,
    generatedAt:new Date().toISOString(),
  };
}
