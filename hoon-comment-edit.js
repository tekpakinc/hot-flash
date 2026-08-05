(()=>{
  const root=document.querySelector('[data-hoon-comments-list]');
  if(!root||!window.hotflashSupabase)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let decorating=false;

  function styleOnce(){
    if(document.querySelector('[data-hoon-comment-edit-style]'))return;
    const style=document.createElement('style');
    style.dataset.hoonCommentEditStyle='';
    style.textContent=`
      .hoon-comment-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .hoon-comment-actions button{min-height:36px;padding:0 12px;font-size:.76rem}
      .hoon-comment-edited{margin-left:6px;color:var(--muted);font-size:.76rem;font-weight:600}
      .hoon-comment-edit-form{display:grid;gap:10px;margin-top:10px}
      .hoon-comment-edit-form textarea{min-height:88px;resize:vertical}
      .hoon-comment-edit-buttons{display:flex;gap:8px;flex-wrap:wrap}
      @media(max-width:560px){.hoon-comment-edit-buttons button{flex:1 1 120px}}
    `;
    document.head.appendChild(style);
  }

  async function markEdited(cards){
    const ids=cards.map(card=>card.querySelector('[data-delete-comment]')?.dataset.deleteComment).filter(Boolean);
    if(!ids.length)return;
    const{data}=await hotflashSupabase.from('hoon_comments').select('id,created_at,updated_at').in('id',ids);
    const map=new Map((data||[]).map(row=>[row.id,row]));
    cards.forEach(card=>{
      const id=card.querySelector('[data-delete-comment]')?.dataset.deleteComment,row=map.get(id);
      if(!row?.updated_at||!row?.created_at)return;
      if(new Date(row.updated_at).getTime()-new Date(row.created_at).getTime()<1000)return;
      const meta=card.querySelector('div span');
      if(meta&&!card.querySelector('.hoon-comment-edited'))meta.insertAdjacentHTML('beforeend','<span class="hoon-comment-edited"> · edited</span>');
    });
  }

  function beginEdit(card,id){
    if(card.querySelector('.hoon-comment-edit-form'))return;
    const body=card.querySelector('p');
    if(!body)return;
    const original=body.textContent;
    body.hidden=true;
    const actions=card.querySelector('.hoon-comment-actions');
    if(actions)actions.hidden=true;
    const form=document.createElement('form');
    form.className='hoon-comment-edit-form';
    form.innerHTML=`<textarea maxlength="500" required>${esc(original)}</textarea><div class="hoon-comment-edit-buttons"><button type="submit">Save changes</button><button type="button" class="secondary-button" data-cancel-edit>Cancel</button></div><p class="small-muted" aria-live="polite"></p>`;
    card.appendChild(form);
    const textarea=form.querySelector('textarea'),status=form.querySelector('p'),save=form.querySelector('button[type="submit"]');
    textarea.focus();textarea.setSelectionRange(textarea.value.length,textarea.value.length);
    const cancel=()=>{form.remove();body.hidden=false;if(actions)actions.hidden=false};
    form.querySelector('[data-cancel-edit]').onclick=cancel;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const value=textarea.value.trim();
      if(!value){status.textContent='Comment cannot be empty.';status.className='small-muted error';return}
      if(value===original.trim()){cancel();return}
      save.disabled=true;save.textContent='Saving…';status.textContent='';
      const{data,error}=await hotflashSupabase.rpc('update_own_hoon_comment',{p_comment_id:id,p_body:value});
      if(error){status.textContent=error.message||'Comment could not be updated.';status.className='small-muted error';save.disabled=false;save.textContent='Save changes';return}
      body.textContent=data?.body||value;
      const meta=card.querySelector('div span');
      if(meta&&!card.querySelector('.hoon-comment-edited'))meta.insertAdjacentHTML('beforeend','<span class="hoon-comment-edited"> · edited</span>');
      cancel();
    });
  }

  async function decorate(){
    if(decorating)return;decorating=true;styleOnce();
    try{
      const cards=[...root.querySelectorAll('.hoon-comment')];
      for(const card of cards){
        const del=card.querySelector('[data-delete-comment]');
        if(!del||card.querySelector('[data-edit-comment]'))continue;
        let actions=del.closest('.hoon-comment-actions');
        if(!actions){actions=document.createElement('div');actions.className='hoon-comment-actions';del.parentNode.insertBefore(actions,del);actions.appendChild(del)}
        const edit=document.createElement('button');
        edit.type='button';edit.className='secondary-button';edit.dataset.editComment=del.dataset.deleteComment;edit.textContent='Edit';
        edit.onclick=()=>beginEdit(card,edit.dataset.editComment);
        actions.insertBefore(edit,del);
      }
      await markEdited(cards);
    }finally{decorating=false}
  }

  const observer=new MutationObserver(()=>decorate());
  observer.observe(root,{childList:true,subtree:true});
  decorate();
})();
