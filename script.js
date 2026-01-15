// Made By bubbabaker2009
// Lobby, name selection, banned-name filter, and votekick (client-only demo)

const BANNED_WORDS = ['admin','moderator','banned','melon'];

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
  renderMembers();
}

function sanitizeName(n){
  if(!n) return '';
  return n.replace(/[^\w\-\s]/g,'').trim();
}

function validateName(n){
  const name = (n||'').toLowerCase();
  if(!name) return 'Name is required.';
  if(name.length < 2) return 'Name must be at least 2 characters.';
  for(const bad of BANNED_WORDS){
    if(bad && name.includes(bad)) return 'Name contains a banned word.';
  }
  return null;
}

function renderMembers(){
  const ul = document.getElementById('members-list');
  ul.innerHTML = '';
  // reload from storage to pick up other tabs' updates
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
  // toggle
  if(target.votes.has(voter.id)){
    target.votes.delete(voter.id);
  }else{
    target.votes.add(voter.id);
  }
  checkKick(target);
  broadcastChange();
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

document.addEventListener('DOMContentLoaded', ()=>{
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');
  const input = document.getElementById('room-input');
  const setNameBtn = document.getElementById('set-name-btn');
  const nameInput = document.getElementById('name-input');

  setNameBtn.addEventListener('click', ()=>{
    const raw = sanitizeName(nameInput.value);
    const err = validateName(raw);
    if(err){ alert(err); return }
    setName(raw);
    // If URL has room param, auto-join
    const room = getRoomFromURL();
    if(room){ showRoom(room.toUpperCase()) }
  });

  createBtn.addEventListener('click', ()=>{
    if(!state.me){ alert('Choose a name first.'); return }
    const id = makeRoomId();
    showRoom(id);
  });

  joinBtn.addEventListener('click', ()=>{
    if(!state.me){ alert('Choose a name first.'); return }
    const v = input.value && input.value.trim();
    if(!v){alert('Enter a room ID or create one');return}
    showRoom(v.toUpperCase());
  });

  // Auto-show name modal if not chosen
  document.getElementById('name-modal').style.display = 'flex';
  const room = getRoomFromURL();
  if(room){ /* wait for user to set name and auto-join */ }
});

// Made By bubbabaker2009 (end of file watermark)
