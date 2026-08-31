(() => {
    const body = document.body;
    const stage = document.querySelector("[data-stage]");
    const canvas = document.querySelector("#lab-canvas");
    const stateLabel = document.querySelector("[data-state]");
    const prompt = document.querySelector("[data-prompt]");
    const fallback = document.querySelector("[data-fallback]");
    const actionButton = document.querySelector("[data-action]");

    if (!stage || !canvas || !stateLabel || !prompt || !fallback) {
        return;
    }

    const effect = body.dataset.effect;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0.7, y: 0.5, vx: 0, vy: 0, down: false, active: false };
    const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
    const mix = (start, end, amount) => start + (end - start) * amount;

    let renderer = null;
    let animationFrame = 0;
    let lastTime = 0;
    let inView = true;
    let reducedMotion = motionQuery.matches;

    function showFallback(message) {
        cancelAnimationFrame(animationFrame);
        fallback.hidden = false;
        fallback.textContent = message;
        stateLabel.textContent = "STATIC EXPLANATION";
        prompt.textContent = "当前浏览器无法启动此实验";
        if (actionButton) {
            actionButton.disabled = true;
        }
    }

    function getWebGLContext() {
        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            depth: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false
        });

        if (!gl) {
            throw new Error("WEBGL_UNAVAILABLE");
        }

        return gl;
    }

    function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(log || "SHADER_COMPILE_FAILED");
        }

        return shader;
    }

    function createProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(log || "PROGRAM_LINK_FAILED");
        }

        return program;
    }

    function makeFullscreenProgram(fragmentSource) {
        const gl = getWebGLContext();
        const vertexSource = `
            attribute vec2 aPosition;
            varying vec2 vUv;
            void main() {
                vUv = aPosition * 0.5 + 0.5;
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `;
        const program = createProgram(gl, vertexSource, fragmentSource);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.useProgram(program);
        const position = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        return {
            gl,
            program,
            uniform(name) { return gl.getUniformLocation(program, name); },
            draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
        };
    }

    function resizeCanvas(scale = 1) {
        const rawWidth = Math.max(1, stage.clientWidth * scale);
        const rawHeight = Math.max(1, stage.clientHeight * scale);
        const resolutionScale = Math.min(1, 1280 / rawWidth, 720 / rawHeight);
        const width = Math.max(1, Math.round(rawWidth * resolutionScale));
        const height = Math.max(1, Math.round(rawHeight * resolutionScale));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        return { width, height };
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
            image.src = url;
        });
    }

    function uploadTexture(gl, image) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        return texture;
    }

    function createReactionDiffusion() {
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
            throw new Error("CANVAS_UNAVAILABLE");
        }

        const fieldCanvas = document.createElement("canvas");
        const fieldContext = fieldCanvas.getContext("2d", { alpha: false });
        let width = 0;
        let height = 0;
        let fieldWidth = 0;
        let fieldHeight = 0;
        let a;
        let b;
        let nextA;
        let nextB;
        let imageData;

        function seed(cx, cy, radius) {
            const centerX = Math.round(cx * fieldWidth);
            const centerY = Math.round((1 - cy) * fieldHeight);
            const radiusSquared = radius * radius;

            for (let y = -radius; y <= radius; y += 1) {
                for (let x = -radius; x <= radius; x += 1) {
                    if (x * x + y * y > radiusSquared) continue;
                    const px = clamp(centerX + x, 1, fieldWidth - 2);
                    const py = clamp(centerY + y, 1, fieldHeight - 2);
                    const index = py * fieldWidth + px;
                    b[index] = 0.88 + Math.random() * 0.12;
                    a[index] = 0.1;
                }
            }
        }

        function reset() {
            a.fill(1);
            b.fill(0);
            for (let index = 0; index < 15; index += 1) {
                seed(0.38 + Math.random() * 0.55, 0.12 + Math.random() * 0.76, 2 + Math.floor(Math.random() * 4));
            }
            stateLabel.textContent = "FIELD RESEEDED";
            prompt.textContent = "继续拖动播种新的反应核";
        }

        function resize() {
            ({ width, height } = resizeCanvas(1));
            const nextWidth = stage.clientWidth < 700 ? 124 : 176;
            const nextHeight = Math.max(72, Math.round(nextWidth * height / width));
            if (fieldWidth === nextWidth && fieldHeight === nextHeight) return;
            fieldWidth = nextWidth;
            fieldHeight = nextHeight;
            fieldCanvas.width = fieldWidth;
            fieldCanvas.height = fieldHeight;
            const count = fieldWidth * fieldHeight;
            a = new Float32Array(count);
            b = new Float32Array(count);
            nextA = new Float32Array(count);
            nextB = new Float32Array(count);
            imageData = fieldContext.createImageData(fieldWidth, fieldHeight);
            reset();
        }

        function laplacian(field, x, y) {
            const left = x === 0 ? fieldWidth - 1 : x - 1;
            const right = x === fieldWidth - 1 ? 0 : x + 1;
            const top = y === 0 ? fieldHeight - 1 : y - 1;
            const bottom = y === fieldHeight - 1 ? 0 : y + 1;
            return (
                -field[y * fieldWidth + x]
                + 0.2 * (field[y * fieldWidth + left] + field[y * fieldWidth + right] + field[top * fieldWidth + x] + field[bottom * fieldWidth + x])
                + 0.05 * (field[top * fieldWidth + left] + field[top * fieldWidth + right] + field[bottom * fieldWidth + left] + field[bottom * fieldWidth + right])
            );
        }

        function simulate() {
            const feed = 0.0545;
            const kill = 0.062;
            for (let y = 0; y < fieldHeight; y += 1) {
                for (let x = 0; x < fieldWidth; x += 1) {
                    const index = y * fieldWidth + x;
                    const av = a[index];
                    const bv = b[index];
                    const reaction = av * bv * bv;
                    nextA[index] = clamp(av + 0.96 * laplacian(a, x, y) - reaction + feed * (1 - av), 0, 1);
                    nextB[index] = clamp(bv + 0.48 * laplacian(b, x, y) + reaction - (kill + feed) * bv, 0, 1);
                }
            }
            [a, nextA] = [nextA, a];
            [b, nextB] = [nextB, b];
        }

        function draw() {
            const pixels = imageData.data;
            for (let index = 0; index < b.length; index += 1) {
                const value = clamp((a[index] - b[index]) * 1.3, 0, 1);
                const edge = clamp(b[index] * 2.2, 0, 1);
                const offset = index * 4;
                pixels[offset] = 5 + 66 * edge + 22 * value;
                pixels[offset + 1] = 8 + 215 * edge + 28 * value;
                pixels[offset + 2] = 18 + 178 * edge + 92 * value;
                pixels[offset + 3] = 255;
            }
            fieldContext.putImageData(imageData, 0, 0);
            context.imageSmoothingEnabled = true;
            context.drawImage(fieldCanvas, 0, 0, width, height);
        }

        return {
            resize,
            render(time, delta, reduced) {
                if (!reduced) {
                    const steps = delta > 28 ? 2 : 4;
                    for (let index = 0; index < steps; index += 1) simulate();
                }
                draw();
            },
            pointer(input, type) {
                if ((type === "pointermove" && (input.down || input.active)) || type === "pointerdown") {
                    seed(input.x, input.y, input.down ? 5 : 3);
                    stateLabel.textContent = "REACTION SEEDED";
                }
            },
            action: reset
        };
    }

    function createSdfRayMarcher() {
        const shader = makeFullscreenProgram(`
            precision highp float;
            varying vec2 vUv;
            uniform vec2 uResolution;
            uniform vec2 uPointer;
            uniform float uTime;
            uniform float uMode;

            mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
            float sdSphere(vec3 p, float r) { return length(p) - r; }
            float sdBox(vec3 p, vec3 b) { vec3 q = abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
            float sdTorus(vec3 p, vec2 t) { return length(vec2(length(p.xz)-t.x,p.y))-t.y; }
            float smin(float a, float b, float k) { float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }

            float mapScene(vec3 p) {
                if (uMode < 0.5) {
                    p.xz *= rot(uTime*0.22);
                    float sphere = sdSphere(p, 1.05);
                    float ring = sdTorus(p.xzy, vec2(1.18, 0.2));
                    return smin(sphere, ring, 0.34);
                }
                if (uMode < 1.5) {
                    p.xy *= rot(p.z*0.52 + uTime*0.16);
                    float box = sdBox(p, vec3(0.82));
                    float cut = -sdSphere(p, 1.08);
                    return max(box, cut);
                }
                p.xz *= rot(uTime*0.16);
                vec3 q = mod(p + 1.15, 2.3) - 1.15;
                return sdSphere(q, 0.36) + 0.07*sin(p.x*3.0)*sin(p.y*3.0)*sin(p.z*3.0);
            }

            vec3 normalAt(vec3 p) {
                vec2 e=vec2(0.002,0.0);
                return normalize(vec3(mapScene(p+e.xyy)-mapScene(p-e.xyy),mapScene(p+e.yxy)-mapScene(p-e.yxy),mapScene(p+e.yyx)-mapScene(p-e.yyx)));
            }

            void main() {
                vec2 p=(gl_FragCoord.xy*2.0-uResolution.xy)/uResolution.y;
                float yaw=(uPointer.x-0.5)*1.5;
                float pitch=(uPointer.y-0.5)*0.8;
                vec3 ro=vec3(0.0,0.0,4.25);
                ro.xz*=rot(yaw);
                ro.yz*=rot(pitch);
                vec3 target=vec3(0.0);
                vec3 forward=normalize(target-ro);
                vec3 right=normalize(cross(forward,vec3(0.0,1.0,0.0)));
                vec3 up=cross(right,forward);
                vec3 rd=normalize(forward+p.x*right+p.y*up);
                float travel=0.0;
                float glow=0.0;
                float distance=0.0;
                bool hit=false;
                for(int i=0;i<56;i++) {
                    vec3 pos=ro+rd*travel;
                    distance=mapScene(pos);
                    glow+=exp(-9.0*abs(distance))*0.006;
                    if(distance<0.002){ hit=true; break; }
                    travel+=max(distance*0.76,0.012);
                    if(travel>8.0) break;
                }
                vec3 background=mix(vec3(0.012,0.018,0.04),vec3(0.06,0.025,0.02),max(0.0,p.y));
                vec3 color=background+glow*vec3(1.0,0.42,0.1);
                if(hit) {
                    vec3 pos=ro+rd*travel;
                    vec3 n=normalAt(pos);
                    vec3 light=normalize(vec3(-0.6,0.9,0.8));
                    float diffuse=max(dot(n,light),0.0);
                    float rim=pow(1.0-max(dot(n,-rd),0.0),2.4);
                    float bands=0.5+0.5*sin(pos.y*7.0+uTime);
                    color=mix(vec3(0.08,0.035,0.018),vec3(1.0,0.48,0.13),diffuse*0.78+bands*0.12)+rim*vec3(1.0,0.78,0.42);
                    color*=exp(-travel*0.055);
                }
                color*=1.0-0.18*dot(p,p);
                gl_FragColor=vec4(pow(max(color,0.0),vec3(0.82)),1.0);
            }
        `);
        const resolution = shader.uniform("uResolution");
        const time = shader.uniform("uTime");
        const pointerUniform = shader.uniform("uPointer");
        const modeUniform = shader.uniform("uMode");
        let width = 0;
        let height = 0;
        let mode = 0;
        let lastDraw = 0;

        function resize() {
            ({ width, height } = resizeCanvas(stage.clientWidth > 900 ? 0.66 : 0.78));
            shader.gl.viewport(0, 0, width, height);
        }

        function cycleMode() {
            mode = (mode + 1) % 3;
            stateLabel.textContent = ["SMOOTH UNION", "CARVED CUBE", "REPEATED FIELD"][mode];
            prompt.textContent = "形体已切换，继续移动指针观察";
        }

        return {
            resize,
            render(now, delta, reduced) {
                if (!reduced && now - lastDraw < 28) return;
                lastDraw = now;
                shader.gl.useProgram(shader.program);
                shader.gl.uniform2f(resolution, width, height);
                shader.gl.uniform2f(pointerUniform, pointer.x, pointer.y);
                shader.gl.uniform1f(time, reduced ? 0.7 : now * 0.001);
                shader.gl.uniform1f(modeUniform, mode);
                shader.draw();
            },
            pointer(input, type) { if (type === "pointerdown") cycleMode(); },
            action: cycleMode
        };
    }

    function createGpuParticles() {
        const gl = getWebGLContext();
        const vertexSource = `
            precision highp float;
            attribute vec4 aSeed;
            uniform vec2 uResolution;
            uniform vec2 uPointer;
            uniform float uTime;
            uniform float uBurst;
            varying float vEnergy;
            varying vec3 vColor;
            void main() {
                float angle=aSeed.x*6.2831853 + uTime*(0.08+aSeed.z*0.08);
                float band=(aSeed.y-0.5)*2.0;
                float radius=0.18+aSeed.x*1.15+0.08*sin(uTime*0.7+aSeed.z*19.0);
                vec2 p=vec2(cos(angle),sin(angle))*radius;
                p.y+=band*0.72+0.2*sin(angle*3.0+aSeed.z*9.0+uTime*0.5);
                p.x+=0.22*sin(band*4.0+uTime+aSeed.z*7.0);
                vec2 mouse=(uPointer-0.5)*vec2(uResolution.x/uResolution.y,1.0)*2.0;
                vec2 delta=p-mouse;
                float influence=exp(-dot(delta,delta)*2.2);
                p+=normalize(delta+0.0001)*influence*(0.23+uBurst*0.42);
                p+=normalize(p+0.0001)*uBurst*(0.2+0.7*aSeed.z);
                p.x*=uResolution.y/uResolution.x;
                gl_Position=vec4(p,0.0,1.0);
                gl_PointSize=(1.1+aSeed.w*2.4)*(0.85+influence*1.8);
                vEnergy=influence+uBurst*0.8;
                vColor=mix(vec3(0.35,0.55,1.0),vec3(0.76,0.47,1.0),aSeed.z)+vEnergy*vec3(0.22,0.32,0.5);
            }
        `;
        const fragmentSource = `
            precision mediump float;
            varying float vEnergy;
            varying vec3 vColor;
            void main() {
                vec2 p=gl_PointCoord-0.5;
                float alpha=smoothstep(0.5,0.05,length(p))*(0.42+vEnergy*0.34);
                gl_FragColor=vec4(vColor,alpha);
            }
        `;
        const program = createProgram(gl, vertexSource, fragmentSource);
        const count = stage.clientWidth < 700 ? 9000 : 18000;
        const seeds = new Float32Array(count * 4);
        for (let index = 0; index < count; index += 1) {
            seeds[index * 4] = index / count;
            seeds[index * 4 + 1] = Math.random();
            seeds[index * 4 + 2] = Math.random();
            seeds[index * 4 + 3] = Math.random();
        }
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
        gl.useProgram(program);
        const seedLocation = gl.getAttribLocation(program, "aSeed");
        gl.enableVertexAttribArray(seedLocation);
        gl.vertexAttribPointer(seedLocation, 4, gl.FLOAT, false, 0, 0);
        const resolution = gl.getUniformLocation(program, "uResolution");
        const pointerUniform = gl.getUniformLocation(program, "uPointer");
        const time = gl.getUniformLocation(program, "uTime");
        const burst = gl.getUniformLocation(program, "uBurst");
        let width = 0;
        let height = 0;
        let burstAt = -10;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        return {
            resize() {
                ({ width, height } = resizeCanvas(0.82));
                gl.viewport(0, 0, width, height);
            },
            render(now, delta, reduced) {
                const seconds = reduced ? 0.8 : now * 0.001;
                const pulse = reduced ? 0 : Math.max(0, 1 - (seconds - burstAt) / 1.15);
                gl.clearColor(0.015, 0.022, 0.055, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(program);
                gl.uniform2f(resolution, width, height);
                gl.uniform2f(pointerUniform, pointer.x, pointer.y);
                gl.uniform1f(time, seconds);
                gl.uniform1f(burst, pulse * pulse);
                gl.drawArrays(gl.POINTS, 0, count);
            },
            action() {
                burstAt = performance.now() * 0.001;
                stateLabel.textContent = "PARTICLE BURST";
                prompt.textContent = "脉冲正在穿过顶点流场";
            }
        };
    }

    async function createImageShader(kind) {
        const isLens = kind === "lens";
        const shader = makeFullscreenProgram(`
            precision highp float;
            varying vec2 vUv;
            uniform sampler2D uImage;
            uniform vec2 uResolution;
            uniform vec2 uImageSize;
            uniform vec2 uPointer;
            uniform vec2 uVelocity;
            uniform float uTime;
            uniform float uPulse;

            vec2 coverUv(vec2 uv) {
                float screenAspect=uResolution.x/uResolution.y;
                float imageAspect=uImageSize.x/uImageSize.y;
                if(screenAspect>imageAspect) uv.y=(uv.y-0.5)*(imageAspect/screenAspect)+0.5;
                else uv.x=(uv.x-0.5)*(screenAspect/imageAspect)+0.5;
                return uv;
            }

            void main() {
                vec2 screenUv=vUv;
                vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);
                vec2 delta=(screenUv-uPointer)*aspect;
                vec2 sampleUv=coverUv(screenUv);
                vec3 color;
                ${isLens ? `
                    float radius=0.18+uPulse*0.035;
                    float distance=length(delta);
                    float inside=1.0-smoothstep(radius-0.008,radius+0.008,distance);
                    float sphere=sqrt(max(0.0,1.0-distance*distance/(radius*radius)));
                    vec2 refractedScreen=uPointer+(screenUv-uPointer)*mix(1.0,0.68-0.08*uPulse,inside*sphere);
                    vec2 refracted=coverUv(refractedScreen);
                    vec2 dispersion=normalize(delta+0.0001)*(1.0-sphere)*0.008*inside;
                    color=vec3(texture2D(uImage,refracted+dispersion).r,texture2D(uImage,refracted).g,texture2D(uImage,refracted-dispersion).b);
                    vec3 base=texture2D(uImage,sampleUv).rgb;
                    color=mix(base,color,inside);
                    float rim=inside*smoothstep(radius-0.022,radius-0.006,distance);
                    float sheen=pow(max(0.0,dot(normalize(delta+0.0001),normalize(vec2(-0.65,0.75)))),12.0)*inside;
                    color+=rim*vec3(0.22,0.62,0.78)+sheen*0.55;
                ` : `
                    vec2 direction=uVelocity*(0.012+uPulse*0.028);
                    float wave=sin((screenUv.y+uTime*0.08)*42.0)*0.0015*(length(uVelocity)+uPulse);
                    direction.x+=wave;
                    vec2 rUv=coverUv(screenUv+direction);
                    vec2 bUv=coverUv(screenUv-direction);
                    color=vec3(texture2D(uImage,rUv).r,texture2D(uImage,sampleUv).g,texture2D(uImage,bUv).b);
                    float glitch=smoothstep(0.72,1.0,sin(screenUv.y*84.0+uTime*7.0)*0.5+0.5)*uPulse;
                    color=mix(color,vec3(color.b,color.r,color.g),glitch*0.36);
                `}
                color*=0.82+0.18*smoothstep(0.92,0.18,length((screenUv-0.5)*vec2(0.78,1.0)));
                gl_FragColor=vec4(pow(max(color,0.0),vec3(0.92)),1.0);
            }
        `);
        const image = await loadImage(body.dataset.image);
        const gl = shader.gl;
        uploadTexture(gl, image);
        const resolution = shader.uniform("uResolution");
        const imageSize = shader.uniform("uImageSize");
        const pointerUniform = shader.uniform("uPointer");
        const velocity = shader.uniform("uVelocity");
        const time = shader.uniform("uTime");
        const pulse = shader.uniform("uPulse");
        gl.uniform1i(shader.uniform("uImage"), 0);
        let width = 0;
        let height = 0;
        let smoothX = pointer.x;
        let smoothY = pointer.y;
        let velocityX = 0;
        let velocityY = 0;
        let pulseAt = -10;

        return {
            resize() {
                ({ width, height } = resizeCanvas(0.82));
                gl.viewport(0, 0, width, height);
            },
            render(now, delta, reduced) {
                const ease = reduced ? 1 : 1 - Math.pow(0.84, Math.max(1, delta / 16.67));
                smoothX = mix(smoothX, pointer.x, ease);
                smoothY = mix(smoothY, pointer.y, ease);
                velocityX = reduced ? 0 : mix(velocityX, pointer.vx, 0.16);
                velocityY = reduced ? 0 : mix(velocityY, pointer.vy, 0.16);
                const seconds = reduced ? 0 : now * 0.001;
                const activePulse = reduced ? 0 : Math.max(0, 1 - (seconds - pulseAt) / 0.9);
                gl.useProgram(shader.program);
                gl.uniform2f(resolution, width, height);
                gl.uniform2f(imageSize, image.naturalWidth, image.naturalHeight);
                gl.uniform2f(pointerUniform, smoothX, smoothY);
                gl.uniform2f(velocity, clamp(velocityX * 14, -1, 1), clamp(-velocityY * 14, -1, 1));
                gl.uniform1f(time, seconds);
                gl.uniform1f(pulse, activePulse * activePulse);
                shader.draw();
                pointer.vx *= 0.9;
                pointer.vy *= 0.9;
            },
            pointer(input, type) {
                if (type === "pointerdown") pulseAt = performance.now() * 0.001;
                if (type === "pointermove") {
                    stateLabel.textContent = isLens ? "LENS REFRACTING" : "CHANNELS SEPARATING";
                }
            },
            action() {
                pulseAt = performance.now() * 0.001;
                stateLabel.textContent = isLens ? "CURVATURE BOOSTED" : "CHROMATIC PULSE";
                prompt.textContent = isLens ? "曲率增强后会缓慢恢复" : "三色通道正在快速错位";
            }
        };
    }

    function createAfterimage() {
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("CANVAS_UNAVAILABLE");
        const first = document.createElement("canvas");
        const second = document.createElement("canvas");
        let source = first;
        let destination = second;
        let sourceContext = source.getContext("2d");
        let destinationContext = destination.getContext("2d");
        let width = 0;
        let height = 0;
        let lastX = 0;
        let lastY = 0;

        function clear() {
            [sourceContext, destinationContext, context].forEach((target) => {
                target.setTransform(1, 0, 0, 1, 0, 0);
                target.fillStyle = "#050711";
                target.fillRect(0, 0, width, height);
            });
            stateLabel.textContent = "TIME CLEARED";
            prompt.textContent = "拖动开始一条新的残像轨迹";
        }

        function resize() {
            ({ width, height } = resizeCanvas(0.74));
            first.width = width;
            first.height = height;
            second.width = width;
            second.height = height;
            sourceContext = source.getContext("2d");
            destinationContext = destination.getContext("2d");
            clear();
            lastX = pointer.x * width;
            lastY = (1 - pointer.y) * height;
        }

        function light(target, x, y, radius, hue) {
            const gradient = target.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `hsla(${hue}, 100%, 82%, 0.95)`);
            gradient.addColorStop(0.16, `hsla(${hue}, 95%, 68%, 0.58)`);
            gradient.addColorStop(1, `hsla(${hue}, 95%, 52%, 0)`);
            target.fillStyle = gradient;
            target.beginPath();
            target.arc(x, y, radius, 0, Math.PI * 2);
            target.fill();
        }

        function render(now, delta, reduced) {
            destinationContext.setTransform(1, 0, 0, 1, 0, 0);
            destinationContext.fillStyle = "rgba(5,7,17,0.075)";
            destinationContext.fillRect(0, 0, width, height);
            destinationContext.save();
            destinationContext.translate(width / 2, height / 2);
            if (!reduced) destinationContext.rotate(Math.sin(now * 0.00023) * 0.0015);
            destinationContext.scale(1.004, 1.004);
            destinationContext.translate(-width / 2, -height / 2);
            destinationContext.globalAlpha = reduced ? 0.9 : 0.963;
            destinationContext.drawImage(source, 0, 0);
            destinationContext.restore();
            destinationContext.globalAlpha = 1;
            destinationContext.globalCompositeOperation = "lighter";

            const targetX = pointer.active ? pointer.x * width : width * (0.69 + Math.sin(now * 0.00051) * 0.12);
            const targetY = pointer.active ? (1 - pointer.y) * height : height * (0.49 + Math.cos(now * 0.00067) * 0.19);
            const x = reduced ? targetX : mix(lastX, targetX, 0.28);
            const y = reduced ? targetY : mix(lastY, targetY, 0.28);
            const speed = Math.hypot(x - lastX, y - lastY);
            light(destinationContext, x, y, 22 + Math.min(64, speed * 2.5), (now * 0.035) % 360);
            if (!reduced) {
                destinationContext.strokeStyle = `hsla(${(now * 0.035 + 45) % 360},100%,72%,${Math.min(0.72, 0.18 + speed * 0.025)})`;
                destinationContext.lineWidth = 1.2 + Math.min(5, speed * 0.08);
                destinationContext.beginPath();
                destinationContext.moveTo(lastX, lastY);
                destinationContext.lineTo(x, y);
                destinationContext.stroke();
            }
            destinationContext.globalCompositeOperation = "source-over";
            context.drawImage(destination, 0, 0, width, height);
            [source, destination] = [destination, source];
            [sourceContext, destinationContext] = [destinationContext, sourceContext];
            lastX = x;
            lastY = y;
        }

        return {
            resize,
            render,
            pointer(input, type) {
                if (type === "pointermove" || type === "pointerdown") {
                    stateLabel.textContent = "TRAIL RECORDING";
                    prompt.textContent = "上一帧正在回灌下一帧";
                }
            },
            action: clear
        };
    }

    function createGodRays() {
        const shader = makeFullscreenProgram(`
            precision highp float;
            varying vec2 vUv;
            uniform vec2 uResolution;
            uniform vec2 uLight;
            uniform float uTime;
            uniform float uPulse;

            float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
            float obstacle(vec2 uv) {
                vec2 p=uv-0.5;
                float ground=step(p.y,-0.25+0.03*sin(p.x*9.0));
                float tower=step(abs(p.x+0.08),0.085)*step(-0.18,p.y)*step(p.y,0.22);
                float archOuter=1.0-step(length(vec2((p.x-0.17)*1.2,p.y+0.03)),0.24);
                float archInner=step(length(vec2((p.x-0.17)*1.2,p.y+0.03)),0.135);
                float arch=(1.0-archOuter)*(1.0-archInner)*step(p.y,-0.01);
                float shards=step(abs(p.x+0.34+0.08*sin(p.y*8.0)),0.018)*step(-0.22,p.y)*step(p.y,0.12);
                return clamp(ground+tower+arch+shards,0.0,1.0);
            }

            void main() {
                vec2 uv=vUv;
                vec2 light=uLight;
                float aspect=uResolution.x/uResolution.y;
                vec2 delta=(uv-light)/32.0;
                vec2 sampleUv=uv;
                float illumination=0.0;
                float decay=1.0;
                for(int i=0;i<32;i++) {
                    sampleUv-=delta;
                    float visibility=1.0-obstacle(sampleUv);
                    float dust=0.78+0.22*sin(sampleUv.y*97.0+hash(floor(sampleUv*120.0))*6.0+uTime*0.3);
                    illumination+=visibility*dust*decay;
                    decay*=0.955;
                }
                illumination/=32.0;
                vec2 lightDelta=(uv-light)*vec2(aspect,1.0);
                float sun=exp(-dot(lightDelta,lightDelta)*45.0);
                float mask=obstacle(uv);
                vec3 sky=mix(vec3(0.015,0.024,0.055),vec3(0.16,0.09,0.035),1.0-uv.y);
                vec3 rays=vec3(1.0,0.66,0.24)*illumination*(1.2+uPulse*1.4);
                vec3 color=sky+rays+sun*vec3(1.0,0.82,0.48)*(1.4+uPulse);
                color=mix(color,vec3(0.008,0.009,0.015),mask*0.94);
                color*=0.9+0.1*sin(uv.y*3.14);
                gl_FragColor=vec4(pow(max(color,0.0),vec3(0.82)),1.0);
            }
        `);
        const resolution = shader.uniform("uResolution");
        const light = shader.uniform("uLight");
        const time = shader.uniform("uTime");
        const pulse = shader.uniform("uPulse");
        let width = 0;
        let height = 0;
        let lightX = pointer.x;
        let lightY = pointer.y;
        let pulseAt = -10;
        let lastDraw = 0;

        return {
            resize() {
                ({ width, height } = resizeCanvas(stage.clientWidth > 900 ? 0.7 : 0.8));
                shader.gl.viewport(0, 0, width, height);
            },
            render(now, delta, reduced) {
                if (!reduced && now - lastDraw < 28) return;
                lastDraw = now;
                const seconds = reduced ? 0.6 : now * 0.001;
                lightX = mix(lightX, pointer.x, reduced ? 1 : 0.06);
                lightY = mix(lightY, pointer.y, reduced ? 1 : 0.06);
                const activePulse = reduced ? 0 : Math.max(0, 1 - (seconds - pulseAt) / 1.25);
                shader.gl.useProgram(shader.program);
                shader.gl.uniform2f(resolution, width, height);
                shader.gl.uniform2f(light, lightX, lightY);
                shader.gl.uniform1f(time, seconds);
                shader.gl.uniform1f(pulse, activePulse * activePulse);
                shader.draw();
            },
            pointer(input, type) {
                if (type === "pointerdown") {
                    pulseAt = performance.now() * 0.001;
                    stateLabel.textContent = "DENSITY BOOSTED";
                }
            },
            action() {
                pulseAt = performance.now() * 0.001;
                stateLabel.textContent = "DENSITY BOOSTED";
                prompt.textContent = "雾的散射密度正在增强";
            }
        };
    }

    function createMorphTargets() {
        const gl = getWebGLContext();
        const vertexSource = `
            precision highp float;
            attribute vec3 aSphere;
            attribute vec3 aTorus;
            attribute vec3 aKnot;
            attribute float aSeed;
            uniform vec2 uResolution;
            uniform vec2 uPointer;
            uniform vec3 uWeights;
            uniform float uTime;
            varying float vSeed;
            varying float vDepth;
            mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
            void main(){
                vec3 p=aSphere*uWeights.x+aTorus*uWeights.y+aKnot*uWeights.z;
                p.xz*=rot((uPointer.x-0.5)*1.5+uTime*0.08);
                p.yz*=rot((uPointer.y-0.5)*0.9);
                p*=1.0+0.035*sin(uTime*1.3+aSeed*25.0);
                float z=p.z-4.8;
                float aspect=uResolution.x/uResolution.y;
                gl_Position=vec4(p.x*2.0/aspect,p.y*2.0,(-z)-0.2,-z);
                gl_PointSize=(1.4+2.2*aSeed)*(5.2/(-z));
                vSeed=aSeed;
                vDepth=clamp((p.z+1.8)/3.6,0.0,1.0);
            }
        `;
        const fragmentSource = `
            precision mediump float;
            varying float vSeed;
            varying float vDepth;
            void main(){
                vec2 p=gl_PointCoord-0.5;
                float alpha=smoothstep(0.5,0.08,length(p));
                vec3 color=mix(vec3(0.25,0.64,1.0),vec3(0.48,1.0,0.72),vDepth);
                color=mix(color,vec3(0.88,0.54,1.0),smoothstep(0.72,1.0,vSeed));
                gl_FragColor=vec4(color,alpha*0.82);
            }
        `;
        const program = createProgram(gl, vertexSource, fragmentSource);
        const count = stage.clientWidth < 700 ? 8000 : 15000;
        const sphere = new Float32Array(count * 3);
        const torus = new Float32Array(count * 3);
        const knot = new Float32Array(count * 3);
        const seeds = new Float32Array(count);
        const golden = Math.PI * (3 - Math.sqrt(5));

        for (let index = 0; index < count; index += 1) {
            const t = (index + 0.5) / count;
            const sphereY = 1 - 2 * t;
            const sphereRadius = Math.sqrt(1 - sphereY * sphereY);
            const sphereAngle = golden * index;
            sphere[index * 3] = Math.cos(sphereAngle) * sphereRadius * 1.42;
            sphere[index * 3 + 1] = sphereY * 1.42;
            sphere[index * 3 + 2] = Math.sin(sphereAngle) * sphereRadius * 1.42;

            const u = (index * golden) % (Math.PI * 2);
            const v = ((index * 0.754877666) % 1) * Math.PI * 2;
            const major = 1.08;
            const minor = 0.38;
            torus[index * 3] = (major + minor * Math.cos(v)) * Math.cos(u);
            torus[index * 3 + 1] = minor * Math.sin(v);
            torus[index * 3 + 2] = (major + minor * Math.cos(v)) * Math.sin(u);

            const ku = t * Math.PI * 2;
            const tube = 0.17;
            const centerX = (Math.sin(ku) + 2 * Math.sin(2 * ku)) * 0.48;
            const centerY = (Math.cos(ku) - 2 * Math.cos(2 * ku)) * 0.48;
            const centerZ = -Math.sin(3 * ku) * 0.48;
            knot[index * 3] = centerX + tube * Math.cos(v) * Math.cos(ku);
            knot[index * 3 + 1] = centerY + tube * Math.sin(v);
            knot[index * 3 + 2] = centerZ + tube * Math.cos(v) * Math.sin(ku);
            seeds[index] = Math.random();
        }

        function attribute(name, size, data) {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            const location = gl.getAttribLocation(program, name);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
        }

        gl.useProgram(program);
        attribute("aSphere", 3, sphere);
        attribute("aTorus", 3, torus);
        attribute("aKnot", 3, knot);
        attribute("aSeed", 1, seeds);
        const resolution = gl.getUniformLocation(program, "uResolution");
        const pointerUniform = gl.getUniformLocation(program, "uPointer");
        const weights = gl.getUniformLocation(program, "uWeights");
        const time = gl.getUniformLocation(program, "uTime");
        let width = 0;
        let height = 0;
        let current = 0;
        let previous = 0;
        let transitionAt = 0;
        let transition = 1;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        function nextTarget() {
            previous = current;
            current = (current + 1) % 3;
            transition = 0;
            transitionAt = performance.now();
            stateLabel.textContent = ["SPHERE TARGET", "TORUS TARGET", "TREFOIL TARGET"][current];
            prompt.textContent = "顶点正在迁移到新的目标坐标";
        }

        return {
            resize() {
                ({ width, height } = resizeCanvas(0.82));
                gl.viewport(0, 0, width, height);
            },
            render(now, delta, reduced) {
                if (!reduced && transition < 1) transition = clamp((now - transitionAt) / 1450, 0, 1);
                if (!reduced && transition === 1 && now - transitionAt > 6800) nextTarget();
                const eased = reduced ? 1 : transition * transition * (3 - 2 * transition);
                const shapeWeights = [0, 0, 0];
                shapeWeights[previous] = 1 - eased;
                shapeWeights[current] += eased;
                gl.clearColor(0.012, 0.02, 0.045, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(program);
                gl.uniform2f(resolution, width, height);
                gl.uniform2f(pointerUniform, pointer.x, pointer.y);
                gl.uniform3f(weights, shapeWeights[0], shapeWeights[1], shapeWeights[2]);
                gl.uniform1f(time, reduced ? 0.4 : now * 0.001);
                gl.drawArrays(gl.POINTS, 0, count);
            },
            pointer(input, type) { if (type === "pointerdown") nextTarget(); },
            action: nextTarget
        };
    }

    const factories = {
        "reaction-diffusion": createReactionDiffusion,
        "sdf-ray-marching": createSdfRayMarcher,
        "gpgpu-particles": createGpuParticles,
        "lens-refraction": () => createImageShader("lens"),
        "rgb-shift": () => createImageShader("rgb"),
        "afterimage-feedback": createAfterimage,
        "volumetric-god-rays": createGodRays,
        "morph-targets": createMorphTargets
    };

    function resize() {
        renderer?.resize();
        renderer?.render(performance.now(), 0, reducedMotion);
    }

    function frame(now) {
        animationFrame = 0;
        if (!renderer || reducedMotion || document.hidden || !inView) return;
        const delta = lastTime ? Math.min(now - lastTime, 50) : 16.67;
        lastTime = now;
        renderer.render(now, delta, false);
        animationFrame = requestAnimationFrame(frame);
    }

    function start() {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        lastTime = 0;
        if (!renderer) return;
        if (reducedMotion) {
            renderer.render(performance.now(), 0, true);
            return;
        }
        if (!document.hidden && inView) animationFrame = requestAnimationFrame(frame);
    }

    function updatePointer(event) {
        const bounds = stage.getBoundingClientRect();
        const nextX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
        const nextY = clamp(1 - (event.clientY - bounds.top) / bounds.height, 0, 1);
        pointer.vx = nextX - pointer.x;
        pointer.vy = nextY - pointer.y;
        pointer.x = nextX;
        pointer.y = nextY;
        pointer.active = true;
        renderer?.pointer?.(pointer, event.type, event);
    }

    stage.addEventListener("pointerdown", (event) => {
        if (reducedMotion || event.target.closest("a, button")) return;
        pointer.down = true;
        updatePointer(event);
        stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener("pointermove", (event) => {
        if (reducedMotion || (event.pointerType !== "mouse" && !pointer.down)) return;
        updatePointer(event);
    });
    stage.addEventListener("pointerup", (event) => {
        pointer.down = false;
        updatePointer(event);
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    });
    stage.addEventListener("pointercancel", () => { pointer.down = false; });
    stage.addEventListener("pointerleave", () => { if (!pointer.down) pointer.active = false; });

    actionButton?.addEventListener("click", () => {
        if (!reducedMotion) renderer?.action?.(actionButton.dataset.action);
    });

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", start);
    motionQuery.addEventListener("change", () => {
        reducedMotion = motionQuery.matches;
        actionButton.disabled = reducedMotion;
        if (reducedMotion) {
            stateLabel.textContent = "MOTION REDUCED";
            prompt.textContent = "已按系统偏好显示静态帧";
        }
        start();
    });

    const observer = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        start();
    }, { threshold: 0.05 });
    observer.observe(stage);

    async function initialize() {
        const factory = factories[effect];
        if (!factory) {
            showFallback("未找到这个实验的渲染器。请返回 Motion Field 选择其他页面。");
            return;
        }

        try {
            renderer = await factory();
            renderer.resize();
            stage.classList.add("is-ready");
            if (reducedMotion) {
                stateLabel.textContent = "MOTION REDUCED";
                prompt.textContent = "已按系统偏好显示静态帧";
                if (actionButton) actionButton.disabled = true;
            }
            start();
        } catch (error) {
            const message = error.message === "WEBGL_UNAVAILABLE"
                ? "这个实验需要 WebGL。当前浏览器或图形设置没有提供 WebGL，因此这里保留原理说明，不伪装动态结果。"
                : error.message === "IMAGE_LOAD_FAILED"
                    ? "实验背景图像没有加载成功，因此暂不启动采样着色器。"
                    : "实验渲染器启动失败。你仍可阅读左侧原理说明，或返回目录尝试其他效果。";
            showFallback(message);
            console.error(error);
        }
    }

    initialize();
})();
