const typeSelect=document.querySelector('[data-vehicle-type]');
const yearSelect=document.querySelector('[data-year-select]');
const yearOther=document.querySelector('[data-year-other]');
const makeSelect=document.querySelector('[data-make-select]');
const makeOther=document.querySelector('[data-make-other]');
const modelSelect=document.querySelector('[data-model-select]');
const modelOther=document.querySelector('[data-model-other]');

const CATALOG={
 automobile:{
  Acura:['Integra','TL','TSX','RSX','NSX','MDX','RDX'],Audi:['A3','A4','A5','A6','S4','RS5','R8','Q5'],BMW:['2 Series','3 Series','4 Series','5 Series','M2','M3','M4','M5','X3','X5'],Cadillac:['ATS','CTS','CT4','CT5','DTS','STS','Escalade'],Chevrolet:['Camaro','Corvette','Chevelle','Nova','Impala','Silverado','S10','Blazer','Tahoe'],Dodge:['Challenger','Charger','Dart','Dart Sport','Viper','Neon','Ram','Dakota','Durango'],Ford:['Mustang','Bronco','F-150','Ranger','Maverick','Thunderbird','Focus','Crown Victoria'],Honda:['Civic','Accord','Prelude','S2000','CRX','Integra','Pilot','Ridgeline'],Jeep:['Wrangler','Cherokee','Grand Cherokee','Gladiator','CJ','Wagoneer'],Mazda:['MX-5 Miata','RX-7','RX-8','Mazda3','Mazda6'],Mitsubishi:['Lancer Evolution','Eclipse','3000GT','Galant','Montero'],Nissan:['Silvia','240SX','300ZX','350Z','370Z','GT-R','Skyline','Sentra','Frontier','Titan'],Plymouth:['Barracuda','Duster','Road Runner','GTX','Fury'],Pontiac:['Firebird','Trans Am','GTO','Grand Prix','Fiero'],Porsche:['911','718 Cayman','944','918 Spyder','Cayenne','Panamera'],Subaru:['Impreza','WRX','WRX STI','BRZ','Legacy','Forester'],Toyota:['Supra','Corolla','Camry','Celica','MR2','86','Tacoma','Tundra','4Runner','Land Cruiser'],Volkswagen:['Golf','GTI','Jetta','Beetle','Passat']
 },
 motorcycle:{
  Aprilia:['RS 660','RSV4','Tuono V4'],BMW:['S 1000 RR','M 1000 RR','R nineT','R 1250 GS'],CanAm:['Ryker','Spyder'],Ducati:['Panigale V2','Panigale V4','Monster','Diavel','Scrambler'],HarleyDavidson:['Sportster','Street Bob','Fat Boy','Road Glide','Street Glide','Low Rider S'],Honda:['Grom','Rebel','CBR600RR','CBR1000RR','Gold Wing','Africa Twin'],Husqvarna:['Svartpilen','Vitpilen','TE 300'],Indian:['Scout','Chief','Challenger','FTR'],Kawasaki:['Ninja 400','Ninja ZX-6R','Ninja ZX-10R','Z900','KLR650'],KTM:['Duke 390','Duke 790','1290 Super Duke R','450 SX-F'],Suzuki:['Hayabusa','GSX-R600','GSX-R1000','DR-Z400'],Triumph:['Street Triple','Speed Triple','Bonneville','Rocket 3'],Yamaha:['YZF-R3','YZF-R6','YZF-R1','MT-07','MT-09','Tenere 700']
 },
 marine:{
  Bayliner:['Element','VR4','VR5','VR6','Bowrider'],BostonWhaler:['Montauk','Outrage','Dauntless'],Chaparral:['SSi','SSX','Sunesta'],Crestliner:['Fish Hawk','Super Hawk','XFC'],GradyWhite:['Fisherman','Freedom','Canyon'],Jeanneau:['NC','Leader','Merry Fisher'],Kawasaki:['Jet Ski STX','Jet Ski Ultra'],Malibu:['Wakesetter','Response'],MasterCraft:['NXT','XT','XStar'],SeaDoo:['Spark','GTI','GTR','RXP-X','Switch'],SeaRay:['SPX','SDX','SLX','Sundancer'],Tracker:['Pro Team','Targa','Grizzly'],Yamaha:['WaveRunner EX','WaveRunner VX','WaveRunner FX','AR Series','195S','252S']
 },
 offroad:{
  ArcticCat:['Alterra','Wildcat','Prowler'],CanAm:['Maverick X3','Maverick R','Defender','Outlander','Renegade'],Coleman:['CT200U','BT200X','RB200'],Honda:['Talion','Pioneer','Foreman','Rancher','TRX','CRF'],Kawasaki:['Teryx','KFX','Brute Force','Mule','KLX'],KTM:['450 SX-F','300 XC-W','500 EXC-F'],Polaris:['RZR','General','Ranger','Sportsman','Scrambler'],Segway:['Villain','Fugleman','Snarler'],Suzuki:['KingQuad','LT-Z400','RM-Z450'],Yamaha:['YFZ450R','Raptor 700R','Grizzly','Kodiak','Wolverine','YXZ1000R']
 }
};
const LABELS={HarleyDavidson:'Harley-Davidson',BostonWhaler:'Boston Whaler',GradyWhite:'Grady-White',SeaDoo:'Sea-Doo',ArcticCat:'Arctic Cat',CanAm:'Can-Am'};
function type(){return typeSelect?.value||'automobile'}
function populateYears(){if(!yearSelect)return;const years=[];for(let y=new Date().getFullYear()+1;y>=1885;y--)years.push(y);yearSelect.innerHTML='<option value="">Choose year</option>'+years.map(y=>`<option>${y}</option>`).join('')+'<option value="other">Other / custom year</option>'}
function populateMakes(){if(!makeSelect)return;const makes=CATALOG[type()]||{};makeSelect.innerHTML='<option value="">Choose make</option>'+Object.keys(makes).sort((a,b)=>(LABELS[a]||a).localeCompare(LABELS[b]||b)).map(k=>`<option value="${LABELS[k]||k}">${LABELS[k]||k}</option>`).join('')+'<option value="other">Other</option>';populateModels('')}
function keyForMake(label){return Object.keys(CATALOG[type()]||{}).find(k=>(LABELS[k]||k)===label)}
function populateModels(label){if(!modelSelect)return;const models=(CATALOG[type()]||{})[keyForMake(label)]||[];modelSelect.disabled=!label||label==='other';modelSelect.innerHTML=!label?'<option value="">Choose make first</option>':'<option value="">Choose model</option>'+models.map(m=>`<option>${m}</option>`).join('')+'<option value="other">Other</option>'}
function toggleOther(select,input){if(!select||!input)return;const show=select.value==='other';input.hidden=!show;input.required=show;if(!show)input.value='';if(show)input.focus()}
typeSelect?.addEventListener('change',()=>{populateMakes();makeOther.hidden=true;modelOther.hidden=true});
yearSelect?.addEventListener('change',()=>toggleOther(yearSelect,yearOther));
makeSelect?.addEventListener('change',()=>{toggleOther(makeSelect,makeOther);populateModels(makeSelect.value);modelOther.hidden=true;modelOther.required=false;modelOther.value='' });
modelSelect?.addEventListener('change',()=>toggleOther(modelSelect,modelOther));
window.hotFlashVehiclePicker={getType:f=>f.get('vehicle_type')||'automobile',getYear:f=>f.get('year_select')==='other'?f.get('year_other'):f.get('year_select'),getMake:f=>f.get('make_select')==='other'?f.get('make_other'):f.get('make_select'),getModel:f=>f.get('model_select')==='other'?f.get('model_other'):f.get('model_select'),reset(){populateYears();populateMakes();[yearOther,makeOther,modelOther].forEach(i=>{if(i){i.hidden=true;i.required=false;i.value=''}})}};
populateYears();populateMakes();