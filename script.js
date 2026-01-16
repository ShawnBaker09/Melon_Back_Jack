// Simple WebSocket lobby server for Melon_Back_Jack
// Made By bubbabaker2009

const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// rooms: roomId -> { members: Map(id -> member) }
const rooms = new Map();

function broadcastRoom(roomId){
  const room = rooms.get(roomId);
  if(!room) return;
  const payload = {
    type: 'state',
    members: Array.from(room.members.values()).map(m=>({id:m.id,name:m.name,isHost:m.isHost,votes:Array.from(m.votes)}))
  };
  const msg = JSON.stringify(payload);
  for(const m of room.members.values()){
    try{ m.ws.send(msg); }catch(e){}
  }
}

function ensureRoom(roomId){
  if(!rooms.has(roomId)) rooms.set(roomId, { members: new Map() });
  return rooms.get(roomId);
}

function promoteHostIfNeeded(room){
  const hasHost = Array.from(room.members.values()).some(m=>m.isHost);
  if(!hasHost){
    const first = room.members.values().next();
    if(!first.done){ first.value.isHost = true }
  }
}

function handleJoin(ws, data){
  const {room, id, name} = data;
  if(!room || !id) return;
  const r = ensureRoom(room);
  const hasHost = Array.from(r.members.values()).some(m=>m.isHost);
  r.members.set(id, {id,name,isHost:!hasHost,ws,votes:new Set()});
  ws.room = room; ws.memberId = id;
  broadcastRoom(room);
}

function handleLeave(ws){
  const roomId = ws.room;
  const id = ws.memberId;
  if(!roomId || !rooms.has(roomId)) return;
  const r = rooms.get(roomId);
  r.members.delete(id);
  promoteHostIfNeeded(r);
  broadcastRoom(roomId);
}

function handleVote(ws, data){
  const {room, voterId, targetId} = data;
  if(!room || !rooms.has(room)) return;
  const r = rooms.get(room);
  const voter = r.members.get(voterId);
  const target = r.members.get(targetId);
  if(!voter || !target) return;
  if(target.isHost) return; // cannot vote kick host
  if(target.votes.has(voterId)) target.votes.delete(voterId); else target.votes.add(voterId);
  // check majority
  const total = r.members.size;
  const votes = target.votes.size;
  const threshold = Math.ceil(total/2);
  if(votes >= threshold){
    // notify kicked
    try{ target.ws.send(JSON.stringify({type:'kicked',reason:'voted'})); }catch(e){}
    r.members.delete(targetId);
  }
  promoteHostIfNeeded(r);
  broadcastRoom(room);
}

wss.on('connection', (ws)=>{
  ws.on('message', (msg)=>{
    let data; try{ data = JSON.parse(msg.toString()) }catch(e){return}
    const t = data.type;
    if(t === 'join') handleJoin(ws, data);
    else if(t === 'leave') handleLeave(ws);
    else if(t === 'vote') handleVote(ws, data);
  });
  ws.on('close', ()=>{ handleLeave(ws); });
});

console.log('Melon_Back_Jack WS server running on port', PORT);
