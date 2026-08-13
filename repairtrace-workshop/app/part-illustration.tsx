type PartKind = "battery" | "screen" | "port" | "camera" | "housing" | "keyboard" | "hinge" | "speaker" | "microphone" | "cooling" | "joystick" | "storage" | "liquid" | "board" | "buttons" | "connectivity" | "generic";

function plain(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function classify(value: string, fallback: string): PartKind {
  const source = plain(value);
  const combined = `${source} ${plain(fallback)}`;
  if (/battery|bateria/.test(source)) return "battery";
  if (/screen|display|lcd|oled|digitizer|touch|ecra|tela|front glass/.test(source)) return "screen";
  if (/charg|usb|lightning|porta|connector|conector/.test(source)) return "port";
  if (/camera|camara|lens|lente/.test(source)) return "camera";
  if (/back glass|rear glass|housing|cover|tampa|carcaca/.test(source)) return "housing";
  if (/keyboard|keycap|teclado|top case/.test(source)) return "keyboard";
  if (/hinge|headband|dobradica/.test(source)) return "hinge";
  if (/speaker|earpiece|altifalante|audio/.test(source)) return "speaker";
  if (/microphone|microfone|\bmic\b/.test(source)) return "microphone";
  if (/fan|cooling|thermal|ventoinha/.test(source)) return "cooling";
  if (/joystick|analog|stick/.test(source)) return "joystick";
  if (/ssd|storage|drive|disk|disco/.test(source)) return "storage";
  if (/liquid|water|cleaning|agua|liquido/.test(source)) return "liquid";
  if (/button|switch|botao/.test(source)) return "buttons";
  if (/antenna|wireless|wifi|bluetooth|antena/.test(source)) return "connectivity";
  if (/board|logic|motherboard|power|placa/.test(source)) return "board";
  if (/battery|bateria/.test(combined)) return "battery";
  if (/screen|display/.test(combined)) return "screen";
  if (/charge-port/.test(combined)) return "port";
  if (/camera/.test(combined)) return "camera";
  if (/back-glass/.test(combined)) return "housing";
  if (/keyboard/.test(combined)) return "keyboard";
  if (/hinge/.test(combined)) return "hinge";
  if (/speaker/.test(combined)) return "speaker";
  if (/microphone/.test(combined)) return "microphone";
  if (/cooling/.test(combined)) return "cooling";
  if (/joystick/.test(combined)) return "joystick";
  if (/storage/.test(combined)) return "storage";
  if (/liquid/.test(combined)) return "liquid";
  if (/buttons/.test(combined)) return "buttons";
  if (/connectivity/.test(combined)) return "connectivity";
  if (/power/.test(combined)) return "board";
  return "generic";
}

function Drawing({ kind }: { kind: PartKind }) {
  const shared = { fill:"none", stroke:"currentColor", strokeWidth:1.7, strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  if (kind === "battery") return <><rect {...shared} x="8" y="5" width="16" height="23" rx="3"/><path {...shared} d="M13 5V2.8h6V5M11 22h10"/><path d="M11 16.5h10V25H11z" fill="currentColor" opacity=".2"/></>;
  if (kind === "screen") return <><rect {...shared} x="7" y="3" width="18" height="26" rx="3"/><path {...shared} d="m17 8-3 5 4 2-4 7 6-4 2 3"/><path {...shared} d="M13 26h6"/></>;
  if (kind === "port") return <><path {...shared} d="M5 11h22v10H5z"/><path {...shared} d="M10 14.5h12v3H10zM8 11v-2m16 2V9"/><circle cx="8" cy="24" r="1.4" fill="currentColor"/><circle cx="24" cy="24" r="1.4" fill="currentColor"/></>;
  if (kind === "camera") return <><rect {...shared} x="5" y="6" width="22" height="21" rx="5"/><circle {...shared} cx="12" cy="13" r="4"/><circle {...shared} cx="21" cy="18" r="4"/><circle cx="22" cy="10" r="1.4" fill="currentColor"/></>;
  if (kind === "housing") return <><rect {...shared} x="8" y="4" width="16" height="24" rx="4"/><path {...shared} d="M11 8h5M19 8h2M10 24l4-4 3 2 4-5"/><circle {...shared} cx="20" cy="11" r="2"/></>;
  if (kind === "keyboard") return <><rect {...shared} x="4" y="7" width="24" height="18" rx="3"/><path {...shared} d="M8 11h2m3 0h2m3 0h2m3 0h1M8 15h2m3 0h2m3 0h2m3 0h1M8 19h2m3 0h11M8 22h16"/></>;
  if (kind === "hinge") return <><path {...shared} d="M5 8h9v16H5zM18 8h9v16h-9z"/><circle {...shared} cx="16" cy="16" r="4"/><path {...shared} d="M16 12v8"/></>;
  if (kind === "speaker") return <><path {...shared} d="M5 13h5l7-6v18l-7-6H5zM21 12c2 2 2 6 0 8M24 9c4 4 4 10 0 14"/></>;
  if (kind === "microphone") return <><rect {...shared} x="11" y="4" width="10" height="17" rx="5"/><path {...shared} d="M7.5 15.5a8.5 8.5 0 0 0 17 0M16 24v5m-5 0h10"/></>;
  if (kind === "cooling") return <><circle {...shared} cx="16" cy="16" r="12"/><circle {...shared} cx="16" cy="16" r="2.5"/><path d="M16 13c-1-5 1-8 4-7 3 2 1 6-2 8M19 16c5-1 8 1 7 4-2 3-6 1-8-2M16 19c1 5-1 8-4 7-3-2-1-6 2-8M13 16c-5 1-8-1-7-4 2-3 6-1 8 2" fill="currentColor" opacity=".3"/></>;
  if (kind === "joystick") return <><rect {...shared} x="5" y="13" width="22" height="14" rx="5"/><path {...shared} d="M16 14V8"/><circle {...shared} cx="16" cy="6" r="3"/><path {...shared} d="M10 18v5m-2.5-2.5h5M22 18h.1M24 21h.1"/></>;
  if (kind === "storage") return <><rect {...shared} x="5" y="7" width="22" height="18" rx="3"/><rect {...shared} x="9" y="11" width="8" height="7" rx="1"/><path {...shared} d="M20 11h3m-3 4h3m-3 4h3M9 22h14"/><path d="M8 25v3m4-3v3m4-3v3m4-3v3m4-3v3" stroke="currentColor" strokeWidth="1.7"/></>;
  if (kind === "liquid") return <><path {...shared} d="M16 3S8 13 8 19a8 8 0 0 0 16 0C24 13 16 3 16 3Z"/><path {...shared} d="M12 20c.5 2 2 3 4 3"/></>;
  if (kind === "buttons") return <><rect {...shared} x="9" y="3" width="14" height="26" rx="5"/><rect {...shared} x="12" y="7" width="8" height="4" rx="2"/><rect {...shared} x="12" y="14" width="8" height="4" rx="2"/><rect {...shared} x="12" y="21" width="8" height="4" rx="2"/></>;
  if (kind === "connectivity") return <><path {...shared} d="M5 12a16 16 0 0 1 22 0M9 16a10 10 0 0 1 14 0M13 20a4 4 0 0 1 6 0"/><circle cx="16" cy="25" r="2" fill="currentColor"/></>;
  if (kind === "board") return <><rect {...shared} x="4" y="5" width="24" height="22" rx="3"/><rect {...shared} x="11" y="10" width="10" height="10" rx="2"/><path {...shared} d="M11 13H7v-3M11 17H7v5m14-9h4V9m-4 8h4v5M14 10V7m4 3V7m-4 13v4m4-4v4"/><circle cx="7" cy="10" r="1.2" fill="currentColor"/><circle cx="7" cy="22" r="1.2" fill="currentColor"/><circle cx="25" cy="9" r="1.2" fill="currentColor"/><circle cx="25" cy="22" r="1.2" fill="currentColor"/></>;
  return <><path {...shared} d="m16 3 11 6v14l-11 6-11-6V9zM5 9l11 6 11-6M16 15v14"/><path {...shared} d="m11 6 11 6"/></>;
}

export default function PartIllustration({ partName, faultKey = "" }: { partName: string; faultKey?: string }) {
  const kind = classify(partName, faultKey);
  return <span className={`part-illustration part-illustration-${kind}`} aria-hidden="true"><svg viewBox="0 0 32 32"><Drawing kind={kind}/></svg></span>;
}
