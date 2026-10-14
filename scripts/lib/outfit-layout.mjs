// Generated sheets are approximately 8x7; their horizontal separators need
// not fall exactly at height/7. Cut at the actual low-coverage row gaps.
export function outfitRows(png) {
 const coverage=new Uint32Array(png.height);
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  if(png.data[(y*png.width+x)*4+3]>=128)coverage[y]++;
 }
 const rows=[0];
 for(let row=1;row<7;row++){
  const expected=Math.floor(row*png.height/7),radius=Math.ceil(png.height/7*.35);
  let best=expected;
  for(let y=Math.max(rows.at(-1)+1,expected-radius);y<Math.min(png.height,expected+radius);y++){
   if(coverage[y]<coverage[best]||(coverage[y]===coverage[best]&&Math.abs(y-expected)<Math.abs(best-expected)))best=y;
  }
  // Use the middle of a clear separator so the sole has breathing room,
  // rather than placing the cut immediately after its final opaque pixel.
  if(coverage[best]===0){
   let left=best,right=best;
   while(left>Math.max(rows.at(-1)+1,expected-radius)&&coverage[left-1]===0)left--;
   while(right<Math.min(png.height-1,expected+radius-1)&&coverage[right+1]===0)right++;
   best=Math.floor((left+right)/2);
  }
  rows.push(best);
 }
 rows.push(png.height);
 return rows;
}
