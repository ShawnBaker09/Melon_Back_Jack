// script.js — minimal Supabase interactions for creating/joining rooms
const roomInput = document.getElementById('room-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomIdSpan = document.getElementById('room-id');
const membersList = document.getElementById('members-list');
const wsStatus = document.getElementById('ws-status');
let displayName = null;

// Attempt to read name from modal-set value
const nameInput = document.getElementById('name-input');
const setNameBtn = document.getElementById('set-name-btn');
setNameBtn.addEventListener('click', () => {
  displayName = (nameInput.value || '').trim();
  if (!displayName) {
    alert('Please enter a display name');
    return;
  }
  document.getElementById('name-modal').classList.add('hidden');
});

// Create room: inserts into rooms and adds creator as player
createBtn.addEventListener('click', async () => {
  if (!displayName) {
    alert('Set your display name first');
    return;
  }
  try {
    const { data: room, error: roomErr } = await window.supabase
      .from('rooms')
      .insert([{ host: displayName }])
      .select()
      .single();

    if (roomErr) throw roomErr;

    roomIdSpan.textContent = room.id;
    wsStatus.textContent = 'connected';
    membersList.innerHTML = '';
    addMember(displayName, true);

    // insert player
    const { error: playerErr } = await window.supabase
      .from('players')
      .insert([{ room_id: room.id, name: displayName }]);

    if (playerErr) console.error('Failed to add player:', playerErr);
  } catch (err) {
    console.error(err);
    alert('Error creating room: ' + (err.message || err));
  }
});

// Join room: read room then insert player
joinBtn.addEventListener('click', async () => {
  if (!displayName) {
    alert('Set your display name first');
    return;
  }
  const roomId = (roomInput.value || '').trim() || window.location.hash.replace('#','');
  if (!roomId) {
    alert('Enter a room id or open link with #roomId');
    return;
  }
  try {
    const { data: rooms, error: roomErr } = await window.supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .limit(1);

    if (roomErr) throw roomErr;
    if (!rooms || rooms.length === 0) {
      alert('Room not found');
      return;
    }

    roomIdSpan.textContent = roomId;
    wsStatus.textContent = 'connected';
    membersList.innerHTML = '';

    // insert player
    const { data: playerData, error: playerErr } = await window.supabase
      .from('players')
      .insert([{ room_id: roomId, name: displayName }])
      .select();

    if (playerErr) throw playerErr;

    // fetch members
    const { data: members } = await window.supabase
      .from('players')
      .select('name')
      .eq('room_id', roomId);

    membersList.innerHTML = '';
    members.forEach(m => addMember(m.name, m.name === rooms[0].host));
  } catch (err) {
    console.error(err);
    alert('Error joining room: ' + (err.message || err));
  }
});

function addMember(name, isHost=false) {
  const li = document.createElement('li');
  li.textContent = name + (isHost ? ' (Host)' : '');
  membersList.appendChild(li);
}
