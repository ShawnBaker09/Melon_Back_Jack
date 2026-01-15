// Made By bubbabaker2009
// Room ID generation and simple join logic

function makeRoomId(){
  // 6 char alphanumeric room id
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

function getRoomFromURL(){
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

function showRoom(id){
  document.getElementById('room-id').textContent = id;
  const link = window.location.origin + window.location.pathname + '?room=' + encodeURIComponent(id);
  const a = document.getElementById('room-link');
  a.href = link;
  a.textContent = 'Copy/share this link';
  a.addEventListener('click', (e)=>{e.preventDefault();navigator.clipboard.writeText(link);a.textContent='Copied!';setTimeout(()=>a.textContent='Copy/share this link',1800)});
  document.getElementById('room').classList.remove('hidden');
  document.getElementById('game').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');
  const input = document.getElementById('room-input');

  createBtn.addEventListener('click', ()=>{
    const id = makeRoomId();
    showRoom(id);
  });

  joinBtn.addEventListener('click', ()=>{
    const v = input.value && input.value.trim();
    if(!v){alert('Enter a room ID or create one');return}
    showRoom(v.toUpperCase());
  });

  // Auto-join if ?room= is present
  const room = getRoomFromURL();
  if(room){
    showRoom(room.toUpperCase());
  }
});

// Made By bubbabaker2009 (end of file watermark)
