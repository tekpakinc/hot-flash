(()=>{
 const typeSelect=document.querySelector('[data-vehicle-type]'),makeSelect=document.querySelector('[data-make-select]'),modelSelect=document.querySelector('[data-model-select]');
 if(!typeSelect||!makeSelect||!modelSelect||!window.hotflashSupabase)return;
 const addOptions=(select,labels)=>{const existing=new Set([...select.options].map(o=>o.value.toLowerCase()));const other=[...select.options].find(o=>o.value==='other');for(const label of labels){if(!label||existing.has(label.toLowerCase()))continue;const option=document.createElement('option');option.value=option.textContent=label;select.insertBefore(option,other||null);existing.add(label.toLowerCase())}}
 async function rows(category,parent=null){let q=hotflashSupabase.from('vehicle_catalog_options').select('label,parent_label').eq('active',true).eq('category',category).eq('vehicle_type',typeSelect.value||'automobile').order('sort_order').order('label');if(parent)q=q.ilike('parent_label',parent);const{data,error}=await q;if(error){console.warn('[Hot Flash custom vehicle options]',error);return[]}return data||[]}
 async function mergeMakes(){addOptions(makeSelect,(await rows('make')).map(x=>x.label))}
 async function mergeModels(){if(!makeSelect.value||makeSelect.value==='other')return;addOptions(modelSelect,(await rows('model',makeSelect.value)).map(x=>x.label))}
 typeSelect.addEventListener('change',()=>setTimeout(mergeMakes,500));
 makeSelect.addEventListener('change',()=>setTimeout(mergeModels,500));
 makeSelect.addEventListener('focus',mergeMakes);
 modelSelect.addEventListener('focus',mergeModels);
 setTimeout(mergeMakes,700);
})();