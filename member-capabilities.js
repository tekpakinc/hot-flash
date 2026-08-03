(()=>{
  const cache=new Map();
  async function session(){return window.hotFlashGetStableSession?window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session}
  async function has(code,userId){
    const current=userId||(await session())?.user?.id;
    if(!current||!code)return false;
    const key=`${current}:${code}`;
    if(cache.has(key))return cache.get(key);
    const{data,error}=await hotflashSupabase.rpc('has_member_capability',{p_code:code,p_user_id:current});
    const value=!error&&Boolean(data);cache.set(key,value);return value;
  }
  async function profileState(userId){
    const current=userId||(await session())?.user?.id;if(!current)return null;
    const{data,error}=await hotflashSupabase.from('profiles').select('id,is_verified,member_tier,verified_membership_status,verified_membership_expires_at').eq('id',current).maybeSingle();
    return error?null:data;
  }
  async function publicTags(userId){
    if(!userId)return[];
    const{data,error}=await hotflashSupabase.from('member_capabilities').select('capability_code,member_capability_types!inner(code,name,description,icon,is_public_tag)').eq('user_id',userId).eq('is_active',true).eq('member_capability_types.is_public_tag',true);
    return error?[]:(data||[]).map(row=>row.member_capability_types).filter(Boolean);
  }
  function clear(){cache.clear()}
  window.HotFlashCapabilities={has,profileState,publicTags,clear};
})();