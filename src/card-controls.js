// Applied at tracked-repost boundaries, never to native previews or unowned replies.
export const isCardMenuId = value => /^manage:open:\d{1,2}$/.test(value || '');
export function withCardControls(nodes) {
 let index=0;
 const result=nodes.map(node=>{
  const card=structuredClone(node.toJSON?.()??node);
  if(card.type!==17)return card;
  const first=card.components?.[0];
  const heading=first?.type===10?first:first?.type===9&&first.components?.length===1&&first.components[0]?.type===10&&(isCardMenuId(first.accessory?.custom_id)||first.accessory?.custom_id==='ellipsis-test:open:v1')?first.components[0]:null;
  if(!heading){
   // Legacy media-only cards have no title to decorate. Keep their content intact.
   card.components=card.components.filter(c=>!(c.type===1&&c.components?.every(b=>isCardMenuId(b.custom_id))));
   card.components.push({type:1,components:[{type:2,style:2,label:'⋯',custom_id:`manage:open:${index++}`}]});return card;
  }
  card.components[0]={type:9,components:[heading],accessory:{type:2,style:2,label:'⋯',custom_id:`manage:open:${index++}`}};
  return card;
 });
 let count=0;function visit(items){for(const x of items){count++;if(x.components)visit(x.components);if(x.accessory)visit([x.accessory]);}}
 visit(result);if(count>40)throw Error('Card component limit');
 return result;
}
