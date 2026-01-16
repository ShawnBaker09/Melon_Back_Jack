// script.js — Supabase-only lobby logic (GitHub Pages compatible)

const roomInput = document.getElementById('room-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomIdSpan = document.getElementById('room-id');
const membersList = document.getElementById('members-list');
const wsStatus = document.getElementById('ws-status');

const nameInput = document.getElementById('name-input');
const setNameBtn = document.getElementById('set-name-btn');

let displayName = null;
let currentRoomId = null;

/* ================= NAME MODAL ================= */

setNameBtn.addEventListener('click', () => {
  displayName = (nameInput.value || '').trim();
  if (!displayName) {
    alert('Please enter a display name');
    return;
  }
  document.getElementById('name-modal').classList.add('hidden');
});

/* ================= REALTIME ================= */

function subscribeToRoom(roomId) {
  currentRoomId = roomId;

  window.supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      },
      () => refreshMembers(roomId)
    )
    .subscribe();
}

async function refreshMembers(roomId) {
  const { data, error } = await window.supabase
    .from('players')
    .select('name')
    .eq('room_id', roomId);

  if (error) {
    console.error(error);
    return;
  }

  membersList.innerHTML = '';
  data.forEach(m => addMember(m.name));
}

/* ================= CREATE ROOM ================= */

createBtn.addEventListener('click', async () => {
  if (!displayName) {
    alert('Set your display name first');
    return;
  }

  try {
    const { data: room, error } = await window.supabase
      .from('rooms')
      .insert([{ host: displayName }])
      .select()
      .single();

    if (error) throw error;

    roomIdSpan.textContent = room.id;
    wsStatus.textContent = 'connected';

    await window.supabase
      .from('players')
      .insert([{ room_id: room.id, name: displayName }]);

    subscribeToRoom(room.id);
    refreshMembers(room.id);

    window.location.hash = room.id;
  } catch (err) {
    console.error(err);
    alert('Error creating room');
  }
});

/* ================= JOIN ROOM ================= */

joinBtn.addEventListener('click', async () => {
  if (!displayName) {
    alert('Set your display name first');
    return;
  }

  const roomId =
    (roomInput.value || '').trim() ||
    window.location.hash.replace('#', '');

  if (!roomId) {
    alert('Enter a room ID');
    return;
  }

  try {
    const { data: rooms, error } = await window.supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .limit(1);

    if (error || !rooms.length) {
      alert('Room not found');
      return;
    }

    roomIdSpan.textContent = roomId;
    wsStatus.textContent = 'connected';

    await window.supabase
      .from('players')
      .insert([{ room_id: roomId, name: displayName }]);

    subscribeToRoom(roomId);
    refreshMembers(roomId);

    window.location.hash = roomId;
  } catch (err) {
    console.error(err);
    alert('Error joining room');
  }
});

/* ================= UI ================= */

function addMember(name) {
  const li = document.createElement('li');
  li.textContent = name;
  membersList.appendChild(li);
}
