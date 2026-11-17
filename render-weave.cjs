/* Build the accessible SVG still using the live illustration's drawing code.
   This is an SVG recording context, not a browser or raster screenshot. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const output = [];
let commands = [];
const number = value => {
  if (!Number.isFinite(value)) throw new Error('Non-finite illustration coordinate');
  return Math.round(value * 100) / 100;
};
const context = {
  fillStyle: 'none', strokeStyle: '#000', lineWidth: 1, lineCap: 'round', lineJoin: 'round',
  setTransform(a,b,c,d,e,f) {
    if (a!==1||b!==0||c!==0||d!==1||e!==0||f!==0) throw new Error('Poster expects a 1100 × 560 identity transform');
  },
  clearRect() { output.length=0; },
  beginPath() { commands=[]; },
  moveTo(x,y) {commands.push('M '+number(x)+' '+number(y));},
  lineTo(x,y) {commands.push('L '+number(x)+' '+number(y));},
  closePath() {commands.push('Z');},
  arc(x,y,r,start,end) {
    if (start!==0 || end!==Math.PI*2) throw new Error('Poster supports full circular nodes');
    commands.push('M '+number(x+r)+' '+number(y)+' A '+number(r)+' '+number(r)+' 0 1 0 '+number(x-r)+' '+number(y)+' A '+number(r)+' '+number(r)+' 0 1 0 '+number(x+r)+' '+number(y)+' Z');
  },
  fill() {output.push('<path d="'+commands.join(' ')+'" style="fill:'+this.fillStyle+';stroke:none"/>');},
  stroke() {output.push('<path d="'+commands.join(' ')+'" style="fill:none;stroke:'+this.strokeStyle+';stroke-width:'+number(this.lineWidth)+';stroke-linecap:round;stroke-linejoin:round"/>');}
};
function element(dataset={}) {
  return {dataset,hidden:false,value:'14.5',textContent:'',classList:{add(){}},
    addEventListener(){},setAttribute(){},getBoundingClientRect(){return {width:1100,height:560};}};
}
const canvas=element();canvas.getContext=()=>context;
const elements={'canvas':canvas,'#play-story':element(),'#weave-position':element(),
  '#weave-caption':element(),'#weave-phase':element(),'.motion-note':element()};
const topics=['customers','operations','risk'].map(topic=>element({topic}));
const root=element();
root.querySelector=q=>elements[q];
root.querySelectorAll=q=>q==='[data-topic]'?topics:[];
const windowStub={addEventListener(){}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'weave.js'),'utf8'),{
  window:windowStub,document:{querySelector:()=>root,addEventListener(){}},
  matchMedia:()=>({matches:true,addEventListener(){}}),devicePixelRatio:1,
  ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},
  requestAnimationFrame(){throw new Error('Still rendering must not animate');},cancelAnimationFrame(){},
  console
});
if (output.length<50) throw new Error('Incomplete illustration');
const title='<title id="weave-title">One knowledge model, overlapping connections</title>';
const desc='<desc id="weave-desc">The existing over-and-under woven grid wraps around softly rounded forms. Thicker blue and grey strands remain individually visible. Single curved lines join strand intersections marked by subtle dots. Each face has four bands in each direction. Different questions rearrange the intact woven blocks. The strands stay in their blocks and the curved connections follow their new positions. This is an illustrative visual metaphor.</desc>';
process.stdout.write('<svg class="weave-graphic" viewBox="0 0 1100 560" role="img" aria-labelledby="weave-title weave-desc" xmlns="http://www.w3.org/2000/svg">'+title+desc+output.join('')+'</svg>');
