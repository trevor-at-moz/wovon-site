/* A conceptual, local illustration. Geometry and topic paths are illustrative.
   No dependencies, product calls, telemetry, or perpetual animation loop. */
(() => {
  'use strict';
  const root = document.querySelector('.weave-explorer');
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const play = root.querySelector('#play-story');
  const scrub = root.querySelector('#weave-position');
  const caption = root.querySelector('#weave-caption');
  const phaseLabel = root.querySelector('#weave-phase');
  const topicButtons = [...root.querySelectorAll('[data-topic]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 28;
  const REFORM_SECONDS = 2.8;
  const BLUE = [40, 83, 255];
  const GREY = [95, 109, 128];
  const CONNECTOR = [66, 98, 168];
  const FACE_COLORS = [[233,240,249], [248,251,255], [207,222,242]];
  const positions = [
    [0, 0, 0, 58], [-282, -91, 20, 43], [258, -143, -45, 44],
    [299, 127, 65, 45], [-247, 147, -25, 48], [53, 204, -142, 37],
    [7, -208, 90, 39], [-420, -5, -130, 30], [285, -40, -110, 32]
  ];
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,4],[1,6],
    [2,6],[2,3],[3,5],[4,5],[1,7],[4,7],[0,8],[8,2],[8,3]];
  const topics = {
    customers: {name:'Customers', nodes:[0,1,2,6], edges:[0,1,5,7,8], detail:'A customer question brings one set of connections into view. Some of these strands also matter to operations and risk.'},
    operations: {name:'Operations', nodes:[0,3,4,5], edges:[2,3,4,10,11], detail:'An operations question reveals a different structure, drawing on some of the same underlying knowledge.'},
    risk: {name:'Risk', nodes:[0,1,4,6,7], edges:[0,3,5,6,7,12,13], detail:'A question about risk connects another overlapping set of findings. The knowledge model remains connected across topics.'}
  };
  const views = {learn:4.3, build:10.8, use:14.5, change:28};
  const phases = [
    {at:0, label:'01 / Strands', view:'learn', text:'Separate observations begin to find their connections.'},
    {at:2.5, label:'02 / Weave', view:'learn', text:'Connected evidence becomes a weave of understanding.'},
    {at:5, label:'03 / Depth', view:'build', text:'Understanding takes shape. The original strands remain part of it.'},
    {at:8, label:'04 / Connections', view:'build', text:'What’s been learned contributes to further understanding, in many directions.'},
    {at:12, label:'05 / Topics', view:'use', text:topics.customers.detail},
    {at:17, label:'05 / Topics', view:'use', text:topics.operations.detail},
    {at:21, label:'05 / Topics', view:'use', text:topics.risk.detail},
    {at:25, label:'06 / New evidence', view:'change', text:'New evidence creates new connections and changes the understanding built around them.'}
  ];
  let resume = false;
  let time = 14.5, playing = false, topic = 'customers', evidenceSeen = false;
  let frame = 0, last = 0, currentUI = '';
  let edgeWeights = edges.map((_, i) => topics.customers.edges.includes(i) ? 1 : 0);
  let nodeWeights = positions.map((_, i) => topics.customers.nodes.includes(i) ? 1 : 0);
  let size = {w:1100, h:560};
  let transition = 0, lastDraw = 0;
  const clamp = v => Math.max(0, Math.min(1, v));
  const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
  const mix = (a,b,t) => a+(b-a)*t;
  const ramp = (a,b,t) => smooth((t-a)/(b-a));
  const rgba = (c,a) => 'rgba('+c.join(',')+','+clamp(a)+')';

  const identityPose = () => positions.map(() => [0,0,0]);
  // Target centres in the settled camera view. Only whole-object translation changes.
  // The weave, dimensions and strand identity are fixed throughout a topic change.
  function placement(centres) {
    const c=Math.cos(-.49),s=Math.sin(-.49),cp=Math.cos(.31),sp=Math.sin(.31);
    return positions.map((node,i)=>{
      if(!centres[i])return [0,0,0];
      const x=(centres[i][0]-550)/.94,y=(centres[i][1]-280)/.94,z=node[2];
      const a=c+x*cp*s/1000,b=-x*sp/1000,d=sp*s+y*cp*s/1000,e=cp-y*sp/1000;
      const u=x+x*cp*c*z/1000-s*z,v=y+y*cp*c*z/1000+sp*c*z,det=a*e-b*d;
      return [(u*e-b*v)/det-node[0],(a*v-u*d)/det-node[1],0];
    });
  }
  const layouts={
    customers:identityPose(),
    operations:placement([[535,315],[245,110],[825,105],[835,355],[285,335],[600,480],[550,90],[120,295]]),
    risk:placement([[535,250],[310,210],[855,110],[835,370],[335,425],[620,480],[520,75],[130,370]])
  };
  let pose=identityPose(),poseFrom=identityPose(),poseTo=identityPose(),reform=1;
  function beginReform() {
    poseFrom=pose.map(p=>p.slice());poseTo=layouts[topic];reform=0;
  }
  function snapPose() {pose=layouts[topic].map(p=>p.slice());reform=1;}
  function shapePoint(point,index) {
    const field=ramp(8,12,time);
    return point.map((v,j)=>v+pose[index][j]*field);
  }

  function getPhase() {
    return phases.reduce((result, p) => time >= p.at ? p : result, phases[0]);
  }
  function state() {
    const phase = getPhase();
    return {view:phase.view, topic, topicLabel:topics[topic].name,
      seconds:Math.round(time*10)/10, playing, illustrative:true,
      explanation:phase.view === 'use' ? topics[topic].detail : phase.text,
      reducedMotion:motion.matches, newEvidence:evidenceSeen,
      movingBlocks:reform===1?0:pose.filter((p,i)=>p.some((v,j)=>Math.abs(v-poseTo[i][j])>.01)).length};
  }
  function syncUI() {
    const phase = getPhase();
    const next = phase.label+'|'+topic;
    if (next !== currentUI) {
      caption.textContent = state().explanation;
      phaseLabel.textContent = phase.label;
      topicButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === topic)));
      root.dataset.view = phase.view;
      root.dataset.topic = topic;
      currentUI = next;
    }
    scrub.value = String(time);
    scrub.setAttribute('aria-valuetext', phase.label.split(' / ')[1]+', '+Math.round(time)+' of 28 seconds');
    play.textContent = playing ? 'Ⅱ Pause' : time >= DURATION ? '↻ Replay' : resume ? '▷ Continue' : '▷ Play the story';
    play.setAttribute('aria-label', playing ? 'Pause the animation' : resume ? 'Continue the animation' : 'Play the animation from the beginning');
  }
  function camera() {
    const depth = ramp(5,8,time);
    const field = ramp(8,12,time);
    const follow=Math.sin(Math.PI*field);
    return {yaw:mix(0,-0.49,depth), pitch:mix(0,.31,depth),
      zoom:mix(2,.94,field), focusX:-65*follow, focusY:-18*follow};
  }
  function project(p, cam) {
    const c=Math.cos(cam.yaw), s=Math.sin(cam.yaw), cp=Math.cos(cam.pitch), sp=Math.sin(cam.pitch);
    const px=p[0]-(cam.focusX||0), py=p[1]-(cam.focusY||0);
    const x=px*c+p[2]*s, z=-px*s+p[2]*c;
    const y=py*cp-z*sp, depth=py*sp+z*cp;
    const perspective=1000/(1000+depth);
    return [550+x*cam.zoom*perspective,280+y*cam.zoom*perspective,depth];
  }
  function stroke(points, color, alpha, width, cam, glow=0) {
    if (alpha < .004) return;
    ctx.beginPath();
    points.forEach((p,i) => {const q=project(p,cam);i ? ctx.lineTo(q[0],q[1]) : ctx.moveTo(q[0],q[1]);});
    ctx.strokeStyle=rgba(color,alpha);
    ctx.lineWidth=width*(size.w<600?1.6:1);ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor=rgba(BLUE,.5);ctx.shadowBlur=glow;
    ctx.stroke();ctx.shadowBlur=0;
  }
  function bezier(a,b,c,d,t) {
    const u=1-t;
    return a.map((v,i)=>u*u*u*v+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);
  }
  // A rounded-box surface, not a box painted with a grid. Every line follows it.
  function rounded(p,r) {
    const corner=r*.16, inner=r-corner;
    const q=p.map(v=>Math.max(-inner,Math.min(inner,v)));
    const d=p.map((v,i)=>v-q[i]), length=Math.hypot(...d)||1;
    return q.map((v,i)=>v+d[i]/length*corner);
  }
  function surface(node,face,u,v,fold=1) {
    const r=node[3];
    const full=rounded(face===0?[u,v,-r]:face===1?[u,-r,v]:[-r,u,v],r);
    const flat=[u,v,0];
    return full.map((value,i)=>mix(flat[i],value,fold)+node[i]);
  }
  function port(node,other) {
    // Junctions sit on strand crossings in the four-band weave. The central crossing is shared.
    const x=node===positions[0]?20:other[0]>=node[0]?100:20;
    const y=node===positions[0]?20:other[1]>=node[1]?100:20;
    return surface(node,0,(x/80-1)*node[3],(y/80-1)*node[3]);
  }
  function linkPoints(edge) {
    const a=positions[edge[0]],d=positions[edge[1]];
    const start=shapePoint(port(a,d),edge[0]),end=shapePoint(port(d,a),edge[1]);
    const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy)||1;
    const nx=-dy/length,ny=dx/length;
    const bend=((edge[0]+edge[1])%2?1:-1)*Math.min(74,length*.23);
    const b=[start[0]+dx*.26+nx*bend,start[1]+dy*.26+ny*bend,start[2]-25];
    const c=[start[0]+dx*.74+nx*bend*.35,start[1]+dy*.74+ny*bend*.35,end[2]-25];
    return Array.from({length:49},(_,i)=>bezier(start,b,c,end,i/48));
  }
  const tilePositions=Array.from({length:20},(_,i)=>8+Math.floor(i/5)*40+(i%5)*6);
  function patternLines(node,fold=1,formation=1) {
    const r=node[3],lines=[];
    for(let face=0;face<3;face++) for(let axis=0;axis<2;axis++) {
      tilePositions.forEach((tile,index)=>{
        const band=Math.floor(index/5),strand=index%5,v=(tile/80-1)*r;
        // Repeat the approved over/under alternation four times across each face.
        const intervals=[];let cursor=0;
        for(let crossing=0;crossing<4;crossing++) {
          const under=axis===0?crossing%2===band%2:crossing%2!==band%2;
          if(!under)continue;
          const centre=20+crossing*40,half=13*formation;
          intervals.push([cursor,centre-half]);cursor=centre+half;
        }
        intervals.push([cursor,160]);
        const paletteAxis=face===2&&axis===1?0:axis;
        const accent=[(band+paletteAxis)%5,2];
        intervals.forEach(([start,end],piece)=>{
          const points=[];
          const steps=Math.max(3,Math.ceil((end-start)/4));
          for(let k=0;k<=steps;k++) {
            const tileU=mix(start,end,k/steps),u=(tileU/80-1)*r;
            let p=surface(node,face,axis===0?u:v,axis===0?v:u,fold);
            if(face===0&&formation<1) {
              // The SAME strand moves from loose line to bundle to its place in the flat weave.
              const id=axis*20+index,t=tileU/160,gather=ramp(0,2.5,time);
              const looseY=(id-19.5)*6+Math.sin(t*3+id*.55)*18;
              const bundleY=(strand-2)*3.3+(band-1.5)*24+(axis-.5)*26+Math.sin(t*Math.PI)*7;
              const loose=[mix(-310,310,t),mix(looseY,bundleY,gather),0];
              p=p.map((value,i)=>mix(loose[i],value,formation));
            }
            points.push(p);
          }
          lines.push({points,face,axis,band,strand,accent,piece,lead:axis===0&&index===2});
        });
      });
    }
    return lines;
  }
  function faces(node,fold,cam) {
    const r=node[3],boundary=[];
    for(let side=0;side<4;side++) for(let k=0;k<12;k++) {
      const u=mix(-r,r,k/12);
      boundary.push(side===0?[u,-r]:side===1?[r,u]:side===2?[-u,r]:[-r,-u]);
    }
    return [0,1,2].map(face=>{
      const points=boundary.map(([u,v])=>surface(node,face,u,v,fold));
      return {face,points,depth:points.reduce((sum,p)=>sum+project(p,cam)[2],0)/points.length};
    }).sort((a,b)=>b.depth-a.depth);
  }
  function veil(points,color,alpha,cam) {
    ctx.beginPath();
    points.forEach((p,i)=>{const q=project(p,cam);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});
    ctx.closePath();ctx.fillStyle=rgba(color,alpha);ctx.fill();
  }
  function dot(point,active,alpha,cam) {
    const p=project(point,cam),radius=Math.max(1.8,1/(size.w/1100));
    ctx.beginPath();ctx.arc(p[0],p[1],radius,0,Math.PI*2);
    ctx.fillStyle=rgba(active>.1?BLUE:GREY,(.28+.45*active)*alpha);ctx.fill();
  }
  const cubes=positions.map(p=>patternLines(p));
  const arrival=[0,8.8,9.8,10.5,10,11.1,10.2,11,25];
  function draw() {
    const scale=size.w/1100;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    const dpr=canvas.width/size.w;
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,(size.h-560*scale)*dpr/2);
    const links=edges.map(linkPoints);
    const cam=camera(),field=ramp(8,12.6,time),fold=ramp(5,8,time);
    const formation=ramp(2.5,5,time),changed=(evidenceSeen?1:ramp(25,27.8,time))*field;
    const nodePresence=i=>i===0?1:i===8?changed:ramp(arrival[i],arrival[i]+1.4,time);
    const routeGrowth=i=>i>=14?changed:ramp(8+Math.min(i*.16,2),9.7+Math.min(i*.16,2),time);
    // Single, curving lines begin and end at intersections in the woven surface.
    links.forEach((points,i)=>{
      const growth=routeGrowth(i);
      if(growth<.01)return;
      const count=Math.max(2,Math.round(1+growth*(points.length-1)));
      const active=edgeWeights[i];
      stroke(points.slice(0,count),active>.1?CONNECTOR:GREY,.15+.47*active,1.2,cam);
      if((playing||transition>0)&&active>.1&&growth>.95) {
        const signalTime=playing?time:reform*3;
        const head=((signalTime*.12+(edges[i][0]===0?0:i*.073))%1),start=Math.floor(head*44);
        stroke(points.slice(start,start+5),BLUE,.62*active,1.65,cam);
      }
    });
    const sorted=positions.map((p,i)=>({i,z:project(shapePoint(p.slice(0,3),i),cam)[2]})).sort((a,b)=>b.z-a.z);
    sorted.forEach(({i})=>{
      const presence=nodePresence(i);
      if(presence<.005)return;
      const unfolding=i===0?fold:1;
      const active=nodeWeights[i],p=positions[i];
      const paths=i===0&&(fold<1||formation<1)?patternLines(p,fold,formation):cubes[i];
      faces(p,unfolding,cam).forEach(({face,points})=>{
        if(i===0&&face>0&&fold<.01)return;
        const reveal=i===0&&face>0?fold:1;
        // A low-opacity curved backing quiets negative space without turning the weave into a solid block.
        const wash=[.15,.08,.2][face]*presence*reveal*(i===0?formation:1);
        veil(points.map(pt=>shapePoint(pt,i,face)),FACE_COLORS[face],wash,cam);
        paths.filter(line=>line.face===face).forEach(line=>{
          const highlighted=line.accent.includes(line.strand)||i===0&&line.lead;
          const isOpening=i===0&&formation<1;
          const baseAlpha=(face===0?.66:face===1?.54:.6)*presence*reveal;
          const growth=i===0?1:clamp(presence*1.35-line.strand*.035);
          const count=Math.max(2,Math.ceil(line.points.length*growth));
          const linePoints=line.points.slice(0,count).map(pt=>shapePoint(pt,i,face,line.band));
          stroke(linePoints,GREY,baseAlpha,1.45,cam);
          const blue=isOpening?(line.lead?1:formation*active):active;
          if(highlighted||isOpening&&line.lead) {
            stroke(linePoints,BLUE,.91*blue*presence*reveal,i===0&&line.lead?2.1:1.55,cam);
            if((playing||transition>0)&&blue>.1) {
              const pulseTime=playing?time:reform*3;
              const start=Math.floor(((pulseTime*.2+line.strand*.08)%1)*Math.max(1,linePoints.length-3));
              stroke(linePoints.slice(start,start+4),[81,121,255],.55*blue*presence*reveal,1.9,cam);
            }
          }
        });
      });
    });
    // Tiny nodes identify the contact with a strand intersection, without a legend.
    edges.forEach((edge,i)=>{
      const growth=routeGrowth(i);
      if(growth>.95) {
        dot(links[i][0],edgeWeights[i],nodePresence(edge[0]),cam);
        dot(links[i][links[i].length-1],edgeWeights[i],nodePresence(edge[1]),cam);
      }
    });
    if(changed>0) {
      const end=shapePoint(port(positions[8],positions[0]),8),start=[-175,-285,120];
      const points=Array.from({length:49},(_,i)=>bezier(start,[-130,-160,120],[150,-90,90],end,i/48));
      stroke(points.slice(0,Math.max(2,Math.ceil(changed*49))),BLUE,.75*changed,1.5,cam);
      if(changed>.95)dot(end,1,changed,cam);
    }
  }
  function targets() {
    const t=topics[topic];
    const changed=evidenceSeen || time>=25;
    return {
      e:edges.map((_,i)=>(t.edges.includes(i)||(changed&&i>=14))?1:0),
      n:positions.map((_,i)=>(t.nodes.includes(i)||(changed&&[2,3,8].includes(i)))?1:0)
    };
  }
  function snapWeights() {
    const t=targets();edgeWeights=t.e;nodeWeights=t.n;
  }
  function tick(now) {
    frame=0;
    const dt=Math.min((now-(last||now))/1000,.08);last=now;
    if(playing) {
      time=Math.min(DURATION,time+dt);
      const nextTopic=time>=21?'risk':time>=17?'operations':'customers';
      if(nextTopic!==topic){topic=nextTopic;beginReform();transition=REFORM_SECONDS;}
      if(time>=27.8)evidenceSeen=true;
      if(time>=DURATION){playing=false;resume=false;}
    }
    const target=targets(), blend=motion.matches?1:Math.min(1,dt*6);
    edgeWeights=edgeWeights.map((v,i)=>mix(v,target.e[i],blend));
    nodeWeights=nodeWeights.map((v,i)=>mix(v,target.n[i],blend));
    reform=Math.min(1,reform+dt/REFORM_SECONDS);
    pose=reform===1?poseTo.map(p=>p.slice()):poseFrom.map((p,i)=>p.map((v,j)=>mix(v,poseTo[i][j],smooth(reform))));
    transition=Math.max(0,transition-dt);
    syncUI();
    // Limit canvas work to 30 fps; UI remains native and keyboard accessible.
    if(now-lastDraw>=30 || !playing) {draw();lastDraw=now;}
    if(playing||transition>0) frame=requestAnimationFrame(tick);
    else {snapWeights();draw();last=0;}
  }
  function requestDraw(animate=false) {
    if(motion.matches){snapPose();snapWeights();syncUI();draw();return;}
    if(animate)transition=REFORM_SECONDS;
    if(!frame)frame=requestAnimationFrame(tick);
  }
  function pause() {
    if(playing)resume=true;
    playing=false;
    if(frame)cancelAnimationFrame(frame);
    frame=0;last=0;transition=0;
    if(motion.matches)snapPose();
    snapWeights();syncUI();draw();
  }
  function selectView(view) {
    if(!Object.hasOwn(views,view))throw new Error('Choose learn, build, use or change.');
    pause();resume=false;time=views[view];if(view==='change')evidenceSeen=true;
    if(view==='change')topic='risk';
    beginReform();
    currentUI='';syncUI();requestDraw(true);
    return state();
  }
  function selectTopic(value) {
    if(!Object.hasOwn(topics,value))throw new Error('Choose customers, operations or risk.');
    pause();resume=false;topic=value;time=14.5;beginReform();
    currentUI='';syncUI();requestDraw(true);
    return state();
  }
  function resize() {
    const r=canvas.getBoundingClientRect();
    if(!r.width)return;
    size={w:r.width,h:r.height};
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    draw();
  }
  play.addEventListener('click',()=>{
    if(playing){pause();return;}
    if(motion.matches){selectView('change');return;}
    if(!resume||time>=DURATION){time=0;topic='customers';evidenceSeen=false;snapPose();poseFrom=pose.map(p=>p.slice());poseTo=pose;}
    playing=true;resume=false;last=0;currentUI='';
    snapWeights();requestDraw();
  });
  scrub.addEventListener('input',()=>{
    const position=Number(scrub.value);
    pause();time=position;resume=true;
    topic=time>=21?'risk':time>=17?'operations':'customers';
    evidenceSeen=time>=27.8;currentUI='';snapPose();poseFrom=pose.map(p=>p.slice());poseTo=pose;snapWeights();syncUI();draw();
  });
  topicButtons.forEach(b=>b.addEventListener('click',()=>selectTopic(b.dataset.topic)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  motion.addEventListener('change',()=>{pause();setMotionUI();});
  function setMotionUI() {
    play.hidden=motion.matches;
    root.querySelector('.motion-note').hidden=!motion.matches;
  }
  new ResizeObserver(resize).observe(canvas);
  // Leaving the illustration stops playback and avoids offscreen work.
  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&(playing||transition>0))pause();},{threshold:0}).observe(canvas);
  window.addEventListener('pagehide',pause);
  root.classList.add('weave-ready');
  root.querySelectorAll('[data-animation-control]').forEach(el=>el.hidden=false);
  setMotionUI();syncUI();resize();
  window.WovonWeave={selectView,selectTopic,pause,state};
})();
