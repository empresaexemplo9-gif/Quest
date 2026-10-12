export const ISO_X = 0.8;
export const ISO_Y = 0.44;

export function project({x,y}) {
 return {x:(x-y)*ISO_X,y:(x+y)*ISO_Y};
}
export function unproject({x,y}) {
 return {x:(x/ISO_X+y/ISO_Y)/2,y:(y/ISO_Y-x/ISO_X)/2};
}

// Abrigo art is drawn at its native resolution with the hub in the plaza.
export function cityCoordinates(position,region) {
 const relative=project({x:position.x-region.x-450,y:position.y-region.y-440});
 return {x:768+relative.x/1.45,y:620+relative.y/1.45};
}
export function insidePolygon(point,polygon) {
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
  if((yi>point.y)!==(yj>point.y)&&point.x<(xj-xi)*(point.y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
const CITY_SOLIDS=[
 [[0,0],[410,0],[410,350],[280,505],[0,620]],
 [[410,0],[1536,0],[1536,190],[1150,235],[920,275],[680,335],[530,255],[410,290]],
 [[1360,380],[1536,350],[1536,850],[1340,765],[1180,735],[1160,610]]
];
export function cityBlocked(position,region) {
 const point=cityCoordinates(position,region);
 return CITY_SOLIDS.some(polygon=>insidePolygon(point,polygon));
}
