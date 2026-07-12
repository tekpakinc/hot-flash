const yearSelect = document.querySelector('[data-year-select]');
const yearOther = document.querySelector('[data-year-other]');
const makeSelect = document.querySelector('[data-make-select]');
const makeOther = document.querySelector('[data-make-other]');
const modelSelect = document.querySelector('[data-model-select]');
const modelOther = document.querySelector('[data-model-other]');

const VEHICLE_MODELS = {
  Acura: ['Integra', 'TL', 'TSX', 'RSX', 'NSX', 'MDX', 'RDX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'S4', 'S5', 'RS3', 'RS5', 'R8', 'Q5', 'Q7'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'M2', 'M3', 'M4', 'M5', 'X3', 'X5', 'Z4'],
  Buick: ['Regal', 'Grand National', 'Riviera', 'LeSabre', 'Century', 'Encore', 'Enclave'],
  Cadillac: ['ATS', 'CTS', 'CT4', 'CT5', 'DTS', 'STS', 'Escalade', 'DeVille', 'Eldorado'],
  Chevrolet: ['Camaro', 'Corvette', 'Chevelle', 'Nova', 'Impala', 'Malibu', 'Monte Carlo', 'Silverado', 'C/K', 'S10', 'Blazer', 'Tahoe', 'Suburban'],
  Chrysler: ['300', 'New Yorker', 'Cordoba', 'Pacifica', 'PT Cruiser'],
  Dodge: ['Challenger', 'Charger', 'Dart', 'Dart Sport', 'Viper', 'Neon', 'Ram', 'Dakota', 'Durango'],
  Ford: ['Mustang', 'Bronco', 'F-150', 'Ranger', 'Maverick', 'Thunderbird', 'Torino', 'Fairlane', 'Focus', 'Fiesta', 'Crown Victoria', 'Explorer'],
  GMC: ['Sierra', 'Canyon', 'Yukon', 'Jimmy', 'Syclone', 'Typhoon'],
  Honda: ['Civic', 'Accord', 'Prelude', 'S2000', 'CRX', 'Integra', 'Pilot', 'Ridgeline'],
  Hyundai: ['Genesis Coupe', 'Veloster', 'Elantra', 'Sonata', 'Santa Fe', 'Palisade'],
  Infiniti: ['G35', 'G37', 'Q50', 'Q60', 'QX60', 'QX80'],
  Jaguar: ['F-Type', 'XJ', 'XE', 'XF', 'E-Type', 'F-Pace'],
  Jeep: ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Gladiator', 'CJ', 'Wagoneer'],
  Kia: ['Stinger', 'Forte', 'K5', 'Soul', 'Telluride', 'Sportage'],
  LandRover: ['Defender', 'Discovery', 'Range Rover', 'Range Rover Sport', 'LR2', 'LR3', 'LR4'],
  Lexus: ['IS', 'GS', 'LS', 'RC', 'LC', 'SC', 'GX', 'LX', 'RX'],
  Lincoln: ['Continental', 'Mark VIII', 'Town Car', 'Navigator'],
  Mazda: ['MX-5 Miata', 'RX-7', 'RX-8', 'Mazda3', 'Mazda6', 'CX-5'],
  MercedesBenz: ['C-Class', 'E-Class', 'S-Class', 'AMG GT', 'SL', 'G-Class', 'GLE', 'GLS'],
  Mercury: ['Cougar', 'Marauder', 'Grand Marquis', 'Montego'],
  Mini: ['Cooper', 'Clubman', 'Countryman'],
  Mitsubishi: ['Lancer Evolution', 'Eclipse', '3000GT', 'Galant', 'Montero'],
  Nissan: ['Silvia', '240SX', '300ZX', '350Z', '370Z', 'GT-R', 'Skyline', 'Sentra', 'Altima', 'Maxima', 'Frontier', 'Titan'],
  Oldsmobile: ['Cutlass', '442', 'Toronado', 'Aurora'],
  Plymouth: ['Barracuda', 'Duster', 'Road Runner', 'GTX', 'Fury', 'Satellite'],
  Pontiac: ['Firebird', 'Trans Am', 'GTO', 'Grand Prix', 'Fiero', 'Solstice'],
  Porsche: ['911', '718 Cayman', '718 Boxster', '944', '928', '918 Spyder', 'Cayenne', 'Macan', 'Panamera'],
  Ram: ['1500', '2500', '3500', 'ProMaster'],
  Saturn: ['Ion', 'Sky', 'Vue'],
  Scion: ['FR-S', 'tC', 'xB'],
  Subaru: ['Impreza', 'WRX', 'WRX STI', 'BRZ', 'Legacy', 'Forester', 'Outback'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  Toyota: ['Supra', 'Corolla', 'Camry', 'Celica', 'MR2', '86', 'Tacoma', 'Tundra', '4Runner', 'Land Cruiser'],
  Volkswagen: ['Golf', 'GTI', 'Jetta', 'Beetle', 'Passat', 'Atlas', 'Tiguan'],
  Volvo: ['240', '740', '850', 'S60', 'S80', 'V70', 'XC60', 'XC90'],
};

const makeLabels = {
  LandRover: 'Land Rover',
  MercedesBenz: 'Mercedes-Benz',
};

function populateYears() {
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear() + 1;
  const years = [];
  for (let year = currentYear; year >= 1900; year -= 1) years.push(year);
  yearSelect.innerHTML = '<option value="">Choose year</option>' + years.map((year) => `<option value="${year}">${year}</option>`).join('') + '<option value="other">Other / custom year</option>';
}

function populateMakes() {
  if (!makeSelect) return;
  makeSelect.innerHTML = '<option value="">Choose make</option>' + Object.keys(VEHICLE_MODELS)
    .sort((a, b) => (makeLabels[a] || a).localeCompare(makeLabels[b] || b))
    .map((make) => `<option value="${makeLabels[make] || make}">${makeLabels[make] || make}</option>`)
    .join('') + '<option value="other">Other</option>';
}

function keyForMake(label) {
  return Object.keys(VEHICLE_MODELS).find((key) => (makeLabels[key] || key) === label);
}

function populateModels(makeLabel) {
  if (!modelSelect) return;
  const key = keyForMake(makeLabel);
  const models = key ? VEHICLE_MODELS[key] : [];
  modelSelect.disabled = !makeLabel || makeLabel === 'other';
  modelSelect.innerHTML = !makeLabel
    ? '<option value="">Choose make first</option>'
    : '<option value="">Choose model</option>' + models.map((model) => `<option value="${model}">${model}</option>`).join('') + '<option value="other">Other</option>';
}

function toggleOther(select, input) {
  if (!select || !input) return;
  const show = select.value === 'other';
  input.hidden = !show;
  input.required = show;
  if (show) input.focus();
  if (!show) input.value = '';
}

yearSelect?.addEventListener('change', () => toggleOther(yearSelect, yearOther));
makeSelect?.addEventListener('change', () => {
  toggleOther(makeSelect, makeOther);
  populateModels(makeSelect.value);
  modelOther.hidden = true;
  modelOther.required = false;
  modelOther.value = '';
});
modelSelect?.addEventListener('change', () => toggleOther(modelSelect, modelOther));

window.hotFlashVehiclePicker = {
  getYear(form) {
    return form.get('year_select') === 'other' ? form.get('year_other') : form.get('year_select');
  },
  getMake(form) {
    return form.get('make_select') === 'other' ? form.get('make_other') : form.get('make_select');
  },
  getModel(form) {
    return form.get('model_select') === 'other' ? form.get('model_other') : form.get('model_select');
  },
  reset() {
    populateYears();
    populateMakes();
    populateModels('');
    [yearOther, makeOther, modelOther].forEach((input) => {
      if (!input) return;
      input.hidden = true;
      input.required = false;
      input.value = '';
    });
  },
};

populateYears();
populateMakes();
populateModels('');
