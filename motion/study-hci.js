(function () {
    "use strict";
    var M = window.MotionStudy, TAU = M.TAU;

    function surface(env) {
        var ctx = env.canvas.getContext("2d");
        return {
            ctx: ctx,
            begin: function (tone) {
                ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
                ctx.clearRect(0, 0, env.width, env.height);
                var g = ctx.createRadialGradient(env.width * .66, env.height * .52, 0, env.width * .66, env.height * .52, Math.max(env.width, env.height) * .62);
                g.addColorStop(0, tone || "rgba(26,36,58,.2)"); g.addColorStop(1, "rgba(4,6,13,.1)"); ctx.fillStyle = g; ctx.fillRect(0, 0, env.width, env.height);
            },
            panel: function (x, y, w, h, fill, r) { M.roundedRect(ctx, x, y, w, h, r || 18); ctx.fillStyle = fill || "rgba(16,21,35,.9)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke(); }
        };
    }

    M.register("semantic-zoom", function (env) {
        var s = surface(env), zoom = 1, target = 2.7, velocity = 0, pan = { x: 0, y: 0 };
        env.setAction("CHANGE LEVEL");
        function setByPointer(p) { target = M.lerp(.65, 5.4, p.x); pan.x = (p.x - .5) * 90; pan.y = (p.y - .5) * 90; }
        return {
            pointerDown: setByPointer, pointerMove: function (p) { if (p.down) setByPointer(p); }, wheel: function (_, dy) { target = M.clamp(target * Math.exp(-dy * .0015), .6, 6); }, action: function () { target = target < 1.6 ? 3 : target < 4 ? 5.3 : .8; }, demo: function (time) { target = 2.9 + Math.sin(time * .5) * 2.2; pan.x = Math.sin(time * .23) * 70; pan.y = Math.cos(time * .31) * 50; },
            update: function (dt) { var v = M.spring(zoom, velocity, target, 28, 9, dt); zoom = M.clamp(v.value, .5, 6); velocity = v.velocity; var level = zoom < 1.5 ? 0 : zoom < 3.7 ? 1 : 2; env.setMeter((zoom - .5) / 5.5); env.setState(["REGIONS / OVERVIEW", "PLACES / DISTRICTS", "RECORDS / DETAIL"][level], "缩放跨阈值时重构信息表示"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, cx = env.width * .65 + pan.x, cy = env.height * .53 + pan.y, level = zoom < 1.5 ? 0 : zoom < 3.7 ? 1 : 2;
                ctx.save(); ctx.translate(cx, cy); ctx.scale(zoom, zoom);
                for (var i = 0; i < 18; i += 1) {
                    var angle = i * 2.399, radius = 30 + Math.sqrt(i) * 52, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .68, size = 20 + (i % 4) * 5;
                    if (level === 0) { ctx.fillStyle = i % 3 === 0 ? env.accent : "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(x, y, size * .75, 0, TAU); ctx.fill(); }
                    else if (level === 1) { M.roundedRect(ctx, x - size, y - size * .7, size * 2, size * 1.4, 5); ctx.fillStyle = i % 3 === 0 ? env.accent : "rgba(255,255,255,.14)"; ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "700 7px Inter"; ctx.fillText("P" + String(i + 1), x - size + 5, y + 2); }
                    else { M.roundedRect(ctx, x - size * 1.2, y - size, size * 2.4, size * 2, 5); ctx.fillStyle = "rgba(17,23,38,.95)"; ctx.fill(); ctx.strokeStyle = i % 3 === 0 ? env.accent : "rgba(255,255,255,.2)"; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "800 7px Inter"; ctx.fillText("PLACE " + String(i + 1), x - size + 2, y - 4); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(x - size + 2, y + 4, size * 1.35, 2); }
                }
                ctx.restore();
                M.label(ctx, "GEOMETRY × " + zoom.toFixed(2) + "  /  SEMANTIC LEVEL " + (level + 1), env.width * .65, env.height * .84, "rgba(255,255,255,.46)", 9, "center");
            }
        };
    });

    M.register("speed-dependent-zoom", function (env) {
        var s = surface(env), camera = 0, velocity = 0, scale = 1, targetVelocity = 0, dragging = false;
        env.setAction("IMPULSE");
        return {
            pointerDown: function () { dragging = true; targetVelocity = 0; },
            pointerMove: function (p) { if (dragging) targetVelocity = -p.vx * 420; },
            pointerUp: function () { dragging = false; velocity += targetVelocity; },
            action: function () { velocity += 1200; }, demo: function (time) { dragging = true; targetVelocity = Math.sin(time * .7) * 980; },
            update: function (dt) { if (dragging) velocity = M.lerp(velocity, targetVelocity, 1 - Math.exp(-13 * dt)); else velocity *= Math.exp(-1.05 * dt); camera += velocity * dt; var desired = 1 / (1 + Math.abs(velocity) / 520); scale += (desired - scale) * (1 - Math.exp(-5 * dt)); env.setMeter(1 - scale); env.setState("SPEED " + Math.round(Math.abs(velocity)) + " / ZOOM " + scale.toFixed(2), "移动越快相机越远，减速后自动靠近"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, cx = env.width * .65, cy = env.height * .53; ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
                M.grid(ctx, env.width / scale, env.height / scale, 74, "rgba(255,255,255,.07)", camera % 74, 0);
                for (var i = -8; i < 10; i += 1) { var x = i * 130 - (camera % 130); M.roundedRect(ctx, x - 46, Math.sin((i + camera / 130) * .7) * 80 - 40, 92, 80, 16); ctx.fillStyle = i % 3 === 0 ? env.accent : "rgba(255,255,255,.09)"; ctx.fill(); M.label(ctx, "NODE " + (i + 9), x, Math.sin((i + camera / 130) * .7) * 80 + 8, i % 3 === 0 ? "#071019" : "rgba(255,255,255,.5)", 8, "center"); }
                ctx.restore(); ctx.strokeStyle = env.accent2; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.stroke();
            }
        };
    });

    M.register("efficient-zoom-pan", function (env) {
        var s = surface(env), landmarks = [{x:-220,y:-110,z:1.8},{x:180,y:-150,z:3.2},{x:230,y:150,z:1.2},{x:-140,y:170,z:4.6},{x:0,y:0,z:2.4}], current = {x:0,y:0,z:1}, start = {x:0,y:0,z:1}, goal = landmarks[1], progress = 1, index = 1;
        env.setAction("NEXT LANDMARK");
        function go(next) { start = { x: current.x, y: current.y, z: current.z }; goal = landmarks[next]; index = next; progress = 0; }
        return {
            pointerDown: function (p) { go(Math.floor(p.x * landmarks.length) % landmarks.length); }, action: function () { go((index + 1) % landmarks.length); }, demo: function (_, cycle) { if (cycle < .05 && progress >= 1) go((index + 1) % landmarks.length); },
            update: function (dt) { progress = Math.min(1, progress + dt * .36); var q = M.easeInOut(progress), separation = Math.hypot(goal.x - start.x, goal.y - start.y), arc = Math.sin(q * Math.PI) * Math.min(2.6, separation / 150); current.x = M.lerp(start.x, goal.x, q); current.y = M.lerp(start.y, goal.y, q); current.z = M.lerp(start.z, goal.z, q) / (1 + arc); env.setMeter(progress); env.setState(progress < 1 ? "OPTIMAL PATH / IN FLIGHT" : "LANDMARK " + (index + 1) + " / LOCKED", "点击地标可在飞行途中重定向"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, cx = env.width * .65, cy = env.height * .53, z = 1 / current.z * 2.2; ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-current.x, -current.y); M.grid(ctx, env.width / z, env.height / z, 60);
                landmarks.forEach(function (lm, i) { ctx.beginPath(); ctx.arc(lm.x, lm.y, i === index ? 30 : 18, 0, TAU); ctx.fillStyle = i === index ? env.accent : "rgba(255,255,255,.12)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.stroke(); M.label(ctx, "L" + (i + 1), lm.x, lm.y, i === index ? "#061019" : "rgba(255,255,255,.55)", 9, "center"); }); ctx.restore();
                var x0 = env.width * .46, x1 = env.width * .84, y = env.height * .84; ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(M.lerp(x0,x1,.25), y - 80, M.lerp(x0,x1,.75), y - 80, x1, y); ctx.stroke(); ctx.fillStyle = env.accent; ctx.beginPath(); ctx.arc(M.lerp(x0,x1,M.easeInOut(progress)), y - Math.sin(progress*Math.PI)*60, 5, 0, TAU); ctx.fill();
            }
        };
    });

    M.register("overview-detail", function (env) {
        var s = surface(env), view = {x:.45,y:.42}, target = {x:.45,y:.42};
        env.setAction("CENTER VIEW");
        function move(p) { target.x = M.clamp((p.x - .43) / .46, .1, .9); target.y = M.clamp((p.y - .23) / .54, .1, .9); }
        return {
            pointerDown: move, pointerMove: function (p) { if (p.down) move(p); }, action: function () { target.x = .5; target.y = .5; }, demo: function (time) { target.x=.5+Math.sin(time*.37)*.34; target.y=.5+Math.cos(time*.29)*.3; },
            update: function (dt) { view.x += (target.x-view.x)*(1-Math.exp(-8*dt)); view.y += (target.y-view.y)*(1-Math.exp(-8*dt)); env.setMeter(view.x); env.setState("VIEWPORT / " + Math.round(view.x*100) + ":" + Math.round(view.y*100), "拖动总览视口，细节视图同步更新"); },
            draw: function () {
                s.begin(); var ctx=s.ctx, main={x:env.width*.43,y:env.height*.25,w:Math.min(610,env.width*.5),h:Math.min(430,env.height*.55)}, map={x:env.width*.72,y:env.height*.69,w:Math.min(220,env.width*.2),h:Math.min(135,env.height*.17)};
                s.panel(main.x,main.y,main.w,main.h,"rgba(10,15,27,.92)",24); ctx.save(); M.roundedRect(ctx,main.x,main.y,main.w,main.h,24); ctx.clip(); ctx.translate(main.x+main.w/2-(view.x-.5)*main.w*2.4,main.y+main.h/2-(view.y-.5)*main.h*2.4); ctx.scale(2.25,2.25); for(var i=0;i<28;i+=1){var a=i*2.399,r=25+Math.sqrt(i)*38,x=Math.cos(a)*r,y=Math.sin(a)*r*.72;ctx.fillStyle=i%5===0?env.accent:"rgba(255,255,255,.13)";ctx.beginPath();ctx.arc(x,y,4+(i%4)*2,0,TAU);ctx.fill();}ctx.restore();
                s.panel(map.x,map.y,map.w,map.h,"rgba(7,10,18,.96)",16); for(var j=0;j<28;j+=1){var aa=j*2.399,rr=7+Math.sqrt(j)*10,xx=map.x+map.w/2+Math.cos(aa)*rr,yy=map.y+map.h/2+Math.sin(aa)*rr*.6;ctx.fillStyle=j%5===0?env.accent:"rgba(255,255,255,.18)";ctx.fillRect(xx,yy,2,2);}var rw=map.w*.34,rh=map.h*.38,rx=map.x+view.x*map.w-rw/2,ry=map.y+view.y*map.h-rh/2;ctx.strokeStyle=env.accent2;ctx.lineWidth=2;ctx.strokeRect(rx,ry,rw,rh);M.arrow(ctx,rx+rw/2,ry,main.x+main.w*.7,main.y+main.h,env.accent2,1);
            }
        };
    });

    M.register("fisheye-menu", function (env) {
        var s=surface(env), focus=5, target=5, items=["SEARCH","LAYERS","TIMELINE","FILTERS","MATERIALS","LIGHT","CAMERA","EXPORT","SETTINGS","ABOUT","ARCHIVE"];
        env.setAction("STEP FOCUS");
        function set(p){target=M.clamp((p.y-.18)/.64*(items.length-1),0,items.length-1);}
        return {
            pointerMove:set,pointerDown:set,action:function(){target=(Math.round(target)+1)%items.length;},demo:function(time){target=(Math.sin(time*.46)*.5+.5)*(items.length-1);},
            update:function(dt){focus+=(target-focus)*(1-Math.exp(-12*dt));env.setMeter(focus/(items.length-1));env.setState("DOI / "+items[Math.round(focus)],"指针附近项目放大，远端项目压缩");},
            draw:function(){s.begin();var ctx=s.ctx,cx=env.width*.65,top=env.height*.2,base=33;items.forEach(function(name,i){var d=Math.abs(i-focus),mag=1+1.2*Math.exp(-d*d*.7),y=top+i*base+Math.sign(i-focus)*(mag-1)*10,w=170*mag;M.roundedRect(ctx,cx-w/2,y,w,26*mag,10);ctx.fillStyle=i===Math.round(focus)?env.accent:"rgba(255,255,255,"+(.04+.07*Math.exp(-d))+')';ctx.fill();M.label(ctx,name,cx,y+13*mag,i===Math.round(focus)?"#071019":"rgba(255,255,255,.58)",8+mag*2,"center");});ctx.strokeStyle="rgba(255,255,255,.18)";ctx.beginPath();ctx.moveTo(cx-220,top+focus*base+15);ctx.lineTo(cx+220,top+focus*base+15);ctx.stroke();}
        };
    });

    M.register("marking-menu", function (env) {
        var s=surface(env),origin={x:.66,y:.52},path=[],active=false,selection=-1,show=false,hold=0,names=["COPY","MOVE","LINK","NOTE","DELETE","LOCK","SHARE","MORE"];
        env.setAction("SHOW NOVICE MODE");
        function down(p){origin.x=p.x;origin.y=p.y;path=[{x:p.x,y:p.y}];active=true;show=false;hold=0;selection=-1;}
        function move(p){if(!active)return;path.push({x:p.x,y:p.y});if(path.length>180)path.shift();var dx=p.x-origin.x,dy=p.y-origin.y;if(Math.hypot(dx,dy)>.05)selection=M.mod(Math.round((Math.atan2(dy,dx)/TAU)*8),8);}
        return {
            pointerDown:down,pointerMove:move,pointerUp:function(){active=false;show=true;},action:function(){show=!show;},demo:function(time,cycle){var p={x:.66,y:.52};if(cycle<.05)down(p);if(cycle<3){var a=Math.floor(time/8)%8/8*TAU;move({x:p.x+Math.cos(a)*cycle*.045,y:p.y+Math.sin(a)*cycle*.045});}else if(active){active=false;show=true;}},
            update:function(dt){if(active){hold+=dt;if(hold>.38)show=true;}env.setMeter(selection<0?0:(selection+1)/8);env.setState(selection<0?"HOLD / DRAW":"COMMAND / "+names[selection],"慢按显示菜单，快速方向笔画直接执行");},
            draw:function(){s.begin();var ctx=s.ctx,cx=origin.x*env.width,cy=origin.y*env.height;if(show||active){for(var i=0;i<8;i+=1){var a=(i/8)*TAU,r=104,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;ctx.beginPath();ctx.arc(x,y,i===selection?31:25,0,TAU);ctx.fillStyle=i===selection?env.accent:"rgba(255,255,255,.075)";ctx.fill();ctx.strokeStyle="rgba(255,255,255,.16)";ctx.stroke();M.label(ctx,names[i],x,y,i===selection?"#071019":"rgba(255,255,255,.56)",7,"center");}}if(path.length>1){ctx.beginPath();ctx.moveTo(path[0].x*env.width,path[0].y*env.height);for(var j=1;j<path.length;j+=1)ctx.lineTo(path[j].x*env.width,path[j].y*env.height);ctx.strokeStyle=env.accent2;ctx.lineWidth=5;ctx.lineCap="round";ctx.stroke();}ctx.beginPath();ctx.arc(cx,cy,10,0,TAU);ctx.fillStyle=env.accent2;ctx.fill();}
        };
    });

    M.register("magic-lens", function (env) {
        var s=surface(env),lens={x:.68,y:.52,r:105},target={x:.68,y:.52},mode=0;
        env.setAction("CHANGE LENS");
        function set(p){target.x=p.x;target.y=p.y;}
        function drawWorld(ctx, detailed){for(var i=0;i<80;i+=1){var x=(i*83%701)/701*env.width,y=(i*137%503)/503*env.height,size=3+(i%7);ctx.fillStyle=i%9===0?env.accent:detailed?(i%3===0?env.accent2:"rgba(255,255,255,.5)"):"rgba(255,255,255,.12)";ctx.beginPath();ctx.arc(x,y,detailed?size*1.5:size,0,TAU);ctx.fill();if(detailed&&i%8===0)M.label(ctx,"N"+i,x+10,y,"rgba(255,255,255,.5)",7);}}
        return {
            pointerMove:set,pointerDown:set,wheel:function(_,dy){lens.r=M.clamp(lens.r-dy*.08,60,180);},action:function(){mode=(mode+1)%3;},demo:function(time){target.x=.67+Math.cos(time*.6)*.22;target.y=.53+Math.sin(time*.8)*.25;mode=Math.floor(time/7)%3;},
            update:function(dt){lens.x+=(target.x-lens.x)*(1-Math.exp(-10*dt));lens.y+=(target.y-lens.y)*(1-Math.exp(-10*dt));env.setMeter((lens.r-60)/120);env.setState(["LENS / MAGNIFY","LENS / CLASSIFY","LENS / XRAY"][mode],"拖动局部信息算子 · 滚轮改变半径");},
            draw:function(){s.begin();var ctx=s.ctx;drawWorld(ctx,false);var cx=lens.x*env.width,cy=lens.y*env.height;ctx.save();ctx.beginPath();ctx.arc(cx,cy,lens.r,0,TAU);ctx.clip();ctx.fillStyle=mode===2?"rgba(4,7,15,.9)":"rgba(16,28,40,.76)";ctx.fillRect(cx-lens.r,cy-lens.r,lens.r*2,lens.r*2);if(mode===0){ctx.translate(cx,cy);ctx.scale(1.65,1.65);ctx.translate(-cx,-cy);}drawWorld(ctx,true);if(mode===1){ctx.fillStyle="rgba(125,211,252,.12)";ctx.fillRect(cx-lens.r,cy-lens.r,lens.r,lens.r*2);}ctx.restore();ctx.strokeStyle=env.accent;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,lens.r,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(cx+lens.r*.72,cy+lens.r*.72);ctx.lineTo(cx+lens.r*1.18,cy+lens.r*1.18);ctx.stroke();}
        };
    });

    M.register("dynamic-queries", function (env) {
        var s=surface(env),points=[],min=.22,max=.78,category=0;for(var i=0;i<120;i+=1)points.push({x:(i*73%127)/127,y:(i*43%109)/109,v:(i*91%137)/137,c:i%3});
        env.setAction("CATEGORY");
        function set(p){if(p.y>.7){min=M.clamp(Math.min(p.x,max-.03),0,1);}else{max=M.clamp(Math.max(p.x,min+.03),0,1);}}
        return {
            pointerDown:set,pointerMove:function(p){if(p.down)set(p);},action:function(){category=(category+1)%4;},demo:function(time){min=.1+.15*(Math.sin(time*.5)*.5+.5);max=.65+.25*(Math.cos(time*.37)*.5+.5);category=Math.floor(time/6)%4;},
            update:function(){var n=points.filter(function(p){return p.v>=min&&p.v<=max&&(category===3||p.c===category);}).length;env.setMeter(n/points.length);env.setState(n+" / "+points.length+" RECORDS", "参数变化立即重算结果集");},
            draw:function(){s.begin();var ctx=s.ctx,x0=env.width*.43,y0=env.height*.24,w=Math.min(620,env.width*.5),h=Math.min(410,env.height*.5);s.panel(x0,y0,w,h,"rgba(9,14,25,.9)",24);points.forEach(function(p){var ok=p.v>=min&&p.v<=max&&(category===3||p.c===category);ctx.fillStyle=ok?[env.accent,env.accent2,"#5eead4"][p.c]:"rgba(255,255,255,.055)";ctx.beginPath();ctx.arc(x0+20+p.x*(w-40),y0+20+p.y*(h-40),ok?4.4:2.2,0,TAU);ctx.fill();});var sy=y0+h+42;ctx.fillStyle="rgba(255,255,255,.1)";ctx.fillRect(x0,sy,w,5);ctx.fillStyle=env.accent;ctx.fillRect(x0+min*w,sy,(max-min)*w,5);[min,max].forEach(function(v){ctx.beginPath();ctx.arc(x0+v*w,sy+2,9,0,TAU);ctx.fillStyle=env.accent;ctx.fill();});M.label(ctx,"VALUE RANGE  "+min.toFixed(2)+" — "+max.toFixed(2),x0,sy+32,"rgba(255,255,255,.48)",8);}
        };
    });

    M.register("bubble-cursor", function (env) {
        var s=surface(env),targets=[],cursor={x:.65,y:.52},selected=-1;for(var i=0;i<30;i+=1)targets.push({x:.43+(i*83%211)/211*.46,y:.22+(i*47%181)/181*.58,r:5+(i%5)*2});
        env.setAction("RESHUFFLE");
        function set(p){cursor.x=p.x;cursor.y=p.y;}
        function metrics(){var px=cursor.x*env.width,py=cursor.y*env.height,order=targets.map(function(t,i){return{i:i,d:M.dist(px,py,t.x*env.width,t.y*env.height)-t.r};}).sort(function(a,b){return a.d-b.d;});return{nearest:order[0],second:order[1],radius:Math.max(8,(order[0].d+order[1].d)/2)};}
        return {
            pointerMove:set,pointerDown:function(p){set(p);selected=metrics().nearest.i;},action:function(){targets.forEach(function(t,i){t.x=.43+((i*97+17)%223)/223*.46;t.y=.22+((i*61+31)%193)/193*.58;});},demo:function(time){cursor.x=.65+Math.cos(time*.53)*.23;cursor.y=.51+Math.sin(time*.79)*.28;},
            update:function(){var m=metrics();env.setMeter(M.clamp(m.radius/120,0,1));env.setState("TARGET "+String(m.nearest.i+1).padStart(2,"0")+" / R "+Math.round(m.radius),"气泡扩到最近目标，但不接触次近目标");},
            draw:function(){s.begin();var ctx=s.ctx,m=metrics(),px=cursor.x*env.width,py=cursor.y*env.height;targets.forEach(function(t,i){ctx.beginPath();ctx.arc(t.x*env.width,t.y*env.height,t.r+(i===selected?5:0),0,TAU);ctx.fillStyle=i===m.nearest.i?env.accent:i===selected?env.accent2:"rgba(255,255,255,.18)";ctx.fill();});ctx.beginPath();ctx.arc(px,py,m.radius,0,TAU);ctx.fillStyle="rgba(125,211,252,.075)";ctx.fill();ctx.strokeStyle=env.accent;ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(px,py,3,0,TAU);ctx.fillStyle="#fff";ctx.fill();M.arrow(ctx,px,py,targets[m.nearest.i].x*env.width,targets[m.nearest.i].y*env.height,"rgba(255,255,255,.4)",1);}
        };
    });

    M.register("crossing-based-interaction", function (env) {
        var s=surface(env),gates=[],trail=[],last={x:.45,y:.5},hits=[];for(var i=0;i<7;i+=1)gates.push({x:.48+i*.06,y:.32+(i%3)*.16,vertical:i%2===0,label:["CUT","LINK","COPY","LOCK","MARK","SEND","DONE"][i]});
        env.setAction("CLEAR PATH");
        function orient(a,b,c){return M.cross(b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y);}
        function move(p){var next={x:p.x,y:p.y};if(M.dist(last.x,last.y,next.x,next.y)<.0001)return;gates.forEach(function(g,i){var span=.055,a=g.vertical?{x:g.x,y:g.y-span}:{x:g.x-span,y:g.y},b=g.vertical?{x:g.x,y:g.y+span}:{x:g.x+span,y:g.y};if(orient(last,next,a)*orient(last,next,b)<=0&&orient(a,b,last)*orient(a,b,next)<=0&&!hits.includes(i))hits.push(i);});last=next;trail.push(next);if(trail.length>90)trail.shift();}
        return {
            pointerDown:function(p){last={x:p.x,y:p.y};trail=[last];},pointerMove:function(p){if(p.down||env.preview)move(p);},action:function(){hits=[];trail=[];},demo:function(time){move({x:.43+((time*.08)%1)*.44,y:.5+Math.sin(time*1.8)*.25});if((time%10)<.05){hits=[];trail=[];}},
            update:function(){env.setMeter(hits.length/gates.length);env.setState(hits.length+" / "+gates.length+" BOUNDARIES", "命令只在轨迹穿过边界时触发");},
            draw:function(){s.begin();var ctx=s.ctx;gates.forEach(function(g,i){var x=g.x*env.width,y=g.y*env.height,span=Math.min(env.width,env.height)*.075;ctx.strokeStyle=hits.includes(i)?env.accent:"rgba(255,255,255,.24)";ctx.lineWidth=hits.includes(i)?6:3;ctx.beginPath();if(g.vertical){ctx.moveTo(x,y-span);ctx.lineTo(x,y+span);}else{ctx.moveTo(x-span,y);ctx.lineTo(x+span,y);}ctx.stroke();M.label(ctx,g.label,x+(g.vertical?12:0),y+(g.vertical?0:16),hits.includes(i)?env.accent:"rgba(255,255,255,.44)",8,g.vertical?"left":"center");});if(trail.length>1){ctx.beginPath();ctx.moveTo(trail[0].x*env.width,trail[0].y*env.height);trail.slice(1).forEach(function(p){ctx.lineTo(p.x*env.width,p.y*env.height);});ctx.strokeStyle=env.accent2;ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke();}}
        };
    });
}());
