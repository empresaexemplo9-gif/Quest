export function touchCapable(navigator,mediaMatches=false){return Number(navigator.maxTouchPoints)>0||/iPad|iPhone|Android|Mobi/i.test(navigator.userAgent||'')||mediaMatches;}
export function stickDirection(x,y,cameraDirection=0,deadZone=.2){
 if(Math.hypot(x,y)<deadZone)return [0,0];
 const angle=-cameraDirection*Math.PI/4,worldX=x*Math.cos(angle)+y*Math.sin(angle),worldY=x*Math.sin(angle)-y*Math.cos(angle);
 const heading=Math.round(Math.atan2(worldY,worldX)/(Math.PI/4));
 return [Math.round(Math.cos(heading*Math.PI/4)),Math.round(Math.sin(heading*Math.PI/4))];
}
export function nearbyTargets(player,entities,{range=14,limit=6}={}){
 if(!player?.position)return [];
 return entities.filter(entity=>entity!==player&&entity.objecttype===5&&entity.position&&entity.action!==entity.ACTION?.DIE&&entity.life?.hp!==0)
 .map(entity=>({entity,distance:Math.hypot(entity.position[0]-player.position[0],entity.position[1]-player.position[1])}))
 .filter(row=>row.distance<=range).sort((a,b)=>a.distance-b.distance||a.entity.GID-b.entity.GID).slice(0,limit);
}
export function preserveTargetSlots(previous,nearest){
 const available=new Map(nearest.map(row=>[row.entity.GID,row])),slots=previous.map(row=>row&&available.get(row.entity.GID)||null);
 const used=new Set(slots.filter(Boolean).map(row=>row.entity.GID));
 for(const row of nearest){if(used.has(row.entity.GID))continue;const at=slots.indexOf(null);if(at<0)break;slots[at]=row;used.add(row.entity.GID);}
 return slots;
}
export function adjacentDestination(position,direction,isWalkable){
 const x=Math.round(position[0]),y=Math.round(position[1]),[dx,dy]=direction;
 if(!dx&&!dy)return null;
 const candidates=[[x+dx,y+dy]];
 if(dx&&dy)candidates.push([x+dx,y],[x,y+dy]);
 for(const candidate of candidates)if(isWalkable(...candidate))return candidate;
 return null;
}
