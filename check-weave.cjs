/* Geometry/control checks in a minimal DOM and Canvas recorder. No browser or dependencies. */
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function run(reduced){
 let points=[],frameId=0,clock=100,queue=new Map(),frames=0;
 const element=(dataset={})=>({dataset,events:{},hidden:false,value:'14.5',classList:{add(){}},addEventListener(n,f){this.events[n]=f},setAttribute(){},getBoundingClientRect(){return {width:1100,height:560}}});
 const context=new Proxy({clearRect(){points=[]},moveTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));points.push([x,y])},lineTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));points.push([x,y])}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas=element();canvas.getContext=()=>context;
 const play=element(),scrub=element(),map={canvas,'#play-story':play,'#weave-position':scrub,'#weave-caption':element(),'#weave-phase':element(),'.motion-note':element()};
 const root=element();root.querySelector=q=>map[q];root.querySelectorAll=q=>q==='[data-topic]'?['customers','operations','risk'].map(t=>element({topic:t})):[];
 const win={addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'weave.js'),'utf8'),{window:win,document:{querySelector:()=>root,addEventListener(){}},matchMedia:()=>({matches:reduced,addEventListener(){}}),devicePixelRatio:1,ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},requestAnimationFrame(f){queue.set(++frameId,f);return frameId},cancelAnimationFrame(id){queue.delete(id)}});
 const settle=()=>{let steps=0;while(queue.size){assert.ok(++steps<2000,'Animation must settle');const callbacks=[...queue.values()];queue.clear();clock+=34;callbacks.forEach(f=>f(clock));frames++}};
 const snapshot=()=>require('node:crypto').createHash('sha256').update(JSON.stringify(points)).digest('hex');
 const initial=snapshot();win.WovonWeave.selectTopic('operations');assert.ok(reduced?win.WovonWeave.state().movingBlocks===0:win.WovonWeave.state().movingBlocks>0);settle();const operations=snapshot();assert.equal(win.WovonWeave.state().movingBlocks,0);assert.notEqual(operations,initial,'Question must change geometry, not only color');
 win.WovonWeave.selectTopic('risk');settle();assert.notEqual(snapshot(),operations);
 win.WovonWeave.selectTopic('customers');settle();assert.equal(snapshot(),initial,'Returning to a question must restore its exact geometry');
 win.WovonWeave.selectTopic('operations');if(!reduced){const f=[...queue.values()][0];queue.clear();clock+=34;f(clock)}win.WovonWeave.selectTopic('risk');settle();win.WovonWeave.selectTopic('operations');settle();assert.equal(snapshot(),operations,'Interrupted transitions must settle to the same geometry');
 if(!reduced){play.events.click();settle();assert.equal(win.WovonWeave.state().seconds,28);assert.equal(win.WovonWeave.state().playing,false)}else assert.equal(frames,0);
 console.log('PASS:',reduced?'reduced-motion':'animated',(reduced?'immediate still layouts; ':'whole-block rearrangement; ')+'arrangements restore exactly, survive interruption, have finite coordinates and settle without a loop.');
}
run(false);run(true);
