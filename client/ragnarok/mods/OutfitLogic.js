export const OUTFITS=['novice','sword','mage','archer','acolyte','merchant','thief'];
export const OUTFIT_COLORS=['Natural','Vermelho','Azul','Verde','Violeta','Dourado','Prata','Preto'];
export function decodeOutfit(value){
 if(!Number.isInteger(value)||value<100||value>211)return null;
 const encoded=value-100,family=Math.floor(encoded/16),variant=encoded%16;
 return {family,name:OUTFITS[family],style:variant>=8?'epic':'standard',color:variant%8};
}
export function encodeOutfit(family,epic=false,color=0){
 if(!Number.isInteger(family)||family<0||family>6||!Number.isInteger(color)||color<0||color>7)throw Error('Invalid outfit');
 return 100+family*16+(epic?8:0)+color;
}
export function encodeCreationPlan(family,level,color=0){
 encodeOutfit(family,false,color);
 if(!Number.isInteger(level)||level<1||level>275)throw Error('Invalid GM level');
 return 10000+family*2300+(level-1)*8+color;
}
