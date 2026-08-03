(()=>{
  const form=document.querySelector('[data-expanded-vehicle-form]');
  if(!form||!window.hotflashSupabase)return;
  const hpInput=form.elements.horsepower;
  const hpLabel=hpInput?.closest('label');
  if(!hpLabel)return;
  const block=document.createElement('div');
  block.className='full-span vehicle-stock-lookup';
  block.innerHTML=`<div><p class="eyebrow">Stock specification lookup</p><h3>Decode VIN & fill factory specs</h3><p class="small-muted">Optional. VIN decoding gives the most reliable engine and stock horsepower match. Suggested values remain editable for swaps, tunes, and modifications.</p></div><div class="vehicle-stock-grid"><label><span>VIN</span><input name="vin" data-vehicle-vin maxlength="17" minlength="11" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="17-character VIN"></label><button type="button" data-decode-vin>Decode & fill stock specs</button></div><p class="small-muted" data-stock-spec-status aria-live="polite"></p>`;
  hpLabel.parentElement.insertBefore(block,hpLabel);
  const powertrainDetails=form.querySelector('.build-category textarea[name="powertrain"]')?.closest('details');
  if(powertrainDetails){
    const fields=document.createElement('div');
    fields.className='vehicle-stock-fields';
    fields.innerHTML=`<label><span>Engine displacement</span><input name="engine_displacement" maxlength="40" placeholder="3.6 L"></label><label><span>Cylinders</span><input name="engine_cylinders" maxlength="30" placeholder="V6 / 6"></label><label><span>Aspiration</span><input name="aspiration" maxlength="60" placeholder="Naturally aspirated / turbocharged"></label><label><span>Drivetrain</span><input name="drivetrain" maxlength="40" placeholder="RWD / AWD / FWD / 4WD"></label><label><span>Transmission</span><input name="transmission" maxlength="100" placeholder="6-speed automatic"></label><label><span>Fuel type</span><input name="fuel_type" maxlength="60" placeholder="Gasoline"></label><label><span>Body style</span><input name="body_style" maxlength="80" placeholder="Sedan / coupe / pickup"></label><label><span>Factory trim</span><input name="factory_trim" maxlength="100" placeholder="Decoded factory trim"></label><input type="hidden" name="stock_specs_source" value=""><input type="hidden" name="stock_specs_decoded_at" value="">`;
    powertrainDetails.insertBefore(fields,powertrainDetails.querySelector('textarea'));
  }
  const vinInput=form.querySelector('[data-vehicle-vin]'),button=form.querySelector('[data-decode-vin]'),status=form.querySelector('[data-stock-spec-status]');
  const clean=v=>String(v||'').trim();
  const first=(data,...keys)=>{for(const key of keys){const value=clean(data?.[key]);if(value)return value}return''};
  function set(name,value,{overwrite=false}={}){const field=form.elements[name];if(!field||!value)return;if(overwrite||!clean(field.value))field.value=value}
  function hpValue(data){const raw=first(data,'EngineHP','EngineHP_to','EngineKW');if(!raw)return'';let n=Number(raw);if(!Number.isFinite(n)||n<=0)return'';if(!first(data,'EngineHP','EngineHP_to')&&first(data,'EngineKW'))n=Math.round(n*1.34102);return String(Math.round(n))}
  function engineText(data){const parts=[];const liters=first(data,'DisplacementL');const cylinders=first(data,'EngineCylinders');const config=first(data,'EngineConfiguration');const model=first(data,'EngineModel');const aspiration=first(data,'Turbo');if(liters)parts.push(`${liters}L`);if(config)parts.push(config);else if(cylinders)parts.push(`${cylinders}-cylinder`);if(model)parts.push(model);if(aspiration==='Yes')parts.push('turbocharged');return parts.join(' ')}
  async function decode(){
    const vin=clean(vinInput.value).toUpperCase().replace(/[^A-HJ-NPR-Z0-9*]/g,'');vinInput.value=vin;
    if(vin.length<11){status.textContent='Enter at least 11 VIN characters. A full 17-character VIN gives the best result.';status.className='small-muted error';return}
    button.disabled=true;button.textContent='Decoding…';status.textContent='Checking the manufacturer specification record…';status.className='small-muted';
    try{
      const year=window.hotFlashVehiclePicker?.getYear(new FormData(form))||'';
      const url=`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json${year?`&modelyear=${encodeURIComponent(year)}`:''}`;
      const response=await fetch(url,{headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`VIN service returned ${response.status}.`);
      const json=await response.json(),data=json.Results?.[0];if(!data)throw new Error('No vehicle record was returned.');
      const errorCode=clean(data.ErrorCode);if(errorCode&&errorCode!=='0'&&!first(data,'Make','Model'))throw new Error(first(data,'ErrorText')||'The VIN could not be decoded.');
      await window.hotFlashVehiclePicker?.setDecoded({year:first(data,'ModelYear'),make:first(data,'Make'),model:first(data,'Model')});
      set('trim',first(data,'Trim','Series'),{overwrite:true});set('factory_trim',first(data,'Trim','Series'),{overwrite:true});
      set('horsepower',hpValue(data),{overwrite:true});set('engine_displacement',first(data,'DisplacementL')?`${first(data,'DisplacementL')} L`:'',{overwrite:true});
      set('engine_cylinders',first(data,'EngineConfiguration','EngineCylinders'),{overwrite:true});set('aspiration',first(data,'Turbo')==='Yes'?'Turbocharged':first(data,'Turbo')==='No'?'Naturally aspirated':'',{overwrite:true});
      set('drivetrain',first(data,'DriveType'),{overwrite:true});set('transmission',[first(data,'TransmissionSpeeds'),first(data,'TransmissionStyle')].filter(Boolean).join('-speed '),{overwrite:true});
      set('fuel_type',first(data,'FuelTypePrimary','FuelTypeSecondary'),{overwrite:true});set('body_style',first(data,'BodyClass'),{overwrite:true});
      set('powertrain',engineText(data),{overwrite:false});set('stock_specs_source','NHTSA vPIC',{overwrite:true});set('stock_specs_decoded_at',new Date().toISOString(),{overwrite:true});
      const filled=['Make','Model',hpValue(data)&&'horsepower',first(data,'DisplacementL')&&'engine',first(data,'DriveType')&&'drivetrain'].filter(Boolean).join(', ');
      status.textContent=`Factory information filled${filled?`: ${filled}`:''}. Review it before saving—modified and swapped vehicles should be corrected manually.`;status.className='small-muted success';
    }catch(error){console.error('[Hot Flash VIN decode]',error);status.textContent=error.message||'The VIN could not be decoded. You can continue by entering the details manually.';status.className='small-muted error'}finally{button.disabled=false;button.textContent='Decode & fill stock specs'}
  }
  button.addEventListener('click',decode);vinInput.addEventListener('input',()=>{vinInput.value=vinInput.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9*]/g,'').slice(0,17)});
})();