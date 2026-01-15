// Made By bubbabaker2009
// Lobby, name selection, banned-name filter, and votekick (client-only demo)

// Banned words list (lowercase). Add words here to block them from display names.
const BANNED_WORDS = ['admin','moderator','banned','melon','nigger'];

// WebSocket server config (change if you host the server elsewhere)
// The client will accept a `ws` query param (wss://...) or the `window.MBJ_WS` value.
let ws = null;
let useServer = false;

// Supabase integration flag
let useSupabase = false;

async function createRoomSupabase(displayName){
  const roomId = makeRoomId();
  try{
    await window.supabase.from('rooms').insert({ id: roomId, host: displayName });
    await window.supabase.from('players').insert({ room_id: roomId, name: displayName });
    return roomId;
  }catch(e){ console.error('supabase createRoom failed', e); throw e }
}

async function joinRoomSupabase(roomId, displayName){
  const { data } = await window.supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if(!data){ alert('Room not found'); return false }
  await window.supabase.from('players').insert({ room_id: roomId, name: displayName });
  return true;
}

async function fetchPlayers(roomId){
  const { data } = await window.supabase.from('players').select('id,name').eq('room_id', roomId);
  const { data: room } = await window.supabase.from('rooms').select('host').eq('id', roomId).maybeSingle();
  const hostName = room ? room.host : null;
  if(!data) return [];
  return data.map(p=>({id: String(p.id), name: p.name, isHost: (p.name === hostName), votes: new Set()}));
}

function subscribeLobbySupabase(roomId){
  const channel = window.supabase.channel('lobby-' + roomId);
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, async () => {
    state.members = await fetchPlayers(roomId);
    renderMembers();
  });
  channel.subscribe();
}

function getInitialWS(){
  const params = new URLSearchParams(window.location.search);
  if(params.get('ws')) return params.get('ws');
  if(window.MBJ_WS) return window.MBJ_WS;
  // local default for testing (not used on GitHub Pages)
  if(location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:3000';
  return null;
}

function isValidWsUrl(u){
  if(!u) return false;
  try{
    const url = new URL(u);
    return url.protocol === 'ws:' || url.protocol === 'wss:';
  }catch(e){return false}
}

function makeRoomId(){
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

function getRoomFromURL(){
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

// Simple in-memory lobby stored per-room in localStorage so tabs on same machine can share state.
function storageKey(roomId){return 'mbj:lobby:' + roomId}

let state = {
  me: null, // {id, name}
  room: null,
  members: [] // [{id,name,isHost,votes:Set()}]
};

function saveLobby(){
  if(!state.room) return;
  const key = storageKey(state.room);
  const dump = state.members.map(m=>({id:m.id,name:m.name,isHost:m.isHost,votes:Array.from(m.votes||[])}));
  localStorage.setItem(key, JSON.stringify(dump));
}

function loadLobby(){
  if(!state.room) return;
  const key = storageKey(state.room);
  const raw = localStorage.getItem(key);
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    state.members = parsed.map(p=>({id:p.id,name:p.name,isHost:p.isHost,votes:new Set(p.votes||[])}));
  }catch(e){console.warn('failed load lobby',e)}
}

function broadcastChange(){
  saveLobby();
  renderMembers();
}

function createMember(name,isHost){
  return {id:Math.random().toString(36).slice(2,9),name, isHost:!!isHost, votes:new Set()}
}

function setName(name){
  state.me = {id:Math.random().toString(36).slice(2,9),name};
  document.getElementById('name-modal').style.display = 'none';
}

function showRoom(id){
  state.room = id;
  document.getElementById('room-id').textContent = id;
  const link = window.location.origin + window.location.pathname + '?room=' + encodeURIComponent(id);
  const a = document.getElementById('room-link');
  a.href = link;
  a.textContent = 'Copy/share this link';
  a.onclick = (e)=>{e.preventDefault();navigator.clipboard.writeText(link);a.textContent='Copied!';setTimeout(()=>a.textContent='Copy/share this link',1800)};
  document.getElementById('room').classList.remove('hidden');
  document.getElementById('game').classList.remove('hidden');
  // load existing lobby and add self if missing
  // If server available, prefer server state. Ensure WS connection and send join.
  // Ensure WS connection. If a WS URL was provided via query param or UI, use it.
  const initial = getInitialWS();
  if(initial){ window.MBJ_WS = initial; }
  connectWS();
  if(window.MBJ_WS && ws && ws.readyState === WebSocket.OPEN){
    useServer = true;
    ws.send(JSON.stringify({type:'join', room: state.room, id: state.me.id, name: state.me.name}));
    // server will provide canonical member list
  }else{
    useServer = false;
    loadLobby();
    const exists = state.members.find(m=>m.name === state.me.name && m.id === state.me.id);
    if(!exists){
      // If no host yet, first member becomes host
      const hasHost = state.members.some(m=>m.isHost);
      const member = createMember(state.me.name, !hasHost);
      // ensure our local id stays consistent so votes persist locally
      member.id = state.me.id;
      state.members.push(member);
      broadcastChange();
    }
  }
  renderMembers();
}

function sanitizeName(n){
  if(!n) return '';
  return n.replace(/[^\w\-\s@!$#%\^&*\(\)\+\=\[\]{}|;:'",.<>\/\\?]/g,'').trim();
}

function normalizeText(s){
  // basic normalization to catch common leetspeak substitutions
  return s.toLowerCase()
    .replace(/[@4]/g,'a')
    .replace(/[3]/g,'e')
    .replace(/[1!\|]/g,'i')
    .replace(/[0]/g,'o')
    .replace(/[5\$]/g,'s')
    .replace(/[7]/g,'t')
    .replace(/[^a-z0-9]/g,'')
    .replace(/(.)\1+/g,'$1');
}

function validateName(n){
  const raw = (n||'').trim();
  const name = raw.toLowerCase();
  if(!name) return 'Name is required.';
  if(name.length < 2) return 'Name must be at least 2 characters.';
  const norm = normalizeText(name);
  for(const bad of BANNED_WORDS){
    if(!bad) continue;
    // check both raw and normalized forms
    if(name.includes(bad) || norm.includes(bad)) return 'Name contains a banned word.';
  }
  return null;
}

function renderMembers(){
  const ul = document.getElementById('members-list');
  ul.innerHTML = '';
  // reload from storage to pick up other tabs' updates (fallback)
  loadLobby();
  state.members.forEach(member=>{
    const li = document.createElement('li');
    li.className = 'member';
    const meta = document.createElement('div'); meta.className='meta';
    const nameSpan = document.createElement('span'); nameSpan.textContent = member.name;
    meta.appendChild(nameSpan);
    if(member.isHost){
      const hostBadge = document.createElement('span'); hostBadge.className='host-badge'; hostBadge.textContent='Host'; meta.appendChild(hostBadge);
    }
    const right = document.createElement('div');
    // vote count
    const count = document.createElement('span'); count.className='vote-count'; count.textContent = member.votes.size || 0;
    // vote button (cannot vote against host or self)
    const voteBtn = document.createElement('button'); voteBtn.className='vote-btn';
    voteBtn.textContent = 'Vote Kick';
    if(member.isHost || member.id === state.me.id){ voteBtn.disabled = true; voteBtn.style.opacity = 0.5 }
    voteBtn.onclick = ()=>{ toggleVote(member.id) };
    right.appendChild(count); right.appendChild(voteBtn);

    li.appendChild(meta); li.appendChild(right);
    ul.appendChild(li);
  });
}

function toggleVote(targetId){
  // find target and voter
  const target = state.members.find(m=>m.id===targetId);
  if(!target) return;
  if(target.isHost) { alert('Cannot vote to kick the host.'); return }
  const voter = state.members.find(m=>m.id===state.me.id);
  if(!voter) return;
  // If connected to server, send vote message. Otherwise fallback to local behavior.
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify({type:'vote', room: state.room, voterId: state.me.id, targetId}));
  }else{
    // toggle locally
    if(target.votes.has(voter.id)) target.votes.delete(voter.id); else target.votes.add(voter.id);
    checkKick(target);
    broadcastChange();
  }
}

function checkKick(target){
  const total = state.members.length;
  const votes = target.votes.size;
  const threshold = Math.ceil(total/2); // majority
  if(votes >= threshold){
    // remove member
    state.members = state.members.filter(m=>m.id !== target.id);
    alert(target.name + ' has been kicked from the lobby.');
  }
}

window.addEventListener('storage', (e)=>{
  // respond to lobby changes from other tabs
  if(!state.room) return;
  if(e.key === storageKey(state.room)){
    loadLobby(); renderMembers();
  }
});

function connectWS(){
  if(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const url = window.MBJ_WS || getInitialWS();
  const url = window.MBJ_WS || getInitialWS();
  if(!url){ updateWsStatus('no server'); return } // no configured server
  if(!isValidWsUrl(url)){ updateWsStatus('invalid ws url'); console.warn('Invalid WS URL:', url); return }
  try{ ws = new WebSocket(url); }catch(e){ console.warn('WS connect failed', e); updateWsStatus('connect failed'); return }
  ws.addEventListener('open', ()=>{
    useServer = true;
    updateWsStatus('connected');
    // send join if we're in a room
    if(state.room && state.me){ ws.send(JSON.stringify({type:'join', room: state.room, id: state.me.id, name: state.me.name})); }
  });
  ws.addEventListener('message', (ev)=>{
    let data; try{ data = JSON.parse(ev.data); }catch(e){return}
    if(data.type === 'state'){
      // replace members with canonical server state
      state.members = (data.members||[]).map(m=>({id:m.id,name:m.name,isHost:m.isHost,votes:new Set(m.votes||[])}));
      renderMembers();
    }else if(data.type === 'kicked'){
      alert('You were kicked from the lobby.');
      // leave room locally
      state.room = null; state.members = [];
      // remove room query from URL
      history.replaceState({},'',location.pathname);
      document.getElementById('room').classList.add('hidden');
      document.getElementById('game').classList.add('hidden');
      document.getElementById('name-modal').style.display = 'flex';
    }
  });
  ws.addEventListener('close', ()=>{ console.log('WS closed'); ws = null; useServer=false; updateWsStatus('disconnected'); });
}

function updateWsStatus(s){
  const el = document.getElementById('ws-status'); if(!el) return; el.textContent = s;
}

document.addEventListener('DOMContentLoaded', ()=>{
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');
  const input = document.getElementById('room-input');
  const wsInput = document.getElementById('ws-input');
  const setNameBtn = document.getElementById('set-name-btn');
  const nameInput = document.getElementById('name-input');

  setNameBtn.addEventListener('click', ()=>{
    const raw = sanitizeName(nameInput.value);
    const err = validateName(raw);
    if(err){ alert(err); return }
    setName(raw);
    // If URL has room param, auto-join
    const room = getRoomFromURL();
    // if ws param present, populate ws input
    const params = new URLSearchParams(window.location.search);
    if(params.get('ws')){ wsInput.value = params.get('ws'); window.MBJ_WS = params.get('ws'); }
    // if saved server in localStorage, populate
    const saved = localStorage.getItem('mbj:ws'); if(saved && !wsInput.value){ wsInput.value = saved; window.MBJ_WS = saved }
    // connection attempt and supabase check
    if(window.supabase){ useSupabase = true; }
    connectWS();
    if(useSupabase){
      // if room param present and using supabase, join via supabase
      if(room){
        joinRoomSupabase(room.toUpperCase(), state.me.name).then(ok=>{ if(ok){ state.room = room.toUpperCase(); subscribeLobbySupabase(state.room); fetchPlayers(state.room).then(players=>{ state.members = players; renderMembers(); }); } });
      }
    }else{
      if(room){ showRoom(room.toUpperCase()) }
    }
  });

  // allow setting server URL in the page (so GitHub Pages users can paste a wss:// URL)
  wsInput.addEventListener('change', ()=>{
    const v = wsInput.value && wsInput.value.trim();
    if(!v) return; window.MBJ_WS = v; localStorage.setItem('mbj:ws', v); connectWS();
  });

  createBtn.addEventListener('click', ()=>{
    if(!state.me){ alert('Choose a name first.'); return }
    if(useSupabase){
      createRoomSupabase(state.me.name).then(id=>{ state.room = id; subscribeLobbySupabase(id); fetchPlayers(id).then(players=>{ state.members = players; renderMembers(); }); const link = window.location.origin + window.location.pathname + '?room=' + encodeURIComponent(id); navigator.clipboard.writeText(link); alert('Room created: ' + id); });
    }else{
      const id = makeRoomId();
      showRoom(id);
    }
  });

  joinBtn.addEventListener('click', ()=>{
    if(!state.me){ alert('Choose a name first.'); return }
    const v = input.value && input.value.trim();
    if(!v){alert('Enter a room ID or create one');return}
    if(useSupabase){
      joinRoomSupabase(v.toUpperCase(), state.me.name).then(ok=>{ if(ok){ state.room = v.toUpperCase(); subscribeLobbySupabase(state.room); fetchPlayers(state.room).then(players=>{ state.members = players; renderMembers(); }); } });
    }else{
      showRoom(v.toUpperCase());
    }
  });

  // Auto-show name modal if not chosen
  document.getElementById('name-modal').style.display = 'flex';
  const room = getRoomFromURL();
  if(room){ /* wait for user to set name and auto-join */ }
  // if ws param present in URL and name already set, store and connect
  const params = new URLSearchParams(window.location.search);
  if(params.get('ws')){ window.MBJ_WS = params.get('ws'); localStorage.setItem('mbj:ws', params.get('ws')); }
  // update status initially
  updateWsStatus('disconnected');
});

// Made By bubbabaker2009 (end of file watermark)
