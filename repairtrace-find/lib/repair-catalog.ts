export type DeviceModel={key:string;label:string;brand:string;category:string;factor:number;aliases?:string[]};
export type RepairIssue={key:string;label:string;shortLabel:string;categories:string[];low:number;typical:number;high:number;partsShare:number};

const coreDeviceModels:DeviceModel[]=[
  {key:"iphone-15-pro",label:"iPhone 15 Pro",brand:"Apple",category:"Phone",factor:1.48},
  {key:"iphone-14-pro",label:"iPhone 14 Pro",brand:"Apple",category:"Phone",factor:1.34},
  {key:"iphone-14",label:"iPhone 14",brand:"Apple",category:"Phone",factor:1.18},
  {key:"iphone-13",label:"iPhone 13",brand:"Apple",category:"Phone",factor:1.04},
  {key:"iphone-12",label:"iPhone 12",brand:"Apple",category:"Phone",factor:.92},
  {key:"galaxy-s24",label:"Samsung Galaxy S24",brand:"Samsung",category:"Phone",factor:1.24},
  {key:"galaxy-s23",label:"Samsung Galaxy S23",brand:"Samsung",category:"Phone",factor:1.12},
  {key:"pixel-8",label:"Google Pixel 8",brand:"Google",category:"Phone",factor:1.08},
  {key:"macbook-air-m2",label:"MacBook Air M2",brand:"Apple",category:"Laptop",factor:1.42},
  {key:"macbook-pro-m1",label:"MacBook Pro M1",brand:"Apple",category:"Laptop",factor:1.54},
  {key:"surface-laptop-5",label:"Microsoft Surface Laptop 5",brand:"Microsoft",category:"Laptop",factor:1.24},
  {key:"nintendo-switch-oled",label:"Nintendo Switch OLED",brand:"Nintendo",category:"Console",factor:1.02},
  {key:"playstation-5",label:"PlayStation 5",brand:"Sony",category:"Console",factor:1.18},
  {key:"ipad-air-5",label:"iPad Air 5",brand:"Apple",category:"Tablet",factor:1.2},
  {key:"sony-wh1000xm4",label:"Sony WH-1000XM4",brand:"Sony",category:"Audio",factor:.82},
];

const expandedDeviceEntries:Array<[string,string,string,number,string[]?]>=[
  ["iPhone 16 Pro Max","Apple","Phone",1.7],["iPhone 16 Pro","Apple","Phone",1.58],["iPhone 16 Plus","Apple","Phone",1.43],["iPhone 16","Apple","Phone",1.38],
  ["iPhone 15 Pro Max","Apple","Phone",1.62],["iPhone 15 Plus","Apple","Phone",1.36],["iPhone 15","Apple","Phone",1.3],["iPhone 14 Pro Max","Apple","Phone",1.47],
  ["iPhone 14 Plus","Apple","Phone",1.27],["iPhone 13 Pro Max","Apple","Phone",1.31],["iPhone 13 Pro","Apple","Phone",1.24],["iPhone 13 mini","Apple","Phone",.99],
  ["iPhone 12 Pro Max","Apple","Phone",1.2],["iPhone 12 Pro","Apple","Phone",1.12],["iPhone 12 mini","Apple","Phone",.88],["iPhone 11 Pro Max","Apple","Phone",1.03],
  ["iPhone 11 Pro","Apple","Phone",.96],["iPhone 11","Apple","Phone",.84],["iPhone SE (2022)","Apple","Phone",.76],["iPhone XR","Apple","Phone",.72],
  ["Samsung Galaxy S25 Ultra","Samsung","Phone",1.62],["Samsung Galaxy S25+","Samsung","Phone",1.43],["Samsung Galaxy S25","Samsung","Phone",1.35],["Samsung Galaxy S24 Ultra","Samsung","Phone",1.52],
  ["Samsung Galaxy S24+","Samsung","Phone",1.35],["Samsung Galaxy S23 Ultra","Samsung","Phone",1.42],["Samsung Galaxy S23+","Samsung","Phone",1.27],["Samsung Galaxy S22 Ultra","Samsung","Phone",1.32],
  ["Samsung Galaxy S22","Samsung","Phone",1.04],["Samsung Galaxy S21 Ultra","Samsung","Phone",1.2],["Samsung Galaxy S21","Samsung","Phone",.96],["Samsung Galaxy Z Fold6","Samsung","Phone",1.85],
  ["Samsung Galaxy Z Fold5","Samsung","Phone",1.72],["Samsung Galaxy Z Fold4","Samsung","Phone",1.58],["Samsung Galaxy Z Flip6","Samsung","Phone",1.43],["Samsung Galaxy Z Flip5","Samsung","Phone",1.34],
  ["Samsung Galaxy A55","Samsung","Phone",.84],["Samsung Galaxy A54","Samsung","Phone",.8],["Samsung Galaxy A35","Samsung","Phone",.72],["Samsung Galaxy A34","Samsung","Phone",.7],
  ["Samsung Galaxy A25","Samsung","Phone",.64],["Samsung Galaxy A15","Samsung","Phone",.58],["Google Pixel 9 Pro XL","Google","Phone",1.45],["Google Pixel 9 Pro","Google","Phone",1.36],
  ["Google Pixel 9","Google","Phone",1.23],["Google Pixel 8 Pro","Google","Phone",1.31],["Google Pixel 8a","Google","Phone",.92],["Google Pixel 7 Pro","Google","Phone",1.17],
  ["Google Pixel 7","Google","Phone",1.04],["Google Pixel 7a","Google","Phone",.89],["Google Pixel 6 Pro","Google","Phone",1.08],["Google Pixel 6","Google","Phone",.94],
  ["Xiaomi 14 Ultra","Xiaomi","Phone",1.42],["Xiaomi 14","Xiaomi","Phone",1.23],["Xiaomi 13T Pro","Xiaomi","Phone",1.12],["Xiaomi 13","Xiaomi","Phone",1.14],
  ["Xiaomi Redmi Note 13 Pro+","Xiaomi","Phone",.91],["Xiaomi Redmi Note 13 Pro","Xiaomi","Phone",.83],["Xiaomi Redmi Note 13","Xiaomi","Phone",.72],["Xiaomi Redmi Note 12 Pro","Xiaomi","Phone",.77],
  ["Xiaomi Redmi Note 12","Xiaomi","Phone",.66],["POCO F6 Pro","Xiaomi","Phone",.94],["POCO F6","Xiaomi","Phone",.85],["POCO X6 Pro","Xiaomi","Phone",.8],
  ["OnePlus 12","OnePlus","Phone",1.2],["OnePlus 11","OnePlus","Phone",1.09],["OnePlus Nord 4","OnePlus","Phone",.82],["OnePlus Nord 3","OnePlus","Phone",.77],
  ["Nothing Phone (2)","Nothing","Phone",.96],["Nothing Phone (2a)","Nothing","Phone",.76],["Huawei P60 Pro","Huawei","Phone",1.16],["Huawei P50 Pro","Huawei","Phone",1.08],
  ["OPPO Find X7 Ultra","OPPO","Phone",1.35],["OPPO Reno12 Pro","OPPO","Phone",.91],["Motorola Edge 50 Pro","Motorola","Phone",.94],["Motorola Razr 50 Ultra","Motorola","Phone",1.34],

  ["MacBook Air M3 13-inch","Apple","Laptop",1.45],["MacBook Air M3 15-inch","Apple","Laptop",1.55],["MacBook Air M2 15-inch","Apple","Laptop",1.49],["MacBook Air M1","Apple","Laptop",1.26],
  ["MacBook Pro M3 14-inch","Apple","Laptop",1.72],["MacBook Pro M3 16-inch","Apple","Laptop",1.91],["MacBook Pro M2 14-inch","Apple","Laptop",1.65],["MacBook Pro M2 16-inch","Apple","Laptop",1.84],
  ["MacBook Pro M1 14-inch","Apple","Laptop",1.58],["MacBook Pro M1 16-inch","Apple","Laptop",1.76],["Microsoft Surface Laptop 7","Microsoft","Laptop",1.33],["Microsoft Surface Laptop 6","Microsoft","Laptop",1.29],
  ["Microsoft Surface Pro 11","Microsoft","Laptop",1.4],["Microsoft Surface Pro 10","Microsoft","Laptop",1.35],["Dell XPS 13","Dell","Laptop",1.28],["Dell XPS 15","Dell","Laptop",1.42],
  ["Dell Inspiron 14","Dell","Laptop",.92],["Dell Inspiron 15","Dell","Laptop",.9],["Lenovo ThinkPad X1 Carbon","Lenovo","Laptop",1.32],["Lenovo ThinkPad T14","Lenovo","Laptop",1.12],
  ["Lenovo IdeaPad 5","Lenovo","Laptop",.9],["Lenovo Legion 5","Lenovo","Laptop",1.17],["HP Spectre x360 14","HP","Laptop",1.28],["HP Pavilion 15","HP","Laptop",.91],
  ["HP Envy x360 15","HP","Laptop",1.03],["ASUS Zenbook 14","ASUS","Laptop",1.12],["ASUS ROG Zephyrus G14","ASUS","Laptop",1.31],["ASUS TUF Gaming A15","ASUS","Laptop",1.08],
  ["Acer Swift Go 14","Acer","Laptop",1.01],["Acer Aspire 5","Acer","Laptop",.86],["Acer Nitro 5","Acer","Laptop",1.04],["MSI Katana 15","MSI","Laptop",1.06],

  ["iPad Pro 13-inch M4","Apple","Tablet",1.62],["iPad Pro 11-inch M4","Apple","Tablet",1.48],["iPad Pro 12.9-inch M2","Apple","Tablet",1.48],["iPad Air 13-inch M2","Apple","Tablet",1.3],
  ["iPad Air 11-inch M2","Apple","Tablet",1.2],["iPad 10th generation","Apple","Tablet",.96],["iPad 9th generation","Apple","Tablet",.85],["iPad mini 6","Apple","Tablet",.98],
  ["Samsung Galaxy Tab S10 Ultra","Samsung","Tablet",1.52],["Samsung Galaxy Tab S10+","Samsung","Tablet",1.4],["Samsung Galaxy Tab S9 Ultra","Samsung","Tablet",1.46],["Samsung Galaxy Tab S9","Samsung","Tablet",1.18],
  ["Samsung Galaxy Tab A9+","Samsung","Tablet",.74],["Microsoft Surface Go 4","Microsoft","Tablet",1.04],["Lenovo Tab P12","Lenovo","Tablet",.82],["Xiaomi Pad 6","Xiaomi","Tablet",.84],

  ["PlayStation 5 Slim","Sony","Console",1.16,["PS5 Slim"]],["PlayStation 5 Digital Edition","Sony","Console",1.14,["PS5 Digital"]],["PlayStation 4 Pro","Sony","Console",.86,["PS4 Pro"]],["PlayStation 4 Slim","Sony","Console",.75,["PS4 Slim"]],
  ["Xbox Series X","Microsoft","Console",1.15],["Xbox Series S","Microsoft","Console",.83],["Xbox One X","Microsoft","Console",.78],["Xbox One S","Microsoft","Console",.7],
  ["Nintendo Switch","Nintendo","Console",.89],["Nintendo Switch Lite","Nintendo","Console",.74],["Steam Deck OLED","Valve","Console",1.08],["Steam Deck LCD","Valve","Console",.94],
  ["ASUS ROG Ally","ASUS","Console",1.1],["Meta Quest 3","Meta","Console",1.06],["PlayStation Portal","Sony","Console",.82],

  ["Sony WH-1000XM5","Sony","Audio",.94],["Sony WF-1000XM5","Sony","Audio",.72],["Apple AirPods Pro 2","Apple","Audio",.69],["Apple AirPods 3","Apple","Audio",.61],
  ["Apple AirPods Max","Apple","Audio",1.02],["Bose QuietComfort Ultra","Bose","Audio",.96],["Bose QuietComfort 45","Bose","Audio",.84],["JBL Charge 5","JBL","Audio",.58],
  ["JBL Flip 6","JBL","Audio",.52],["Sonos Era 100","Sonos","Audio",.76],["Sonos One","Sonos","Audio",.7],["Beats Studio Pro","Beats","Audio",.82],

  ["Apple Watch Ultra 2","Apple","Wearable",1.18],["Apple Watch Series 10","Apple","Wearable",1.02],["Apple Watch Series 9","Apple","Wearable",.96],["Apple Watch SE 2","Apple","Wearable",.75],
  ["Samsung Galaxy Watch Ultra","Samsung","Wearable",1.05],["Samsung Galaxy Watch7","Samsung","Wearable",.88],["Google Pixel Watch 3","Google","Wearable",.92],["Garmin Fenix 8","Garmin","Wearable",1.16],
  ["Garmin Forerunner 965","Garmin","Wearable",1.01],["Fitbit Charge 6","Fitbit","Wearable",.61],

  ["Canon EOS R6 Mark II","Canon","Camera",1.5],["Canon EOS R50","Canon","Camera",1.04],["Sony Alpha A7 IV","Sony","Camera",1.54],["Sony Alpha A6700","Sony","Camera",1.27],
  ["Nikon Z6 II","Nikon","Camera",1.42],["Fujifilm X-T5","Fujifilm","Camera",1.38],["GoPro HERO13 Black","GoPro","Camera",.82],["DJI Osmo Action 5 Pro","DJI","Camera",.79],
  ["DJI Mini 4 Pro","DJI","Drone",1.15],["DJI Air 3","DJI","Drone",1.31],["DJI Avata 2","DJI","Drone",1.18],
  ["LG OLED C4 Television","LG","Television",1.38],["Samsung Neo QLED QN90D","Samsung","Television",1.4],["Sony Bravia 8 OLED","Sony","Television",1.42],
];

function catalogSlug(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\+/g,"plus").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"other";}
const expandedDeviceModels=expandedDeviceEntries.map(([label,brand,category,factor,aliases])=>({key:catalogSlug(label),label,brand,category,factor,aliases}));
export const deviceModels:DeviceModel[]=Array.from(new Map([...coreDeviceModels,...expandedDeviceModels].map(model=>[model.key,model])).values());

export const repairIssues:RepairIssue[]=[
  {key:"screen",label:"Cracked screen, display or touch problem",shortLabel:"Screen",categories:["Phone","Tablet","Laptop","Console","Wearable","Camera","Television"],low:95,typical:155,high:245,partsShare:.72},
  {key:"battery",label:"Battery drains quickly or will not hold charge",shortLabel:"Battery",categories:["Phone","Tablet","Laptop","Audio","Wearable","Camera","Drone"],low:42,typical:69,high:105,partsShare:.48},
  {key:"charging",label:"Charging port or device will not charge",shortLabel:"Charging",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera","Drone"],low:55,typical:92,high:155,partsShare:.38},
  {key:"back-glass",label:"Broken rear glass or housing",shortLabel:"Housing",categories:["Phone","Tablet"],low:72,typical:125,high:205,partsShare:.63},
  {key:"camera",label:"Camera does not focus or open",shortLabel:"Camera",categories:["Phone","Tablet","Laptop","Camera","Drone"],low:58,typical:98,high:168,partsShare:.59},
  {key:"liquid",label:"Liquid damage assessment",shortLabel:"Liquid damage",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera","Drone","Television"],low:35,typical:72,high:165,partsShare:.2},
  {key:"fan",label:"Fan noise, overheating or cooling fault",shortLabel:"Cooling",categories:["Laptop","Console","Drone","Television"],low:48,typical:88,high:145,partsShare:.36},
  {key:"hinge",label:"Broken hinge, frame or headband",shortLabel:"Hinge / frame",categories:["Laptop","Audio"],low:38,typical:76,high:135,partsShare:.42},
  {key:"keyboard",label:"Keyboard or individual keys do not work",shortLabel:"Keyboard",categories:["Laptop"],low:55,typical:105,high:210,partsShare:.55},
  {key:"speaker",label:"Speaker, earpiece or audio output problem",shortLabel:"Speaker / audio",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Television"],low:36,typical:72,high:135,partsShare:.44},
  {key:"microphone",label:"Microphone is quiet, distorted or not working",shortLabel:"Microphone",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera"],low:38,typical:74,high:138,partsShare:.43},
  {key:"joystick",label:"Controller stick drift or joystick fault",shortLabel:"Joystick drift",categories:["Console"],low:32,typical:58,high:95,partsShare:.32},
  {key:"storage",label:"Storage drive is slow, failed or not detected",shortLabel:"Storage",categories:["Laptop","Console"],low:65,typical:125,high:240,partsShare:.61},
  {key:"power",label:"Device will not power on or has a board fault",shortLabel:"Power / board",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera","Drone","Television","Other"],low:55,typical:125,high:290,partsShare:.35},
  {key:"buttons",label:"Power, volume or another button does not work",shortLabel:"Buttons",categories:["Phone","Tablet","Console","Audio","Wearable","Camera","Drone","Television"],low:38,typical:72,high:125,partsShare:.43},
  {key:"connectivity",label:"Wi-Fi, Bluetooth or signal problem",shortLabel:"Connectivity",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera","Drone","Television"],low:35,typical:78,high:165,partsShare:.3},
  {key:"video",label:"HDMI, video input or picture output problem",shortLabel:"HDMI / video",categories:["Laptop","Console","Camera","Television"],low:48,typical:95,high:190,partsShare:.4},
  {key:"lens",label:"Lens, shutter, zoom or camera gimbal problem",shortLabel:"Lens / gimbal",categories:["Phone","Tablet","Camera","Drone"],low:55,typical:125,high:310,partsShare:.61},
  {key:"sensors",label:"Face ID, fingerprint, GPS or sensor problem",shortLabel:"Sensors",categories:["Phone","Tablet","Wearable","Camera","Drone"],low:42,typical:88,high:180,partsShare:.47},
  {key:"movement",label:"Motor, propeller or movement-control problem",shortLabel:"Motor / movement",categories:["Drone"],low:45,typical:105,high:235,partsShare:.52},
  {key:"data-recovery",label:"Recover files or data from a damaged device",shortLabel:"Data recovery",categories:["Phone","Tablet","Laptop","Console","Camera","Other"],low:55,typical:135,high:420,partsShare:.14},
  {key:"software",label:"Software, startup or data problem",shortLabel:"Software",categories:["Phone","Tablet","Laptop","Console","Wearable","Camera","Drone","Television"],low:25,typical:55,high:110,partsShare:.08},
  {key:"diagnostic",label:"I am not sure — diagnose the device",shortLabel:"Diagnosis",categories:["Phone","Tablet","Laptop","Console","Audio","Wearable","Camera","Drone","Television","Other"],low:20,typical:38,high:65,partsShare:.05},
];

export const countries=[
  {code:"PT",label:"Portugal",currency:"EUR",symbol:"€",factor:1},
  {code:"ES",label:"Spain",currency:"EUR",symbol:"€",factor:1.04},
  {code:"FR",label:"France",currency:"EUR",symbol:"€",factor:1.16},
  {code:"DE",label:"Germany",currency:"EUR",symbol:"€",factor:1.14},
  {code:"IT",label:"Italy",currency:"EUR",symbol:"€",factor:1.06},
  {code:"NL",label:"Netherlands",currency:"EUR",symbol:"€",factor:1.2},
];

export const deviceCategories=["Phone","Laptop","Tablet","Console","Audio","Wearable","Camera","Drone","Television","Other"] as const;

export function modelKeyFromLabel(value:string){
  return catalogSlug(value);
}

function normalizedSearch(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
const popularKeys=["iphone-16","iphone-15-pro","iphone-14","galaxy-s24","samsung-galaxy-s25-ultra","google-pixel-9","macbook-air-m2","playstation-5","xbox-series-x","nintendo-switch-oled"];
export function searchDeviceModels(query:string,limit=10){
  const needle=normalizedSearch(query);
  if(!needle)return popularKeys.map(key=>deviceModels.find(model=>model.key===key)).filter(Boolean).slice(0,limit) as DeviceModel[];
  const tokens=needle.split(/\s+/).filter(Boolean);
  return deviceModels.map(model=>{
    const label=normalizedSearch(model.label);const brand=normalizedSearch(model.brand);const aliases=normalizedSearch((model.aliases??[]).join(" "));const haystack=`${label} ${brand} ${aliases} ${model.key.replaceAll("-"," ")}`;
    if(!tokens.every(token=>haystack.includes(token)))return {model,score:-1};
    let score=tokens.reduce((total,token)=>total+(label.split(" ").some(word=>word.startsWith(token))?18:8),0);
    if(label===needle)score+=200;else if(label.startsWith(needle))score+=110;else if(label.includes(needle))score+=70;if(brand===needle)score+=30;
    return {model,score};
  }).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score||a.model.label.localeCompare(b.model.label)).slice(0,Math.min(20,Math.max(1,limit))).map(item=>item.model);
}

export function inferIssueFromProblem(problem:string,category:string){
  const value=normalizedSearch(problem);
  const rules:Array<[string,RegExp]>=[
    ["screen",/screen|display|lcd|oled|glass|touch|ecra|ecrã|tela|vidro/],["battery",/battery|bateria|drain|charge quickly|descarrega/],["charging",/charging port|charger|usb|carreg|porta/],
    ["liquid",/water|liquid|wet|agua|molhado/],["video",/hdmi|video output|video input|sem imagem|no picture/],["lens",/lens|lente|shutter|obturador|zoom|gimbal/],["camera",/camera|focus|camara|foco/],["fan",/fan|overheat|hot|ventoinha|aquece|ruido/],
    ["keyboard",/keyboard|key|teclado|tecla/],["speaker",/speaker|sound|audio|som|altifalante/],["microphone",/microphone|mic|microfone/],["joystick",/joystick|stick drift|drift|comando/],
    ["data-recovery",/data recovery|recover files|recuperar dados|recuperar ficheiros/],["storage",/storage|ssd|hard drive|disk|armazenamento|disco/],["sensors",/face id|fingerprint|impressao digital|gps|sensor/],["movement",/motor|propeller|helice|movimento/],["buttons",/button|botao|volume/],["connectivity",/wifi|wi fi|bluetooth|signal|rede|sinal/],["software",/software|boot|startup|windows|android|ios|inicia|sistema/],["power",/power on|turn on|dead|board|motherboard|liga|placa/],
  ];
  return rules.find(([key,pattern])=>pattern.test(value)&&repairIssues.some(issue=>issue.key===key&&issue.categories.includes(category)))?.[0]??"diagnostic";
}

function brandFromLabel(value:string){
  if(/iphone|ipad|macbook/i.test(value))return"Apple";
  if(/galaxy|samsung/i.test(value))return"Samsung";
  if(/pixel/i.test(value))return"Google";
  if(/switch|nintendo/i.test(value))return"Nintendo";
  if(/playstation|sony/i.test(value))return"Sony";
  if(/surface|xbox|microsoft/i.test(value))return"Microsoft";
  return value.trim().split(/\s+/)[0]?.slice(0,60)??"";
}

export function getModel(key:string,customLabel="",category="Phone"){
  const known=deviceModels.find(model=>model.key===key);
  if(known)return known;
  const label=customLabel.trim().slice(0,100)||"Other device";
  const safeCategory=deviceCategories.includes(category as typeof deviceCategories[number])?category:"Other";
  return {key:modelKeyFromLabel(label),label,brand:brandFromLabel(label),category:safeCategory,factor:1};
}

export function getIssue(key:string,category="Phone"){
  return repairIssues.find(issue=>issue.key===key&&issue.categories.includes(category))??repairIssues.find(issue=>issue.key==="diagnostic"&&issue.categories.includes(category))!;
}
