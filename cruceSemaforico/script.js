const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const UI = {
    startBtn: document.getElementById('btn-start'),
    stopBtn: document.getElementById('btn-stop'),
    statVehicles: document.getElementById('stat-vehicles'),
    statPedestrians: document.getElementById('stat-pedestrians'),
    tlNS: document.getElementById('stat-tl-ns'),
    tlEW: document.getElementById('stat-tl-ew')
};

// Utilidad para simular "hilos" o esperas asíncronas
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ----- CONSTANTES DEL ENTORNO -----
const LANE_WIDTH = 100;
const CANVAS_SIZE = 800;

const ROAD_NS = { x: (CANVAS_SIZE - LANE_WIDTH) / 2, width: LANE_WIDTH, direction: 'UP' }; // Va de Sur a Norte
const ROAD_EW = { y: (CANVAS_SIZE - LANE_WIDTH) / 2, height: LANE_WIDTH, direction: 'RIGHT' }; // Va de Oeste a Este

const STOP_LINE_NS = ROAD_EW.y + ROAD_EW.height + 10;
const STOP_LINE_EW = ROAD_NS.x - 10;

const CROSSWALK_Y = ROAD_EW.y - 60; // Zebra peatonal al norte de la intersección

class TrafficLight {
    constructor(orientation, x, y) {
        this.orientation = orientation; // 'NS' o 'EW' o 'PEDESTRIAN'
        this.state = 'RED'; // RED, YELLOW, GREEN
        this.x = x;
        this.y = y;
    }

    async changeState(newState, uiElement) {
        this.state = newState;
        if (uiElement) {
            uiElement.textContent = newState === 'RED' ? 'Rojo' : (newState === 'YELLOW' ? 'Amarillo' : 'Verde');
            uiElement.className = `value traffic-value ${newState.toLowerCase()}`;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x, this.y, 30, 80);
        ctx.fillStyle = this.state === 'RED' ? '#ff3b30' : '#440000';
        ctx.beginPath(); ctx.arc(this.x + 15, this.y + 15, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = this.state === 'YELLOW' ? '#ffcc00' : '#444400';
        ctx.beginPath(); ctx.arc(this.x + 15, this.y + 40, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = this.state === 'GREEN' ? '#34c759' : '#004400';
        ctx.beginPath(); ctx.arc(this.x + 15, this.y + 65, 10, 0, Math.PI * 2); ctx.fill();
    }
}

class PedestrianLight {
    constructor(x, y) {
        this.state = 'RED'; // RED or GREEN
        this.x = x;
        this.y = y;
    }

    draw(ctx) {
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x, this.y, 40, 20);
        ctx.fillStyle = this.state === 'RED' ? '#ff3b30' : '#440000';
        ctx.beginPath(); ctx.arc(this.x + 10, this.y + 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = this.state === 'GREEN' ? '#34c759' : '#004400';
        ctx.beginPath(); ctx.arc(this.x + 30, this.y + 10, 6, 0, Math.PI * 2); ctx.fill();
    }
}

class Actor {
    constructor(x, y, speed, color) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.color = color;
        this.active = true;
    }
    move() {}
    draw(ctx) {}
}

class Vehicle extends Actor {
    constructor(direction) {
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        super(0, 0, Math.random() * 1.5 + 2, colors[Math.floor(Math.random() * colors.length)]);
        this.direction = direction; // 'UP' or 'RIGHT'
        this.width = direction === 'UP' ? 40 : 60;
        this.height = direction === 'UP' ? 60 : 40;
        
        if (direction === 'UP') {
            this.x = ROAD_NS.x + 50; // Carril derecho
            this.y = CANVAS_SIZE + 50; // Inicia abajo
        } else {
            this.x = -50; // Inicia izquierda
            this.y = ROAD_EW.y + 50; // Carril inferior
        }
    }

    checkStop(lights, vehicles) {
        let shouldStop = false;

        // Verificar Semáforos
        if (this.direction === 'UP') {
            const tl = lights.ns;
            const distToLight = this.y - STOP_LINE_NS;
            if (tl.state !== 'GREEN' && distToLight > 0 && distToLight < 80) {
                shouldStop = true;
            }
        } else {
            const tl = lights.ew;
            const distToLight = STOP_LINE_EW - (this.x + this.width);
            if (tl.state !== 'GREEN' && distToLight > 0 && distToLight < 80) {
                shouldStop = true;
            }
        }

        // Evitar colisiones traseras
        vehicles.forEach(v => {
            if (v !== this && v.active && v.direction === this.direction) {
                if (this.direction === 'UP') {
                    if (this.y > v.y && (this.y - (v.y + v.height)) < 30) shouldStop = true;
                } else {
                    if (this.x < v.x && (v.x - (this.x + this.width)) < 30) shouldStop = true;
                }
            }
        });

        return shouldStop;
    }

    move(lights, vehicles) {
        if (!this.checkStop(lights, vehicles)) {
            if (this.direction === 'UP') this.y -= this.speed;
            else this.x += this.speed;
        }

        // Desactivar si sale del mapa
        if (this.y < -100 || this.x > CANVAS_SIZE + 100) this.active = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height, 8);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        
        // Window
        ctx.fillStyle = '#111';
        if(this.direction === 'UP') {
            ctx.fillRect(this.x - this.width/2 + 5, this.y - this.height/2 + 10, this.width - 10, 15); // Windshield
        } else {
            ctx.fillRect(this.x - this.width/2 + 35, this.y - this.height/2 + 5, 15, this.height - 10); // Windshield
        }
    }
}

class Pedestrian extends Actor {
    constructor() {
        super(ROAD_NS.x - 40, CROSSWALK_Y + 15, Math.random() * 0.5 + 1, '#ffffff');
        this.state = 'WAITING'; // WAITING, CROSSING, DONE
        this.radius = 10;
    }

    move(pedLight) {
        if (this.state === 'WAITING' && pedLight.state === 'GREEN') {
            this.state = 'CROSSING';
        }

        if (this.state === 'CROSSING') {
            this.x += this.speed;
            if (this.x > ROAD_NS.x + ROAD_NS.width + 20) {
                this.state = 'DONE';
                this.active = false;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Simulation {
    constructor() {
        this.isRunning = false;
        this.lights = {
            ns: new TrafficLight('NS', ROAD_NS.x + ROAD_NS.width + 10, ROAD_EW.y + ROAD_EW.height + 10),
            ew: new TrafficLight('EW', ROAD_NS.x - 50, ROAD_EW.y + ROAD_EW.height + 10),
            ped: new PedestrianLight(ROAD_NS.x - 50, CROSSWALK_Y + 5)
        };
        this.vehicles = [];
        this.pedestrians = [];
        this.stats = { v: 0, p: 0 };
    }

    drawBackground() {
        // Asfalto
        ctx.fillStyle = '#2e3035';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        ctx.fillStyle = '#444';
        
        // Vía NS
        ctx.fillRect(ROAD_NS.x, 0, ROAD_NS.width, CANVAS_SIZE);
        // Vía EW
        ctx.fillRect(0, ROAD_EW.y, CANVAS_SIZE, ROAD_EW.height);

        // Líneas Divisorias
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([20, 20]);
        ctx.lineWidth = 4;
        
        // Línea central NS
        ctx.beginPath();
        ctx.moveTo(ROAD_NS.x + ROAD_NS.width / 2, 0);
        ctx.lineTo(ROAD_NS.x + ROAD_NS.width / 2, CANVAS_SIZE);
        ctx.stroke();

        // Línea EW
        ctx.strokeStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(0, ROAD_EW.y + ROAD_EW.height / 2);
        ctx.lineTo(CANVAS_SIZE, ROAD_EW.y + ROAD_EW.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Paso Peatonal (Cebra)
        ctx.fillStyle = '#fff';
        for(let i=0; i<ROAD_NS.width; i+=20) {
            ctx.fillRect(ROAD_NS.x + i + 2, CROSSWALK_Y, 15, 30);
        }

        // Stop Lines
        ctx.fillStyle = '#fff';
        // NS (subiendo)
        ctx.fillRect(ROAD_NS.x + ROAD_NS.width/2, STOP_LINE_NS, ROAD_NS.width/2, 6);
        // EW (derecha)
        ctx.fillRect(STOP_LINE_EW, ROAD_EW.y + ROAD_EW.height/2, 6, ROAD_EW.height/2);
    }

    async runTrafficLightCycle() {
        while (this.isRunning) {
            // Fase 1: NS Verde, EW Rojo, Peatones Rojo
            await this.lights.ns.changeState('GREEN', UI.tlNS);
            await this.lights.ew.changeState('RED', UI.tlEW);
            this.lights.ped.state = 'RED';
            await sleep(5000); // Tiempos ajustados para fluidez

            if(!this.isRunning) break;

            // Transición a Rojo para NS
            await this.lights.ns.changeState('YELLOW', UI.tlNS);
            await sleep(2000);
            await this.lights.ns.changeState('RED', UI.tlNS);
            await sleep(1000); // Todos en rojo por seguridad

            if(!this.isRunning) break;

            // Fase 2: EW Verde, NS Rojo
            await this.lights.ew.changeState('GREEN', UI.tlEW);
            await sleep(5000);

            if(!this.isRunning) break;

            // Transición a Rojo para EW
            await this.lights.ew.changeState('YELLOW', UI.tlEW);
            await sleep(2000);
            await this.lights.ew.changeState('RED', UI.tlEW);
            await sleep(1000);

            if(!this.isRunning) break;

            // Fase 3: Peatones
            this.lights.ped.state = 'GREEN';
            // NS Rojo, EW Rojo se mantienen
            await sleep(4000); // Tiempo para pasar
            this.lights.ped.state = 'RED';
            await sleep(1000);
        }
    }

    // Funciones Asincronas de "hilos" generadores
    async vehicleGenerator() {
        while (this.isRunning) {
            const delay = Math.random() * 2000 + 1000; // Entre 1 y 3 seg
            await sleep(delay);
            if (!this.isRunning) break;
            
            const dir = Math.random() > 0.5 ? 'UP' : 'RIGHT';
            this.vehicles.push(new Vehicle(dir));
            this.stats.v++;
            UI.statVehicles.textContent = this.stats.v;
        }
    }

    async pedestrianGenerator() {
        while (this.isRunning) {
            const delay = Math.random() * 5000 + 3000;
            await sleep(delay);
            if (!this.isRunning) break;
            
            this.pedestrians.push(new Pedestrian());
            this.stats.p++;
            UI.statPedestrians.textContent = this.stats.p;
        }
    }

    loop = () => {
        if (!this.isRunning) return;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        this.drawBackground();

        // Update & Draw Lights
        Object.values(this.lights).forEach(l => l.draw(ctx));

        // Update & Draw Actors
        this.vehicles = this.vehicles.filter(v => v.active);
        this.vehicles.forEach(v => {
            v.move(this.lights, this.vehicles);
            v.draw(ctx);
        });

        this.pedestrians = this.pedestrians.filter(p => p.active);
        this.pedestrians.forEach(p => {
            p.move(this.lights.ped);
            p.draw(ctx);
        });

        // Loop animation frame simulates physics thread
        requestAnimationFrame(this.loop);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        UI.startBtn.disabled = true;
        UI.stopBtn.disabled = false;

        // Iniciar "hilos" (promesas continuas)
        this.runTrafficLightCycle();
        this.vehicleGenerator();
        this.pedestrianGenerator();
        
        // Iniciar renderizado interactivo
        this.loop();
    }

    stop() {
        this.isRunning = false;
        UI.startBtn.disabled = false;
        UI.stopBtn.disabled = true;
    }
}

const sim = new Simulation();

UI.startBtn.addEventListener('click', () => sim.start());
UI.stopBtn.addEventListener('click', () => sim.stop());

// Initial Draw
sim.drawBackground();
Object.values(sim.lights).forEach(l => l.draw(ctx));
